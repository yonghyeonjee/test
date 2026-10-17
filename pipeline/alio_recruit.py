"""
alio_recruit.py — 알리오 공공기관 채용정보 API 로 잡알리오 공고를 받고, 공고 요약 자리에 칸별 내용을 채운다(2026-10-17).

재정경제부_공공기관 채용정보 조회서비스(opendata.alio.go.kr/new/v1/recruit/list.do, POST, serviceKey).
목록 한 줄에 응시 자격·우대·전형 절차·근무지·고용형태·인원·접수 기간·기관 원문 주소가 다 들어 있다.
공고 번호(recrutPblntSn)는 잡알리오 화면 번호와 같아 job_posts 의 source_id 'a<번호>' 와 바로 맞물린다.

  - job_posts: 없는 공고는 넣고(나라일터에 같은 공고가 있으면 넣지 않는다), 있는 공고는 인원·구분·직무·기관 원문 주소를 채운다.
  - job_summaries: web/lib/jobSummary.ts 와 같은 모양으로. 요약이 있으면 공고 쪽이 요약 상자·FAQ·구인 정보를 그리고
    색인한다(web/app/jobs/[id]/page.tsx). 나라일터와 겹치는 공고(쌍둥이)에는 요약을 쓰지 않아 색인에서 빠진 채로 둔다.
  - 결격 사유(disqlfcRsn)는 싣지 않는다. 기관마다 같은 법조문이라 쪽마다 똑같은 글이 된다.
  - Gemini 를 쓰지 않는다. 기관이 공시한 글을 칸별로 나눠 담을 뿐이다.

  python pipeline/alio_recruit.py              # 최근 공고(접수 시작 90일 안)
  python pipeline/alio_recruit.py --days 30 --dry
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import sys
import time

import requests

API = "https://opendata.alio.go.kr/new/v1/recruit/list.do"
PAGE = 100
MODEL = "alio-api"

# 코드 정의서(MOEF_NKOD_DB_05 v1.2)의 근무지 이름 → job_posts.region 에 쓰는 시·도 이름(web/lib/geo.ts normSido 와 같게).
SIDO = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시", "인천": "인천광역시", "대전": "대전광역시",
    "울산": "울산광역시", "세종": "세종특별자치시", "경기": "경기도", "강원": "강원특별자치도", "충북": "충청북도",
    "충남": "충청남도", "전북": "전북특별자치도", "경북": "경상북도", "경남": "경상남도", "제주": "제주특별자치도",
    "광주": "전남광주통합특별시", "전남": "전남광주통합특별시", "전남광주": "전남광주통합특별시",
}
_TWIN_NORM = re.compile(r"[\s\[\]()「」『』\"'·ㆍ.,\-]")


def ymd(s: str | None) -> str | None:
    s = (s or "").strip()
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if re.fullmatch(r"\d{8}", s) else None


def region_of(names: str | None) -> str | None:
    """근무지가 한 시·도면 그 이름, 여럿이거나 해외면 비운다(지역 쪽에 엉뚱하게 걸리지 않게)."""
    got = {SIDO.get(n.strip()) for n in (names or "").split(",") if n.strip()}
    got.discard(None)
    return got.pop() if len(got) == 1 else None


def lines(text: str | None, cap: int = 40) -> list[str]:
    """기관이 붙여 넣은 긴 글을 줄 단위로. 빈 줄·구분선은 버리고, 너무 긴 글은 앞쪽만."""
    out = []
    for ln in re.split(r"\r?\n", (text or "").replace("\\r\\n", "\n").replace("\\n", "\n")):
        t = re.sub(r"[ \t]+", " ", ln).strip()
        if not t or re.fullmatch(r"[-=_*·.~\s]+", t):
            continue
        out.append(t[:400])
        if len(out) >= cap:
            break
    return out


def to_summary(r: dict) -> dict:
    """API 한 줄 → job_summaries.summary(web/lib/jobSummary.ts JobSummary 와 같은 모양)."""
    hire = (r.get("hireTypeNmLst") or "").replace(",", ", ")
    n = r.get("recrutNope")
    ncs = (r.get("ncsCdNmLst") or "").replace(",", ", ")
    one = " · ".join(x for x in [
        r.get("recrutSeNm") or "", f"{n}명" if n else "", hire,
    ] if x)
    pref = lines(r.get("prefCondCn"), 12) + [x for x in lines(r.get("prefCn"), 12) if x not in lines(r.get("prefCondCn"), 12)]
    return {
        "one_line": one,
        "positions": [{"name": ncs, "headcount": f"{n}명" if n else "", "grade": "", "type": hire}] if (ncs or n or hire) else [],
        "requirements": lines(r.get("aplyQlfcCn")),
        "preferred": pref[:20],
        "period": {"start": ymd(r.get("pbancBgngYmd")) or "", "end": ymd(r.get("pbancEndYmd")) or "", "how": ""},
        "documents": [],
        "process": lines(r.get("scrnprcdrMthdExpln")),
        "work": {"place": (r.get("workRgnNmLst") or "").replace(",", ", "), "hours": "", "pay": "", "term": ""},
        "contact": "",
        "notes": [f"학력: {(r.get('acbgCondNmLst') or '').replace(',', ', ')}"] if r.get("acbgCondNmLst") else [],
    }


def filled(s: dict) -> bool:
    """web/lib/jobSummary.ts toLoadedSummary 와 같은 기준."""
    return sum(len(s.get(k) or []) for k in ("positions", "requirements", "documents", "process")) > 0


def twin_of(r: dict, gojobs: list[dict]) -> bool:
    """나라일터에 같은 공고가 있는지(web/lib/jobTwins.ts, blog_daily.drop_alio_twins 와 같은 기준)."""
    norm = lambda t: _TWIN_NORM.sub("", t or "").lower()
    n = norm(r.get("recrutPbancTtl"))
    reg, end = ymd(r.get("pbancBgngYmd")), ymd(r.get("pbancEndYmd"))
    for g in gojobs:
        if g.get("end_date") != end or (g.get("reg_date") and reg and g["reg_date"] != reg):
            continue
        t = norm(g.get("title"))
        if t == n or (len(t) >= 8 and t in n) or (len(n) >= 8 and n in t):
            return True
    return False


def fetch(key: str, page: int) -> tuple[list[dict], int]:
    for attempt in range(3):
        try:
            r = requests.post(API, data={"serviceKey": key, "pageNo": str(page), "numOfRows": str(PAGE)}, timeout=60)
            d = r.json()
            rows = d.get("result")
            if isinstance(rows, list):
                return rows, int(d.get("totalCount") or 0)
            # 결과가 없으면 resultCode 3(데이터없음)
            if str(d.get("resultCode")) == "3":
                return [], 0
            print(f"  {page}쪽: {str(d)[:160]}", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"  {page}쪽: {type(e).__name__}", file=sys.stderr)
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"{page}쪽을 받지 못했다")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=90, help="접수 시작이 며칠 안인 공고까지")
    ap.add_argument("--max-pages", type=int, default=40)
    ap.add_argument("--dry", action="store_true")
    # probe.yml 은 인자를 한 덩어리로 넘긴다("--days 90 --dry"). 그럴 때는 나눠 읽는다.
    argv = sys.argv[1].split() if len(sys.argv) == 2 and " " in sys.argv[1] else sys.argv[1:]
    a = ap.parse_args(argv)
    key = os.environ.get("ALIO_RECRUIT_KEY", "").strip()
    if not key:
        sys.exit("ALIO_RECRUIT_KEY 가 없다")
    since = (dt.date.today() - dt.timedelta(days=a.days)).isoformat()

    rows: list[dict] = []
    seen_first = None
    for p in range(1, a.max_pages + 1):
        got, total = fetch(key, p)
        if not got:
            break
        if p == 1:
            print(f"전체 {total}건")
        first = got[0].get("recrutPblntSn")
        if first == seen_first:
            sys.exit("쪽 번호가 먹지 않는다(같은 쪽이 되풀이됨) — 요청 칸 이름을 확인할 것")
        seen_first = first if p == 1 else seen_first
        rows += got
        # 번호 큰(최근) 것부터 온다. 한 쪽이 통째로 기간 밖이면 멈춘다.
        if all((ymd(x.get("pbancBgngYmd")) or "9999") < since for x in got):
            break
    rows = [r for r in rows if (ymd(r.get("pbancBgngYmd")) or "9999") >= since]
    print(f"받은 공고 {len(rows)}건(접수 시작 {since} 이후)")
    if not rows:
        return

    if a.dry and not os.environ.get("SUPABASE_URL"):
        sb = None  # DB 없이 모양만 본다(probe.yml)
    else:
        from supabase import create_client
        sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    ids = [f"a{r['recrutPblntSn']}" for r in rows]
    have: set[str] = set()
    for i in range(0, len(ids) if sb else 0, 200):
        have |= {x["source_id"] for x in (sb.table("job_posts").select("source_id").eq("source", "alio")
                                          .in_("source_id", ids[i:i + 200]).execute().data or [])}
    ends = sorted({ymd(r.get("pbancEndYmd")) for r in rows if ymd(r.get("pbancEndYmd"))})
    gojobs: list[dict] = []
    for i in range(0, len(ends) if sb else 0, 50):
        gojobs += (sb.table("job_posts").select("title,reg_date,end_date").eq("source", "gojobs")
                   .in_("end_date", ends[i:i + 50]).limit(5000).execute().data or [])

    now = dt.datetime.now(dt.timezone.utc).isoformat()
    posts, sums, twins = [], [], 0
    for r in rows:
        sid = f"a{r['recrutPblntSn']}"
        twin = twin_of(r, gojobs)
        twins += twin
        if sid not in have and twin:
            continue  # 나라일터에 있는 공고는 새로 넣지 않는다(alioJobs.ts 와 같은 규칙)
        post = {
            "id": f"alio:{sid}", "source": "alio", "source_id": sid,
            "headcount": str(r["recrutNope"]) if r.get("recrutNope") else None,
            "recruit": r.get("recrutSeNm") or None,
            "sectors": (r.get("ncsCdNmLst") or "").replace(",", ", ") or None,
            "fetched_at": now,
        }
        if sid not in have:
            post |= {
                "title": (r.get("recrutPbancTtl") or "")[:300], "org": (r.get("instNm") or "")[:200],
                "region": region_of(r.get("workRgnNmLst")), "hire": "공공",
                "reg_date": ymd(r.get("pbancBgngYmd")), "start_date": ymd(r.get("pbancBgngYmd")),
                "end_date": ymd(r.get("pbancEndYmd")),
                "url": f"https://job.alio.go.kr/recruitview.do?idx={r['recrutPblntSn']}",
                "raw": {"from": "opendata.alio.go.kr", "area": r.get("workRgnNmLst"), "src": r.get("srcUrl")},
            }
        posts.append(post)
        s = to_summary(r)
        if not twin and filled(s):
            files = [f.get("atchFileNm") for f in (r.get("files") or []) if isinstance(f, dict) and f.get("atchFileNm")]
            sums.append({"source_id": sid, "summary": s, "files": files[:10], "chars": len(r.get("aplyQlfcCn") or ""),
                         "model": MODEL, "updated_at": "now()"})
    new = sum(1 for p in posts if "title" in p)
    print(f"새 공고 {new}, 채울 공고 {len(posts) - new}, 요약 {len(sums)}, 나라일터와 겹침 {twins}")
    for s in sums[:2]:
        print("  예:", s["source_id"], s["summary"]["one_line"], "| 자격", len(s["summary"]["requirements"]), "| 전형", len(s["summary"]["process"]))
    if a.dry:
        return
    # 새 줄은 통째로 넣고, 있는 줄은 고칠 칸만 바꾼다(제목·지역 등 이미 있는 값을 덮지 않게).
    fresh = [p for p in posts if "title" in p]
    for i in range(0, len(fresh), 200):
        sb.table("job_posts").upsert(fresh[i:i + 200], on_conflict="id").execute()
    for p in posts:
        if "title" not in p:
            sb.table("job_posts").update({k: v for k, v in p.items() if k not in ("id", "source", "source_id")}) \
                .eq("id", p["id"]).execute()
    for i in range(0, len(sums), 100):
        sb.table("job_summaries").upsert(sums[i:i + 100], on_conflict="source_id").execute()
    print("저장 끝")


if __name__ == "__main__":
    main()
