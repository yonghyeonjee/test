"""
test_sbiz24.py — 소상공인24 어댑터 검증. 탐침 9차(2026-09-24) 응답을 줄인 견본으로 돈다.

    python pipeline/test_sbiz24.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sbiz24 import detail_path, list_body  # noqa: E402
from sources import from_sbiz24, sido_in_text, section, tidy, _SEC_TARGET  # noqa: E402

A_ITEM = {"pbancSn": 829, "pbancGubun": "A", "pbancNm": "2026년 패션 메이커허브 소공인 코워킹스페이스 입주기업 추가모집 공고",
          "rcrtTypeCdNm": "소상공인", "aplyPsbltySe": "신청가능", "aplyPd": "2026-09-14 ~ 2026-09-28",
          "bizType": "공단지원사업", "departNm": "소상공인시장진흥공단", "pbancKindCd": "P"}
A_DETAIL = {"pbancSn": 829, "pbancNm": A_ITEM["pbancNm"], "rcrtTypeCdNm": "소상공인", "pbancAplyYn": True,
            "rcptPd": {"from": "2026-09-14 09:00", "to": "2026-09-28 18:00"}, "sprtBizTypeNm": "소공인 지원",
            "pbancDtlCn": (
                '<p style="text-align: center;"><span style="font-size: 22pt;">2026년 패션 메이커허브 소공인 코워킹스페이스&nbsp;</span></p>\n'
                '<p><span>성장가능성이 높은 의류&middot;패션잡화&middot;주얼리 제조 창업자의 육성을 위해 다음과 같이 공고합니다.</span></p>\n'
                '<p><span>□ 지원대상 : 서울 소재 의류·패션잡화·주얼리 제조 소공인(상시근로자 10인 미만) 및 예비창업자</span></p>\n'
                '<p><span>□ 지원내용 : 코워킹스페이스 입주(월 5만원), 시제품 제작 장비 이용</span></p>\n'
                '<p><span>□ 신청자격 : 사업자등록증 기준 서울특별시 소재, 창업 7년 이내</span></p>\n'
                '<p><span>□ 신청기간 : 2026. 9. 14.(월) ~ 9. 28.(월) 18:00</span></p>'
            )}

D_ITEM = {"pbancSn": 825, "pbancGubun": "D", "pbancNm": "「2026년 울산광역시 소상공인 산재보험료 지원사업」공고",
          "rcrtTypeCdNm": "소상공인", "aplyPd": "2026-05-06 ~ 2026-12-31", "bizType": "지방정부사업", "departNm": "울산광역시"}
D_DETAIL = {"pbancSn": 825, "pbancAplyYn": False, "ctpvCdNm": "울산광역시", "pbancRgn": "울산",
            "pbancDtlCn": "<p>울산경제일자리진흥원 공고 제2026 &ndash; 93호</p>\n<p>「2026년 소상공인 산재보험료 지원사업」 공고</p>\n"
                          "<p>자영업자의 사회안전망 확충을 위한 사업을 공고합니다.</p>\n"
                          "<p>1. 지원대상 : 울산광역시 소재 소상공인 중 산재보험(중소기업사업주) 가입자, 연 매출 3억원 이하</p>\n"
                          "<p>2. 지원내용 : 납부 보험료의 30%</p>"}

C_ITEM = {"pbancSn": 415, "pbancGubun": "C", "pbancNm": "사잇돌Ⅱ대출_대환형", "rcrtTypeCdNm": "기타",
          "aplyPd": "상시", "bizType": "대출상품", "departNm": "SGI서울보증"}
C_DETAIL = {"loanGdsSn": "415", "ageVl": "없음", "crdtScrCn": "없음", "fncGdsNm": "사잇돌Ⅱ대출_대환형", "trmtInstNm": "저축은행",
            "earnInfoCn": "없음", "irVl": "~19.99", "irTypeVl": "변동금리", "joinMthdCn": "취급 금융기관 방문, 서금원 맞춤대출 조회",
            "loanLimitVl": "2000", "maxRpmtPdCn": "5", "totalLoanPdCn": "5(최대 60개월, 보증기간 이내)", "pvsnInstNm": "SGI서울보증",
            "gdsOperPdCn": "상시", "rpmtMthdCn": "원(리)금균등분할상환", "rfrnMttr": "취급 저축은행 콜센터, 서민금융콜센터 (국번없이) 1397",
            "rltnSiteAddr": "https://www.fsb.or.kr", "srvcPvsnRgnVl": "전국",
            "sprtTrgtDtlCndCn": "중저신용 거래자로, 소득수준 요건 등에 해당하는 자 (개별 취급 금융기관 문의)",
            "trgtCn": "근로자, 사업자, 연금소득자", "useUsgVl": "생계", "excptnMttr": "-",
            "etcRfrncMttrCn": "- 재직근로자의 대학학자금 : 거치기간 연 1.0%, 상환기간 연 3.0%"}

B_ITEM = {"pbancSn": None, "pbancGubun": "B", "pbancId": "PBLN_000000000126771", "pbancNm": "[전북] 라이브커머스 참여 소상공인 모집 공고"}


def check(cond, msg):
    if not cond:
        print("  FAIL", msg)
        return 1
    return 0


def main():
    bad = 0

    # 목록 본문: 그리드가 보내는 모양 그대로
    b = list_body(2, 500)
    bad += check(b["startRow"] == 500 and b["endRow"] == 1000 and b["paging"] is True and b["search"] == {}, f"list_body {b}")

    # 상세 경로: A/D 는 pbanc, C 는 loanProduct, B 는 없음
    bad += check(detail_path(A_ITEM) == "/api/pbanc/829", detail_path(A_ITEM))
    bad += check(detail_path(D_ITEM) == "/api/pbanc/825", detail_path(D_ITEM))
    bad += check(detail_path(C_ITEM) == "/api/loanProduct/415", detail_path(C_ITEM))
    bad += check(detail_path(B_ITEM) is None, "B 는 상세 없음")
    bad += check(from_sbiz24(B_ITEM, None) is None and from_sbiz24(A_ITEM, None) is None, "상세 없으면 None")

    # 시도
    bad += check(sido_in_text("[전북] 라이브커머스") == "전북특별자치도", "bracket sido")
    bad += check(sido_in_text("「2026년 울산광역시 소상공인 산재보험료 지원사업」공고") == "울산광역시", "울산")
    bad += check(sido_in_text("서울·경기 소상공인 모집") is None, "둘 이상이면 None")
    bad += check(sido_in_text("2026년 소상공인 모집") is None, "없으면 None")

    # 빈 문단 정리
    t = tidy("제목 \n \n \n \n 본문 \n끝")
    bad += check(t == "제목\n\n본문\n끝", f"tidy {t!r}")

    # 본문 항목 자르기
    sec = section("□ 지원대상 : 서울 소재 소공인\n□ 지원내용 : 입주", _SEC_TARGET)
    bad += check(sec == "서울 소재 소공인", f"section {sec!r}")

    # A 공단 공고
    a = from_sbiz24(A_ITEM, A_DETAIL)
    bad += check(a["source"] == "sbiz24" and a["source_id"] == "P829" and a["kind"] == "business", f"A id {a['source_id']}")
    bad += check(a["detail_url"] == "https://www.sbiz24.kr/#/pbanc/829", a["detail_url"])
    bad += check(a["apply_start"] == "2026-09-14" and a["apply_end"] == "2026-09-28" and a["is_always_on"] is False, f"A dates {a['apply_start']} {a['apply_end']}")
    bad += check(a["raw_target"].startswith("소상공인\n\n서울 소재 의류·패션잡화·주얼리 제조 소공인"), f"A raw_target {a['raw_target']!r}")
    bad += check("지원내용" not in a["raw_target"], "raw_target 이 다음 항목까지 먹지 않아야")
    bad += check(a["raw_criteria"] and a["raw_criteria"].startswith("사업자등록증 기준 서울특별시 소재, 창업 7년 이내"), f"A raw_criteria {a['raw_criteria']!r}")
    bad += check(a["sido"] is None, f"A 제목에 시도 없음 → 전국 {a['sido']}")
    bad += check(a["online_apply"] is True and a["apply_method"], "A 온라인 신청")
    bad += check(a["support_type"] == "공단지원사업" and a["org_name"] == "소상공인시장진흥공단", "A 유형/기관")
    bad += check("<" not in (a["raw_benefit"] or "") and "&middot;" not in a["raw_benefit"], "A 본문 태그·엔티티 제거")
    bad += check(a["dept_name"] is None, "A 내부 분류 라벨은 부서로 쓰지 않음")
    a2 = from_sbiz24(A_ITEM, {**A_DETAIL, "pbancDtlCn": A_DETAIL["pbancDtlCn"] + "\n<p>※ 문의처 ※</p>\n<p>- 사업문의 : 소공인코워킹스페이스 담당자(02-742-3771)</p>"})
    bad += check(a2["contact"] == "사업문의 : 소공인코워킹스페이스 담당자(02-742-3771)", f"A contact {a2['contact']!r}")
    bad += check(a["contact"] is None, "전화번호 없으면 contact None")

    # D 지방정부 공고
    d = from_sbiz24(D_ITEM, D_DETAIL)
    bad += check(d["source_id"] == "P825" and d["detail_url"].endswith("#/lcgPbanc/825"), f"D {d['source_id']} {d['detail_url']}")
    bad += check(d["sido"] == "울산광역시", f"D sido {d['sido']}")
    bad += check(d["raw_target"].startswith("소상공인\n\n울산광역시 소재 소상공인 중 산재보험"), f"D raw_target {d['raw_target']!r}")
    bad += check(d["revenue_max"] == 300_000_000, f"D revenue_max {d['revenue_max']}")
    bad += check(d["apply_end"] == "2026-12-31" and d["online_apply"] is None, "D dates")

    # C 대출상품
    c = from_sbiz24(C_ITEM, C_DETAIL)
    bad += check(c["source_id"] == "L415" and c["detail_url"].endswith("#/loanProduct/415"), f"C {c['source_id']}")
    bad += check(c["is_always_on"] is True and c["support_type"] == "대출" and c["sido"] is None, "C 상시·전국")
    bad += check(c["amount_max"] == 20_000_000, f"C amount_max {c['amount_max']}")
    bad += check("근로자, 사업자, 연금소득자" in c["raw_target"] and "중저신용" in c["raw_target"], f"C raw_target {c['raw_target']!r}")
    bad += check("나이" not in c["raw_target"], "'없음' 항목은 raw_target 에 넣지 않음")
    bad += check(c["raw_benefit"].startswith("대출 한도 2,000만원\n금리: ~19.99%"), f"C raw_benefit {c['raw_benefit']!r}")
    bad += check(c["raw_criteria"] is None and c["contact"].startswith("취급 저축은행"), "C 예외/문의")
    c2 = from_sbiz24(C_ITEM, {**C_DETAIL, "irVl": "4.5", "irTypeVl": "4.5", "totalLoanPdCn": "7"})
    bad += check("금리: 4.5%" in c2["raw_benefit"] and "금리 방식" not in c2["raw_benefit"] and "대출 기간: 7년" in c2["raw_benefit"], f"C 중복 금리 {c2['raw_benefit']!r}")
    bad += check(c["org_name"] == "SGI서울보증" and c["dept_name"] == "저축은행", "C 기관")

    # 상세가 빈 껍데기(제목 없음)면 버린다
    bad += check(from_sbiz24({**C_ITEM, "pbancSn": 13, "pbancNm": None}, {"key": "13", "es": "N"}) is None, "빈 상세는 None")

    # P/L 접두어로 pbanc 415 와 loanProduct 415 가 안 겹친다
    bad += check(from_sbiz24({**A_ITEM, "pbancSn": 415}, A_DETAIL)["source_id"] != c["source_id"], "sn 충돌")

    print("sbiz24 어댑터: " + ("모두 통과" if bad == 0 else f"{bad}건 실패"))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
