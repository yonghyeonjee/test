import { createClient } from "@supabase/supabase-js";
import { configured, isLoggedIn } from "@/lib/auth";
import LoginForm from "./LoginForm";
import SavedPanel, { type Account, type SavedCond } from "./SavedPanel";
import SettingsPanel from "./SettingsPanel";

export const dynamic = "force-dynamic";
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

function Panel({ title, note, children }: {
  title: string; note?: string; children: React.ReactNode;
}) {
  return (
    <section className="card mt-4 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold">{title}</h2>
        {note && <span className="text-xs text-faint">{note}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
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
          <span className="truncate">{String(r[keyName] ?? "(없음)")}</span>
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
  const [logs, settings, cov, saved, accounts, visits] = await Promise.all([
    db.from("search_log").select("*").gte("at", since).limit(5000),
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
    db.from("visit_log").select("*").gte("at", since).limit(5000),
  ]);

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

  const today = rows.filter(
    (r) => new Date(String(r.at)).toDateString() === new Date().toDateString()
  ).length;

  const st = new Map((settings.data ?? []).map((d) => [d.key as string, d.value]));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-extrabold">관리자</h1>
        <form action={async () => { "use server";
          const { logout } = await import("./actions"); await logout(); }}>
          <button className="text-xs text-muted hover:text-brand">로그아웃</button>
        </form>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { k: "오늘 검색", v: today },
          { k: "30일 검색", v: rows.length },
          { k: "결과 0건", v: zero.length },
          { k: "저장한 조건", v: savedRows.length },
          { k: "오늘 유입", v: visitsToday },
          { k: "7일 유입", v: visits7 },
          { k: "30일 유입", v: visitRows.length },
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

      <Panel title="일별 유입자" note="최근 30일 · 탭당 한 번, 사이트 안 이동은 세지 않음">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Panel title="많이 찾는 지역" note="최근 30일">
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

      <SettingsPanel
        closingDays={String(st.get("closing_days") ?? 14)}
        newDays={String(st.get("new_days") ?? 7)}
        notice={String(st.get("notice") ?? "").replace(/^"|"$/g, "")}
      />

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
