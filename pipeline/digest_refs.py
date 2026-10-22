"""
digest_refs.py — 모음 글(tistory_publish.digest)에 묶인 글마다 붙일 공식 사이트 화면과 참고 링크.

글 제목·slug 에 든 낱말로 주제를 고른다. 화면(shots)은 그 절 첫머리에, 링크(refs)는 그 절 끝 '근거 자료' 줄에 들어간다.
주소는 러너 탐침(probe_pages head:/links:)으로 열리는 것을 확인한 것만 둔다(2026-10-22).
"""

from __future__ import annotations

# 주제 → (화면 [(주소, 파일 이름, 설명)], 참고 링크 [(이름, 주소)])
TOPICS: list[tuple[tuple[str, ...], list[tuple[str, str, str]], list[tuple[str, str]]]] = [
    (("채용", "공고", "브리핑", "daily"),
     [("https://www.gojobs.go.kr", "gojobs", "인사혁신처 나라일터 — 국가·지자체 채용 공고 원 자료 (gojobs.go.kr)"),
      ("https://job.alio.go.kr", "alio", "잡알리오 공공기관 채용정보시스템 — 공공기관 채용 공고 원 자료 (job.alio.go.kr)")],
     [("인사혁신처 나라일터", "https://www.gojobs.go.kr"), ("잡알리오 공공기관 채용정보", "https://job.alio.go.kr"),
      ("고용24 채용정보·AI 추천 일자리", "https://www.work24.go.kr"), ("NCS 국가직무능력표준(직무기술서)", "https://www.ncs.go.kr")]),
    (("전세", "버팀목", "임대차", "보증금"),
     [("https://www.hf.go.kr/ko/sub02/sub02_01_02.do", "hf_jeonse", "한국주택금융공사 일반전세자금보증 안내 (hf.go.kr)"),
      ("https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020301.jsp", "nhuf_youth", "주택도시기금 청년전용 버팀목전세자금 안내 (nhuf.molit.go.kr)")],
     [("한국주택금융공사 일반전세자금보증", "https://www.hf.go.kr/ko/sub02/sub02_01_02.do"),
      ("한국주택금융공사 전세대출금리 안내", "https://www.hf.go.kr/ko/sub02/sub02_01_07_01.do"),
      ("주택도시기금 청년전용 버팀목전세자금", "https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020301.jsp"),
      ("주택도시기금 버팀목전세자금", "https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020101.jsp"),
      ("주택도시기금 주택전세자금 계산", "https://nhuf.molit.go.kr/FP/FP08/FP0801/FP08010101.jsp"),
      ("HUG 안심전세포털(전세보증금반환보증)", "https://www.khug.or.kr/jeonse/index.jsp"),
      ("국토교통부 실거래가 공개시스템(시세 확인)", "https://rt.molit.go.kr"),
      ("대법원 인터넷등기소(등기부 확인)", "https://www.iros.go.kr"),
      ("찾기쉬운 생활법령정보 — 주택임대차", "https://www.easylaw.go.kr")]),
]


def refs_for(post: dict) -> tuple[list[tuple[str, str, str]], list[tuple[str, str]]]:
    hay = f"{post.get('slug', '')} {post.get('title', '')} {post.get('kind', '')}"
    for keys, shots, links in TOPICS:
        if any(k in hay for k in keys):
            return shots, links
    return [], []
