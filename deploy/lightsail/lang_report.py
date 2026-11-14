"""최근 N분 쪽 요청을 '브라우저 이름표인데 Accept-Language 가 없는 것' 기준으로 나눠 센다(2026-11-15).

    sudo python3 lang_report.py 30

진짜 브라우저는 Accept-Language 를 늘 보낸다. 브라우저로 꾸민 수집기는 빠뜨리는 일이 많다(10/29 /policies 수집기).
Caddy 에서 막기 전에, 그 기준이 사람을 얼마나 잘못 막을지와 수집기를 얼마나 잡을지 본다.
"""
import collections
import datetime as dt
import json
import re
import sys

BOT = re.compile(r"(?i)(bot|crawler|spider|slurp|google|yeti|daum|facebookexternalhit|kakaotalk|slack|discord|whatsapp|line/|preview|lighthouse)")


def main() -> None:
    minutes = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=minutes)
    c = collections.Counter()
    ua_nolang = collections.Counter()
    path_nolang = collections.Counter()
    visit_with = collections.Counter()
    with open("/var/log/caddy/access.log", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                r = json.loads(line)
                ts = dt.datetime.fromisoformat(str(r["ts"]).replace("Z", "+00:00"))
            except (ValueError, KeyError, TypeError):
                continue
            if ts < since:
                continue
            req = r.get("request") or {}
            h = req.get("headers") or {}
            ua = (h.get("User-Agent") or [""])[0]
            uri = req.get("uri") or ""
            if uri.startswith(("/_next/", "/og", "/favicon", "/icon")) or "." in uri.split("?")[0].rsplit("/", 1)[-1]:
                continue
            lang = bool((h.get("Accept-Language") or [""])[0])
            kind = "봇 이름표" if BOT.search(ua) else ("브라우저 이름표" if ua.startswith("Mozilla/") else "그 밖")
            c[(kind, "언어 있음" if lang else "언어 없음")] += 1
            if kind == "브라우저 이름표" and not lang:
                ua_nolang[ua[:110]] += 1
                path_nolang["/" + uri.lstrip("/").split("/")[0] + ("/" + uri.split("/")[2] if uri.count("/") >= 2 else "")] += 1
            if uri.startswith("/api/visit"):
                visit_with["언어 있음" if lang else "언어 없음"] += 1
    print(f"== 최근 {minutes}분 쪽 요청: 이름표 종류 × Accept-Language")
    for k, v in sorted(c.items()):
        print(f"   {k[0]:8} {k[1]:6} {v:6}")
    print("== 방문 집계(/api/visit, 자바스크립트를 돌린 진짜 브라우저):", dict(visit_with))
    print("== 언어 없는 브라우저 이름표 상위")
    for ua, n in ua_nolang.most_common(8):
        print(f"   {n:6} {ua}")
    print("== 언어 없는 브라우저 이름표가 간 경로 상위")
    for p, n in path_nolang.most_common(10):
        print(f"   {n:6} {p}")


if __name__ == "__main__":
    main()
