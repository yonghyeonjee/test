"""서치 콘솔 사이트맵을 지우고 다시 제출한다(2026-10-21). 구글이 사이트맵을 다시 읽는 계기를 만든다.

    python -u pipeline/gsc_sitemaps.py            # 깨진 것은 지우고, 우리 사이트맵 8개는 지운 뒤 다시 제출
    python -u pipeline/gsc_sitemaps.py --dry      # 할 일만 찍는다
    python -u pipeline/gsc_sitemaps.py --only "sitemap/licenses.xml<"   # 그 경로만 지운다

쓰기(submit/delete)는 webmasters 전체 범위가 필요하다. 읽기 전용 범위로만 허용받은 OAuth 토큰이면 여기서 멈추고
무엇을 다시 허용받아야 하는지 찍는다. 속성 삭제·재등록은 색인에 영향이 없어 하지 않는다.
"""
from __future__ import annotations

import argparse
import sys
import urllib.parse

import requests

from google_auth import access_token

API = "https://searchconsole.googleapis.com/webmasters/v3"
WEBMASTERS = "https://www.googleapis.com/auth/webmasters"
SITE_URL = "https://jiwon.knowhow-it.com"
SECTIONS = ["pages", "programs", "jobs", "licenses", "housing", "posts", "orgs"]  # web/lib/sitemapTree.ts 와 같게
OURS = [f"{SITE_URL}/sitemap.xml"] + [f"{SITE_URL}/sitemap/{s}.xml" for s in SECTIONS]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--only", default="", help="이 글자가 든 경로만 지운다(재제출 안 함)")
    ap.add_argument("--site", default="", help="속성. 비우면 URL 접두어 속성을 쓴다")
    a = ap.parse_args([x for x in sys.argv[1:] if x] or [])

    try:
        tok = access_token([WEBMASTERS])
    except RuntimeError as e:
        raise SystemExit(f"쓰기 토큰을 못 받았다: {e}\n→ OAuth 플레이그라운드에서 {WEBMASTERS} 범위를 더해 새로고침 토큰을 다시 받아야 한다")
    if not tok:
        raise SystemExit("구글 인증 설정이 없다(GOOGLE_INDEXING_SA 또는 GOOGLE_OAUTH_*)")
    h = {"Authorization": f"Bearer {tok}"}

    sites = requests.get(f"{API}/sites", headers=h, timeout=60).json().get("siteEntry", [])
    for s in sites:
        print(f"  속성 {s['siteUrl']} ({s['permissionLevel']})")
    site = a.site or next((s["siteUrl"] for s in sites if s["siteUrl"] == f"{SITE_URL}/"), "") \
        or next((s["siteUrl"] for s in sites if "knowhow-it.com" in s["siteUrl"]), "")
    if not site:
        raise SystemExit("속성이 보이지 않는다")
    lvl = next((s["permissionLevel"] for s in sites if s["siteUrl"] == site), "?")
    print(f"속성 {site} 권한 {lvl}")
    if lvl not in ("siteOwner", "siteFullUser"):
        raise SystemExit("사이트맵을 지우고 제출하려면 소유자 또는 전체 권한이어야 한다")
    q = urllib.parse.quote(site, safe="")

    have = requests.get(f"{API}/sites/{q}/sitemaps", headers=h, timeout=60).json().get("sitemap", [])
    print(f"== 지금 등록된 사이트맵 {len(have)}개")
    for s in have:
        print(f"  {s.get('path')} | 읽음 {str(s.get('lastDownloaded'))[:10]} | 오류 {s.get('errors')} 경고 {s.get('warnings')}")

    def delete(path: str) -> None:
        if a.dry:
            print(f"  (dry) 삭제 {path}")
            return
        r = requests.delete(f"{API}/sites/{q}/sitemaps/{urllib.parse.quote(path, safe='')}", headers=h, timeout=60)
        print(f"  삭제 {path} → {r.status_code}{'' if r.ok else ' ' + r.text[:200]}")

    def submit(path: str) -> None:
        if a.dry:
            print(f"  (dry) 제출 {path}")
            return
        r = requests.put(f"{API}/sites/{q}/sitemaps/{urllib.parse.quote(path, safe='')}", headers=h, timeout=60)
        print(f"  제출 {path} → {r.status_code}{'' if r.ok else ' ' + r.text[:200]}")

    if a.only:
        for s in have:
            if a.only in (s.get("path") or ""):
                delete(s["path"])
        return

    print("== 우리 것이 아닌 경로(깨진 것) 지우기")
    for s in have:
        p = s.get("path") or ""
        if p not in OURS:
            delete(p)
    print("== 우리 사이트맵 지우고 다시 제출")
    for p in OURS:
        if any(s.get("path") == p for s in have):
            delete(p)
    for p in OURS:
        submit(p)

    if not a.dry:
        after = requests.get(f"{API}/sites/{q}/sitemaps", headers=h, timeout=60).json().get("sitemap", [])
        print(f"== 제출 뒤 {len(after)}개")
        for s in after:
            print(f"  {s.get('path')} | 제출 {str(s.get('lastSubmitted'))[:19]} | 대기 {s.get('isPending')}")


if __name__ == "__main__":
    main()
