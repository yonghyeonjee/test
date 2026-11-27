"""
health_check.py — 운영 상태 점검(2026-11-27)

매일 한 번, 사람이 들여다보지 않아도 멈춘 것이 드러나게 한다. 2026-11 에 티스토리 발행이 14일 동안 실패했고
해외취업 자료가 석 달 동안 새로 들어오지 않았는데 아무도 몰랐다.

보는 것
  1) 사이트가 열리는가(첫 화면·채용·자격증·전체 정책·사이트맵)
  2) 수집이 돌았는가(지원사업 다섯 출처의 ingest_runs, 채용 공고의 새로 들어온 때)
  3) 블로그가 나갔는가, 시험 일정이 갱신됐는가
  4) 예약 실행이 실패한 자동 작업이 있는가(GitHub Actions, 최근 26시간)

결과
  - site_settings 의 health_report 에 적는다(관리자 화면이 읽는다)
  - out/health.md 와 GITHUB_STEP_SUMMARY 에 표로 남긴다
  - "실패"가 하나라도 있으면 종료 코드 1 — 작업이 빨갛게 끝나 GitHub 이 실패 알림을 보낸다

사용: python pipeline/health_check.py [--dry]     (--dry: DB 에 적지 않는다)
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

SITE = os.environ.get("SITE_URL", "https://jiwon.knowhow-it.com").rstrip("/")
NOW = datetime.now(timezone.utc)
KST = timezone(timedelta(hours=9))

OK, WARN, FAIL = "ok", "warn", "fail"
MARK = {OK: "정상", WARN: "주의", FAIL: "실패"}
items: list[dict] = []


def add(name: str, level: str, detail: str):
    items.append({"name": name, "level": level, "detail": detail})
    print(f"[{MARK[level]}] {name} — {detail}", flush=True)


def parse(ts):
    """Supabase 가 주는 시각·날짜 글을 UTC 시각으로. 못 읽으면 None."""
    if not ts:
        return None
    s = str(ts).replace("Z", "+00:00")
    try:
        d = datetime.fromisoformat(s)
    except ValueError:
        try:
            d = datetime.fromisoformat(s[:10])
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def ago(d) -> str:
    h = (NOW - d).total_seconds() / 3600
    return f"{h:.0f}시간 전" if h < 48 else f"{h / 24:.0f}일 전"


# ── 1) 사이트 ─────────────────────────────────────────────
PAGES = [
    ("첫 화면", "/", "지원금"),
    ("채용", "/jobs", "채용"),
    ("자격증", "/license", "자격증"),
    ("전체 정책", "/policies", "정책"),
    ("사이트맵", "/sitemap.xml", "<loc>"),
]


def check_site():
    for name, path, must in PAGES:
        last = ""
        for attempt in range(3):          # 배포 중 잠깐 점검 화면이 뜨는 것은 실패로 치지 않는다
            try:
                r = requests.get(SITE + path, timeout=20, headers={"User-Agent": "Mozilla/5.0 (compatible; knara-health-check)", "Accept-Language": "ko"})
                body = r.text
                if r.status_code == 200 and must in body and "점검하고 있습니다" not in body:
                    add(f"사이트 · {name}", OK, f"200 · {r.elapsed.total_seconds():.1f}초")
                    break
                last = f"응답 {r.status_code}" + ("" if must in body else " · 내용이 비어 있음") + (" · 점검 화면" if "점검하고 있습니다" in body else "")
            except requests.RequestException as e:
                last = type(e).__name__
            if attempt < 2:
                time.sleep(40)
        else:
            add(f"사이트 · {name}", FAIL, f"세 번 모두 열리지 않음({last})")


# ── 2)·3) 자료 ────────────────────────────────────────────
def check_data(sb):
    # 지원사업 다섯 출처: 마지막으로 성공한 수집이 36시간 안에 있나(매일 03:00 KST).
    runs = sb.table("ingest_runs").select("source,status,finished_at").order("finished_at", desc=True).limit(300).execute().data or []
    for src in ["bokjiro_local", "bokjiro_central", "bizinfo_support", "bizinfo_event", "sbiz24"]:
        mine = [r for r in runs if r["source"] == src and r.get("finished_at")]
        good = next((r for r in mine if r["status"] == "ok"), None)
        t = parse(good["finished_at"]) if good else None
        if t and NOW - t < timedelta(hours=36):
            add(f"수집 · {src}", OK, f"마지막 성공 {ago(t)}")
        else:
            bad = mine[0]["status"] if mine else "기록 없음"
            add(f"수집 · {src}", FAIL, f"36시간 안에 성공한 수집이 없음(마지막 성공 {ago(t) if t else '없음'}, 최근 상태 {bad})")

    # 채용: 새 공고가 마지막으로 들어온 때. 주말에는 새 공고가 거의 없어 72시간까지 본다.
    for src, label in [("gojobs", "나라일터"), ("alio", "잡알리오")]:
        row = sb.table("job_posts").select("first_seen_at").eq("source", src).order("first_seen_at", desc=True).limit(1).execute().data
        t = parse(row[0]["first_seen_at"]) if row else None
        if t and NOW - t < timedelta(hours=72):
            add(f"채용 · {label}", OK, f"새 공고가 들어온 지 {ago(t)}")
        else:
            add(f"채용 · {label}", FAIL, f"72시간 동안 새 공고가 없음(마지막 {ago(t) if t else '없음'})")

    # 해외취업: 원본에 새 공고가 없는 때가 길다(2026-08 부터). 멈춘 것을 알리되 실패로 치지는 않는다.
    today = datetime.now(KST).strftime("%Y-%m-%d")
    openw = sb.table("job_posts").select("source_id", count="exact").eq("source", "worldjob").gte("end_date", today).limit(1).execute().count or 0
    add("채용 · 해외취업", OK if openw else WARN, f"접수 중 {openw}건" if openw else "접수 중인 공고 0건(원본에 새 공고가 없음 — 화면은 지난 공고만 보이고 검색 제외)")

    # 블로그: 월·목에 한 편씩. 닷새 넘게 새 글이 없으면 주의.
    row = sb.table("blog_posts").select("published_at").order("published_at", desc=True).limit(1).execute().data
    t = parse(row[0]["published_at"]) if row else None
    if t and NOW - t < timedelta(days=5):
        add("블로그 · 새 글", OK, f"마지막 글 {t.strftime('%m.%d')}")
    else:
        add("블로그 · 새 글", WARN, f"닷새 넘게 새 글이 없음(마지막 {t.strftime('%m.%d') if t else '없음'})")

    # 시험 일정: 주 1회 갱신.
    row = sb.table("exam_rounds").select("fetched_at").order("fetched_at", desc=True).limit(1).execute().data
    t = parse(row[0]["fetched_at"]) if row else None
    if t and NOW - t < timedelta(days=10):
        add("자격증 · 시험 일정", OK, f"갱신 {ago(t)}")
    else:
        add("자격증 · 시험 일정", WARN, f"열흘 넘게 갱신이 없음(마지막 {ago(t) if t else '없음'})")


# ── 4) 자동 작업 ──────────────────────────────────────────
def check_actions():
    token, repo = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY")
    if not token or not repo:
        add("자동 작업", WARN, "GITHUB_TOKEN 이 없어 확인하지 못함")
        return
    since = (NOW - timedelta(hours=26)).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        r = requests.get(
            f"https://api.github.com/repos/{repo}/actions/runs",
            params={"status": "failure", "event": "schedule", "created": f">={since}", "per_page": 100},
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}, timeout=20)
        r.raise_for_status()
        runs = r.json().get("workflow_runs", [])
    except Exception as e:  # noqa: BLE001 — 확인을 못 한 것과 실패한 것을 구분해 적는다
        add("자동 작업", WARN, f"실행 기록을 읽지 못함({type(e).__name__})")
        return
    names = sorted({x["name"] for x in runs if x.get("name") != os.environ.get("GITHUB_WORKFLOW")})
    if names:
        add("자동 작업", FAIL, f"최근 26시간에 예약 실행이 실패한 작업 {len(names)}개: {', '.join(names)}")
    else:
        add("자동 작업", OK, "최근 26시간에 실패한 예약 실행 없음")


def main():
    dry = "--dry" in sys.argv
    check_site()
    sb = None
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if url and key:
        try:
            from supabase import create_client
            sb = create_client(url, key)
            check_data(sb)
        except Exception as e:  # noqa: BLE001
            add("자료", FAIL, f"DB 를 읽지 못함({type(e).__name__})")
    else:
        add("자료", WARN, "SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없어 확인하지 못함")
    check_actions()

    fails = [i for i in items if i["level"] == FAIL]
    warns = [i for i in items if i["level"] == WARN]
    when = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
    head = f"실패 {len(fails)}개 · 주의 {len(warns)}개 · 정상 {len(items) - len(fails) - len(warns)}개"
    md = [f"## 운영 상태 점검 — {when} (KST)", "", head, "", "| 상태 | 항목 | 내용 |", "|---|---|---|"]
    order = {FAIL: 0, WARN: 1, OK: 2}
    for i in sorted(items, key=lambda x: order[x["level"]]):
        md.append(f"| {MARK[i['level']]} | {i['name']} | {i['detail']} |")
    text = "\n".join(md) + "\n"
    Path("out").mkdir(exist_ok=True)
    Path("out/health.md").write_text(text, encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(text)

    if sb and not dry:
        try:
            sb.table("site_settings").upsert({
                "key": "health_report",
                "value": {"at": NOW.isoformat(), "ok": not fails, "fails": len(fails), "warns": len(warns), "items": items},
                "updated_at": NOW.isoformat(),
            }, on_conflict="key").execute()
        except Exception as e:  # noqa: BLE001
            print(f"health_report 를 적지 못함: {type(e).__name__}")

    print("\n" + head)
    print(json.dumps([i["name"] for i in fails], ensure_ascii=False))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
