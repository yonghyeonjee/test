import JobsIndexPage, { jobsIndexMetadata } from "@/components/JobsIndexPage";
import { peekJobRoute } from "@/lib/jobRoute";

// /jobs/sort/new — 최신 등록순(2026-11-15). 색인하지 않고 정본은 /jobs(jobRobots·jobCanonical).
// 세 시간. 조합이 수천 개라 15분마다 새로 그리면 캐시 저장(ISR Writes)이 크게 쌓였다. 채용은 하루 다섯 번 모은다.
export const revalidate = 10800;

type P = { params: { seg: string[] } };
export const generateMetadata = ({ params }: P) => jobsIndexMetadata(peekJobRoute(["sort"], params.seg));
export default ({ params }: P) => <JobsIndexPage prefix={["sort"]} seg={params.seg} />;
