import type { Metadata } from "next";
import Link from "next/link";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import { IllusMap } from "@/components/Illus";
import PageBanner from "@/components/PageBanner";
import PolicyMap from "@/components/PolicyMap";
import RelatedLinks from "@/components/RelatedLinks";
import { SIDO_SHORT } from "@/lib/geo";
import { EMPTY_MAP, getMapData, listItems, liteOf } from "@/lib/mapData";
import { blogIndexRelated } from "@/lib/related";
import { brandKeys, withOg } from "@/lib/seo";

/**
 * 정책지도. 시·군·구마다 지금 접수 중인 지원사업·채용을 점으로 놓고, 내 위치를
 * 켜면 가까운 순으로 본다. 점을 누르면 요약, 제목을 누르면 상세.
 *
 * 쪽 자체는 한 시간에 한 번 만든다. 주소의 ?kind= ?lat= ?lng= 는 지도 쪽(클라이언트)
 * 에서 붙은 뒤 읽어, 쪽이 요청마다 그려지지 않게 한다. 쪽에는 점만 싣고 요약은
 * /api/map/items 에서 받는다.
 */
export const revalidate = 3600;

export const metadata: Metadata = withOg({
  title: "정책지도 — 내 주변 지원금·공공기관 채용을 지도에서 찾기",
  description:
    "시·군·구마다 지금 접수 중인 정부 지원사업과 공공기관 채용을 지도에 놓았습니다. " +
    "내 위치를 켜면 가까운 순으로 보고, 반경으로 거르고, 눌러서 요약을 봅니다. 찾아가야 할 때 길찾기까지.",
  keywords: [
    ...brandKeys("정책지도", "지원금 지도"),
    "내 주변 지원금", "우리 동네 지원금 지도", "근처 공공기관 채용", "지역별 정책 지도", "지원사업 지도", "시군구 지원금",
  ],
  alternates: { canonical: "/map" },
});

export default async function MapPage() {
  const data = await getMapData().catch(() => EMPTY_MAP);
  // 시·도별 묶음 — 자바스크립트 없이도 읽을 수 있는 본문이고, 검색엔진이 읽는 것도 이것이다.
  const bySido = new Map<string, { w: number; b: number; j: number; places: number }>();
  for (const p of data.programs) {
    const c = bySido.get(p.sido) ?? { w: 0, b: 0, j: 0, places: 0 };
    c.w += p.nW; c.b += p.nB; c.places += p.sigungu ? 1 : 0; bySido.set(p.sido, c);
  }
  for (const p of data.jobs) {
    const c = bySido.get(p.sido) ?? { w: 0, b: 0, j: 0, places: 0 };
    c.j += p.n; bySido.set(p.sido, c);
  }
  const sidos = [...bySido.entries()].sort((a, b) => (b[1].w + b[1].b + b[1].j) - (a[1].w + a[1].b + a[1].j));
  const totalP = data.programs.reduce((a, p) => a + p.n, 0);
  const totalJ = data.jobs.reduce((a, p) => a + p.n, 0);

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="정책지도"
        title="내 주변 지원금과 채용, 지도에서"
        sub="시·군·구마다 지금 접수 중인 지원사업과 공공기관 채용을 지도에 놓았습니다. 내 위치를 켜면 가까운 순으로 보고, 점을 누르면 요약이 뜹니다."
        art={<IllusMap />}
      />

      <PolicyMap data={liteOf(data)} initial={listItems(data, "programs", { sort: "end", limit: 20 })} />

      <section className="mt-14">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">시·도별로 보기</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          지도에 올린 것은 접수 중인 지원사업 <b className="num text-ink2">{totalP.toLocaleString("ko-KR")}건</b>과
          채용 <b className="num text-ink2">{totalJ.toLocaleString("ko-KR")}건</b>입니다.
          지역이 정해지지 않은 전국 공통 사업 {data.nationwide.toLocaleString("ko-KR")}건은{" "}
          <Link href="/policies" className="font-semibold text-brand underline underline-offset-4">정책 전체</Link>에서,
          근무 지역이 적히지 않은 채용 {data.jobsNoPlace.toLocaleString("ko-KR")}건은{" "}
          <Link href="/jobs" className="font-semibold text-brand underline underline-offset-4">채용 목록</Link>에서 보세요.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {sidos.map(([sido, c]) => (
            <li key={sido}>
              <Link href={`/area/${encodeURIComponent(sido)}`}
                    className="card card-link block px-4 py-3">
                <b className="block text-[15px]">{SIDO_SHORT[sido] ?? sido}</b>
                <span className="num mt-0.5 block text-[12.5px] text-muted">
                  복지 {c.w} · 기업 {c.b} · 채용 {c.j}
                </span>
                {c.places > 0 && <span className="num mt-0.5 block text-[12px] text-faint">{c.places}개 시·군·구</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">이 지도를 읽는 법</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            공고에는 주소가 없습니다. 있는 것은 "경기도 시흥시"처럼 시·도와 시·군·구 이름뿐이라, 점은
            그 구역의 가운데에 놓았습니다. 그래서 거리는 <b>시·군·구 가운데 기준 직선거리</b>이고, 청사나
            접수처까지의 길 거리와 다릅니다. 찾아가야 하면 점 안의 길찾기로 지도 앱을 여세요.
          </p>
          <p>
            채용 공고는 근무 지역이 시·도까지만 적혀 있거나 비어 있는 것이 많습니다. 기관명과 제목에서
            시·군·구를 읽어 놓았고("인천광역시 연수구", "국립군산대학교"), 못 읽은 것은 시·도 가운데에
            흐린 점으로 둡니다. 중앙부처 공고처럼 아예 지역이 없는 것은 지도에 없습니다.
          </p>
          <p>
            내 위치는 이 브라우저에만 저장되고 서버로 보내지 않습니다. 상세 화면의 작은 지도가 "내 위치에서
            몇 km"를 바로 적는 것은 그 때문입니다. 위치 권한을 주지 않아도 시·도를 골라 그 가운데를 기준으로
            볼 수 있습니다.
          </p>
        </div>
      </section>

      <Faq
        items={[
          { q: "점의 크기는 무엇인가요?", a: "그 시·군·구에서 지금 접수 중인 공고 수입니다. 많을수록 큽니다. 마감된 공고는 세지 않습니다." },
          { q: "우리 동네가 지도에 없어요.", a: "지금 접수 중인 공고가 하나도 없는 시·군·구는 점이 없습니다. 상시 접수 사업은 포함되니, 정말 없다면 시·도 단위 사업(흐린 점)이나 전국 공통 사업을 보세요." },
          { q: "거리가 실제와 달라요.", a: "구역 가운데 기준 직선거리라서 그렇습니다. 넓은 군 지역은 청사와 10~20km 차이가 날 수 있습니다. 길찾기는 카카오맵·네이버지도 단추로 확인하세요." },
          { q: "일정을 캘린더에 넣고 싶어요.", a: "공고 상세 화면과 자격증 시험 일정에 '구글 캘린더'와 '.ics 내려받기' 단추가 있습니다. 구글은 바로 열리고, 애플·아웃룩·네이버는 .ics 파일을 열면 됩니다." },
        ]}
      />

      <GuideBanner />
      <RelatedLinks items={blogIndexRelated()} />
    </div>
  );
}
