"""첨부·관련 링크 어댑터. 2026-10 탐침에서 본 실제 응답 모양으로.
   python pipeline/test_sources_attach.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sources as s  # noqa: E402

bad = 0
def ok(c, m):
    global bad
    if not c:
        bad += 1; print("  ✗", m)

# 지자체 상세: wlfareInfo* 이름. 040 서식 둘, 010 문의처(링크 아님)
local_lists = {
    "inqplCtadrList": [{"wlfareInfoDtlCd": "010", "wlfareInfoReldCn": "053-663-2573", "wlfareInfoReldNm": "서구청 복지정책과"}],
    "basfrmList": [
        {"wlfareInfoDtlCd": "040", "wlfareInfoReldCn": "https://www.bokjiro.go.kr/ssis-tbu/CmmFileUtil/siteQnaInfoDownload.do?atcflId=2026A&atcflSn=1", "wlfareInfoReldNm": "의료ㆍ요양 등 지역 돌봄의 통합지원에 관한 법률.pdf"},
        {"wlfareInfoDtlCd": "040", "wlfareInfoReldCn": "https://www.bokjiro.go.kr/ssis-tbu/CmmFileUtil/siteQnaInfoDownload.do?atcflId=2026B&atcflSn=1", "wlfareInfoReldNm": "[별지 제1호서식] 통합지원 신청서.pdf"},
        {"wlfareInfoDtlCd": "040", "wlfareInfoReldCn": "https://www.bokjiro.go.kr/ssis-tbu/CmmFileUtil/siteQnaInfoDownload.do?atcflId=2026B&atcflSn=1", "wlfareInfoReldNm": "같은 파일 또"},
    ],
}
a = s.bokjiro_attach(local_lists)
ok(len(a) == 2, a)
ok(a[0]["kind"] == "file" and a[0]["ext"] == "pdf" and a[0]["name"].startswith("의료"), a[0])
ok(a[1]["name"].startswith("[별지 제1호서식]"), a[1])

# 중앙 상세: servSe* 이름. 020 누리집 → site. applmetList 는 링크가 아니라 무시
central_lists = {
    "applmetList": [{"servSeCode": "070", "servSeDetailLink": "거주지 읍/면/동 주민센터에서 신청", "servSeDetailNm": "신청기관연락처목록"}],
    "inqplHmpgReldList": [{"servSeCode": "020", "servSeDetailLink": "http://www.mohw.go.kr", "servSeDetailNm": "보건복지부"}],
    "baslawList": [{"servSeCode": "030", "servSeDetailNm": "노인복지법"}],
}
a = s.bokjiro_attach(central_lists)
ok(a == [{"name": "보건복지부", "url": "http://www.mohw.go.kr", "kind": "site"}], a)
ok(s.bokjiro_attach(None) is None and s.bokjiro_attach({}) == [], "빈 목록")

# 어댑터에 _lists 가 실려 오면 attach 가 채워진다
row = s.from_bokjiro_local({"servId": "WLF1"}, {"enfcEndYmd": "99991231", "_lists": local_lists})
ok(len(row["attach"]) == 2, row["attach"])
row = s.from_bokjiro_central({"servId": "WLF2"}, {"_lists": central_lists})
ok(row["attach"][0]["kind"] == "site", row["attach"])
ok(s.from_bokjiro_local({"servId": "WLF3"}, None)["attach"] is None, "상세 없으면 None")

# 기업마당 목록 항목
item = {"pblancId": "PBLN_1", "pblancNm": "2026년 문화체육관광형 예비사회적기업 지정 계획 공고",
        "printFlpthNm": "https://www.bizinfo.go.kr/cmm/fms/getImageFile.do?atchFileId=FILE_1&fileSn=1",
        "printFileNm": "2026년도 문화체육관광형 예비사회적기업 지정 모집 공고.hwpx",
        "flpthNm": None, "fileNm": None, "rceptEngnHmpgUrl": "https://www.seis.or.kr/mainPage.do",
        "reqstBeginEndDe": "2026-10-01 ~ 2026-10-20"}
a = s.from_bizinfo_support(item)["attach"]
ok(len(a) == 2, a)
ok(a[0] == {"name": "2026년도 문화체육관광형 예비사회적기업 지정 모집 공고.hwpx", "url": item["printFlpthNm"], "kind": "file", "ext": "hwpx"}, a[0])
ok(a[1] == {"name": "접수 누리집", "url": "https://www.seis.or.kr/mainPage.do", "kind": "site"}, a[1])
ok(s.from_bizinfo_support({"pblancId": "P2", "pblancNm": "x", "reqstBeginEndDe": None})["attach"] == [], "첨부 없으면 []")

print("sources attach OK" if not bad else f"{bad}건 실패")
sys.exit(1 if bad else 0)
