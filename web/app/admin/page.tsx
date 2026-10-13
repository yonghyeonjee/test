import { createClient } from "@supabase/supabase-js";
import { configured, isLoggedIn } from "@/lib/auth";
import LoginForm from "./LoginForm";
import SavedPanel, { type Account, type SavedCond } from "./SavedPanel";
import SettingsPanel from "./SettingsPanel";
import { AdsPanel, SeoPanel } from "./SeoAdsPanel";
import CollectPanel, { type SourceStat } from "./CollectPanel";
import { COLLECT_KEYS, type CollectKey } from "@/lib/collectorMeta";
import { readLastRuns } from "@/lib/jobsIngest";
import { checkSchema, EXPECTED_FUNCTIONS, EXPECTED_RELATIONS } from "@/lib/schemaHealth";
import { parseAds, parseAdsOn, parseSeo } from "@/lib/settings";

export const dynamic = "force-dynamic";
// 수집 서버 액션이 공공 API 를 여러 쪽 읽는다. 기본 10초로는 모자란다.
export const maxDuration = 60;
export const metadata = { robots: { index: false, follow: false } };

function svc() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return key
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
        auth: { persistSession: false },
      })
    : null;
}

type Row = Record<string, unknown>;

const JUMPS: [string, string][] = [
  ["#a-health", "점검"], ["#a-visit", "유입"], ["#a-saved", "저장 조건"], ["#a-search", "검색"],
  ["#a-collect", "수집"], ["#a-seo", "SEO"], ["#a-ads", "광고"], ["#a-settings", "설정"],
];

