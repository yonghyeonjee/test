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

export default async function JobsSearch({ searchParams }: { searchParams: SP }) {
  redirect(
    jobPath({
      org: one(searchParams.org),
      region: one(searchParams.region),
      hire: one(searchParams.hire),
      open: one(searchParams.open) === "1",
      q: one(searchParams.q),
      page: 1,
    }),
  );
}
