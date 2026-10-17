"""
indexing.py — 새로 생긴 쪽을 검색엔진에 바로 알린다(2026-10-15).

검색엔진이 스스로 찾아오기를 기다리면 채용 공고는 마감 뒤에야 색인되기도 한다. 하루치 새 주소를 모아
  1) IndexNow   — 네이버(서치어드바이저)·빙(api.indexnow.org, 빙·얀덱스 등이 나눠 받는다). 키 파일은 web/public/<KEY>.txt
  2) 구글 Indexing API — 채용 공고(JobPosting) 쪽만 허용된다. 서비스 계정(GOOGLE_INDEXING_SA) 또는 계정 로그인(GOOGLE_OAUTH_*)이 있을 때만.
                         하루 기본 한도 200건. 새 공고 먼저, 남으면 어제 마감된 공고(구글이 마감을 빨리 보게).
에 보낸다. 주소는 정본 주소만(https://jiwon.knowhow-it.com/...). 실패해도 다른 쪽은 계속한다.

  python pipeline/indexing.py                 # 최근 30시간 새 주소
  python pipeline/indexing.py --hours 72 --dry
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.parse

import requests

SITE = "https://jiwon.knowhow-it.com"
HOST = "jiwon.knowhow-it.com"
# IndexNow 키. 비밀이 아니다 — 누구나 볼 수 있는 키 파일(web/public/<KEY>.txt)로 이 사이트 주인임을 보인다.
KEY = "b5cb845dc6f92a695d0bce4736a5ee2b"
INDEXNOW = ["https://searchadvisor.naver.com/indexnow", "https://api.indexnow.org/indexnow"]
GOOGLE_QUOTA = 190  # 하루 200건 한도에서 손으로 보낼 몫을 조금 남긴다


def enc(x: str) -> str:
    return urllib.parse.quote(x, safe="")


def collect(sb, hours: int) -> dict[str, list[str]]:
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)).isoformat()
    yday = (dt.date.today() - dt.timedelta(days=1)).isoformat()
    # 1년 넘게 지난 공고는 상세 쪽이 noindex 다(web/app/jobs/[id]/page.tsx stale). 옛 공고를 한꺼번에 받아 오는
    # 날이면 그 수천 건이 "새 공고"로 잡혀 구글 몫(190건)을 다 먹으니 처음부터 뺀다.
    cutoff = (dt.date.today() - dt.timedelta(days=365)).isoformat()
    jobs = (sb.table("job_posts").select("source_id").in_("source", ["gojobs", "alio"]).gte("first_seen_at", since)
            .or_(f"end_date.gte.{cutoff},end_date.is.null")
            .order("first_seen_at", desc=True).limit(2000).execute().data or [])
    closed = (sb.table("job_posts").select("source_id").in_("source", ["gojobs", "alio"]).eq("end_date", yday)
              .limit(500).execute().data or [])
    # 화면에 나오는 사업만(programs_public = 정리됐고 확신도 0.3 초과). 원본 표(programs)에서 고르면 정리 안 된
    # 사업(기업마당 행사 전부 등)까지 보내 하루 열에 둘이 404 였다(2026-10-17 점검).
    progs = (sb.table("programs_public").select("source_id").gte("first_seen_at", since).limit(2000).execute().data or [])
    blogs = (sb.table("blog_posts").select("slug").gte("published_at", since).limit(100).execute().data or [])
    guides = (sb.table("org_guides").select("slug").gte("updated_at", since).limit(100).execute().data or [])
    return {
        "jobs": [f"{SITE}/jobs/{enc(r['source_id'])}" for r in jobs],
        "closed": [f"{SITE}/jobs/{enc(r['source_id'])}" for r in closed],
        "programs": [f"{SITE}/p/{enc(r['source_id'])}" for r in progs],
        "pages": [f"{SITE}/story/{enc(r['slug'])}" for r in blogs] + [f"{SITE}/jobs/guide/{enc(r['slug'])}" for r in guides],
    }


def indexnow(urls: list[str], dry: bool) -> None:
    if not urls:
        print("IndexNow: 보낼 주소 없음")
        return
    body = {"host": HOST, "key": KEY, "keyLocation": f"{SITE}/{KEY}.txt", "urlList": urls[:10000]}
    for ep in INDEXNOW:
        if dry:
            print(f"IndexNow {ep}: (dry) {len(urls)}건")
            continue
        try:
            r = requests.post(ep, json=body, headers={"Content-Type": "application/json; charset=utf-8"}, timeout=30)
            # 200·202 가 받음. 422 는 키·주소 불일치, 429 는 너무 잦음.
            print(f"IndexNow {ep}: {r.status_code} {len(urls)}건 {r.text[:160].strip()}")
        except requests.RequestException as e:
            print(f"IndexNow {ep}: 실패 {type(e).__name__}", file=sys.stderr)


def google_worthy(sb, urls: list[str]) -> set[str]:
    """구글 Indexing API 로 보낼 만한 공고 주소만 고른다.

    2026-10-17 서치 콘솔 점검: 사이트 거의 전체가 "크롤링됨 - 현재 색인이 생성되지 않음"으로 빠졌다. 공고 쪽은 본문의
    90% 가 틀에 박힌 글이라 구글이 품질을 낮게 본 것으로 판단했다. 그래서 구글에는 고유한 내용이 있는 공고만 알린다:
    나라일터 공고이면서 공고문 요약(job_summaries)이 있고, 합격자 발표·면접 안내·채용 계획이 아닌 채용 공고.
    잡알리오 공고는 첨부를 받지 않아 요약이 없다. IndexNow(네이버·빙)는 그대로 다 보낸다.
    """
    from blog_daily import is_opening  # noqa: PLC0415 — 같은 기준(채용 공고인지)을 쓴다

    ids = {u.rsplit("/", 1)[-1]: u for u in urls}
    gojobs = [urllib.parse.unquote(i) for i in ids if not urllib.parse.unquote(i).startswith("a")]
    if not gojobs:
        return set()
    have: set[str] = set()
    titles: dict[str, str] = {}
    for i in range(0, len(gojobs), 200):
        chunk = gojobs[i:i + 200]
        rows = sb.table("job_summaries").select("source_id").in_("source_id", chunk).execute().data or []
        have |= {r["source_id"] for r in rows}
        rows = sb.table("job_posts").select("source_id,title").eq("source", "gojobs").in_("source_id", chunk).execute().data or []
        titles |= {r["source_id"]: r.get("title") or "" for r in rows}
    ok = {sid for sid in have if is_opening(titles.get(sid, ""))}
    return {u for i, u in ids.items() if urllib.parse.unquote(i) in ok}


def google_token() -> str | None:
    """서비스 계정 JSON 또는 계정 로그인(OAuth) 토큰(pipeline/google_auth.py)."""
    from google_auth import INDEXING, access_token  # noqa: PLC0415
    return access_token([INDEXING])


def google_publish(new_jobs: list[str], closed: list[str], dry: bool) -> None:
    try:
        token = google_token()
    except Exception as e:  # noqa: BLE001 — 키가 틀려도 IndexNow 는 이미 갔다
        print(f"구글 Indexing: 인증 실패 {type(e).__name__}: {str(e)[:160]}", file=sys.stderr)
        return
    if not token:
        print("구글 Indexing: 인증 정보가 없어 건너뜀(GOOGLE_INDEXING_SA 또는 GOOGLE_OAUTH_* 를 넣으면 켜진다)")
        return
    plan = [(u, "URL_UPDATED") for u in new_jobs][:GOOGLE_QUOTA]
    plan += [(u, "URL_UPDATED") for u in closed][: max(0, GOOGLE_QUOTA - len(plan))]
    ok = fail = 0
    for url, kind in plan:
        if dry:
            ok += 1
            continue
        r = requests.post("https://indexing.googleapis.com/v3/urlNotifications:publish",
                          headers={"Authorization": f"Bearer {token}"}, json={"url": url, "type": kind}, timeout=30)
        if r.status_code == 200:
            ok += 1
        else:
            fail += 1
            if fail <= 3:
                print(f"  구글 {r.status_code}: {url} {r.text[:200].strip()}", file=sys.stderr)
            if r.status_code in (403, 429):  # 권한 없음·한도 소진은 계속해도 같다
                break
        time.sleep(0.2)
    print(f"구글 Indexing: 보냄 {ok} · 실패 {fail} (새 공고 {len(new_jobs)}, 어제 마감 {len(closed)})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=int, default=30)
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    got = collect(sb, a.hours)
    print("새 주소: " + ", ".join(f"{k} {len(v)}" for k, v in got.items()))
    for k, v in got.items():
        for u in v[:3]:
            print(f"  {k}: {u}")
    indexnow(got["jobs"] + got["programs"] + got["pages"], a.dry)
    keep = google_worthy(sb, got["jobs"] + got["closed"])
    new_jobs = [u for u in got["jobs"] if u in keep]
    closed = [u for u in got["closed"] if u in keep]
    print(f"구글로 보낼 공고: 새 공고 {len(got['jobs'])} 중 {len(new_jobs)}, 어제 마감 {len(got['closed'])} 중 {len(closed)}"
          " (나라일터 채용 공고 가운데 공고문 요약이 붙은 것만)")
    google_publish(new_jobs, closed, a.dry)


if __name__ == "__main__":
    main()
