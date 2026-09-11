import Link from "next/link";
import { ArtJeonse, ArtLicense, ArtPolicy, ArtStudy } from "./Art";

/**
 * 사이트 안에서 다음에 볼 곳을 권하는 띠.
 *
 * 바깥으로 나가는 배너(PromoBanner)와 달리 전부 내부 링크다. 읽던 사람을
 * 사이트 밖으로 먼저 내보내지 않으려고 늘 그 위에 둔다.
 */

const ITEMS = [
  {
    href: "/policies",
    tag: "전체 보기",
    title: "정책 전체 찾아보기",
    desc: "대상·분야·지역·업종을 눌러 가며 전국 공고를 훑어봅니다.",
    Art: ArtPolicy,
  },
  {
    href: "/money/jeonse",
    tag: "매일 갱신",
    title: "전세자금대출 금리 비교",
    desc: "주택금융공사 보증 전세대출의 은행별 금리를 한 표에 모았습니다.",
    Art: ArtJeonse,
  },
  {
    href: "/money/student-loan",
    tag: "지자체",
    title: "학자금 이자지원 되는 곳",
    desc: "학자금 대출 이자를 대신 내주는 지자체를 지역별로 정리했습니다.",
    Art: ArtStudy,
  },
  {
    href: "/license",
    tag: "전체 목록",
    title: "국가자격 종목 찾아보기",
    desc: "무슨 자격증이 있는지 직무 분야와 등급으로 나눠 두었습니다.",
    Art: ArtLicense,
  },
];

export default function GuideBanner({
  title = "이런 것도 찾아보실 수 있습니다",
}: {
  title?: string;
}) {
  return (
    <section className="mt-14">
      <h2 className="text-[1.0625rem] font-bold">{title}</h2>
      <p className="mb-3 mt-1 text-sm text-muted">
        지원금 말고도, 돈이 덜 나가게 해 주는 제도들을 모아 두었습니다.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} className="card card-link block p-5">
            <div className="h-16 w-24">
              <it.Art />
            </div>
            <span className="badge badge-new mt-3">{it.tag}</span>
            <b className="mt-2 block text-[15px] leading-snug">{it.title}</b>
            <span className="mt-1 block text-sm leading-relaxed text-muted">
              {it.desc}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
