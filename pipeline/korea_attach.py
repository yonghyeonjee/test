"""
korea.kr(정책브리핑) 채용정보에서 첨부파일 링크를 받아 job_posts 에 붙인다.

나라일터 공고는 정책브리핑에도 같은 제목으로 실린다. 나라일터 목록에는
첨부가 없지만 정책브리핑 상세에는 공고문 PDF·이력서 양식 HWP 같은 첨부가
내려받기 링크와 함께 있다. 그걸 우리 공고 쪽 아래에 그대로 보여 준다.

하는 일
  1. 정책브리핑 채용정보 목록을 최신부터 몇 쪽 읽는다(한 쪽 20건).
  2. 제목이 같은 우리 공고(최근 등록, 아직 첨부 없음)를 찾는다.
  3. 찾은 것만 상세를 열어 기관명·등록일·마감일·첨부 목록을 읽는다.
  4. job_posts.raw.korea 에 적고, 원문 주소가 비어 있으면 상세 주소를 넣는다.

지키는 것
  - robots.txt 는 User-Agent * Allow / (2026-10 확인). 우리가 누구인지 UA 로 밝힌다.
  - 요청 사이에 쉰다. 하루 한 번, 목록 몇 쪽과 맞은 상세만 읽는다.

  python pipeline/korea_attach.py            # 목록 25쪽
  python pipeline/korea_attach.py --pages 60 # 더 깊이
  python pipeline/korea_attach.py --start 41 --pages 120 --days 40   # 지난 한 달 채우기
  python pipeline/korea_attach.py --ids 393231,393000   # 특정 dataId 만
  python pipeline/korea_attach.py --dry      # 적지 않고 보기만
"""
from __future__ import annotations

import argparse
import datetime as dt
import html as H
import json
import os
import re
import sys
import time

import requests

BASE = "https://www.korea.kr"
LIST_URL = BASE + "/archive/recruitInfoList.do"
VIEW_URL = BASE + "/archive/recruitInfoView.do?dataId={}"
UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com)"
PAUSE = 0.4  # 요청 사이 쉬는 시간(초)

S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "ko"})


def log(*a):
    print(*a, flush=True)


def get(url: str) -> str | None:
    try:
        r = S.get(url, timeout=25)
        time.sleep(PAUSE)
        if not r.ok:
            log(f"  !! {url} → {r.status_code}")
            return None
        return r.text
    except Exception as e:  # noqa: BLE001
        log(f"  !! {url} → {e}")
        return None


def strip(h: str) -> str:
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]*>", " ", h))).strip()


def norm(t: str | None) -> str:
    """제목 맞추기용. 띄어쓰기와 괄호 종류 차이는 무시한다."""
    return re.sub(r"\s+|[()\[\]（）【】]", "", t or "")


# ── 파싱 ────────────────────────────────────────────────────

def parse_list(h: str) -> list[tuple[str, str]]:
    """목록에서 (dataId, 제목). 같은 번호가 두 번 나오면(onclick + href) 하나만."""
    out, seen = [], set()
    for m in re.finditer(r'<a[^>]*href="[^"]*recruitInfoView\.do\?dataId=(\d+)[^"]*"[^>]*>([\s\S]*?)</a>', h, re.I):
        did, title = m.group(1), strip(m.group(2))
        if did in seen or not title:
            continue
        seen.add(did)
        out.append((did, title))
    return out


def ymd(s: str | None) -> str | None:
    m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", s or "")
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def parse_view(h: str, data_id: str) -> dict:
    """상세 쪽. 제목·기관명·등록일·마감일·첨부파일."""
    text = strip(h)
    t = re.search(r"<title>([\s\S]*?)</title>", h)
    title = strip(t.group(1)).split(" - 채용정보")[0].strip() if t else ""
    org = re.search(r"기관명\s*:\s*(.+?)\s+(?:등록일|마감일)", text)
    reg = re.search(r"등록일\s*:\s*([\d.]+)", text)
    end = re.search(r"마감일\s*:\s*([\d.]+)", text)

    files, seen = [], set()
    for m in re.finditer(r'<a[^>]*href="([^"]*?/common/download\.do\?[^"]*?fileId=(\d+)[^"]*)"[^>]*>([\s\S]*?)</a>', h, re.I):
        href, fid, name = m.group(1), m.group(2), strip(m.group(3))
        if fid in seen:
            continue
        seen.add(fid)
        tbl = re.search(r"tblKey=([A-Za-z0-9]+)", href)
        q = f"fileId={fid}" + (f"&tblKey={tbl.group(1)}" if tbl else "")
        name = re.sub(r"^\d+\.\s*", "", H.unescape(name)).strip()
        if not name:
            continue
        ext = (name.rsplit(".", 1)[1].lower() if "." in name else "")
        files.append({"name": name[:200], "ext": ext[:8],
                      "dl": f"{BASE}/common/download.do?{q}",
                      "view": f"{BASE}/common/docViewer.do?{q}"})
    return {"id": data_id, "url": VIEW_URL.format(data_id), "title": title,
            "org": org.group(1).strip() if org else None,
            "reg": ymd(reg.group(1) if reg else None), "end": ymd(end.group(1) if end else None),
            "files": files}


# ── 맞추기 ──────────────────────────────────────────────────

# 기관명에 흔히 붙어 뜻이 없는 말. 이것만 겹치는 것은 같은 기관이 아니다.
_GENERIC = {"대한민국", "정부", "국방부", "교육청", "교육부", "지방", "사무소", "지원", "센터", "학교", "청", "시", "군", "구", "도"}


