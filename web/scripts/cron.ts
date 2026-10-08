/**
 * 수집·알림 단계를 GitHub 러너에서 직접 돌린다. 서버의 /api/cron/* 이 부르는 것과 같은 lib 함수를 부른다.
 *
 * 2026-10-08 서버(1GB 기계의 Next 프로세스) 메모리 장애 뒤, 예약 실행을 서버 밖으로 뺐다.
 * 러너는 메모리 7GB, 한 번에 6시간까지라 30초씩 쪼갤 필요가 없고, 서버가 점검 중이어도 수집이 끊기지 않는다.
 * 서버의 /api/cron 길은 관리자 화면의 수동 실행용으로 남는다.
 *
 * 사용: npx tsx scripts/cron.ts <작업> [--minutes 20]
 *   latest              전부 최신 수집(collectAll) — 나라일터 최신, 해외취업, 자격 종목, 시험 일정, 공공기관 사업·행사·시설, 전세 금리
 *   source:<key>        하나만 이어서(collectOne). 예: source:gojobs_archive, source:worldjob
 *   gojobs_detail       나라일터 접수 중 공고의 상세(첨부파일·근무지역)
 *   qnet                큐넷 종목별 시험 일정·수험자 동향
 *   alio | alio_full    잡알리오 새 공고(이미 있는 쪽을 만나면 멈춤) | 끝까지
 *   notify | notify_dry 저장 조건 알림 메일 | 보내지 않고 몇 명에게 몇 건이 갈지만
 *
 * 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY(필수). 단계별로 DATA_GO_KR_KEY(과거·해외취업 API),
 * ALIOPLUS_*(공공기관 사업·행사·시설), 알림은 수신 거부 서명용 SESSION_SECRET/ADMIN_SECRET/ADMIN_PASSWORD(서버와 같은 값이어야
 * 링크가 맞는다)와 메일 AWS_REGION·AWS_ACCESS_KEY_ID·AWS_SECRET_ACCESS_KEY·MAIL_FROM(없으면 시험 모드).
 * 비밀값은 찍지 않는다.
 */
import { alioStep } from "../lib/alioJobs";
import { collectAll, collectOne, COLLECT_KEYS, type CollectKey } from "../lib/collectors";
import { gojobsDetailStep } from "../lib/gojobsDetail";
import { runNotify } from "../lib/notify";
import { qnetSiteStep } from "../lib/qnetSite";

type Round = { more: boolean } & Record<string, unknown>;

/** 한 호출에 주는 예산. 라이브러리들은 예산 안에서 멈추고 more 로 남은 것을 알린다. */
const PER_CALL_MS = 10 * 60_000;
const MAX_ROUNDS = 60;

function parseArgs(argv: string[]): { job: string; minutes: number } {
  let job = "";
  let minutes = 20;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--minutes") minutes = Number(argv[++i]);
    else if (!job) job = argv[i];
  }
  if (!job || !Number.isFinite(minutes) || minutes <= 0) {
    console.error("사용: npx tsx scripts/cron.ts <latest|source:<key>|gojobs_detail|qnet|alio|alio_full|notify|notify_dry> [--minutes 20]");
    process.exit(2);
  }
  return { job, minutes };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 한 줄 JSON. 긴 문자열은 자른다(공고 제목 수백 개를 통째로 찍지 않게). */
function log(o: unknown) {
  console.log(JSON.stringify(o, (_k, v) => (typeof v === "string" && v.length > 300 ? `${v.slice(0, 300)}…` : v)));
}

function pickStep(job: string, budget: () => number): () => Promise<Round> {
  if (job === "latest") {
    return async () => {
      const results = await collectAll(budget());
      return { results, more: results.some((r) => r.ok && Boolean(r.more)) };
    };
  }
  if (job.startsWith("source:")) {
    const key = job.slice("source:".length) as CollectKey;
    if (!(COLLECT_KEYS as string[]).includes(key)) {
      console.error(`모르는 source: ${key}. 아는 것: ${COLLECT_KEYS.join(", ")}`);
      process.exit(2);
    }
    return async () => {
      const r = await collectOne(key, { budgetMs: budget() });
      return { ...r, more: Boolean(r.ok && r.more) };
    };
  }
  if (job === "gojobs_detail") return () => gojobsDetailStep(budget());
  if (job === "qnet") return () => qnetSiteStep(budget());
  if (job === "alio") return () => alioStep("new");
  if (job === "alio_full") return () => alioStep("full");
  if (job === "notify" || job === "notify_dry") {
    return async () => ({ ...(await runNotify({ dry: job === "notify_dry" })), more: false });
  }
  console.error(`모르는 작업: ${job}`);
  process.exit(2);
}

async function main() {
  const { job, minutes } = parseArgs(process.argv.slice(2));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error("NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_KEY 가 있어야 합니다.");
    process.exit(2);
  }
  const deadline = Date.now() + minutes * 60_000;
  const budget = () => Math.max(10_000, Math.min(PER_CALL_MS, deadline - Date.now()));
  const step = pickStep(job, budget);
  log({ job, minutes, at: new Date().toISOString() });

  let fails = 0;
  let exit = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const t0 = Date.now();
    let r: Round;
    try {
      r = await step();
      fails = 0;
    } catch (e) {
      fails++;
      log({ round, error: msg(e) });
      if (fails >= 3) { exit = 1; break; }
      await new Promise((res) => setTimeout(res, 5_000));
      continue;
    }
    log({ round, sec: Math.round((Date.now() - t0) / 1000), ...r });
    if (!r.more) break;
    if (Date.now() >= deadline) { log({ note: "시간이 다 되어 멈춤 — 남은 것은 다음 실행이 잇는다" }); break; }
  }
  // collectAll 의 마감 타이머 같은 것이 남아 있어도 여기서 끝낸다.
  process.exit(exit);
}

main().catch((e) => { console.error(msg(e)); process.exit(1); });
