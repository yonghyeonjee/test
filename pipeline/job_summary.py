"""
job_summary.py — 공고 하나하나의 요약.

나라일터는 제목·기관·날짜만 주고 본문은 첨부 공고문(pdf·hwp·hwpx)에 있다. 그 파일을 읽어
모집 분야·인원, 자격 요건, 접수 기간·방법, 제출 서류, 전형 절차, 근무 조건을 뽑아 공고 쪽에 붙인다.
원문을 옮기지 않고 사실만 항목으로 적는다. 문서에 없는 것은 비워 둔다.

  python pipeline/job_summary.py                    # 최근 3일 등록·접수 중·첨부 있는 공고 가운데 아직 요약 없는 것, 300건까지
  python pipeline/job_summary.py --days 7 --limit 50
  python pipeline/job_summary.py --id 304682 --dry
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from org_guide import (  # noqa: E402
    DOC_CHARS, DOC_EXT, MODELS, classify_file, doc_text, download, file_ext, file_url, generate, is_quota,
)
import org_guide  # noqa: E402

SITE = "https://jiwon.knowhow-it.com"
PAUSE_S = 1.2   # 분당 호출 수 한도를 넘지 않게 호출 사이에 쉰다

SCHEMA = {
    "type": "object",
    "properties": {
        "one_line": {"type": "string", "description": "공고를 한 문장(60자 안)으로. 무엇을 몇 명 뽑고 언제까지 접수하는지"},
        "positions": {"type": "array", "items": {"type": "object", "properties": {
            "name": {"type": "string", "description": "모집 분야·직무"},
            "headcount": {"type": "string", "description": "인원. 문서 표기 그대로(예: 2명, 0명)"},
            "grade": {"type": "string", "description": "직급·등급·호봉. 없으면 빈 문자열"},
            "type": {"type": "string", "description": "고용 형태(정규직·공무직·기간제·임기제 등). 없으면 빈 문자열"}},
            "required": ["name", "headcount", "grade", "type"]}},
        "requirements": {"type": "array", "items": {"type": "string"}, "description": "응시 자격·필수 요건"},
        "preferred": {"type": "array", "items": {"type": "string"}, "description": "우대 사항·가점"},
        "period": {"type": "object", "properties": {
            "start": {"type": "string"}, "end": {"type": "string", "description": "접수 마감. 날짜와 시각이 있으면 둘 다"},
            "how": {"type": "string", "description": "접수 방법(이메일·방문·우편·누리집)과 주소"}},
            "required": ["start", "end", "how"]},
        "documents": {"type": "array", "items": {"type": "string"}, "description": "제출 서류"},
        "process": {"type": "array", "items": {"type": "string"}, "description": "전형 절차를 순서대로. 날짜가 있으면 함께"},
        "work": {"type": "object", "properties": {
            "place": {"type": "string"}, "hours": {"type": "string"}, "pay": {"type": "string"}, "term": {"type": "string", "description": "계약·근무 기간"}},
            "required": ["place", "hours", "pay", "term"]},
        "contact": {"type": "string", "description": "문의처(부서·전화)"},
        "notes": {"type": "array", "items": {"type": "string"}, "description": "그 밖에 지원자가 알아야 할 유의사항"},
    },
    "required": ["one_line", "positions", "requirements", "preferred", "period", "documents", "process", "work", "contact", "notes"],
}


def prompt(title: str, org: str | None, text: str) -> str:
    return (f"다음은 '{org or ''}'의 채용 공고 '{title}'에 붙은 공고문에서 뽑은 글이다. 지원자가 알아야 할 사실만 JSON 으로 정리해라.\n"
            "- 문서에 적힌 것만 쓴다. 없는 항목은 빈 문자열·빈 배열. 추측하지 않는다.\n"
            "- 숫자·날짜·시각·금액은 문서 표기 그대로. 요약은 항목으로 짧게, 문장 그대로 베끼지 않는다.\n"
            "- 여러 분야를 뽑으면 positions 에 분야마다 한 줄. 인원이 분야별로 적혀 있으면 그대로.\n"
            "- one_line 은 '무엇을 몇 명, 언제까지' 꼴의 한 문장.\n\n" + text)


def pick_files(files: list[dict], limit: int = 2) -> list[dict]:
    ok = [f for f in files or [] if file_ext(f) in DOC_EXT]
    order = ["공고문", "입사지원서·응시원서", "직무기술서", "자기소개서", "직무수행계획서", None]
    ok.sort(key=lambda f: (order.index(classify_file(f.get("name", ""))) if classify_file(f.get("name", "")) in order else 5, f.get("name", "")))
    return ok[:limit]


def read_text(files: list[dict]) -> tuple[str, list[str]]:
    texts, names = [], []
    for f in files:
        data = download(file_url(f))
        if not data:
            continue
        try:
            t = doc_text(f.get("name", ""), data)
        except Exception as e:  # noqa: BLE001
            print(f"  첨부 못 읽음 {f.get('name')}: {type(e).__name__}", file=sys.stderr)
            continue
        if len(t) >= 150:
            texts.append(f"[{f.get('name')}]\n{t}")
            names.append(f.get("name", ""))
    return "\n\n".join(texts)[:DOC_CHARS], names


def clean(s: dict) -> dict:
    """빈 값 정리. 글자 수 한도 안으로. 아무것도 없으면 빈 dict."""
    def strs(xs, n=12, ln=160):
        out = []
        for x in xs or []:
            x = (x or "").strip()
            if x and x not in out and len(x) <= ln:
                out.append(x)
        return out[:n]
    out = {
        "one_line": (s.get("one_line") or "").strip()[:120],
        "positions": [{k: (p.get(k) or "").strip()[:80] for k in ("name", "headcount", "grade", "type")} for p in (s.get("positions") or []) if (p.get("name") or "").strip()][:12],
        "requirements": strs(s.get("requirements")), "preferred": strs(s.get("preferred"), 8),
        "period": {k: ((s.get("period") or {}).get(k) or "").strip()[:160] for k in ("start", "end", "how")},
        "documents": strs(s.get("documents")), "process": strs(s.get("process"), 8),
        "work": {k: ((s.get("work") or {}).get(k) or "").strip()[:160] for k in ("place", "hours", "pay", "term")},
        "contact": (s.get("contact") or "").strip()[:120], "notes": strs(s.get("notes"), 6),
    }
    filled = (len(out["positions"]) + len(out["requirements"]) + len(out["documents"]) + len(out["process"])
              + sum(1 for v in out["period"].values() if v) + sum(1 for v in out["work"].values() if v))
    return out if filled >= 2 else {}


def fix_period(s: dict, row: dict) -> dict:
    """모델이 마감을 '14:00' 처럼 시각만 적으면 공고의 마감 날짜를 앞에 붙인다."""
    import re
    end = (s.get("period") or {}).get("end") or ""
    if end and not re.search(r"\d{4}|\d{1,2}\s*[./월]\s*\d{1,2}", end) and row.get("end_date"):
        y, m, d = row["end_date"][:10].split("-")
        s["period"]["end"] = f"{y}.{int(m)}.{int(d)}. {end}"
    return s


def summarize(client, row: dict) -> tuple[dict, list[str], int]:
    from google.genai import types
    files = pick_files(((row.get("raw") or {}).get("gojobs") or {}).get("files") or [])
    text, names = read_text(files)
    if len(text) < 150:
        return {}, names, len(text)
    r = generate(client, "요약", contents=prompt(row.get("title") or "", row.get("org"), text),
                 config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=SCHEMA, temperature=0))
    try:
        raw = json.loads(r.text or "{}")
    except json.JSONDecodeError:
        raw = {}
    s = clean(raw)
    return (fix_period(s, row) if s else s), names, len(text)


def targets(sb, days: int, limit: int, only_id: str | None) -> list[dict]:
    q = sb.table("job_posts").select("source_id,title,org,reg_date,end_date,raw").eq("source", "gojobs")
    if only_id:
        q = q.eq("source_id", only_id)
    else:
        today = dt.date.today()
        q = (q.gte("reg_date", (today - dt.timedelta(days=days)).isoformat()).gte("end_date", today.isoformat())
             .order("reg_date", desc=True).limit(limit * 2))
    rows = q.execute().data or []
    rows = [r for r in rows if pick_files(((r.get("raw") or {}).get("gojobs") or {}).get("files") or [])]
    if only_id:
        return rows
    done = {d["source_id"] for d in (sb.table("job_summaries").select("source_id").in_("source_id", [r["source_id"] for r in rows]).execute().data or [])} if rows else set()
    return [r for r in rows if r["source_id"] not in done][:limit]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=3)
    ap.add_argument("--limit", type=int, default=300)
    ap.add_argument("--id")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    from supabase import create_client
    url, key = os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]
    try:
        from supabase import ClientOptions
        sb = create_client(url, key, options=ClientOptions(postgrest_client_timeout=120))
    except Exception:  # noqa: BLE001
        sb = create_client(url, key)
    client = org_guide.gemini_client()

    rows = targets(sb, a.days, a.limit, a.id)
    print(f"대상 {len(rows)}건 (최근 {a.days}일 등록 · 접수 중 · 첨부 있음 · 요약 없음)")
    saved = empty = failed = 0
    for i, r in enumerate(rows):
        try:
            s, names, chars = summarize(client, r)
        except Exception as e:  # noqa: BLE001
            if is_quota(e):
                print(f"  할당량 소진. 여기서 멈춤 ({i}건 처리). 내일 이어서.", file=sys.stderr)
                break
            failed += 1
            print(f"  [{r['source_id']}] 실패: {type(e).__name__}: {str(e)[:160]}", file=sys.stderr)
            continue
        if not s:
            empty += 1
            print(f"  [{r['source_id']}] 요약 없음 ({chars}자): {(r.get('title') or '')[:40]}")
            if not a.dry:
                # 다음에 다시 시도하지 않도록 빈 요약을 남긴다(파일이 그림만이거나 글자가 없는 공고).
                sb.table("job_summaries").upsert({"source_id": r["source_id"], "summary": {}, "files": names, "chars": chars, "model": org_guide.MODEL, "updated_at": "now()"}, on_conflict="source_id").execute()
            continue
        print(f"  [{r['source_id']}] {s['one_line'][:60]} · 분야 {len(s['positions'])} 자격 {len(s['requirements'])} 서류 {len(s['documents'])}")
        if a.dry:
            print(json.dumps(s, ensure_ascii=False, indent=1)[:3000])
        else:
            sb.table("job_summaries").upsert({"source_id": r["source_id"], "summary": s, "files": names, "chars": chars, "model": org_guide.MODEL, "updated_at": "now()"}, on_conflict="source_id").execute()
            saved += 1
        time.sleep(PAUSE_S)
    print(f"저장 {saved} · 빈 요약 {empty} · 실패 {failed}")


if __name__ == "__main__":
    main()
