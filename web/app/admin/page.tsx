import AdminTabs from "./AdminTabs";
import { createClient } from "@supabase/supabase-js";
import { configured, isLoggedIn } from "@/lib/auth";
import LoginForm from "./LoginForm";
import SavedPanel, { type Account, type SavedCond } from "./SavedPanel";
import SettingsPanel from "./SettingsPanel";
import BlogPanel from "./BlogPanel";
import StatsBoard from "./StatsBoard";
import { AdsPanel, SeoPanel } from "./SeoAdsPanel";
import CollectPanel, { type SourceStat } from "./CollectPanel";
import { COLLECT_KEYS } from "@/lib/collectorMeta";
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
  ["#a-health", "점검"], ["#a-blog", "블로그"], ["#a-visit", "통계"], ["#a-saved", "저장 조건"],
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

  // 2026-11-15: 방문·검색 통계는 StatsBoard 가 기간을 받아 /admin/stats 로 센다. 여기서는 기간과 상관없는 것만 읽는다.
  // (전에는 오늘·7일·30일로 고정한 숫자 칸과 최근 30일 표본 1,000건 순위를 여기서 만들어, 화면의 숫자들이
  //  서로 다른 기간을 말했다.)
  const [settings, cov, saved, accounts, sourcesR, lastRuns, health] = await Promise.all([
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
    // 수집 대상 8개의 집계는 DB 함수 하나로 묶어 받는다(sql/010).
    db.rpc("admin_source_stats"),
    readLastRuns(),
    checkSchema(db as never),
  ]);

  // 수집 대상마다 건수·최신·마지막 수집 시각. 함수가 없으면 0 으로 보인다.
  const srcRows = (Array.isArray(sourcesR.data) ? sourcesR.data : []) as { key: string; n: number; newest: string | null; fetched: string | null }[];
  const jobStats: SourceStat[] = COLLECT_KEYS.map((key) => {
    const r = srcRows.find((x) => x.key === key);
    return { key, n: Number(r?.n ?? 0), newest: r?.newest ?? null, fetched: r?.fetched ?? null };
  });
  const broken = health.rows.filter((r) => r.problem);

  const savedRows = (saved.data ?? []) as SavedCond[];
  const accountRows = (accounts.data ?? []) as Account[];
  const usable = ((cov.data ?? []) as Row[]).reduce((s: number, c: Row) => s + Number(c.usable ?? 0), 0);

  const st = new Map((settings.data ?? []).map((d) => [d.key as string, d.value]));

  return (
    <div>
      {/* 탭(2026-11-26). 고른 구역 하나만 보인다. 처음은 통계. */}
      <AdminTabs tabs={JUMPS} initial="#a-visit" />
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
            함수 {EXPECTED_FUNCTIONS.length} · 표 {EXPECTED_RELATIONS.length} · 노출 사업 {usable.toLocaleString()}건 · 저장한 조건 {savedRows.length >= 200 ? "200+" : savedRows.length}건
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

      {/* 운영 상태 점검(2026-11-27). 매일 한 번 도는 health-check 작업이 site_settings.health_report 에 적은 것.
          사이트 응답·수집·발행·실패한 예약 작업. 실패나 주의가 있으면 그 항목만 펼친다. */}
      {(() => {
        const hr = st.get("health_report") as
          | { at?: string; fails?: number; warns?: number; items?: { name: string; level: "ok" | "warn" | "fail"; detail: string }[] }
          | undefined;
        const its = hr?.items ?? [];
        const bad = its.filter((i) => i.level !== "ok");
        const at = hr?.at ? new Date(hr.at) : null;
        const stale = !at || Date.now() - at.getTime() > 50 * 3_600_000;   // 이틀 넘게 점검이 안 돌았다
        const red = stale || (hr?.fails ?? 0) > 0;
        return (
          <div className={`mt-3 rounded-card border p-4 ${red ? "border-red-300 bg-red-50" : bad.length ? "border-amber-300 bg-amber-50" : "border-line bg-ground/40"}`}>
            <div className="flex items-baseline justify-between gap-3">
              <b className="text-sm">운영 상태 점검</b>
              <span className="num text-xs text-muted">
                {at ? `${at.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 점검 · ${its.length}개 항목` : "아직 점검 기록이 없습니다"}
              </span>
            </div>
            {!at ? (
              <p className="mt-1.5 text-[13px] text-muted">GitHub Actions 의 health-check 작업이 한 번 돌면 여기 보입니다(매일 낮 12시 무렵).</p>
            ) : stale ? (
              <p className="mt-2 text-[13px] font-semibold text-red-700">이틀 넘게 점검이 돌지 않았습니다. GitHub Actions 의 health-check 작업을 확인하세요.</p>
            ) : bad.length === 0 ? (
              <p className="mt-1.5 text-[13px] text-muted">사이트 응답·수집·발행·예약 작업이 모두 정상입니다.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {bad.map((i) => (
                  <li key={i.name} className={`text-[13px] ${i.level === "fail" ? "text-red-700" : "text-amber-800"}`}>
                    <b>{i.level === "fail" ? "실패" : "주의"} · {i.name}</b>
                    <span className="ml-1.5 opacity-80">{i.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* 블로그 글 작성·수정·삭제(2026-11-15). */}
      <div id="a-blog" className="scroll-mt-14"><BlogPanel /></div>

      {/* 통계(2026-11-15). 기간 하나로 요약·순위·그래프가 모두 맞춰진다. */}
      <StatsBoard />

      <Panel
        id="a-saved"
        title="저장한 조건"
        note={savedRows.length >= 200 ? "최근 200건" : `${savedRows.length}건`}
      >
        <SavedPanel rows={savedRows} accounts={accountRows} />
      </Panel>

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
        통계에는 개인을 식별할 수 있는 정보가 들어 있지 않습니다.
        IP·브라우저 정보·자유입력 원문은 저장하지 않으며, 나이는 10년 단위로만
        기록합니다.
      </p>
    </div>
  );
}
