import Link from "next/link";
import { dot, type AlioItem } from "@/lib/alioplus";
import CalendarAdd from "./CalendarAdd";
import { agencyEvents } from "@/lib/calEvents";

export type Facet = { name: string; label: string; options: { code: string; label: string }[] };

function href(base: string, cur: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * 알리오 플러스 자료 목록. 사업·행사·시설이 같은 틀을 쓴다.
 *
 * 거르기는 API 가 받는 조건을 그대로 링크로 만든다. 서버가 걸러 주므로
 * 화면은 받은 것을 보여 주기만 한다. 검색어는 GET 폼이라 스크립트가 없어도 된다.
 */
/** 한 쪽에 보이는 카드 수. 시설은 천 건이 넘어 한 쪽에 다 그리면 휴대폰에서 25만 픽셀이었다(2026-10-17). */
const PER_PAGE = 24;

export default function AgencyList({
  base, items, ok, reason, facets, current, qName, empty, external, page = 1,
}: {
  base: string;
  items: AlioItem[];
  ok: boolean;
  reason: string | null;
  facets: Facet[];
  current: Record<string, string | undefined>;
  /** 검색어 파라미터 이름. 없으면 검색창을 그리지 않는다. */
  qName?: string;
  empty: string;
  /** 자료를 못 받았을 때 대신 보낼 곳. */
  external: { href: string; label: string };
  /** 몇째 쪽인지(?page=). 거르기 조건을 바꾸면 첫 쪽으로 돌아간다(current 에 page 를 넣지 않는다). */
  page?: number;
}) {
  const active = Object.values(current).some(Boolean);
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const cur = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const shown = items.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  return (
    <div className="mt-6">
      {qName && (
        <form action={base} method="get" className="flex gap-2">
          {Object.entries(current)
            .filter(([k, v]) => k !== qName && v)
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name={qName} defaultValue={current[qName] ?? ""}
                 placeholder="기관명·이름·소개로 찾기" className="field min-w-0 flex-1"
                 aria-label="검색어" />
          <button type="submit" className="btn btn-primary shrink-0 px-5 py-2.5">찾기</button>
        </form>
      )}

      {facets.map((f) => (
        <div key={f.name} className="mt-4">
          <span className="mr-2 text-xs font-bold text-muted">{f.label}</span>
          <span className="inline-flex flex-wrap gap-1.5 align-middle">
            {f.options.map((o) => {
              const on = current[f.name] === o.code;
              return (
                <Link key={o.code}
                      href={href(base, current, { [f.name]: on ? undefined : o.code })}
                      className={`chip !py-1.5 !text-[13px] ${on ? "chip-on" : ""}`}>
                  {o.label}
                </Link>
              );
            })}
          </span>
        </div>
      ))}

      {!ok ? (
        <div className="card mt-6 p-8 text-center">
          <p className="leading-relaxed text-muted">
            지금은 자료를 불러오지 못했습니다.
            {reason?.includes("인증키") ? (
              <>
                <br />
                알리오 플러스 인증키가 아직 연결되지 않았습니다.
              </>
            ) : (
              <>
                <br />
                잠시 뒤 다시 들어오시면 보입니다.
              </>
            )}
          </p>
          <a href={external.href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-5">
            {external.label}
          </a>
        </div>
      ) : (
        <>
          <div className="mb-3 mt-8 flex items-baseline justify-between">
            <h2 className="text-[1.0625rem] font-bold">{active ? "조건에 맞는 것" : "전체"}</h2>
            <span className="num text-sm text-muted">{items.length}건</span>
          </div>
          {items.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="leading-relaxed text-muted">{empty}</p>
              <Link href={base} className="btn btn-ghost mt-5">조건 지우기</Link>
            </div>
          ) : (
            <>
              <ul className="grid gap-3 sm:grid-cols-2">
                {shown.map((it) => <AgencyCard key={it.id} it={it} />)}
              </ul>
              {pages > 1 && (
                <nav aria-label="쪽 넘기기" className="mt-6 flex items-center justify-center gap-2 text-sm">
                  {cur > 1 ? (
                    <Link href={href(base, current, { page: cur > 2 ? String(cur - 1) : undefined })} rel="prev" className="btn btn-ghost px-4 py-2">‹ 이전</Link>
                  ) : <span className="btn btn-ghost pointer-events-none px-4 py-2 opacity-40">‹ 이전</span>}
                  <span className="num px-2 text-muted">{cur} / {pages}</span>
                  {cur < pages ? (
                    <Link href={href(base, current, { page: String(cur + 1) })} rel="next" className="btn btn-ghost px-4 py-2">다음 ›</Link>
                  ) : <span className="btn btn-ghost pointer-events-none px-4 py-2 opacity-40">다음 ›</span>}
                </nav>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** 오늘(KST) 기준 행사 상태. 날짜가 없으면 null. */
function phase(it: AlioItem): { label: string; cls: string } | null {
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  if (!it.start && !it.end) return null;
  if (it.end && it.end < today) return { label: "끝남", cls: "badge-closed" };
  if (it.start && it.start > today) return { label: "예정", cls: "badge-soon" };
  return { label: "진행 중", cls: "badge-open" };
}

/** "행사 > 문화/예술 > 연극/공연" → "연극/공연". 맨 앞의 큰 갈래 이름(행사·시설·사업)은 뺀다. */
function lastCate(cate: string | null): string | null {
  if (!cate) return null;
  const parts = cate.split(">").map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

/**
 * 기관이 붙여 넣은 긴 설명("1. … ㅇ 공연내용: … ㅇ 운영장소: … - 3~4월: …")을 줄로 나눈다.
 * 한 덩어리로 보이면 읽을 수가 없었다(2026-10-17 휴대폰 화면). 번호·ㅇ·○·•·- 표시 앞에서 끊는다.
 */
function descLines(desc: string): string[] {
  return desc
    .replace(/\s+/g, " ")
    .split(/\s(?=(?:\d{1,2}\.\s)|(?:[ㅇ○◦•▶■□※]\s?)|(?:-\s)|(?:\*\s))/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * 한 건. 공공 공유 누리집들(시흥 공유누리 등)처럼 위에는 상태·요금, 가운데는 장소·기간·대상, 아래에는 갈 곳 단추.
 * 2026-10-17: 설명 전체가 카드에 그대로 펼쳐져(줄임이 block 에 덮여 안 먹었다) 휴대폰에서 한 건이 한 화면을 넘었고,
 * 원문 주소가 있는 것이 행사 22건 중 6건, 시설 1,114건 중 136건뿐이라 대부분 눌러도 갈 데가 없었다.
 * 그래서 설명은 접어 두고, 원문이 없으면 지도(주소)와 검색으로라도 잇는다.
 */
function AgencyCard({ it }: { it: AlioItem }) {
  const st = phase(it);
  const fee = it.tags.find((t) => t === "무료" || t === "유료");
  const avail = it.tags.find((t) => t === "신청 가능" || t === "예약 가능");
  const rest = it.tags.filter((t) => t !== fee && t !== avail);
  const cate = lastCate(it.cate);
  const lines = it.desc ? descLines(it.desc) : [];
  const events = agencyEvents(it);
  const q = encodeURIComponent([it.org, it.title].filter(Boolean).join(" "));
  const actions: { href: string; label: string; primary?: boolean }[] = [];
  if (it.url) actions.push({ href: it.url.replace(/^(https?:\/\/)\s+/, "$1"), label: avail === "예약 가능" ? "예약·원문" : avail ? "신청·원문" : "원문 보기", primary: true });
  if (it.address) actions.push({ href: `https://map.kakao.com/link/search/${encodeURIComponent(it.address)}`, label: "지도" });
  if (!it.url) actions.push({ href: `https://search.naver.com/search.naver?query=${q}`, label: "검색해 보기" });

  return (
    <li className="card flex flex-col overflow-hidden p-0">
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {avail && <span className="badge badge-open">{avail}</span>}
          {st && st.label !== "진행 중" && <span className={`badge ${st.cls}`}>{st.label}</span>}
          {fee && <span className={`badge ${fee === "무료" ? "badge-new" : "badge-quiet"}`}>{fee}</span>}
          {cate && <span className="badge badge-quiet">{cate}</span>}
          {rest.slice(0, 2).map((t) => <span key={t} className="badge badge-quiet">{t}</span>)}
        </div>
        <b className="mt-2.5 line-clamp-2 text-[15.5px] font-bold leading-snug">{it.title}</b>
        <dl className="mt-2.5 grid grid-cols-[3.2em_1fr] gap-x-2 gap-y-1 text-[13px] leading-snug">
          {it.address && (<><dt className="text-faint">장소</dt><dd className="truncate text-ink2">{it.address}</dd></>)}
          {it.org && (<><dt className="text-faint">기관</dt><dd className="truncate text-ink2">{it.org}</dd></>)}
          {(it.start || it.end) && (
            <><dt className="text-faint">기간</dt><dd className="num text-ink2">{dot(it.start) ?? "—"} ~ {dot(it.end) ?? "—"}</dd></>
          )}
          {it.target && (<><dt className="text-faint">대상</dt><dd className="line-clamp-1 text-ink2">{it.target}</dd></>)}
        </dl>
        {lines.length > 0 && (
          <details className="group mt-3">
            <summary className="cursor-pointer list-none text-[13px] font-semibold text-brand">
              <span className="group-open:hidden">자세히 보기 ▾</span>
              <span className="hidden group-open:inline">접기 ▴</span>
            </summary>
            <ul className="mt-2 space-y-1 text-[13.5px] leading-relaxed text-ink2">
              {lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </details>
        )}
      </div>
      <div className="flex border-t border-line">
        {actions.map((a, i) => (
          <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer"
             className={`flex-1 py-3 text-center text-[13.5px] font-semibold transition-colors hover:bg-ground
                         ${i > 0 ? "border-l border-line" : ""} ${a.primary ? "text-brand" : "text-ink2"}`}>
            {a.label} <span aria-hidden>↗</span>
          </a>
        ))}
      </div>
      {/* 캘린더 단추는 카드 아래에. 링크 안에 단추를 넣으면 눌림이 겹친다. */}
      {events.length > 0 && (
        <div className="flex justify-end border-t border-line px-3 py-2">
          <CalendarAdd size="sm" events={events} file={it.title} />
        </div>
      )}
    </li>
  );
}
