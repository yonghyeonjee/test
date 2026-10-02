import JobsIndexPage, { jobsIndexMetadata } from "@/components/JobsIndexPage";
import { peekJobRoute } from "@/lib/jobRoute";

// 옛 주소(/jobs?region=…&page=2)는 미들웨어가 경로 주소로 308 넘긴다. 여기까지
// 오는 것은 조건 없는 첫 쪽뿐이라, 요청마다 그릴 이유가 없다. 공고는 하루 한 번
// 모으니 한 시간에 한 번이면 넉넉하다(예전 15분, 캐시 저장 ISR Writes 를 줄였다). 이 쪽이 방문마다 DB 에서 3,000건을 다시
// 읽어 전체 조회의 1위였다.
export const revalidate = 3600;

export const generateMetadata = () => jobsIndexMetadata(peekJobRoute([]));

export default function Jobs() {
  return <JobsIndexPage />;
}
