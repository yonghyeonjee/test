"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "./Gtm";
import { toast } from "./Toast";

/**
 * 공유·저장 단추. 누르면 작은 판이 열리고 여섯 가지 중 고른다.
 *
 *  - 카카오톡: 카카오 공유 SDK(지도와 같은 JavaScript 키). 받는 사람 고르기에서 "나와의 채팅"을
 *    고르면 내 카카오톡에 저장된다. 키가 없거나 SDK 를 못 받으면 휴대폰 공유 시트로 대신한다.
 *  - 문자: sms: 링크. 아이폰은 "sms:&body=", 안드로이드는 "sms:?body=" 라서 갈라 쓴다.
 *  - 메모 앱에 저장: 제목·기관·마감·주소를 한 덩어리 글로 만들어 공유 시트에 넘긴다 —
 *    구글 킵·삼성 노트·애플 메모가 받는 쪽에 뜬다. 구글 킵은 외부에서 바로 적어 넣는 API 가
 *    없어서(2026-10 기준) 이 길이 유일하다. 공유 시트가 없는 PC 는 글을 복사해 둔다.
 *  - 링크 복사 / 이메일 / 다른 앱(OS 공유 시트).
 *
 * 2026-10-16 까지는 공유 시트 하나만 띄웠다. 카톡과 문자를 바로 누르고 싶다는 말에 판으로 바꿨다.
 */
declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share: { sendDefault: (o: Record<string, unknown>) => void };
    };
  }
}

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
const SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";

let kakaoLoading: Promise<Window["Kakao"] | null> | null = null;
function loadKakao(): Promise<Window["Kakao"] | null> {
  if (!KAKAO_KEY) return Promise.resolve(null);
  if (window.Kakao?.Share) {
    if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_KEY);
    return Promise.resolve(window.Kakao);
  }
  kakaoLoading ??= new Promise((res) => {
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.onload = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(KAKAO_KEY);
        res(window.Kakao?.Share ? window.Kakao : null);
      } catch { res(null); }
    };
    s.onerror = () => { kakaoLoading = null; res(null); };
    document.head.appendChild(s);
  });
  return kakaoLoading;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

export default function ShareButton({
  title, text, memo, className = "",
}: {
  title: string;
  /** 한 줄 설명(기관·지역 등). */
  text?: string;
  /** 메모 앱에 넣을 긴 글. 없으면 제목·설명·주소로 만든다. */
  memo?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const flash = (m: string) => toast(m);
  const url = () => window.location.href.split("#")[0];
  const line = () => [title, text].filter(Boolean).join(" · ");
  const memoText = () => memo ?? `${title}\n${text ?? ""}\n${url()}\n\n— K나라지원에서 저장`.replace(/\n\n+/g, "\n\n");
  const done = (how: string) => { track("share", { how }); setOpen(false); };

  const copy = async (s: string, msg: string) => {
    try { await navigator.clipboard.writeText(s); flash(msg); } catch { flash("복사하지 못했습니다. 주소창에서 직접 복사해 주세요."); }
  };
  const nativeShare = async (data: ShareData, fallback: () => Promise<void>) => {
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* 시트를 닫은 것 */ }
      return;
    }
    await fallback();
  };

  const kakao = async () => {
    const k = await loadKakao();
    const u = url();
    if (k) {
      try {
        k.Share.sendDefault({
          objectType: "text",
          text: line().slice(0, 190),
          link: { mobileWebUrl: u, webUrl: u },
          buttonTitle: "자세히 보기",
        });
        done("kakao");
        return;
      } catch { /* 아래 공유 시트로 */ }
    }
    await nativeShare({ title, text: line(), url: u }, () => copy(u, "카카오톡 공유를 쓸 수 없어 주소를 복사했습니다. 카톡 창에 붙여 넣으세요."));
    done("kakao-fallback");
  };
  const sms = () => {
    const body = encodeURIComponent(`${line()}\n${url()}`);
    window.location.href = isIOS() ? `sms:&body=${body}` : `sms:?body=${body}`;
    done("sms");
  };
  const toMemo = async () => {
    await nativeShare({ title, text: memoText() }, () => copy(memoText(), "메모 글을 복사했습니다. 구글 킵이나 메모 앱에 붙여 넣으세요."));
    done("memo");
  };
  const mail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(memoText())}`;
    done("mail");
  };
  const more = async () => {
    await nativeShare({ title, text: line(), url: url() }, () => copy(url(), "주소를 복사했습니다."));
    done("native");
  };

  const item = "flex flex-col items-center gap-1.5 rounded-[12px] px-1 py-2.5 text-[12px] font-semibold text-ink2 transition-colors hover:bg-ground";
  const ic = "flex h-10 w-10 items-center justify-center rounded-full";

  return (
    <div ref={box} className={`relative inline-block ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-line2 bg-surface px-3.5 py-2 text-[13.5px] font-semibold text-ink2 transition-colors hover:border-brand hover:text-brand">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        공유·저장
      </button>

      {open && (
        <>
        {/* 휴대폰: 화면 아래 시트. 판이 단추 왼쪽에 붙어 오른쪽이 잘렸다. 뒤를 눌러도 닫힌다. */}
        <button type="button" aria-label="닫기" onClick={() => setOpen(false)}
                className="fixed inset-0 z-30 bg-black/30 sm:hidden" />
        <div role="menu" aria-label="공유하거나 저장하기"
             className="fixed inset-x-3 bottom-3 z-40 rounded-card border border-line bg-white p-2 shadow-lift
                        sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[calc(100%+6px)] sm:z-30 sm:w-[20rem]">
          <div className="grid grid-cols-3">
            <button type="button" role="menuitem" onClick={kakao} className={item}>
              <span className={`${ic} bg-[#FEE500] text-[#191919]`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.8 5.2 4.6 6.6L5.5 21l4.4-2.9c.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8.1S17.5 3 12 3z" /></svg>
              </span>
              카카오톡
            </button>
            <button type="button" role="menuitem" onClick={sms} className={item}>
              <span className={`${ic} bg-[#E6FCF5] text-[#0B8A5F]`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5h16v11H9l-5 4z" /></svg>
              </span>
              문자
            </button>
            <button type="button" role="menuitem" onClick={toMemo} className={item}>
              <span className={`${ic} bg-[#FFF9DB] text-[#9A6B2F]`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 3h12v18H6z M9 8h6M9 12h6M9 16h3" /></svg>
              </span>
              메모 앱에 저장
            </button>
            <button type="button" role="menuitem" onClick={() => { void copy(url(), "주소를 복사했습니다."); done("copy"); }} className={item}>
              <span className={`${ic} bg-ground text-ink2`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1 M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>
              </span>
              링크 복사
            </button>
            <button type="button" role="menuitem" onClick={mail} className={item}>
              <span className={`${ic} bg-ground text-ink2`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18v12H3z M3 7l9 6 9-6" /></svg>
              </span>
              이메일
            </button>
            <button type="button" role="menuitem" onClick={more} className={item}>
              <span className={`${ic} bg-ground text-ink2`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12 M8 7l4-4 4 4 M4 14v6h16v-6" /></svg>
              </span>
              다른 앱
            </button>
          </div>
          <p className="mt-1 px-2 pb-1 text-[11.5px] leading-relaxed text-faint">
            카카오톡에서 <b className="font-semibold text-muted">나와의 채팅</b>을 고르면 내 카카오톡에 저장됩니다.
            메모 앱에 저장은 구글 킵·삼성 노트·애플 메모로 보냅니다.
          </p>
        </div>
        </>
      )}
    </div>
  );
}
