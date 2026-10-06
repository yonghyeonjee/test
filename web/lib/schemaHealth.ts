/**
 * 화면이 기대는 함수·표가 데이터베이스에 실제로 있는지 본다.
 *
 * 왜 두었나: programs_public 뷰를 drop … cascade 로 다시 만들면서
 * match_welfare·match_business 가 딸려 지워졌다. 되살리는 것을 빠뜨렸는데,
 * 첫 화면은 그 함수를 안 부르니 멀쩡했고 지역을 고르는 순간에만 500 이
 * 났다. 그 길을 아무도 안 밟으면 며칠이고 모른 채 지나간다.
 *
 * 아래 목록은 손으로 맞춘다. 새 rpc()·from() 을 쓰면 여기에도 적는다.
 * 목록과 코드가 어긋나는 것을 막으려고, 관리자 화면에 "코드가 부르는데
 * 목록에 없는 것"까지 같이 보여 준다.
 */

/** db.rpc("…") 로 부르는 것. */
export const EXPECTED_FUNCTIONS = [
  "account_by_device", "account_create", "account_mark", "account_probe", "account_taken",
  "account_update_contact", "feed_closing", "feed_ending", "feed_new",
  "home_bundle", "log_search", "log_visit",
  "match_business", "match_welfare",
  "recovery_claim", "recovery_issue",
  "saved_add", "saved_list", "saved_open", "saved_remove",
] as const;

/**
 * 서버(service_role)만 부르는 것. 브라우저 anon 키의 실행 권한을 거뒀으므로
 * anon 이 없어야 정상이고, service_role 이 없으면 문제다.
 * (저장 조건·되찾기·기록은 /api/saved·/api/visit 가, 계정은 서버 액션이 부른다.)
 */
const SERVER_ONLY = new Set<string>([
  "account_by_device", "account_create", "account_mark", "account_probe", "account_taken",
  "account_update_contact", "log_search", "log_visit", "recovery_claim", "recovery_issue",
  "saved_add", "saved_list", "saved_open", "saved_remove",
  "notify_sent", "notify_log", "visit_log", "save_account", "saved_condition", "exam_site_state",
]);

/** db.from("…") 으로 읽는 표와 뷰. */
export const EXPECTED_RELATIONS = [
  "agency_items", "area_summary", "coverage", "exam_rounds", "exam_sched", "exam_site_state", "exam_stats",
  "job_org_stats", "job_overview", "job_posts",
  "program_detail", "programs", "programs_public", "rate_rows",
  "regions_available", "save_account", "saved_condition", "saved_popular",
  "search_log", "settings_public", "site_settings",
  "stat_age", "stat_employment", "stat_household", "visit_log",
  "notify_sent", "notify_log",
] as const;

/** anon 키로도 닿아야 하는 것(공개 읽기). SERVER_ONLY 가 아닌 전부. */
const ANON_NEEDED = new Set<string>(
  [...EXPECTED_FUNCTIONS, ...EXPECTED_RELATIONS].filter((n) => !SERVER_ONLY.has(n)),
);

export type HealthRow = {
  name: string;
  kind: "function" | "relation";
  present: boolean;
  anonOk: boolean;
  svcOk: boolean;
  /** 문제가 있으면 무엇이 문제인지. 없으면 null. */
  problem: string | null;
};

type Client = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

export async function checkSchema(db: Client): Promise<{ rows: HealthRow[]; error: string | null }> {
  const { data, error } = await db.rpc("schema_health2", {
    p_fns: [...EXPECTED_FUNCTIONS],
    p_rels: [...EXPECTED_RELATIONS],
  });
  if (error) return { rows: [], error: error.message };

  const rows = ((data ?? []) as { name: string; kind: string; present: boolean; anon_ok: boolean; svc_ok?: boolean }[])
    .map((r): HealthRow => {
      const anonOk = Boolean(r.anon_ok);
      const svcOk = r.svc_ok === undefined ? true : Boolean(r.svc_ok);
      const serverOnly = SERVER_ONLY.has(r.name);
      return {
        name: r.name,
        kind: r.kind === "function" ? "function" : "relation",
        present: Boolean(r.present),
        anonOk,
        svcOk,
        problem: !r.present
          ? "없습니다"
          : serverOnly
            ? (!svcOk ? "service_role 권한이 없습니다" : anonOk ? "anon 이 부를 수 있습니다(서버 전용이어야 함)" : null)
            : ANON_NEEDED.has(r.name) && !anonOk
              ? "anon 권한이 없습니다"
              : null,
      };
    })
    .sort((a, b) => Number(Boolean(a.problem)) - Number(Boolean(b.problem)) || a.name.localeCompare(b.name));

  return { rows, error: null };
}
