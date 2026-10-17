"""알리오 공공기관 채용정보 API 를 실제로 불러 응답 모양을 본다(2026-10-17). 키 값은 찍지 않는다.
공공데이터포털 기획재정부_공공기관 채용정보 조회서비스(1051000/recruitment) 목록·상세를 키 후보마다 시험한다.
"""
import json
import os
import re

import requests

BASE = "https://apis.data.go.kr/1051000/recruitment"
KEYS = [(n, os.environ.get(n, "").strip()) for n in ("ALIO_RECRUIT_KEY", "DATA_GO_KR_KEY")]


def mask(s: str) -> str:
    for _, k in KEYS:
        if k:
            s = s.replace(k, "***").replace(requests.utils.quote(k, safe=""), "***")
    return s


for name, key in KEYS:
    print(f"\n== {name}: {'있음 ' + str(len(key)) + '자' if key else '없음'}")
    if not key:
        continue
    for path, extra in (("list", {"numOfRows": "3", "pageNo": "1"}),):
        try:
            r = requests.get(f"{BASE}/{path}", params={"serviceKey": key, "resultType": "json", **extra}, timeout=40)
        except Exception as e:  # noqa: BLE001
            print(f"   {path}: 실패 {type(e).__name__}")
            continue
        print(f"   {path}: status {r.status_code} type {r.headers.get('content-type')}")
        body = mask(r.text)
        print("   " + body[:3000].replace("\n", " "))
        try:
            d = r.json()
        except Exception:  # noqa: BLE001
            continue
        items = d.get("result") or d.get("items") or (d.get("response", {}).get("body", {}).get("items"))
        first = items[0] if isinstance(items, list) and items else None
        if isinstance(first, dict):
            print("   필드: " + ", ".join(first.keys()))
            sn = next((first[k] for k in ("recrutPblntSn", "sn", "idx") if k in first), None)
            if sn:
                r2 = requests.get(f"{BASE}/detail", params={"serviceKey": key, "resultType": "json", "sn": sn}, timeout=40)
                print(f"   detail sn={sn}: status {r2.status_code}")
                print("   " + mask(r2.text)[:4000].replace("\n", " "))
