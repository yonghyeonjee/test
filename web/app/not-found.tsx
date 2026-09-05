import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16">
      <h1 className="text-display font-extrabold">찾을 수 없는 페이지입니다</h1>
      <p className="mt-4 leading-relaxed text-muted">
        사업이 종료되어 목록에서 내려갔거나, 주소가 바뀌었을 수 있습니다.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block bg-ink px-6 py-3.5 text-sm font-bold text-white"
      >
        처음부터 다시 찾기
      </Link>
    </div>
  );
}
