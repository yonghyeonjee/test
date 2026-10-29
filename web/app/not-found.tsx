import Link from "next/link";
import { IllusEmpty } from "@/components/Illus";

/** 전역 404. DB 를 묻지 않는 정적 화면이다 — 없는 주소가 몰려도 DB 에 짐이 가지 않게(2026-10-29). */
const WAYS: { href: string; label: string; note: string }[] = [
  { href: "/jobs", label: "공공기관 채용", note: "지금 접수 중인 공고" },
  { href: "/jobs/org", label: "기관별 채용 이력", note: "다음 공고는 언제쯤" },
  { href: "/policies", label: "정부지원사업", note: "나이·지역으로 찾기" },
  { href: "/license", label: "자격증 시험 일정", note: "접수·시험·발표일" },
  { href: "/housing", label: "주거 지원", note: "전세·월세·구입 대출" },
];

export default function NotFound() {
  return (
    <div className="py-16">
      <div className="mb-6 h-36 w-52"><IllusEmpty /></div>
      <h1 className="text-display font-extrabold">찾을 수 없는 페이지입니다</h1>
      <p className="mt-4 leading-relaxed text-muted">
        공고나 사업이 끝나 목록에서 내려갔거나, 주소가 바뀌었을 수 있습니다. 찾던 것과 가까운 곳에서 다시 시작해 보세요.
      </p>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {WAYS.map((w) => (
          <li key={w.href}>
            <Link href={w.href} className="card card-link block px-4 py-3">
              <b className="block text-[14.5px]">{w.label}</b>
              <span className="text-[13px] text-muted">{w.note}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/" className="btn btn-primary mt-8">
        처음부터 다시 찾기
      </Link>
    </div>
  );
}
