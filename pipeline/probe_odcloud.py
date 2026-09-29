"""
probe_odcloud.py — 공공데이터포털(odcloud) 파일 API 의 실제 모양을 본다.

    DATA_GO_KR_KEY=... python pipeline/probe_odcloud.py 15090223

  1) 스웨거 문서에서 엔드포인트 경로(uddi:…)와 필드를 읽고
  2) 첫 쪽을 불러 필드명과 앞 몇 줄을 찍는다.
  3) 같은 키로 주택금융공사 u-보금자리론 금리 API 도 되는지 본다.

인증키는 어디에도 찍지 않는다(mask).
"""

import json
import os
import sys
from urllib.parse import unquote

import requests

KEY = os.environ.get("DATA_GO_KR_KEY", "").strip()
DEC = unquote(KEY)


def mask(s: str) -> str:
    for k in (KEY, DEC):
        if k:
            s = s.replace(k, "***")
    return s


def main():
    ns = sys.argv[1] if len(sys.argv) > 1 else "15090223"
    print(f"=== 1) 스웨거 namespace={ns}")
    r = requests.get("https://infuser.odcloud.kr/oas/docs", params={"namespace": f"{ns}/v1"}, timeout=30)
    print("  ", r.status_code, r.headers.get("content-type"))
    doc = r.json()
    print("   title:", doc.get("info", {}).get("title"))
    paths = list(doc.get("paths", {}).keys())
    print("   paths:", paths)
    for p, ops in doc.get("paths", {}).items():
        for m, op in ops.items():
            print(f"   {m.upper()} {p} :: {op.get('summary')}")
            params = [q.get("name") for q in op.get("parameters", [])]
            print("     params:", params)
            resp = op.get("responses", {}).get("200", {})
            schema = resp.get("content", {}).get("application/json", {}).get("schema", {})
            props = schema.get("properties", {}).get("data", {}).get("items", {}).get("properties", {})
            print("     fields:", list(props.keys()))

    if not paths:
        return
    path = paths[0]
    print(f"\n=== 2) 첫 쪽 {path}")
    r = requests.get(f"https://api.odcloud.kr/api{path}",
                     params={"page": 1, "perPage": 100, "serviceKey": DEC}, timeout=30)
    print("  ", r.status_code, mask(r.text[:200]))
    try:
        j = r.json()
        print("   keys:", list(j.keys()), "| totalCount:", j.get("totalCount"), "| currentCount:", j.get("currentCount"))
        data = j.get("data") or []
        if data:
            print("   fields:", list(data[0].keys()))
            for row in data[:8]:
                print("   ", json.dumps(row, ensure_ascii=False)[:300])
    except Exception as e:
        print("   json 실패:", type(e).__name__)

    print("\n=== 3) u-보금자리론 금리 API (B551408/u-loan-rate/uloan-info)")
    try:
        r = requests.get("http://apis.data.go.kr/B551408/u-loan-rate/uloan-info",
                         params={"serviceKey": DEC, "numOfRows": 20, "pageNo": 1, "dataType": "JSON"}, timeout=30)
        print("  ", r.status_code, mask(r.text[:600]))
    except Exception as e:
        print("   실패", type(e).__name__, mask(str(e)))

    print("\n=== 4) 참고: 전세자금대출 금리 API 가 같은 키로 되는지")
    try:
        r = requests.get("http://apis.data.go.kr/B551408/rent-loan-rate-info/rate-list",
                         params={"serviceKey": DEC, "numOfRows": 3, "pageNo": 1, "dataType": "JSON"}, timeout=30)
        print("  ", r.status_code, mask(r.text[:300]))
    except Exception as e:
        print("   실패", type(e).__name__, mask(str(e)))


if __name__ == "__main__":
    main()
