import type { Metadata } from "next";
import { ArtJeonse } from "@/components/Art";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import RateTable from "@/components/RateTable";
import { getRentRates, pct, ymd } from "@/lib/rentRate";
import { jeonseRelated } from "@/lib/related";

/** 공사가 하루 한 번 갱신한다. 여섯 시간마다 다시 받아 오면 충분하다. */
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "전세자금대출 금리 비교 — 은행별 기준·가산·적용금리",
  description:
    "한국주택금융공사가 보증하는 전세자금대출의 은행별 금리를 낮은 순으로 정리했습니다. " +
    "기준금리와 가산금리를 나눠 보여드리므로 어디서 차이가 나는지 바로 보입니다.",
  keywords: [
    "전세자금대출 금리",
    "전세자금대출 금리 비교",
    "주택금융공사 전세자금보증",
    "전세대출 은행별 금리",
  ],
  alternates: { canonical: "/money/jeonse" },
};

export default async function Jeonse() {
  const board = await getRentRates();
  const best = board.banks.find((b) => b.low !== null) ?? null;
  const week =
    ymd(board.from) && ymd(board.to) ? `${ymd(board.from)} ~ ${ymd(board.to)}` : null;

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="생활금융"
        title="전세자금대출, 은행마다 금리가 다릅니다"
        sub="한국주택금융공사가 보증하는 전세자금 대출의 은행별 금리입니다. 같은 보증을 받고도 어디서 빌리느냐에 따라 매달 나가는 돈이 달라집니다."
        art={<ArtJeonse />}
      />

      {board.ok ? (
        <>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-sm text-muted">
              {week ? `기준 ${week}` : "공사 공개 자료 기준"} · 한국주택금융공사
              공공데이터
            </p>
            {best && (
              <p className="num text-sm font-bold text-brand">
                가장 낮은 적용금리 {pct(best.low)} — {best.bank}
              </p>
            )}
          </div>
          <RateTable board={board} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            공사가 공개한 값을 그대로 옮긴 것입니다. 실제 적용 금리는 신용도와 상품,
            우대 조건에 따라 달라지므로 최종 확인은 해당 은행에서 하셔야 합니다.
          </p>
        </>
      ) : (
        <div className="card mt-6 p-8 text-center">
          <p className="leading-relaxed text-muted">
            지금은 금리 자료를 불러오지 못했습니다.
            <br />
            공공데이터 쪽이 잠시 응답하지 않는 경우가 있어, 잠시 뒤 다시 들어오시면
            보입니다.
          </p>
          <a
            href="https://www.hf.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost mt-5"
          >
            주택금융공사에서 직접 보기
          </a>
        </div>
      )}

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          이 표를 읽는 법
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            전세자금대출 금리는 &lsquo;기준금리 + 가산금리 = 적용금리&rsquo;로 만들어집니다.
            기준금리는 은행이 돈을 빌려 오는 값이라 어느 은행이든 비슷하게 움직입니다.
            차이가 나는 쪽은 가산금리입니다. 은행이 붙이는 몫이라 은행마다, 상품마다
            다릅니다. 그래서 표를 볼 때 적용금리만 보지 마시고 가산금리가 얼마나
            붙었는지를 같이 보시면, 지금 금리가 싼 은행인지 앞으로도 싼 은행인지
            어느 정도 가늠이 됩니다.
          </p>
          <p>
            보증비율은 주택금융공사가 대출금의 몇 퍼센트까지 책임지는지를 말합니다.
            보증비율이 높을수록 은행이 떠안는 위험이 줄어 금리가 낮아지는 것이 보통입니다.
            같은 은행에 두 줄이 있는 것은 보증비율이 다른 두 가지 조건이 있다는 뜻이고,
            어느 조건으로 받을 수 있는지는 소득과 보증금 규모에 따라 갈립니다.
          </p>
          <p>
            전세자금보증은 전세 계약을 맺은 세입자가 보증금을 마련할 때 쓰는 제도입니다.
            임대차 계약서와 계약금 납부 영수증, 확정일자를 갖춘 뒤 은행에 신청하면
            은행이 공사 보증을 끼고 대출을 내줍니다. 잔금일 이전에 신청해야 하는 것이
            원칙이라 계약하고 나서 알아보기 시작하면 늦는 경우가 많습니다. 계약서에
            도장을 찍기 전에 어느 은행에서 얼마에 받을 수 있는지 먼저 확인해 두시는
            것이 좋습니다.
          </p>
          <p>
            금리를 0.5%포인트 낮추면 1억 원을 빌렸을 때 한 해에 50만 원이 덜 나갑니다.
            지원금 하나 더 받는 것보다 큰 경우가 많습니다. 여기서 후보를 두세 곳으로
            좁힌 뒤 각 은행에 직접 물어보시면, 우대금리까지 더해 실제로 얼마가 되는지
            들으실 수 있습니다.
          </p>
        </div>
      </section>

      <GuideBanner title="전세를 알아보신다면 이것도" />
      <RelatedLinks items={jeonseRelated()} />
      <PromoBanner placement="jeonse" context="housing" />
    </div>
  );
}
