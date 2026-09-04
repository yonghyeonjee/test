"""
explore_apis.py — 스키마 확정 전, 4개 API의 실제 응답 구조를 확인한다.

각 소스마다:
  1) 전체 건수(totalCount) 확인   <- 정규화 비용이 여기서 결정됨
  2) 목록 20건 호출 -> 필드 목록 + 레코드 1건 출력
  3) 상세조회가 있으면 1건 호출 -> 지원대상/선정기준 원문 확인

    python pipeline/explore_apis.py
    python pipeline/explore_apis.py bokjiro_local
"""

import json
import os
import sys
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

KEY = os.environ.get("DATA_GO_KR_KEY", "").strip()
SAMPLES = ROOT / "samples"
SAMPLES.mkdir(exist_ok=True)
ROWS = 20

# 정규화의 재료가 되는 긴 서술형 필드
LONG_FIELDS = {
    "tgtrDtlCn", "slctCritCn", "alwServCn", "wlfareInfoOutlCn",
    "servDgst", "bsnsSumryCn", "trgetNm", "reqstMthPapersCn",
}


def fill(raw: dict, page=1) -> dict:
    out = {}
    for k, v in raw.items():
        v = str(v)
        v = v.replace("__SERVICE_KEY__", KEY)
        v = v.replace("__ROWS__", str(ROWS))
        v = v.replace("__PAGE__", str(page))
        out[k] = v
    return out


def diagnose(body: str) -> str | None:
    checks = {
        "SERVICE_KEY_IS_NOT_REGISTERED": "서비스키 미등록. Decoding 키인지, 승인됐는지 확인",
        "SERVICE KEY IS NOT REGISTERED": "서비스키 미등록. Decoding 키인지, 승인됐는지 확인",
        "NO_OPENAPI_SERVICE_ERROR": "엔드포인트 경로 오류",
        "LIMITED_NUMBER_OF_SERVICE_REQUESTS": "일일 호출 한도 초과",
        "SERVICE_ACCESS_DENIED": "이용 권한 없음. 활용신청 상태 확인",
        "DEADLINE_HAS_EXPIRED": "인증키 기한 만료",
    }
    for token, msg in checks.items():
        if token in body:
            return msg
    return None


# ── XML ──────────────────────────────────────────────────────

def xml_tags(text):
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return None, None
    counter = Counter(el.tag for el in root.iter())
    return root, counter


def xml_first_record(root):
    for el in root.iter():
        kids = list(el)
        if len(kids) >= 3 and all(len(list(k)) == 0 for k in kids):
            return el
    return None


def xml_flat(root):
    """중첩 무시하고 leaf 태그=값 전부 뽑기 (상세조회용)"""
    out = []
    for el in root.iter():
        if list(el):
            continue
        txt = (el.text or "").strip()
        if txt:
            out.append((el.tag, txt))
    return out


# ── JSON ─────────────────────────────────────────────────────

def json_first_record(obj):
    """가장 그럴듯한 레코드 리스트를 찾아 첫 항목 반환"""
    best = None
    def walk(o):
        nonlocal best
        if isinstance(o, list):
            if o and isinstance(o[0], dict) and (best is None or len(o) > 1):
                best = o[0]
            for v in o:
                walk(v)
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
    walk(obj)
    return best


def find_total(obj):
    found = {}
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k.lower() in ("totalcount", "totalcnt", "total"):
                    found[k] = v
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(obj)
    return found


# ── 본체 ─────────────────────────────────────────────────────

def probe(name: str, conf: dict):
    print("\n" + "=" * 72)
    print(f"[{name}] {conf['label']}")
    print("=" * 72)

    fmt = conf.get("format", "xml")

    try:
        r = requests.get(conf["url"], params=fill(conf["params"]), timeout=40)
    except Exception as e:
        print(f"  ERROR 요청 실패: {e}")
        return

    print(f"  HTTP {r.status_code}  ({len(r.text):,} bytes, {fmt})")
    ext = "json" if fmt == "json" else "xml"
    (SAMPLES / f"{name}_list.{ext}").write_text(r.text, encoding="utf-8")

    msg = diagnose(r.text)
    if msg:
        print(f"  !! {msg}")
        print("  " + r.text[:400].replace("\n", " "))
        return

    detail_id = None

    if fmt == "xml":
        root, counter = xml_tags(r.text)
        if root is None:
            print("  XML 파싱 실패:")
            print("  " + r.text[:500])
            return

        total = root.findtext(".//totalCount")
        print(f"  ** totalCount = {total} **")

        print(f"\n  -- 태그 {len(counter)}종 --")
        for tag, n in counter.most_common():
            print(f"     {tag:<30} x{n}")

        rec = xml_first_record(root)
        if rec is not None:
            print("\n  -- 레코드 1건 --")
            for c in rec:
                v = (c.text or "").strip()
                print(f"     {c.tag:<26} : {v[:160]}")
            detail_id = rec.findtext(conf.get("detail_key", "servId"))

    else:  # json
        try:
            obj = r.json()
        except Exception:
            print("  JSON 파싱 실패:")
            print("  " + r.text[:500])
            return

        totals = find_total(obj)
        print(f"  ** total 관련 필드 = {totals} **")

        print("\n  -- 최상위 구조 --")
        print("     " + json.dumps(obj, ensure_ascii=False)[:300])

        rec = json_first_record(obj)
        if rec:
            print(f"\n  -- 레코드 1건 ({len(rec)}개 필드) --")
            for k, v in rec.items():
                print(f"     {k:<26} : {str(v)[:160]}")
            detail_id = rec.get(conf.get("detail_key", ""))

    # ── 상세조회 ──
    durl = conf.get("detail_url")
    if not durl or not detail_id:
        return

    print(f"\n  -- 상세조회 ({conf['detail_key']}={detail_id}) --")
    dp = fill(conf.get("detail_params", {}))
    dp[conf["detail_key"]] = detail_id

    try:
        d = requests.get(durl, params=dp, timeout=40)
    except Exception as e:
        print(f"     ERROR: {e}")
        return

    print(f"     HTTP {d.status_code} ({len(d.text):,} bytes)")
    (SAMPLES / f"{name}_detail.{ext}").write_text(d.text, encoding="utf-8")

    msg = diagnose(d.text)
    if msg:
        print(f"     !! {msg}")
        return

    droot, _ = xml_tags(d.text)
    if droot is None:
        print("     " + d.text[:400])
        return

    for tag, val in xml_flat(droot):
        limit = 500 if tag in LONG_FIELDS else 120
        mark = " ***" if tag in LONG_FIELDS else ""
        print(f"     {tag:<24}{mark} : {val[:limit]}")


def main():
    if not KEY:
        print("DATA_GO_KR_KEY 가 비어 있습니다.")
        sys.exit(1)

    with open(Path(__file__).parent / "endpoints.json", encoding="utf-8") as f:
        cfg = {k: v for k, v in json.load(f).items() if not k.startswith("_")}

    for name in (sys.argv[1:] or list(cfg)):
        if name not in cfg:
            print(f"알 수 없는 키: {name}")
            continue
        probe(name, cfg[name])

    print("\n" + "-" * 72)
    print("*** 표시된 긴 필드가 정규화의 재료입니다.")
    print("위 출력 전체를 Claude 에 붙여넣으세요.")


if __name__ == "__main__":
    main()
