import { redirect } from "next/navigation";
import { jobPath } from "@/lib/jobRoute";

/**
 * 검색 상자만은 물음표를 피할 수 없다 — GET 폼은 ?q= 로만 보낸다.
 * 자바스크립트 없이도 검색이 되어야 하므로 폼은 그대로 두고, 여기서
 * 곧바로 경로 주소로 넘긴다. 그래서 주소창에 남는 것은 /jobs/q/방호 다.
 */
export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const many = (v: SP[string]) => ([] as string[]).concat(v ?? []).map((s) => s.trim()).filter(Boolean).join(",") || undefined;

// 보통은 미들웨어가 먼저 넘긴다. 미들웨어를 거치지 않은 경우를 위한 몫.
export default async function JobsSearch({ searchParams }: { searchParams: SP }) {
  redirect(
    jobPath({
      org: one(searchParams.org),
      region: one(searchParams.region),
      hire: many(searchParams.hire),
      type: many(searchParams.type),
      grade: many(searchParams.grade),
      field: many(searchParams.field),
      kind: one(searchParams.kind) === "result" ? "result" : undefined,
      open: one(searchParams.open) === "1",
      sort: one(searchParams.sort) === "new" ? "new" : undefined,
      q: one(searchParams.q),
      page: 1,
    }),
  );
}
