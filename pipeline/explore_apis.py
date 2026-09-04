"""
explore_apis.py — 스키마 설계 전에 실제 응답을 눈으로 확인하는 스크립트

사용법:
    python pipeline/explore_apis.py            # 전체
    python pipeline/explore_apis.py bokjiro_local   # 하나만

하는 일:
  1) endpoints.json 의 각 API를 20건씩 호출
  2) 원본 응답을 samples/{key}.xml 로 저장
  3) 응답에서 발견된 필드명 목록을 출력  <- 스키마 설계의 재료
"""

import json
import os
import sys
from pathlib import Path
from collections import Counter
from xml.etree import ElementTree as ET

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SERVICE_KEY = os.environ.get("DATA_GO_KR_KEY", "").strip()
SAMPLES = ROOT / "samples"
SAMPLES.mkdir(exist_ok=True)
ROWS = 20


def load_endpoints() -> dict:
    with open(Path(__file__).parent / "endpoints.json", encoding="utf-8") as f:
        cfg = json.load(f)
    return {k: v for k, v in cfg.items() if not k.startswith("_")}


def build_params(raw: dict) -> dict:
    out = {}
    for k, v in raw.items():
        v = str(v)
        v = v.replace("__SERVICE_KEY__", SERVICE_KEY)
        v = v.replace("__ROWS__", str(ROWS))
        v = v.replace("__PAGE__", "1")
        out[k] = v
    return out


def collect_field_names(xml_text: str):
    """응답에 등장하는 모든 태그명과 등장 횟수를 센다."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None
    counter = Counter()
    for el in root.iter():
        counter[el.tag] += 1
    return counter


def sample_first_record(xml_text: str):
    """반복되는 아이템 하나를 골라 필드=값 형태로 보여준다."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None

    # 자식이 여러 개인 반복 노드를 찾는다
    best = None
    for el in root.iter():
        children = list(el)
        if len(children) >= 3 and all(len(list(c)) == 0 for c in children):
            best = el
            break
    if best is None:
        return None
    return [(c.tag, (c.text or "").strip()[:120]) for c in best]


def probe(key: str, conf: dict):
    print("\n" + "=" * 70)
    print(f"[{key}] {conf['label']}")
    print("=" * 70)

    url = conf["url"]
    if "PUT_ENDPOINT_HERE" in url:
        print("  SKIP: endpoints.json 에 URL을 아직 안 넣었습니다.")
        print(f"        참고: {conf['portal']}")
        return

    try:
        r = requests.get(url, params=build_params(conf["params"]), timeout=30)
    except Exception as e:
        print(f"  ERROR: 요청 실패 - {e}")
        return

    print(f"  HTTP {r.status_code}  ({len(r.text):,} bytes)")

    out = SAMPLES / f"{key}.xml"
    out.write_text(r.text, encoding="utf-8")
    print(f"  saved -> {out.relative_to(ROOT)}")

    body = r.text

    # 흔한 실패 케이스 진단
    if "SERVICE_KEY_IS_NOT_REGISTERED" in body or "SERVICE KEY IS NOT REGISTERED" in body:
        print("  !! 서비스키 미등록. Decoding 키를 썼는지, 승인 상태인지 확인하세요.")
        return
    if "NO_OPENAPI_SERVICE_ERROR" in body:
        print("  !! 엔드포인트 경로 오류. Swagger에서 오퍼레이션명을 다시 확인하세요.")
        return
    if "LIMITED_NUMBER_OF_SERVICE_REQUESTS" in body:
        print("  !! 일일 호출 한도 초과.")
        return

    fields = collect_field_names(body)
    if fields is None:
        print("  (XML 파싱 실패 - 응답 앞부분)")
        print("  " + body[:600].replace("\n", "\n  "))
        return

    print(f"\n  -- 발견된 태그 ({len(fields)}종) --")
    for tag, n in fields.most_common():
        print(f"     {tag:<32} x{n}")

    rec = sample_first_record(body)
    if rec:
        print("\n  -- 레코드 1건 샘플 --")
        for tag, val in rec:
            print(f"     {tag:<28} : {val}")


def main():
    if not SERVICE_KEY:
        print("DATA_GO_KR_KEY 가 비어 있습니다. .env 를 확인하세요.")
        sys.exit(1)

    endpoints = load_endpoints()
    targets = sys.argv[1:] or list(endpoints.keys())

    for key in targets:
        if key not in endpoints:
            print(f"알 수 없는 키: {key}")
            continue
        probe(key, endpoints[key])

    print("\n" + "-" * 70)
    print("samples/ 폴더의 xml 파일을 열어보고, 위 태그 목록을 공유하면")
    print("그걸 기준으로 통합 스키마를 확정합니다.")


if __name__ == "__main__":
    main()
