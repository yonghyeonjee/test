"""
indexing.py — 새로 생긴 쪽을 검색엔진에 바로 알린다(2026-10-15).

검색엔진이 스스로 찾아오기를 기다리면 채용 공고는 마감 뒤에야 색인되기도 한다. 하루치 새 주소를 모아
  1) IndexNow   — 네이버(서치어드바이저)·빙(api.indexnow.org, 빙·얀덱스 등이 나눠 받는다). 키 파일은 web/public/<KEY>.txt
  2) 구글 Indexing API — 채용 공고(JobPosting) 쪽만 허용된다. 서비스 계정(GOOGLE_INDEXING_SA) 또는 계정 로그인(GOOGLE_OAUTH_*)이 있을 때만.
                         하루 기본 한도 200건. 새 공고 먼저, 남으면 어제 마감된 공고(구글이 마감을 빨리 보게).
에 보낸다. 주소는 정본 주소만(https://jiwon.knowhow-it.com/...). 실패해도 다른 쪽은 계속한다.

  python pipeline/indexing.py                 # 최근 30시간 새 주소
  python pipeline/indexing.py --hours 72 --dry
  python pipeline/indexing.py --urls /jobs,/policies   # 이 주소들만 IndexNow 로(허브 다시 긁기, 2026-10-25). 구글 Indexing API 는
                                                       # 채용 공고만 허용돼 허브는 보내지 않는다 — 어기면 한도가 잘린다.
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
    # 새로 들어온 공고 가운데 아직 접수 중인 것만 알린다. 옛 공고를 한꺼번에 받아 오는 날이면 그것이 "새 공고"로
    # 잡혀 구글 몫(190건)을 다 먹는다 — 2026-10-18 잡알리오 API 첫 수집으로 7~9월 공고 723건이 들어와 그렇게 됐다.
    # 마감된 공고 쪽은 JobPosting 을 내지 않으니 Indexing API 대상도 아니다. (한국 날짜)
    cutoff = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=9)).date().isoformat()
    # 잡알리오 공고는 칸별 내용(요약)이 붙은 것만 색인하니 main() 에서 google_worthy 로 한 번 더 거른다.
    jobs = (sb.table("job_posts").select("source_id").in_("source", ["gojobs", "alio"]).gte("first_seen_at", since)
            .or_(f"end_date.gte.{cutoff},end_date.is.null")
            .order("first_seen_at", desc=True).limit(2000).execute().data or [])
    closed = (sb.table("job_posts").select("source_id").in_("source", ["gojobs", "alio"]).eq("end_date", yday)
              .limit(500).execute().data or [])
    # 화면에 나오는 사업만(programs_public = 정리됐고 확신도 0.3 초과). 원본 표(programs)에서 고르면 정리 안 된
    # 사업(기업마당 행사 전부 등)까지 보내 하루 열에 둘이 404 였다(2026-10-17 점검).
    # 기업마당 사업은 선정기준이 꼬리표뿐이라 noindex 다(web/lib/db.ts programIndexable). 자동 브리핑(/story)과
    # 기관별 작성 가이드(/jobs/guide)도 noindex 로 돌려 더는 알리지 않는다(2026-10-17).
    progs = (sb.table("programs_public").select("source_id").neq("source", "bizinfo_support").gte("first_seen_at", since)
             .limit(2000).execute().data or [])
    return {
        "jobs": [f"{SITE}/jobs/{enc(r['source_id'])}" for r in jobs],
        "closed": [f"{SITE}/jobs/{enc(r['source_id'])}" for r in closed],
        "programs": [f"{SITE}/p/{enc(r['source_id'])}" for r in progs],
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
    나라일터 공고이면서 내용 있는 공고문 요약(job_summaries)이 있고, 합격자 발표·면접 안내가 아닌 공고.
    공고 쪽이 JobPosting 을 내는 기준(web/app/jobs/[id]/page.tsx jobNode, lib/jobSummary.ts toLoadedSummary)과 같다.
    임용시험 시행계획 공고는 대개 그 자체가 접수 공고라 넣는다(blog_daily.is_opening 은 브리핑용이라 뺀다).
    잡알리오 공고는 알리오 채용공시 API 로 칸별 내용이 붙은 것만(pipeline/alio_recruit.py, 나라일터와 겹치면 붙이지 않는다).
    IndexNow(네이버·빙)에는 나라일터 공고를 다 보내고, 잡알리오는 여기서 고른 것만 보낸다.
    """
    from blog_daily import _DOCS_PASS, _FINAL, _INTERVIEW  # noqa: PLC0415 — web stageOf 와 같은 기준

    def recruiting(t: str) -> bool:
        if _FINAL.search(t) and not _DOCS_PASS.search(t):
            return False
        return not _INTERVIEW.search(t) and not t.lstrip().startswith("(적격자 없음)")

    def filled(s) -> bool:
        # 빈 표시({})나 칸이 다 빈 요약은 쪽에서 요약 없음으로 친다(toLoadedSummary).
        if not isinstance(s, dict):
            return False
        return sum(len(s.get(k) or []) for k in ("positions", "requirements", "documents", "process")) > 0

    ids = {u.rsplit("/", 1)[-1]: u for u in urls}
    gojobs = [urllib.parse.unquote(i) for i in ids]
    if not gojobs:
        return set()
    have: set[str] = set()
    titles: dict[str, str] = {}
    for i in range(0, len(gojobs), 200):
        chunk = gojobs[i:i + 200]
        rows = sb.table("job_summaries").select("source_id,summary").in_("source_id", chunk).execute().data or []
        have |= {r["source_id"] for r in rows if filled(r.get("summary"))}
        rows = sb.table("job_posts").select("source_id,title").in_("source", ["gojobs", "alio"]).in_("source_id", chunk).execute().data or []
        titles |= {r["source_id"]: r.get("title") or "" for r in rows}
    ok = {sid for sid in have if recruiting(titles.get(sid, ""))}
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
    ap.add_argument("--urls", default="", help="쉼표로 나눈 경로·주소. 이것만 IndexNow 로 보내고 끝낸다(DB 안 읽음)")
    a = ap.parse_args()
    if a.urls:
        urls = [u if u.startswith("http") else SITE + u for u in (x.strip() for x in a.urls.split(",")) if u]
        print(f"지정 주소 {len(urls)}건 → IndexNow(네이버·빙)만")
        indexnow(urls, a.dry)
        return
    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    got = collect(sb, a.hours)
    print("새 주소: " + ", ".join(f"{k} {len(v)}" for k, v in got.items()))
    for k, v in got.items():
        for u in v[:3]:
            print(f"  {k}: {u}")
    keep = google_worthy(sb, got["jobs"] + got["closed"])
    alio = lambda u: u.rsplit("/", 1)[-1].startswith("a")
    indexnow([u for u in got["jobs"] if not alio(u) or u in keep] + got["programs"], a.dry)
    new_jobs = [u for u in got["jobs"] if u in keep]
    closed = [u for u in got["closed"] if u in keep]
    print(f"구글로 보낼 공고: 새 공고 {len(got['jobs'])} 중 {len(new_jobs)}, 어제 마감 {len(got['closed'])} 중 {len(closed)}"
          " (나라일터 공고 가운데 공고문 요약이 붙은 것만, 합격자 발표·면접 안내 제외)")
    google_publish(new_jobs, closed, a.dry)


if __name__ == "__main__":
    main()