function Panel({ title, note, children, id }: {
  title: string; note?: string; children: React.ReactNode; id?: string;
}) {
  return (
    <section id={id} className="card mt-4 scroll-mt-14 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-sm font-bold">{title}</h2>
        {note && <span className="text-xs text-faint">{note}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** 기록에 남은 주소는 %EC%84%9C 꼴이라 읽을 수 없다. 한글로 풀고, 못 풀면 그대로. */
function pretty(v: string) {
  try { return /%[0-9A-Fa-f]{2}/.test(v) ? decodeURIComponent(v) : v; } catch { return v; }
}

function Rank({ rows, keyName }: { rows: Row[]; keyName: string }) {
  if (!rows.length)
    return <p className="text-sm text-muted">아직 기록이 없습니다.</p>;
  const max = Math.max(...rows.map((r) => Number(r.n)), 1);
  return (
    <ul className="space-y-0.5">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center px-1 py-1.5 text-sm">
          <span className="num w-5 shrink-0 text-xs text-faint">{i + 1}</span>
          <span className="min-w-0 flex-1 break-all sm:flex-none sm:truncate">{pretty(String(r[keyName] ?? "(없음)"))}</span>
          <span className="ml-3 hidden h-1.5 flex-1 rounded-pill bg-line sm:block">
            <span className="block h-full rounded-pill bg-brand2/50"
                  style={{ width: `${(Number(r.n) / max) * 100}%` }} />
          </span>
          <span className="num ml-3 w-10 shrink-0 text-right text-xs text-muted">
            {Number(r.n).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function Admin() {
  if (!configured())
    return (
      <div className="card p-6">
        <h1 className="font-bold">관리자 계정이 설정되지 않았습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Vercel → Settings → Environment Variables 에 아래 세 개를 넣고
          다시 배포하세요. 코드에는 두지 않습니다.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-ctl bg-surface2 p-4 text-xs">
{`ADMIN_USER            관리자 아이디
ADMIN_PASSWORD        관리자 비밀번호 (충분히 길게)
ADMIN_SECRET          아무 긴 무작위 문자열
SUPABASE_SERVICE_KEY  Supabase service_role 키`}
        </pre>
      </div>
    );

  if (!isLoggedIn()) return <LoginForm />;

  const db = svc();
  if (!db)
    return <p className="card p-6 text-sm">SUPABASE_SERVICE_KEY 가 없습니다.</p>;

  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const since7Iso = new Date(Date.now() - 7 * 86400_000).toISOString();
  // 서울 기준 오늘 0시. 서버가 어디 있든 하루 경계가 같아야 한다.
  const nowKst = new Date(Date.now() + 9 * 3600_000);
  const todayStart = new Date(
    Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()) - 9 * 3600_000,
  ).toISOString();

  /**
   * 한 줄도 받아 오지 않고 세기만 한다.
   *
   * 예전에는 30일치를 통째로 받아 배열 길이로 셌다. PostgREST 가 한 번에
   * 주는 줄 수는 1,000줄이 상한이라 실제로 1,568건인 날에도 화면에는
   * 딱 1,000 이 찍혔다. 상한이 값인 척하고 있었다.
   */
  const num = async (q: PromiseLike<{ count: number | null }>) => {
    try {
      return (await q).count ?? 0;
    } catch {
      return 0;
    }
  };
  const head = (table: string) => db.from(table).select("*", { count: "exact", head: true });

  // 줄을 받아 오는 것은 순위와 그래프용 표본이다. 최근 것부터 받는다 —
  // 정렬 없이 1,000줄을 자르면 어느 1,000줄인지 아무도 모른다.
  const SAMPLE = 1000;
  const [logs, settings, cov, saved, accounts, visits] = await Promise.all([
    db.from("search_log").select("*").gte("at", since).order("at", { ascending: false }).limit(SAMPLE),
    db.from("site_settings").select("key,value"),
    db.from("coverage").select("*"),
    db
      .from("saved_condition")
      .select("id,device_key,kind,label,query,created_at,open_count")
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("save_account")
      .select("device_key,display_name,phone_tail,email,notify_consent")
      .limit(1000),
    db.from("visit_log").select("*").gte("at", since).order("at", { ascending: false }).limit(SAMPLE),
  ]);

  // 건수 7개와 수집 대상 8개의 집계는 DB 함수 하나씩으로 묶어 한 번에 받는다(sql/010).
  // 전에는 질의 31개를 다섯 차례로 나눠 보내 왕복만 1초가 넘었고, "마지막 수집 시각"은
  // 24만 건을 통째로 훑어 질의 하나에 300ms 가 걸렸다(fetched_at 색인도 같이 만들었다).
  const [countsR, sourcesR, lastRuns, health] = await Promise.all([
    db.rpc("admin_counts", { p_since: since, p_today: todayStart, p_since7: since7Iso }),
    db.rpc("admin_source_stats"),
    readLastRuns(),
    checkSchema(db as never),
  ]);
  const cnt = (countsR.data ?? {}) as Record<string, number | null>;
  const n0 = (k: string) => Number(cnt[k] ?? 0);
  let [nSearch30, nSearchToday, nZero30, nSaved, nVisit30, nVisitToday, nVisit7] =
    [n0("search30"), n0("search_today"), n0("zero30"), n0("saved"), n0("visit30"), n0("visit_today"), n0("visit7")];
  if (countsR.error) {
    // 함수가 없으면(마이그레이션 전) 예전처럼 하나씩 센다. 느리지만 틀리지는 않는다.
    [nSearch30, nSearchToday, nZero30, nSaved, nVisit30, nVisitToday, nVisit7] = await Promise.all([
      num(head("search_log").gte("at", since)), num(head("search_log").gte("at", todayStart)),
      num(head("search_log").gte("at", since).eq("n_results", 0)), num(head("saved_condition")),
      num(head("visit_log").gte("at", since)), num(head("visit_log").gte("at", todayStart)), num(head("visit_log").gte("at", since7Iso)),
    ]);
  }
  // 수집 대상마다 건수·최신·마지막 수집 시각. 함수가 없으면 0 으로 보인다.
  const srcRows = (Array.isArray(sourcesR.data) ? sourcesR.data : []) as { key: string; n: number; newest: string | null; fetched: string | null }[];
  const jobStats: SourceStat[] = COLLECT_KEYS.map((key) => {
    const r = srcRows.find((x) => x.key === key);
    return { key, n: Number(r?.n ?? 0), newest: r?.newest ?? null, fetched: r?.fetched ?? null };
  });
  const broken = health.rows.filter((r) => r.problem);

  const visitRows = (visits.data ?? []) as Row[];

  /** 값별로 세어 많은 순으로. 빈 값은 세지 않는다. */
  const tally = (rows: Row[], key: string, top = 10) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = r[key];
      if (v === null || v === undefined || v === "") continue;
      m.set(String(v), (m.get(String(v)) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([label, n]) => ({ label, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, top);
  };

  const terms = tally(visitRows, "term", 20);
  const landings = tally(visitRows, "landing", 10);
  /**
   * 채널별로 무엇을 찾아 들어왔나. 검색어를 넘겨주는 곳(다음·카카오)은 검색어를, 지우고 보내는 곳
   * (구글·네이버·직접)은 처음 열린 페이지를 — 어느 쪽이든 "그 채널 사람들이 무엇을 보러 왔나" 가 보인다.
   */
  const byChannel = (() => {
    const m = new Map<string, Row[]>();
    for (const r of visitRows) {
      const c = r.channel ? String(r.channel) : "(없음)";
      (m.get(c) ?? m.set(c, []).get(c)!).push(r);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 6)
      .map(([channel, rows]) => ({ channel, n: rows.length, terms: tally(rows, "term", 8), landings: tally(rows, "landing", 6) }));
  })();

  /** 서울 기준 날짜. 서버가 어디 있든 하루 경계가 같아야 한다. */
  const kst = (v: unknown) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(String(v)));
  const todayK = kst(new Date());
  const visitsToday = visitRows.filter((r) => kst(r.at) === todayK).length;
  const since7 = Date.now() - 7 * 86400_000;
  const visits7 = visitRows.filter((r) => new Date(String(r.at)).getTime() >= since7).length;
  // 최근 30일 일별. 없는 날도 0으로 채워 막대가 빠지지 않게.
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) byDay.set(kst(new Date(Date.now() - i * 86400_000)), 0);
  for (const r of visitRows) { const d = kst(r.at); if (byDay.has(d)) byDay.set(d, (byDay.get(d) ?? 0) + 1); }
  const daily = [...byDay.entries()].map(([d, n]) => ({ d, n }));
  const dailyMax = Math.max(1, ...daily.map((x) => x.n));
  const campaigns = tally(
    visitRows.filter((r) => r.utm_campaign),
    "utm_campaign"
  );

  const savedRows = (saved.data ?? []) as SavedCond[];
  const accountRows = (accounts.data ?? []) as Account[];

  const rows = (logs.data ?? []) as Row[];
  const count = <K extends string>(k: K) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = r[k];
      const list = Array.isArray(v) ? v : [v];
      for (const x of list) {
        if (x === null || x === undefined) continue;
        m.set(String(x), (m.get(String(x)) ?? 0) + 1);
      }
    }
    return [...m.entries()]
      .map(([label, n]) => ({ label, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  };

  const zero = rows.filter((r) => Number(r.n_results) === 0);
  const zeroBy = new Map<string, number>();
  for (const r of zero) {
    const k = [r.sido, r.sigungu, r.age_band, r.employment]
      .filter(Boolean).join(" ") || "(조건 없음)";
    zeroBy.set(k, (zeroBy.get(k) ?? 0) + 1);
  }
  const zeroRows = [...zeroBy.entries()]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  const st = new Map((settings.data ?? []).map((d) => [d.key as string, d.value]));

  return (
    <div>
      {/* 바로가기. 한 쪽에 전부 있어 휴대폰에서는 한참 내려야 한다. 위에 붙여 둔다. */}
      <nav aria-label="관리자 바로가기"
           className="sticky top-0 z-20 -mx-5 mb-2 flex gap-1 overflow-x-auto border-b border-line bg-white/95 px-5 py-2 text-[13px] backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:px-3">
        {JUMPS.map(([h, t]) => (
          <a key={h} href={h} className="shrink-0 rounded-pill px-3 py-1 font-semibold text-ink2 hover:bg-brandSoft hover:text-brand">{t}</a>
        ))}
      </nav>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-extrabold">관리자</h1>
        <form action={async () => { "use server";
          const { logout } = await import("./actions"); await logout(); }}>
          <button className="text-xs text-muted hover:text-brand">로그아웃</button>
        </form>
      </div>

      {/* 스키마 점검. 멀쩡하면 한 줄, 문제가 있으면 무엇이 문제인지 펼친다. */}
      <div id="a-health" className={`mt-4 scroll-mt-14 rounded-card border p-4 ${
        health.error || broken.length
          ? "border-red-300 bg-red-50"
          : "border-line bg-ground/40"}`}>
        <div className="flex items-baseline justify-between gap-3">
          <b className="text-sm">데이터베이스 점검</b>
          <span className="num text-xs text-muted">
            함수 {EXPECTED_FUNCTIONS.length} · 표 {EXPECTED_RELATIONS.length}
          </span>
        </div>
        {health.error ? (
          <p className="mt-2 text-[13px] leading-relaxed text-red-700">
            점검하지 못했습니다 — {health.error}
            <br />
            schema_health 함수가 없으면 마이그레이션을 먼저 적용하세요.
          </p>
        ) : broken.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-muted">
            화면이 부르는 것이 모두 살아 있습니다.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[13px] font-semibold text-red-700">
              {broken.length}개가 문제입니다. 이 중 하나라도 화면에서 부르면 500 이 납니다.
            </p>
            <ul className="mt-2 space-y-1">
              {broken.map((r) => (
                <li key={r.name} className="text-[13px] text-red-700">
                  <code className="font-semibold">{r.name}</code>
                  <span className="ml-1.5 text-red-600/80">
                    ({r.kind === "function" ? "함수" : "표"}) {r.problem}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { k: "오늘 검색", v: nSearchToday },
          { k: "30일 검색", v: nSearch30 },
          { k: "결과 0건", v: nZero30 },
          { k: "저장한 조건", v: nSaved },
          { k: "오늘 유입", v: nVisitToday },
          { k: "7일 유입", v: nVisit7 },
          { k: "30일 유입", v: nVisit30 },
          {
            k: "노출 사업",
            v: (cov.data ?? []).reduce(
              (s: number, c: Row) => s + Number(c.usable ?? 0), 0),
          },
        ].map((c) => (
          <div key={c.k} className="card p-4">
            <p className="text-xs text-muted">{c.k}</p>
            <p className="num mt-1 text-2xl font-extrabold">
              {c.v.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-faint">
        위 숫자는 데이터베이스에서 직접 센 것입니다. 검색 수는 크롤러를 뺀 사람 기준입니다.
        {(rows.length >= SAMPLE || visitRows.length >= SAMPLE) &&
          ` 아래 순위와 그래프는 최근 ${SAMPLE.toLocaleString()}건을 표본으로 합니다.`}
      </p>

      <Panel id="a-visit" title="일별 유입자" note="최근 30일 · 탭당 한 번, 사이트 안 이동은 세지 않음">
        <div className="flex h-28 items-end gap-[3px]">
          {daily.map((x) => (
            <div key={x.d} className="group relative flex-1">
              <div className="w-full rounded-t-[3px] bg-brand/70 transition-colors group-hover:bg-brand"
                   style={{ height: `${Math.max(2, (x.n / dailyMax) * 100)}%` }} />
              <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap
                               rounded bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                {x.d.slice(5).replace("-", ".")} · {x.n}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-faint">
          <span>{daily[0]?.d.slice(5).replace("-", ".")}</span>
          <span>오늘</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-bold text-muted">처음 도착한 화면</p>
            <Rank rows={landings.map((t) => ({ landing: t.label, n: t.n }))} keyName="landing" />
          </div>
          <div>
            <p className="mb-1 text-xs font-bold text-muted">하루 평균</p>
            <p className="num text-2xl font-extrabold">
              {(visitRows.length / 30).toFixed(1)}
              <span className="ml-1 text-xs font-normal text-muted">명 / 일</span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              한 탭에서 첫 화면을 열 때 한 번 셉니다. 새로고침이나 사이트 안 이동은 세지
              않으므로 페이지뷰보다 작고, 사람 수에 가깝습니다. IP 는 저장하지 않습니다.
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        id="a-saved"
        title="저장한 조건"
        note={savedRows.length >= 200 ? "최근 200건" : `${savedRows.length}건`}
      >
        <SavedPanel rows={savedRows} accounts={accountRows} />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Panel title="유입 채널" note="최근 30일">
            <Rank rows={tally(visitRows, "channel")} keyName="label" />
          </Panel>
          <Panel title="처음 열린 페이지">
            <Rank rows={tally(visitRows, "landing")} keyName="label" />
          </Panel>
        </div>
        <div>
          <Panel
            title="유입 검색어"
            note={terms.length ? "최근 30일" : "대부분 안 넘어옵니다"}
          >
            {terms.length ? (
              <Rank rows={terms} keyName="label" />
            ) : (
              <p className="text-sm leading-relaxed text-muted">
                구글·네이버는 리퍼러에서 검색어를 지우고 보냅니다. 그래서 여기는
                대개 비어 있습니다 — 기록이 안 되는 게 아니라 브라우저가 안 넘겨
                줍니다. 실제 검색어는{" "}
                <a
                  href="https://search.google.com/search-console"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-brand"
                >
                  구글 서치콘솔
                </a>
                과{" "}
                <a
                  href="https://searchadvisor.naver.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-brand"
                >
                  네이버 서치어드바이저
                </a>
                에서 보셔야 합니다. 직접 링크에 <code>utm_term</code> 을 붙이면
                그 값은 여기 그대로 쌓입니다.
              </p>
            )}
          </Panel>
          <Panel title="캠페인" note="utm_campaign">
            <Rank rows={campaigns} keyName="label" />
          </Panel>
        </div>
      </div>

      <Panel title="채널별로 무엇을 찾아왔나" note="최근 30일 · 검색어를 넘겨주는 채널은 검색어, 아니면 처음 열린 페이지">
        <div className="grid gap-5 sm:grid-cols-2">
          {byChannel.map((c) => (
            <div key={c.channel}>
              <div className="flex items-baseline justify-between">
                <b className="text-[13.5px] font-bold">{c.channel}</b>
                <span className="num text-xs text-faint">{c.n.toLocaleString()}명{c.terms.length ? " · 검색어" : " · 처음 열린 페이지"}</span>
              </div>
              <div className="mt-1.5">
                <Rank rows={c.terms.length ? c.terms : c.landings} keyName="label" />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-faint">
          다음·카카오만 검색어를 리퍼러에 실어 보냅니다. 구글·네이버의 실제 검색어는 서치콘솔·서치어드바이저에서
          보고, 여기서는 그 채널 사람들이 처음 연 페이지로 무엇을 찾아왔는지 가늠합니다.
        </p>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Panel id="a-search" title="많이 찾는 지역" note="최근 30일">
            <Rank rows={count("sido")} keyName="label" />
          </Panel>
          <Panel title="많이 찾는 나이대">
            <Rank rows={count("age_band")} keyName="label" />
          </Panel>
          <Panel title="많이 찾는 상황">
            <Rank rows={count("household")} keyName="label" />
          </Panel>
        </div>
        <div>
          <Panel title="결과가 0건이던 조건"
                 note="여기가 데이터 구멍입니다">
            <Rank rows={zeroRows} keyName="label" />
          </Panel>
          <Panel title="조회 방식" note="화면에서 어떻게 찾았는지">
            <Rank rows={count("entry")} keyName="label" />
          </Panel>
          <Panel title="많이 찾는 취업상태">
            <Rank rows={count("employment")} keyName="label" />
          </Panel>
        </div>
      </div>

      <div id="a-collect" className="scroll-mt-14"><CollectPanel stats={jobStats} lastRuns={lastRuns} /></div>
      <div id="a-seo" className="scroll-mt-14"><SeoPanel initial={parseSeo(st.get("seo"))} /></div>
      <div id="a-ads" className="scroll-mt-14"><AdsPanel initial={parseAds(st.get("ads"))} initialOn={parseAdsOn(st.get("ads_on"))} /></div>

      <div id="a-settings" className="scroll-mt-14">
        <SettingsPanel
          closingDays={String(st.get("closing_days") ?? 14)}
          newDays={String(st.get("new_days") ?? 7)}
          notice={String(st.get("notice") ?? "").replace(/^"|"$/g, "")}
        />
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        위쪽 <b className="font-bold text-ink2">저장한 조건</b> 은 이용자가
        직접 동의하고 남긴 연락처입니다. 안내 목적 외로 쓰지 말고, 삭제를
        요청받으면 지웁니다.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        그 아래 검색 통계에는 개인을 식별할 수 있는 정보가 들어 있지 않습니다.
        IP·브라우저 정보·자유입력 원문은 저장하지 않으며, 나이는 10년 단위로만
        기록합니다.
      </p>
    </div>
  );
}
