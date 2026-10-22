/**
 * 관리자 유입 그래프(2026-10-22). 일별(90일)·주별(26주)·월별(12개월)을 채널별로 쌓은 막대. 서버에서 그린다.
 * 자료는 admin_visit_series(DB 집계, 한국 날짜) — 표본이 아니라 전부를 센다.
 */
export type VisitPoint = { d: string; channel: string; n: number };

const COLORS: Record<string, string> = {
  "직접 유입": "#9AA3AF", "네이버": "#03C75A", "다음·카카오": "#4A6CF7", "구글": "#EA4335", "빙": "#0C8484",
  "chatgpt.com": "#10A37F",
};
const color = (c: string) => COLORS[c] ?? "#C9A227";
const CHANNELS = ["네이버", "다음·카카오", "구글", "빙", "chatgpt.com", "직접 유입"];

type Bucket = { key: string; label: string; total: number; by: Map<string, number> };

/** 한국 날짜 "YYYY-MM-DD". */
const kst = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(t));

function bucketsOf(points: VisitPoint[], unit: "day" | "week" | "month", count: number): Bucket[] {
  const keyOf = (d: string) => {
    if (unit === "day") return d;
    if (unit === "month") return d.slice(0, 7);
    // 주: 월요일 날짜로 묶는다.
    const t = new Date(`${d}T00:00:00+09:00`);
    const dow = (t.getUTCDay() + 6) % 7; // 월=0
    return kst(t.getTime() - dow * 86400_000);
  };
  const labelOf = (k: string) => (unit === "month" ? `${Number(k.slice(5, 7))}월` : k.slice(5).replace("-", "."));
  // 빈 구간도 0 으로. 끝은 오늘.
  const keys: string[] = [];
  const today = Date.now();
  if (unit === "month") {
    const y = Number(kst(today).slice(0, 4)), m = Number(kst(today).slice(5, 7));
    for (let i = count - 1; i >= 0; i--) { const mm = m - i; const yy = y + Math.floor((mm - 1) / 12); const m2 = ((mm - 1) % 12 + 12) % 12 + 1; keys.push(`${yy}-${String(m2).padStart(2, "0")}`); }
  } else {
    const step = unit === "day" ? 1 : 7;
    const last = keyOf(kst(today));
    const lastT = new Date(`${last}T00:00:00+09:00`).getTime();
    for (let i = count - 1; i >= 0; i--) keys.push(kst(lastT - i * step * 86400_000));
  }
  const m = new Map<string, Bucket>(keys.map((k) => [k, { key: k, label: labelOf(k), total: 0, by: new Map() }]));
  for (const p of points) {
    const b = m.get(keyOf(p.d));
    if (!b) continue;
    b.total += p.n;
    b.by.set(p.channel, (b.by.get(p.channel) ?? 0) + p.n);
  }
  return [...m.values()];
}

function Bars({ buckets, labelEvery }: { buckets: Bucket[]; labelEvery: number }) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const order = (b: Bucket) => [...CHANNELS.filter((c) => b.by.has(c)), ...[...b.by.keys()].filter((c) => !CHANNELS.includes(c))];
  return (
    <div>
      <div className="flex h-32 items-end gap-[2px]">
        {buckets.map((b) => (
          <div key={b.key} className="group relative flex h-full flex-1 flex-col justify-end">
            {order(b).map((c) => (
              <div key={c} style={{ height: `${((b.by.get(c) ?? 0) / max) * 100}%`, background: color(c) }}
                   className="w-full first:rounded-t-[2px]" />
            ))}
            {b.total === 0 && <div className="h-[2px] w-full bg-line" />}
            <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block">
              {b.label} · {b.total.toLocaleString("ko-KR")}{order(b).length ? " (" + order(b).map((c) => `${c} ${b.by.get(c)}`).join(", ") + ")" : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-faint">
        {buckets.map((b, i) => (
          <span key={b.key} className="flex-1 truncate text-center">{i % labelEvery === 0 || i === buckets.length - 1 ? b.label : ""}</span>
        ))}
      </div>
    </div>
  );
}

export default function VisitChart({ points }: { points: VisitPoint[] }) {
  const day = bucketsOf(points, "day", 90);
  const week = bucketsOf(points, "week", 26);
  const month = bucketsOf(points, "month", 12);
  const sum = (bs: Bucket[]) => bs.reduce((a, b) => a + b.total, 0);
  const used = new Set(points.map((p) => p.channel));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {[...CHANNELS.filter((c) => used.has(c)), ...[...used].filter((c) => !CHANNELS.includes(c))].map((c) => (
          <span key={c} className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color(c) }} />{c}</span>
        ))}
      </div>
      <section>
        <p className="mb-2 text-xs font-bold text-muted">일별 · 최근 90일 · {sum(day).toLocaleString("ko-KR")}명</p>
        <Bars buckets={day} labelEvery={10} />
      </section>
      <section>
        <p className="mb-2 text-xs font-bold text-muted">주별 · 최근 26주(월요일 시작) · {sum(week).toLocaleString("ko-KR")}명</p>
        <Bars buckets={week} labelEvery={4} />
      </section>
      <section>
        <p className="mb-2 text-xs font-bold text-muted">월별 · 최근 12개월 · {sum(month).toLocaleString("ko-KR")}명</p>
        <Bars buckets={month} labelEvery={1} />
      </section>
    </div>
  );
}
