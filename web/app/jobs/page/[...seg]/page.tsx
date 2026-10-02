import JobsIndexPage, { jobsIndexMetadata } from "@/components/JobsIndexPage";
import { peekJobRoute } from "@/lib/jobRoute";

// /jobs/page/… — 앞머리는 라우트가 알고 있고, 나머지 조각만 Next 가 준다.
// 공고는 하루 한 번 모은다. 요청마다 다시 그릴 일이 없다 — 15분에 한 번이면 넉넉하다.
export const revalidate = 900;

type P = { params: { seg: string[] } };
export const generateMetadata = ({ params }: P) => jobsIndexMetadata(peekJobRoute(["page"], params.seg));
export default ({ params }: P) => <JobsIndexPage prefix={["page"]} seg={params.seg} />;
