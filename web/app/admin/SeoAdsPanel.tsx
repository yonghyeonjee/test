"use client";

import { useState, useTransition } from "react";
import { AD_SLOTS, AD_SLOT_LABEL, type Ads, type AdSlotName, type Seo } from "@/lib/settings";
import { refreshCache, saveJsonSetting } from "./actions";

const input = "w-full rounded-ctl border border-line px-3 py-2 text-sm outline-none focus:border-brand";

function Save({ onSave }: { onSave: () => Promise<{ error: string | null }> }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        onClick={() => start(async () => {
          const r = await onSave();
          if (!r.error) await refreshCache();
          setMsg(r.error ?? "저장하고 캐시를 비웠습니다");
          setTimeout(() => setMsg(""), 3000);
        })}
        disabled={pending}
        className="btn btn-primary px-4 py-2 text-sm"
      >
        저장
      </button>
      {msg && <span className="text-xs text-brand">{msg}</span>}
    </div>
  );
}

/** 검색엔진 확인 토큰과 기본 설명. 코드를 고치지 않고 관리자에서 바꾼다. */
export function SeoPanel({ initial }: { initial: Seo }) {
  const [v, setV] = useState<Seo>(initial);
  const f = (k: keyof Seo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <section className="card mt-6 p-5">
      <h2 className="text-sm font-bold">검색엔진 (SEO)</h2>
      <p className="mt-1 text-xs text-faint">
        확인 토큰은 &lt;meta name=&quot;…-site-verification&quot;&gt; 로 모든 화면 head 에 나갑니다. 값만 넣으세요.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {([["naver", "네이버 서치어드바이저"], ["google", "구글 서치콘솔"], ["bing", "빙 웹마스터"], ["daum", "다음 웹마스터도구 (robots.txt 에 들어갑니다)"]] as const).map(([k, label]) => (
          <div key={k}>
            <label className="block text-xs font-bold text-muted">{label}</label>
            <input value={v[k]} onChange={f(k)} className={`${input} mt-1.5 font-mono text-xs`} placeholder="content 값" />
          </div>
        ))}
        <div className="sm:col-span-3">
          <label className="block text-xs font-bold text-muted">기본 설명 (description)</label>
          <p className="text-xs text-faint">비우면 코드의 기본 문장을 씁니다. 검색 결과에 그대로 보입니다. 120자 안팎.</p>
          <textarea value={v.description} onChange={f("description")} rows={2} className={`${input} mt-1.5`} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-muted">기본 키워드</label>
          <p className="text-xs text-faint">쉼표로 나눕니다. 비우면 코드의 기본값.</p>
          <input value={v.keywords} onChange={f("keywords")} className={`${input} mt-1.5`} placeholder="정부지원금, 복지 혜택, …" />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={v.index} onChange={(e) => setV({ ...v, index: e.target.checked })} />
          검색엔진 색인 허용
        </label>
      </div>
      <Save onSave={() => saveJsonSetting("seo", v)} />
    </section>
  );
}

function SlotEditor({ name, cfg, onChange }: {
  name: AdSlotName; cfg: Ads[AdSlotName]; onChange: (c: Ads[AdSlotName]) => void;
}) {
  return (
    <div className="rounded-card border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={cfg.on} onChange={(e) => onChange({ ...cfg, on: e.target.checked })} />
          {AD_SLOT_LABEL[name]}
        </label>
        <select value={cfg.kind} onChange={(e) => onChange({ ...cfg, kind: e.target.value as "html" | "image" })}
                className="rounded-ctl border border-line px-2 py-1 text-xs">
          <option value="html">HTML / 스크립트 (애드센스 등)</option>
          <option value="image">이미지 배너 + 링크</option>
        </select>
      </div>
      {cfg.kind === "html" ? (
        <textarea value={cfg.html} onChange={(e) => onChange({ ...cfg, html: e.target.value })} rows={4}
                  className={`${input} mt-3 font-mono text-xs`} placeholder="<ins class=&quot;adsbygoogle&quot; …></ins><script>…</script>" />
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input value={cfg.img} onChange={(e) => onChange({ ...cfg, img: e.target.value })} className={input} placeholder="이미지 주소 (https://…)" />
          <input value={cfg.href} onChange={(e) => onChange({ ...cfg, href: e.target.value })} className={input} placeholder="눌렀을 때 갈 주소" />
          <input value={cfg.alt} onChange={(e) => onChange({ ...cfg, alt: e.target.value })} className={input} placeholder="대체 글 (무슨 광고인지)" />
        </div>
      )}
    </div>
  );
}

/** 광고 지면 넷. 자리는 코드가 정하고, 켜고 끄기와 내용은 여기서. */
export function AdsPanel({ initial, initialOn }: { initial: Ads; initialOn: boolean }) {
  const [v, setV] = useState<Ads>(initial);
  const [on, setOn] = useState(initialOn);
  return (
    <section className="card mt-6 p-5">
      <h2 className="text-sm font-bold">광고 지면</h2>

      {/* 급히 내려야 할 때 배포를 기다리지 않게. 여기가 제일 위다. */}
      <div className="mt-3 rounded-ctl border border-line bg-ground px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={on}
                 onChange={(e) => { setOn(e.target.checked); void saveJsonSetting("ads_on", e.target.checked); }} />
          광고 내보내기
        </label>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          {on
            ? "아래에서 켜 둔 지면이 화면에 나갑니다. 끄면 지면이 통째로 사라지고 빈 상자도 남지 않습니다 — 본문 중간 자리에는 우리 사이트 배너가 대신 들어갑니다. 이 체크는 누르는 즉시 저장됩니다."
            : "지금 광고를 내려 둔 상태입니다. 아래에서 켜 두어도 화면에는 나오지 않습니다. 이 체크를 켜면 바로 나갑니다."}
        </p>
      </div>

      <div className="mt-3 rounded-ctl border border-line bg-surface px-4 py-3">
        <p className="text-xs font-bold text-ink2">자동광고는 여기서 끄는 것이 아닙니다</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          화면 아래 고정 띠처럼 우리가 자리를 정하지 않은 광고는 애드센스 계정 설정에서 나옵니다.
          이 사이트는 로더 주소에서 client 인자를 떼어 자동광고를 달라고 하지 않지만, 계정 쪽이
          켜져 있으면 나올 수 있습니다. 애드센스 → 광고 → 사이트별 → knowhow-it.com 에서
          jiwon.knowhow-it.com 을 페이지 제외로 넣어 두면 1차 도메인은 자동광고를 그대로 쓰면서
          이 사이트만 수동 지면으로 갑니다.
        </p>
      </div>
      <p className="mt-4 text-xs text-faint">
        본문이 끝난 자리에만 나옵니다. 첫 화면과 목록 사이에는 두지 않습니다. 끄면 자리 자체가 사라집니다.
        높이는 200px 안쪽으로 잡히고 &quot;광고&quot; 표시가 붙습니다. 상세 화면 맨 아래 지면만 높이를 막지 않아 멀티플렉스를 넣을 수 있습니다.
      </p>
      <div className="mt-4 grid gap-3">
        {AD_SLOTS.map((n) => (
          <SlotEditor key={n} name={n} cfg={v[n]} onChange={(c) => setV({ ...v, [n]: c })} />
        ))}
      </div>
      <Save onSave={() => saveJsonSetting("ads", v)} />
    </section>
  );
}
