import { redirect } from "next/navigation";
import JobsIndexPage, { jobsIndexMetadata } from "@/components/JobsIndexPage";
import { jobPath, peekJobRoute } from "@/lib/jobRoute";

// 거르기 조건을 경로로 받는다. 주소마다 내용이 달라지므로 요청마다 그린다.
export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export const generateMetadata = () => jobsIndexMetadata(peekJobRoute([]));

export default function Jobs({ searchParams }: { searchParams: SP }) {
  // 예전 주소(/jobs?region=서울특별시&page=2)로 들어오면 경로 주소로 넘긴다.
  // 즐겨찾기나 남의 사이트에 걸린 링크가 죽지 않게.
  const legacy = {
    region: one(searchParams.region),
    hire: one(searchParams.hire),
    q: one(searchParams.q),
    open: one(searchParams.open) === "1",
    page: Math.max(1, Number(one(searchParams.page) ?? 1) || 1),
  };
  if (legacy.region || legacy.hire || legacy.q || legacy.open || legacy.page > 1) {
    redirect(jobPath(legacy));
  }
  return <JobsIndexPage />;
}
