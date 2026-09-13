import JobsIndexPage, { jobsIndexMetadata } from "@/components/JobsIndexPage";
import { peekJobRoute } from "@/lib/jobRoute";

// /jobs/status/… — 앞머리는 라우트가 알고 있고, 나머지 조각만 Next 가 준다.
export const dynamic = "force-dynamic";

type P = { params: { seg: string[] } };
export const generateMetadata = ({ params }: P) => jobsIndexMetadata(peekJobRoute(["status"], params.seg));
export default ({ params }: P) => <JobsIndexPage prefix={["status"]} seg={params.seg} />;
