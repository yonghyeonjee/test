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
  "account_create", "account_mark", "account_probe", "account_taken",
  "account_update_contact", "feed_closing", "feed_ending", "feed_new",
  "home_bundle", "log_search", "log_visit",
  "match_business", "match_welfare",
  "recovery_claim", "recovery_issue",
  "saved_add", "saved_list", "saved_open", "saved_remove",
] as const;

/** db.from("…") 으로 읽는 표와 뷰. */
export const EXPECTED_RELATIONS = [
  "agency_items", "area_summary", "coverage", "exam_rounds",
  "job_org_stats", "job_overview", "job_posts",
  "program_detail", "programs", "programs_public", "rate_rows",
  "regions_available", "save_account", "saved_condition", "saved_popular",
  "search_log", "settings_public", "site_settings",
  "stat_age", "stat_employment", "stat_household", "visit_log",
] as const;

/**
 * anon 키로도 닿아야 하는 것. 여기 없는 것은 service_role 전용이라
 * anon 권한이 없어도 정상이다(visit_log 가 그렇다).
 */
const ANON_NEEDED = new Set<string>([
  ...EXPECTED_FUNCTIONS,
  ...EXPECTED_RELATIONS.filter((r) => r !== "visit_log"),
]);

export type HealthRow = {
  name: string;
  kind: "function" | "relation";
  present: boolean;
  anonOk: boolean;
  /** 문제가 있으면 무엇이 문제인지. 없으면 null. */
  problem: string | null;
};

type Client = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

export async function checkSchema(db: Client): Promise<{ rows: HealthRow[]; error: string | null }> {
  const { data, error } = await db.rpc("schema_health", {
    p_fns: [...EXPECTED_FUNCTIONS],
    p_rels: [...EXPECTED_RELATIONS],
  });
  if (error) return { rows: [], error: error.message };

  const rows = ((data ?? []) as { name: string; kind: string; present: boolean; anon_ok: boolean }[])
    .map((r): HealthRow => {
      const anonOk = Boolean(r.anon_ok);
      const needsAnon = ANON_NEEDED.has(r.name);
      return {
        name: r.name,
        kind: r.kind === "function" ? "function" : "relation",
        present: Boolean(r.present),
        anonOk,
        problem: !r.present
          ? "없습니다"
          : needsAnon && !anonOk
            ? "anon 권한이 없습니다"
            : null,
      };
    })
    .sort((a, b) => Number(Boolean(a.problem)) - Number(Boolean(b.problem)) || a.name.localeCompare(b.name));

  return { rows, error: null };
}
