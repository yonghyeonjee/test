import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from revenue import parse_revenue_cap, won_to_label

억 = 100_000_000

# (원문 조각, 기대값) — 전부 DB 에 실제로 들어 있는 문장이다.
CASES = [
    # 자격 기준 — 뽑아야 한다
    ("’25년도 연매출액이 3억 원 이하이며,사업자등록증 상의 소재지가 경산시인 소상공인", 3 * 억),
    ("사업장을 창원시에 두고 있는 전년도 연간 매출액 200억 원 이하의 제조업 기반 중소기업", 200 * 억),
    ("사업비 출연 시ㆍ군 소재 2025년도 연매출 120억원 이하 중소기업으로", 120 * 억),
    ("본사 또는 공장이 소재한 전년도 매출액 120억원 이하의 지방세 완납 제조업", 120 * 억),
    ("최근 3년 매출액 평균 300억원 이하 기업 ☞ 개소당 최대 8백만원", 300 * 억),
    ("2026년 중소기업 매출채권보험 지원사업을 다음과 같이 공고합니다. ☞ 당기매출액 500억원 미만인 본사", 500 * 억),

    # 지원 한도 — 뽑으면 안 된다
    ("융자한도 : 기업당 전년도 매출액의 1/4 또는 최근 3개월간 매출액의 범위 내에서 3억원 이하의 운전자금", None),
    ("업체당 최대 3억원 이내(전년도 매출액 1/3 범위 내)", None),
    ("제조업 3억원, 비제조업 7천만원, 매출증빙 불가업체 3천만원", None),

    # 하한(이상)은 상한이 아니다
    ("연 매출액이 기준 피보험자 수x1,900만원 이상인 기업", None),

    # 매출 얘기가 아예 없거나 자격과 무관
    ("기업의 실질적 매출 창출 기반을 마련하고자", None),
    ("김해시에 본점 또는 사업장을 두고 매출실적이 3개월 이상 있는 공장등록된 중소제조업체", None),
    ("국제표준인증, 혁신인증 획득에 따른 매출증대 및 판매처 확대에 기여", None),
    ("무매출 사업자, 임대사업자, 공고일 기준 최초 사업개시일 이전 사업자", None),
    ("", None),
    (None, None),
]

fails = 0
for text, want in CASES:
    got = parse_revenue_cap(text)
    ok = got == want
    if not ok:
        fails += 1
    mark = "OK " if ok else "FAIL"
    print(f"{mark} 기대={won_to_label(want) or '없음':>8}  얻음={won_to_label(got) or '없음':>8}  {(text or '')[:44]}")

# 여러 조각을 같이 넘기면 가장 낮은 상한이 나와야 한다
multi = parse_revenue_cap("연매출 300억원 이하", "매출액 120억원 이하")
assert multi == 120 * 억, multi
print(f"\n여러 조각 → 가장 낮은 상한: {won_to_label(multi)}")
print(f"\n실패 {fails}건 / 전체 {len(CASES)}건")
sys.exit(1 if fails else 0)
