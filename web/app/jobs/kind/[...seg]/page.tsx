import JobsIndexPage, { jobsIndexMetadata } from "@/components/JobsIndexPage";
import { peekJobRoute } from "@/lib/jobRoute";

// /jobs/kind/result — 합격자·시험 일정 공고(2026-11-16). 기본 목록에서 뺀 것만 따로 본다. 색인하지 않는다(jobRobots).
// 세 시간. 조합이 수천 개라 15분마다 새로 그리면 캐시 저장(ISR Writes)이 크게 쌓였다. 채용은 하루 다섯 번 모은다.
export const revalidate = 10800;

type P = { params: { seg: string[] } };
export const generateMetadata = ({ params }: P) => jobsIndexMetadata(peekJobRoute(["kind"], params.seg));
export default ({ params }: P) => <JobsIndexPage prefix={["kind"]} seg={params.seg} />;
