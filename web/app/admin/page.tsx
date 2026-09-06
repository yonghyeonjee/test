import { createClient } from "@supabase/supabase-js";
import { configured, isLoggedIn } from "@/lib/auth";
import LoginForm from "./LoginForm";
import SavedPanel, { type SavedFull } from "./SavedPanel";
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
  const [logs, settings, cov, saved, visits] = await Promise.all([
    db.from("search_log").select("*").gte("at", since).limit(5000),
    db.from("site_settings").select("key,value"),
    db.from("coverage").select("*"),
    db
      .from("saved_searches")
      .select("id,kind,label,query,name,phone,email,biz_no,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
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
  const campaigns = tally(
    visitRows.filter((r) => r.utm_campaign),
    "utm_campaign"
  );

  const savedRows = (saved.data ?? []) as SavedFull[];

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

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-6">
        {[
          { k: "오늘 검색", v: today },
          { k: "30일 검색", v: rows.length },
          { k: "결과 0건", v: zero.length },
          { k: "저장한 조건", v: savedRows.length },
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

      <Panel
        title="저장한 조건"
        note={savedRows.length >= 200 ? "최근 200건" : `${savedRows.length}건`}
      >
        <SavedPanel rows={savedRows} />
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
