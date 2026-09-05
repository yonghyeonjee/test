"""
collect.py — 4개 API를 돌며 원본을 raw_items 에, 매핑 결과를 programs 에 적재

사용:
    python pipeline/collect.py                      # 전체
    python pipeline/collect.py bokjiro_local        # 하나만
    python pipeline/collect.py bokjiro_local --detail-only   # 상세만 보충

특징
  - 목록은 페이징으로 전부 훑는다
  - 상세조회는 아직 안 가져온 건만 (중단돼도 다음 실행에서 이어짐)
  - 일일 쿼터를 넘지 않도록 MAX_CALLS 로 상한
  - 실패해도 다음 건으로 넘어가고, ingest_runs 에 결과를 남긴다
"""

import json
import os
import sys
import time
from pathlib import Path
from xml.etree import ElementTree as ET

import re
from urllib.parse import quote

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, str(Path(__file__).parent))
from sources import ADAPTERS  # noqa: E402

# 로그 버퍼링 해제: 타임아웃으로 강제 종료돼도 진행 상황이 남는다
try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

KEY = os.environ["DATA_GO_KR_KEY"].strip()
SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# 소스별 일일 호출 상한 (지자체 API 는 개발계정 1,000/일)
MAX_CALLS = {
    "bokjiro_local": int(os.environ.get("MAX_CALLS_LOCAL", 900)),
    "bokjiro_central": int(os.environ.get("MAX_CALLS_CENTRAL", 900)),
    "bizinfo_support": 300,
    "bizinfo_event": 100,
}
PAGE_ROWS = 100
SLEEP = 0.12          # 초당 30tps 제한 대비 여유
TIMEOUT = 10
RETRIES = 1           # 오래 붙들지 않는다. 실패 건은 다음 실행에서 다시 시도된다
DEADLINE_MIN = 45     # 이 시간을 넘기면 저장하고 정상 종료 (러너 타임아웃 회피)

# 연결 실패/5xx 를 지수 백오프로 재시도하는 세션
SESSION = requests.Session()
_retry = Retry(
    total=RETRIES,
    connect=RETRIES,
    read=RETRIES,
    backoff_factor=1,                     # 1s, 2s
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
)
SESSION.mount("https://", HTTPAdapter(max_retries=_retry))
SESSION.mount("http://", HTTPAdapter(max_retries=_retry))


class Quota:
    def __init__(self, limit):
        self.limit, self.used = limit, 0

    def take(self):
        if self.used >= self.limit:
            return False
        self.used += 1
        return True


def mask(text) -> str:
    """예외 메시지 등에 섞여 나오는 서비스키를 가린다."""
    t = str(text)
    t = re.sub(r"serviceKey=[^&\s)]+", "serviceKey=***", t)
    if KEY:
        t = t.replace(KEY, "***")
        t = t.replace(quote(KEY, safe=""), "***")
    return t


# 호스트별로 http 폴백 여부를 기억한다.
# 매 요청마다 https 타임아웃을 기다리면 건당 30초씩 낭비된다.
_USE_HTTP: set[str] = set()


def _host(url: str) -> str:
    return url.split("//", 1)[-1].split("/", 1)[0]


def get(url, params, fmt):
    """재시도 + https 실패 시 http 폴백 (폴백 결과를 호스트 단위로 기억)"""
    h = _host(url)
    if h in _USE_HTTP:
        url = url.replace("https://", "http://", 1)

    try:
        r = SESSION.get(url, params=params, timeout=TIMEOUT)
    except requests.exceptions.RequestException:
        alt = url.replace("https://", "http://", 1)
        if alt == url:
            raise
        print(f"    https 실패 -> {h} 는 이후 http 사용", flush=True)
        _USE_HTTP.add(h)
        r = SESSION.get(alt, params=params, timeout=TIMEOUT)

    time.sleep(SLEEP)
    if fmt == "json":
        return r.json()
    return ET.fromstring(r.text)


def xml_items(root, tag):
    out = []
    for el in root.iter(tag):
        rec = {}
        for c in el:
            if len(list(c)) == 0:
                rec[c.tag] = (c.text or "").strip()
        out.append(rec)
    return out


def xml_detail(root):
    """상세 응답을 flat dict 로. 반복 태그는 첫 값만."""
    rec = {}
    for el in root.iter():
        if list(el):
            continue
        txt = (el.text or "").strip()
        if txt and el.tag not in rec:
            rec[el.tag] = txt
    return rec


def json_items(obj):
    try:
        items = obj["response"]["body"]["items"]["item"]
    except (KeyError, TypeError):
        return []
    return items if isinstance(items, list) else [items]


def fill(raw, page=1, rows=PAGE_ROWS):
    return {
        k: str(v).replace("__SERVICE_KEY__", KEY)
                 .replace("__ROWS__", str(rows))
                 .replace("__PAGE__", str(page))
        for k, v in raw.items()
    }


def upsert(table, rows, conflict):
    """500건씩 나눠서 upsert"""
    n = 0
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        SB.table(table).upsert(chunk, on_conflict=conflict).execute()
        n += len(chunk)
    return n


