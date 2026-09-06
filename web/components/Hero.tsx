import Link from "next/link";
import SearchBox from "./SearchBox";

/** 대상자 중심 입구. "무엇을 지원하나"가 아니라 "누가 받나"로 묻는다. */
const TILES = [
  { href: "/?age=28&via=chip",  label: "청년",   desc: "월세 · 학자금 · 취업",
    d: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z M12 12v9 M12 12L4 7.5 M12 12l8-4.5" },
  { href: "/?age=70&via=chip",  label: "어르신", desc: "돌봄 · 의료 · 수당",
    d: "M12 7a3 3 0 100-6 3 3 0 000 6z M5 21v-2a4 4 0 014-4h6a4 4 0 014 4v2" },
  { href: "/?hh=%EC%A0%80%EC%86%8C%EB%93%9D&via=chip", label: "저소득",
    desc: "생계 · 주거 · 의료",
    d: "M3 21h18 M6 21V9l6-5 6 5v12 M10 21v-6h4v6" },
  { href: "/?tab=business", label: "사업자", desc: "자금 · 판로 · 인력",
    d: "M3 8h18v12H3z M8 8V5a2 2 0 012-2h4a2 2 0 012 2v3 M3 13h18" },
];

export default function Hero({
  index, count, closing,
}: {
  index: Record<string, { sido: string; full: string }>;
  count: number;
  closing: number;
}) {
  return (
    <>
      <section className="hero -mx-5 px-6 pb-24 pt-12 text-white sm:mx-0 sm:rounded-card sm:px-9">
        <p className="text-[11px] font-bold tracking-[.3em] text-[#8FCFB0]">
          공공데이터 기반 · 정부 공식 서비스 아님
        </p>

        <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.18] tracking-[-.025em] sm:text-[2.35rem]">
          받을 수 있는데
          <br />
          모르고 지나친 지원금
        </h1>

        <p className="mt-4 max-w-[26rem] text-[15px] leading-relaxed text-[#A9CFBC]">
          사는 곳과 나이만 넣으면 됩니다. 회원가입도, 주민등록번호도, 소득 자료도
          필요 없습니다.
        </p>

        <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
          <div>
            <b className="num block text-2xl font-extrabold">
              {count.toLocaleString()}
            </b>
            <small className="text-xs text-[#A9CFBC]">찾을 수 있는 지원사업</small>
          </div>
          {closing > 0 && (
            <div>
              <b className="num block text-2xl font-extrabold text-[#F0C98A]">
                {closing.toLocaleString()}
              </b>
              <small className="text-xs text-[#A9CFBC]">2주 안에 마감</small>
            </div>
          )}
          <div>
            <b className="block text-2xl font-extrabold">매일</b>
            <small className="text-xs text-[#A9CFBC]">새 공고 수집</small>
          </div>
        </div>
      </section>

      <div className="-mt-16 px-0.5">
        <div className="card p-4 sm:p-5">
          <SearchBox index={index} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TILES.map((t) => (
            <Link key={t.label} href={t.href} className="tile">
              <span className="tile-ic">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"
                     stroke="currentColor" strokeWidth="1.9"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.d} />
                </svg>
              </span>
              <b className="text-[15px] tracking-[-.01em]">{t.label}</b>
              <small className="text-[12.5px] leading-snug text-muted">
                {t.desc}
              </small>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
