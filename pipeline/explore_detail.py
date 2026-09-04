"""상세조회 응답 + 전체 건수 확인"""
import os, sys
from pathlib import Path
from xml.etree import ElementTree as ET
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
KEY = os.environ["DATA_GO_KR_KEY"]
(ROOT / "samples").mkdir(exist_ok=True)

TARGETS = {
    "bokjiro_local": (
        "http://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist",
        "http://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfaredetailed",
    ),
    "bokjiro_central": (
        "http://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001",
        "http://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfaredetailedV001",
    ),
}

for name, (list_url, detail_url) in TARGETS.items():
    print("\n" + "=" * 70)
    print(name)
    print("=" * 70)

    # 전체 건수
    r = requests.get(list_url, params={
        "serviceKey": KEY, "pageNo": 1, "numOfRows": 1, "callTp": "L"
    }, timeout=30)
    try:
        root = ET.fromstring(r.text)
        total = root.findtext(".//totalCount")
        first_id = root.findtext(".//servId")
        print(f"  totalCount = {total}")
    except Exception as e:
        print(f"  목록 파싱 실패: {e}")
        continue

    # 상세조회
    print(f"  상세조회 대상 servId = {first_id}")
    d = requests.get(detail_url, params={
        "serviceKey": KEY, "servId": first_id, "callTp": "D"
    }, timeout=30)
    print(f"  HTTP {d.status_code} ({len(d.text):,} bytes)")

    (ROOT / "samples" / f"{name}_detail.xml").write_text(d.text, encoding="utf-8")

    try:
        droot = ET.fromstring(d.text)
    except Exception:
        print("  " + d.text[:800])
        continue

    for el in droot.iter():
        if list(el):
            continue
        txt = (el.text or "").strip()
        if txt:
            print(f"     {el.tag:<26} : {txt[:300]}")
