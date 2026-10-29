import JobGone from "@/components/JobGone";

/**
 * 없는 공고 번호의 404 화면. page.tsx 가 notFound() 를 부르면 Next 가 404 머리글과
 * 함께 이 쪽을 낸다. 내용은 JobGone(지금 접수 중인 공고로 채운 안내) 그대로.
 */
export default function JobNotFound() {
  return <JobGone />;
}