def org_ok(a: str | None, b: str | None) -> bool:
    """두 기관명이 같은 곳을 가리키는가. 한쪽이 비면 가릴 수 없으니 통과.
    "대법원 수원지방법원 안산지원" / "수원지방법원 안산지원" 처럼 포함 관계거나,
    뜻 있는 낱말 하나라도 겹치면 같은 곳으로 본다."""
    if not a or not b:
        return True
    na, nb = norm(a), norm(b)
    if na in nb or nb in na:
        return True
    ta = {t for t in re.split(r"[\s()·,/]+", a) if len(t) >= 2 and t not in _GENERIC}
    tb = {t for t in re.split(r"[\s()·,/]+", b) if len(t) >= 2 and t not in _GENERIC}
    return bool(ta & tb)


def pick_row(rows: list[dict], view: dict) -> dict | None:
    """제목이 같은 우리 공고를 고른다. 여럿이면 기관명·등록일로 가른다.

    하나뿐이어도 기관명이 어긋나면 붙이지 않는다 — "기간제근로자 채용 공고"처럼
    흔한 제목은 다른 기관의 공고가 같은 제목으로 올 수 있다."""
    if len(rows) == 1:
        return rows[0] if org_ok(rows[0].get("org"), view.get("org")) else None
    vo = norm(view.get("org"))
    if vo:
        hit = [r for r in rows if norm(r.get("org")) and (vo in norm(r["org"]) or norm(r["org"]) in vo)]
        if len(hit) == 1:
            return hit[0]
        # 기관명이 같은 것이 여럿이면 등록일이 같은 것
        hit2 = [r for r in hit if r.get("reg_date") == view.get("reg")]
        if len(hit2) == 1:
            return hit2[0]
    return None


def build(row: dict, view: dict, now: str) -> dict:
    raw = dict(row.get("raw") or {})
    raw["korea"] = {"id": view["id"], "url": view["url"], "org": view["org"], "reg": view["reg"],
                    "end": view["end"], "files": view["files"], "at": now}
    patch = {"raw": raw}
    if not row.get("url"):
        patch["url"] = view["url"]
    return patch


# ── 실행 ────────────────────────────────────────────────────

def load_rows(sb, days: int) -> list[dict]:
    since = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    out, start, step = [], 0, 1000
    while True:
        r = (sb.table("job_posts").select("id,title,org,url,reg_date,raw")
             .eq("source", "gojobs").gte("reg_date", since)
             .order("reg_date", desc=True).range(start, start + step - 1).execute())
        data = r.data or []
        out.extend(data)
        if len(data) < step:
            break
        start += step
    return [r for r in out if not (r.get("raw") or {}).get("korea")]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=25, help="목록을 몇 쪽 읽나(쪽당 20건)")
    ap.add_argument("--start", type=int, default=1, help="목록 몇 쪽부터. 지난 것을 나눠 채울 때")
    ap.add_argument("--days", type=int, default=21, help="우리 공고는 며칠 안 등록된 것만 맞춘다")
    ap.add_argument("--ids", default="", help="특정 dataId 만(쉼표). 목록은 안 읽는다")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    days = a.days if not a.ids else 400
    rows = load_rows(sb, days)
    by_title: dict[str, list[dict]] = {}
    for r in rows:
        by_title.setdefault(norm(r["title"]), []).append(r)
    log(f"우리 공고(첨부 없음, 최근 {days}일): {len(rows)}건")

    # 1. 정책브리핑 쪽 후보
    cands: list[tuple[str, str | None]] = []
    if a.ids:
        cands = [(x.strip(), None) for x in a.ids.split(",") if x.strip()]
    else:
        for p in range(a.start, a.start + a.pages):
            h = get(LIST_URL + (f"?pageIndex={p}" if p > 1 else ""))
            if not h:
                break
            items = parse_list(h)
            if not items:
                log(f"  {p}쪽: 목록 줄 없음 — 끝")
                break
            hit = [(d, t) for d, t in items if norm(t) in by_title]
            cands.extend(hit)
            log(f"  {p}쪽: {len(items)}건 가운데 제목 맞음 {len(hit)}")

    now = dt.datetime.now(dt.timezone.utc).isoformat()
    stats = {"seen": len(cands), "matched": 0, "files": 0, "nofile": 0, "ambiguous": 0, "miss": 0}
    for did, _ in cands:
        h = get(VIEW_URL.format(did))
        if not h:
            continue
        v = parse_view(h, did)
        rows_t = by_title.get(norm(v["title"]), [])
        row = pick_row(rows_t, v)
        if not row:
            stats["ambiguous" if rows_t else "miss"] += 1
            log(f"  - {did} {v['title'][:50]} → " + ("기관명으로 못 가름" if rows_t else "우리 공고 없음"))
            continue
        stats["matched"] += 1
        stats["files"] += len(v["files"])
        if not v["files"]:
            stats["nofile"] += 1
        log(f"  ✓ {row['id']} ← {did} 첨부 {len(v['files'])}개 {v['title'][:40]}")
        if a.dry:
            continue
        sb.table("job_posts").update(build(row, v, now)).eq("id", row["id"]).execute()
        # 같은 제목이 또 나와도 두 번 적지 않는다.
        rows_t.remove(row)

    log(json.dumps(stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
