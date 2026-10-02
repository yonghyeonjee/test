import JobsIndexPage, { jobsIndexMetadata } from "@/components/JobsIndexPage";
import { peekJobRoute } from "@/lib/jobRoute";

// /jobs/q/… — 앞머리는 라우트가 알고 있고, 나머지 조각만 Next 가 준다.
// 세 시간. 조합이 수천 개라 15분마다 새로 그리면 캐시 저장(ISR Writes)이 크게 쌓였다. 채용은 하루 다섯 번 모은다.
export const revalidate = 10800;
// 검색어 화면: 검색어마다 DB 조회 결과를 캐시에 남기지 않는다(다시 쓰일 일이 드물다).
export const fetchCache = "default-no-store";

type P = { params: { seg: string[] } };
export const generateMetadata = ({ params }: P) => jobsIndexMetadata(peekJobRoute(["q"], params.seg));
export default ({ params }: P) => <JobsIndexPage prefix={["q"]} seg={params.seg} />;