def run(name, conf, detail_only=False):
    print(f"\n{'=' * 64}\n[{name}] {conf['label']}\n{'=' * 64}", flush=True)
    deadline = time.time() + DEADLINE_MIN * 60

    run_row = SB.table("ingest_runs").insert(
        {"source": name, "status": "running"}
    ).execute().data[0]
    run_id = run_row["id"]

    q = Quota(MAX_CALLS.get(name, 500))
    fmt = conf.get("format", "xml")
    adapt = ADAPTERS[name]
    fetched = 0

    try:
        # ── 1) 목록 전체 수집 ──
        if not detail_only:
            page, total = 1, None
            raw_rows, prog_rows = [], []

            fails = 0
            while q.take():
                try:
                    data = get(conf["url"], fill(conf["params"], page), fmt)
                except Exception as e:
                    fails += 1
                    print(f"  page {page} 실패({fails}/3): {type(e).__name__}")
                    if fails >= 3:
                        print("  연속 실패 — 여기까지 저장하고 중단합니다")
                        break
                    time.sleep(10)
                    continue
                fails = 0

                if fmt == "xml":
                    if total is None:
                        t = data.findtext(".//totalCount")
                        total = int(t) if t and t.isdigit() else 0
                        print(f"  totalCount = {total}")
                    items = xml_items(data, "servList")
                else:
                    if total is None:
                        total = data.get("response", {}).get("body", {}).get("totalCount", 0)
                        print(f"  totalCount = {total}")
                    items = json_items(data)

                if not items:
                    break

                for it in items:
                    mapped = adapt(it, None)
                    sid = mapped.get("source_id")
                    if not sid:
                        continue
                    raw_rows.append({
                        "source": name, "source_id": sid,
                        "payload": {"list": it},
                    })
                    prog_rows.append({k: v for k, v in mapped.items() if v is not None})

                fetched += len(items)
                print(f"  page {page}: +{len(items)}  (누적 {fetched})", flush=True)

                if len(raw_rows) >= 500:
                    upsert("raw_items", raw_rows, "source,source_id")
                    upsert("programs", prog_rows, "source,source_id")
                    print(f"    중간 저장 {len(prog_rows)}건")
                    raw_rows, prog_rows = [], []

                if total and fetched >= total:
                    break
                page += 1

            if raw_rows:
                upsert("raw_items", raw_rows, "source,source_id")
                upsert("programs", prog_rows, "source,source_id")
                print(f"  적재 {len(prog_rows)}건")

        # ── 2) 상세조회 보충 ──
        durl = conf.get("detail_url")
        if durl:
            todo = SB.table("programs") \
                .select("source_id,kind,title") \
                .eq("source", name) \
                .is_("raw_target", "null") \
                .limit(q.limit - q.used) \
                .execute().data

            print(f"  상세조회 대상 {len(todo)}건 (남은 쿼터 {q.limit - q.used})")

            batch, dkey, dfails = [], conf.get("detail_key", "servId"), 0
            t0 = time.time()
            for i, row in enumerate(todo, 1):
                if not q.take():
                    print("  쿼터 소진 — 다음 실행에서 이어집니다", flush=True)
                    break
                if time.time() > deadline:
                    print(f"  {DEADLINE_MIN}분 경과 — 저장하고 종료합니다", flush=True)
                    break
                try:
                    dp = fill(conf.get("detail_params", {}))
                    dp[dkey] = row["source_id"]
                    _t = time.time()
                    droot = get(durl, dp, "xml")
                    if i <= 3:
                        print(f"    [진단] {row['source_id']} "
                              f"{time.time() - _t:.1f}초", flush=True)
                    d = xml_detail(droot)
                    if d.get("resultCode") not in (None, "0"):
                        continue
                    merged = adapt({"servId": row["source_id"]}, d)
                    upd = {k: v for k, v in merged.items()
                           if v is not None and k in (
                               "raw_target", "raw_criteria", "raw_benefit",
                               "apply_start", "apply_end", "is_always_on",
                               "apply_method", "contact")}
                    if upd:
                        # NOT NULL 컬럼(kind, title)을 함께 보내야 upsert 가 통과한다.
                        # Postgres 는 ON CONFLICT 판정 전에 NOT NULL 을 먼저 검사한다.
                        upd.update({
                            "source": name,
                            "source_id": row["source_id"],
                            "kind": row["kind"],
                            "title": row["title"],
                        })
                        batch.append(upd)
                    dfails = 0
                except Exception as e:
                    dfails += 1
                    print(f"    skip {row['source_id']}: {type(e).__name__}")
                    if dfails >= 10:
                        print("    연속 10회 실패 — 중단하고 저장합니다")
                        break
                    time.sleep(5)

                if i % 25 == 0:
                    rate = i / max(time.time() - t0, 1)
                    print(f"    {i}/{len(todo)}  ({rate:.1f}건/초, 저장대기 {len(batch)})",
                          flush=True)
                if len(batch) >= 50:
                    upsert("programs", batch, "source,source_id")
                    print(f"    중간 저장 {len(batch)}건", flush=True)
                    batch = []

            if batch:
                upsert("programs", batch, "source,source_id")
            print(f"  상세 보충 완료")

        SB.table("ingest_runs").update({
            "status": "ok", "fetched": fetched,
            "finished_at": "now()",
            "message": f"calls={q.used}",
        }).eq("id", run_id).execute()

    except Exception as e:
        msg = mask(e)
        print(f"  ERROR {type(e).__name__}: {msg}")
        SB.table("ingest_runs").update({
            "status": "error", "fetched": fetched,
            "finished_at": "now()", "message": msg[:500],
        }).eq("id", run_id).execute()
        raise


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    detail_only = "--detail-only" in sys.argv

    with open(Path(__file__).parent / "endpoints.json", encoding="utf-8") as f:
        cfg = {k: v for k, v in json.load(f).items() if not k.startswith("_")}

    for name in (args or list(cfg)):
        if name not in cfg:
            print(f"알 수 없는 소스: {name}")
            continue
        run(name, cfg[name], detail_only)

    print("\n" + "-" * 64)
    res = SB.table("programs").select("source", count="exact").execute()
    print(f"programs 총 {res.count}건")


if __name__ == "__main__":
    main()
