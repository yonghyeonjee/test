"""
org_guide.py — 기관별 "자기소개서·직무수행계획서 작성 가이드"를 만든다.

취업 준비하는 사람이 검색창에 치는 말은 "OO공사 자소서", "OO 직무수행계획서" 다. 그 답을 기관마다
한 쪽씩 만들어 둔다. 사이트는 저장된 글만 읽으니 빠르고, 글은 120일에 한 번만 다시 쓰니 싸다.

재료는 셋이다.
  1. 우리 자료(job_posts·blog_org_stats): 공고 수, 접수 기간, 임기제·공무직 같은 자리 구성, 첨부 파일(공고문·지원서·직무기술서)
  2. 기관이 나라일터에 붙인 공고문 PDF(최근 세 건): 전형 절차, 제출 서류, 자소서 문항, 직무수행계획서 분량을 모델이 문서에서만 뽑는다.
     1차 자료라 가장 믿을 만하고, 일반 호출이라 무료 할당량으로 돈다. 출처는 우리 공고 쪽(/jobs/<id>).
  3. 웹 검색(Gemini 검색 접지): 기관이 밝힌 인재상·핵심가치·공식 누리집. 접지 할당량이 없으면(결제 꺼짐) 건너뛴다.
     공식 출처(누리집·알리오·나라일터)만 쓰고, 출처 없는 항목은 버린다.

지어내지 않는다. 검색으로 확인되지 않은 것은 "확인하지 못했다"고 적고 공고문으로 보낸다.
작성 틀(문항 유형별 구조, 직무수행계획서 뼈대)은 우리가 쓴 일반 안내다.

  python pipeline/org_guide.py                  # 오늘 차례 3곳(찾는 사람 많고 접수 중인 공고 많은 순)
  python pipeline/org_guide.py --org 한국농어촌공사
  python pipeline/org_guide.py --count 5 --dry  # DB 에 쓰지 않고 JSON 만
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
from urllib.parse import unquote, urlparse

SITE = "https://jiwon.knowhow-it.com"
BRAND = "K나라지원"
# 검색 접지 할당량이 모델마다 다르다. 앞 모델이 429(할당량 소진)면 다음 모델로 넘어간다. 실제로 쓴 모델을 글에 적는다.
MODELS = [m.strip() for m in (os.environ.get("GEMINI_MODELS") or "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.1-flash-lite").split(",") if m.strip()]
MODEL = MODELS[0]
REFRESH_DAYS = 120

# 출처로 인정하지 않는 곳. 취업 포털·커뮤니티 글은 남의 글이고, 우리가 확인할 수 없다.
BAD_SOURCE = re.compile(r"jobkorea|saramin|incruit|linkareer|wanted\.co|catch\.co|blog\.naver|tistory|brunch|cafe\.naver|cafe\.daum|dcinside|fmkorea|clien|ppomppu|velog|medium\.com|youtube|instagram|facebook|namu\.wiki|wikipedia", re.I)
# 직무수행계획서를 내게 하는 일이 많은 자리. 제목으로 가른다.
PLAN_RE = re.compile(r"임기제|전문경력관|개방형|공모직|별정직|계약직\s*[가-힣]*(장|관)|센터장|원장|소장|단장|본부장|실장|팀장")
KIND_RE = [
    ("임기제·전문경력관", re.compile(r"임기제|전문경력관|개방형|별정직")),
    ("공무직·무기계약", re.compile(r"공무직|무기계약|상용직")),
    ("기간제·계약", re.compile(r"기간제|계약직|한시|대체|시간선택제")),
    ("정규직·신입", re.compile(r"신입|정규직|일반직|채용형\s*인턴|공개채용|공채|[0-9]급")),
    ("인턴·체험", re.compile(r"인턴|체험형|현장실습")),
    ("연구·전문", re.compile(r"연구원|연구직|박사|전문연구|학술")),
]
FILE_RE = [
    ("직무수행계획서", re.compile(r"직무수행계획|직무계획|업무수행계획")),
    ("자기소개서", re.compile(r"자기소개|자소서")),
    ("직무기술서", re.compile(r"직무기술서|직무설명|직무\s*기술")),
    ("입사지원서·응시원서", re.compile(r"지원서|응시원서|이력서|응시서류|제출서류|서식|양식")),
    ("공고문", re.compile(r"공고|안내문|모집")),
]
MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]


# ── 작은 도우미 ──────────────────────────────────────────
def today() -> dt.date:
    return dt.date.today()


def n(x) -> str:
    try:
        return f"{int(round(float(x))):,}"
    except (TypeError, ValueError):
        return "0"


def pct(a, b) -> int:
    try:
        return int(round(100.0 * float(a) / float(b))) if float(b) else 0
    except (TypeError, ValueError):
        return 0


def kdate(iso: str | None) -> str:
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", iso or "")
    return f"{int(m.group(2))}월 {int(m.group(3))}일" if m else ""


def slugify(s: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣]+", "-", s).strip("-")


def josa(word: str, pair: str) -> str:
    core = re.sub(r"[^가-힣]+$", "", word) or word
    c = ord(core[-1])
    kor = 0xAC00 <= c <= 0xD7A3
    jong = (c - 0xAC00) % 28 if kor else 0
    has = kor and jong != 0
    if pair == "으로":
        return word + ("로" if (not has or jong == 8) else "으로")
    a, b = {"은는": ("은", "는"), "이가": ("이", "가"), "을를": ("을", "를"), "과와": ("과", "와")}[pair]
    return word + (a if has else b)


def domain(url: str | None) -> str:
    try:
        return (urlparse(url or "").hostname or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def ok_source(url: str | None, allowed: set[str]) -> bool:
    """출처로 인정하는가. 접지가 실제로 읽은 도메인이거나 공공 도메인(.go.kr·.or.kr·.re.kr·.ac.kr)이고, 포털·커뮤니티가 아니다."""
    d = domain(url)
    if not d or BAD_SOURCE.search(d):
        return False
    return d in allowed or any(d.endswith(s) for s in (".go.kr", ".or.kr", ".re.kr", ".ac.kr", ".kr"))


def P(text): return {"type": "p", "text": text}
def H2(text, id_): return {"type": "h2", "text": text, "id": id_}
def LIST(items): return {"type": "list", "items": items}
def TABLE(head, rows): return {"type": "table", "head": head, "rows": rows}
def LINKS(items): return {"type": "links", "items": items}
def NOTE(text): return {"type": "note", "text": text}


# ── 우리 자료 ─────────────────────────────────────────────
def classify_title(title: str) -> str | None:
    for label, rx in KIND_RE:
        if rx.search(title or ""):
            return label
    return None


def classify_file(name: str) -> str | None:
    for label, rx in FILE_RE:
        if rx.search(name or ""):
            return label
    return None


def shape_posts(rows: list[dict]) -> dict:
    """공고 줄(source_id,title,reg_date,end_date,raw)에서 자리 구성·직무수행계획서 자리·첨부 파일 있는 공고를 센다."""
    t = today().isoformat()
    kinds: dict[str, int] = {}
    plan_titles, with_files = [], []
    for r in rows:
        title = r.get("title") or ""
        k = classify_title(title)
        if k:
            kinds[k] = kinds.get(k, 0) + 1
        if PLAN_RE.search(title):
            plan_titles.append({"id": r["source_id"], "title": title, "end": r.get("end_date"), "open": bool(r.get("end_date") and r["end_date"] >= t)})
        files = (((r.get("raw") or {}).get("gojobs") or {}).get("files")) or []
        labels = sorted({classify_file(f.get("name", "")) for f in files} - {None}, key=lambda x: [l for l, _ in FILE_RE].index(x))
        if labels:
            with_files.append({"id": r["source_id"], "title": title, "reg": r.get("reg_date"), "files": labels})
    return {
        "kinds": sorted(({"k": k, "n": v} for k, v in kinds.items()), key=lambda x: -x["n"]),
        "plan_n": len(plan_titles), "plan_open": [p for p in plan_titles if p["open"]][:5], "plan_recent": plan_titles[:5],
        "files_n": len(with_files), "with_files": with_files[:6],
        "has_plan_file": any("직무수행계획서" in w["files"] for w in with_files),
        "has_essay_file": any("자기소개서" in w["files"] for w in with_files),
        "has_desc_file": any("직무기술서" in w["files"] for w in with_files),
    }


# ── 웹 검색(Gemini) ───────────────────────────────────────
FACT_SCHEMA = {
    "type": "object",
    "properties": {
        "official_site": {"type": "string", "description": "기관 공식 누리집 주소. 모르면 빈 문자열"},
        "recruit_page": {"type": "string", "description": "채용 안내 페이지 주소. 모르면 빈 문자열"},
        "mission": {"type": "string"},
        "vision": {"type": "string"},
        "values": {"type": "array", "items": {"type": "object", "properties": {"text": {"type": "string"}, "source": {"type": "string"}}, "required": ["text", "source"]}},
        "ideal": {"type": "array", "description": "인재상", "items": {"type": "object", "properties": {"text": {"type": "string"}, "source": {"type": "string"}}, "required": ["text", "source"]}},
        "process": {"type": "object", "properties": {
            "steps": {"type": "array", "items": {"type": "string"}},
            "blind": {"type": "string", "description": "yes / no / unknown"},
            "source": {"type": "string"}}, "required": ["steps", "blind", "source"]},
        "essay_questions": {"type": "array", "items": {"type": "object", "properties": {
            "text": {"type": "string"}, "limit": {"type": "string", "description": "글자 수 제한. 없으면 빈 문자열"},
            "year": {"type": "string"}, "position": {"type": "string"}, "source": {"type": "string"}}, "required": ["text", "limit", "year", "position", "source"]}},
        "plan": {"type": "object", "properties": {
            "required": {"type": "string", "description": "yes / no / unknown"},
            "positions": {"type": "array", "items": {"type": "string"}},
            "format": {"type": "string", "description": "분량·양식 요건. 없으면 빈 문자열"},
            "source": {"type": "string"}}, "required": ["required", "positions", "format", "source"]},
        "rules": {"type": "array", "description": "기재 금지·가점·우대 등 지원서에 영향 주는 규정", "items": {"type": "object", "properties": {"text": {"type": "string"}, "source": {"type": "string"}}, "required": ["text", "source"]}},
    },
    "required": ["official_site", "recruit_page", "mission", "vision", "values", "ideal", "process", "essay_questions", "plan", "rules"],
}


def search_prompt(org: str) -> str:
    return (
        f"한국의 공공기관·정부기관 '{org}'에 지원서를 쓰려는 사람에게 필요한 공식 정보를 웹에서 찾아 정리해라.\n"
        "근거는 기관 공식 누리집, 알리오(alio.go.kr)·잡알리오, 나라일터(gojobs.go.kr), 정부·지자체 공고문처럼 공식 출처만 써라. "
        "취업 포털(잡코리아·사람인 등)·블로그·카페·커뮤니티 글은 근거로 쓰지 마라.\n\n"
        "찾을 것:\n"
        "1. 공식 누리집 주소, 채용 안내 페이지 주소\n"
        "2. 기관이 밝힌 미션·비전·인재상·핵심가치 (기관의 표현을 그대로, 짧게)\n"
        "3. 최근 채용의 전형 절차(예: 서류 → 필기 → 면접), 블라인드 채용 여부\n"
        "4. 최근 공식 공고문이나 입사지원서 양식에 실린 자기소개서 문항 (문항 원문, 글자 수 제한, 연도, 어느 자리 공고인지)\n"
        "5. 직무수행계획서(직무계획서·업무수행계획서)를 내게 하는 직위·공고와 분량·양식 요건\n"
        "6. 그 밖에 지원서 작성에 영향을 주는 규정 (기재 금지 사항, 가점·우대)\n\n"
        "항목마다 확인한 출처 URL 을 적어라. 확인되지 않는 항목은 '확인 안 됨'이라고만 적어라. 추측하거나 지어내지 마라. "
        "자기소개서 문항은 공식 문서에서 확인된 것만 적고, 흔한 문항을 예로 만들어 넣지 마라."
    )


def gemini_client():
    from google import genai
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def is_quota(e: Exception) -> bool:
    """할당량 소진(429)이거나 모델이 없어진 것(404). 둘 다 기다려도 안 풀리니 다음 모델로 간다."""
    t = str(e)
    return "429" in t or "RESOURCE_EXHAUSTED" in t or "404" in t or "NOT_FOUND" in t


def with_retry(fn, tries: int = 3, what: str = ""):
    """일시 오류는 세 번까지. 할당량 소진(429)은 기다려도 안 풀리니 바로 올린다."""
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            if i == tries - 1 or is_quota(e):
                raise
            print(f"  {what} 다시 시도 {i + 1}: {type(e).__name__}: {str(e)[:200]}", file=sys.stderr)
            time.sleep(20 * (i + 1))


def generate(client, what: str, **kw):
    """모델을 차례로 시도한다. 429 면 다음 모델. 성공한 모델 이름을 MODEL 에 남긴다."""
    global MODEL
    last: Exception | None = None
    start = MODELS.index(MODEL) if MODEL in MODELS else 0
    for m in MODELS[start:] + MODELS[:start]:
        try:
            r = with_retry(lambda: client.models.generate_content(model=m, **kw), what=f"{what}({m})")
            MODEL = m
            return r
        except Exception as e:  # noqa: BLE001
            last = e
            if is_quota(e):
                print(f"  {what}: {m} 못 씀 → 다음 모델. {str(e)[:400]}", file=sys.stderr)
                continue
            raise
    # 전부 막혔다. 검색 접지만 막힌 것인지(결제 필요) 모델 자체가 막힌 것인지 한 번 가려 본다.
    if kw.get("config") is not None and getattr(kw["config"], "tools", None):
        for m in MODELS:
            try:
                client.models.generate_content(model=m, contents="답: 1")
                print(f"  진단: {m} 은 일반 호출은 되지만 검색 접지(google_search)는 할당량이 없다. Google AI Studio 프로젝트에 결제를 켜야 한다.", file=sys.stderr)
                break
            except Exception as e2:  # noqa: BLE001
                print(f"  진단: {m} 일반 호출도 막힘. {str(e2)[:200]}", file=sys.stderr)
    raise last or RuntimeError("모델 없음")


def search_facts(client, org: str) -> tuple[dict, list[dict], str]:
    """(facts, sources, memo). 1) 검색 접지로 메모를 얻고 2) 그 메모만 JSON 으로 옮긴다(접지와 JSON 출력은 한 호출에 못 섞는다)."""
    from google.genai import types
    try:
        r = generate(client, "검색", contents=search_prompt(org),
                     config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())], temperature=0.1))
    except Exception as e:  # noqa: BLE001
        if is_quota(e):
            print("  검색 접지 할당량 없음(Google AI 결제 꺼짐) → 공고문만으로 씁니다.", file=sys.stderr)
            return {}, [], ""
        raise
    memo = r.text or ""
    sources: list[dict] = []
    try:
        gm = r.candidates[0].grounding_metadata
        for c in (gm.grounding_chunks or []):
            w = getattr(c, "web", None)
            if w and w.uri:
                sources.append({"title": w.title or "", "uri": w.uri, "domain": (w.title or "").lower() if "." in (w.title or "") else domain(w.uri)})
    except (AttributeError, IndexError):
        pass
    if not memo.strip():
        return {}, sources, memo
    r2 = generate(client, "정리",
                  contents=("다음은 '" + org + "' 채용 정보를 웹에서 조사한 메모다. 메모에 적힌 것만 JSON 으로 옮겨라. "
                            "메모에 없거나 '확인 안 됨'인 항목은 빈 문자열·빈 배열로 둔다. 각 항목의 source 에는 메모에 적힌 출처 URL 을 그대로 넣고, "
                            "출처가 없는 항목은 넣지 마라.\n\n메모:\n" + memo),
                  config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=FACT_SCHEMA, temperature=0))
    try:
        facts = json.loads(r2.text or "{}")
    except json.JSONDecodeError:
        facts = {}
    return facts, sources, memo


PDF_MAX_BYTES = 15 * 1024 * 1024
PDF_MAX_PAGES = 15
DOC_CHARS = 14000
GOJOBS = "https://www.gojobs.go.kr"


def file_url(f: dict) -> str:
    from urllib.parse import quote
    return f"{GOJOBS}/downFile.do?filenm={quote(f.get('name', ''))}&uuid={quote(f.get('uuid', ''))}&saveGbn={quote(f.get('path', ''))}"


def pdf_text(data: bytes) -> str:
    from io import BytesIO
    from pypdf import PdfReader
    out = []
    reader = PdfReader(BytesIO(data))
    for page in reader.pages[:PDF_MAX_PAGES]:
        try:
            out.append(page.extract_text() or "")
        except Exception:  # noqa: BLE001 — 글자 못 뽑는 쪽은 건너뜀
            continue
    return re.sub(r"[ \t]+", " ", "\n".join(out)).strip()


def pick_docs(rows: list[dict], limit: int = 3) -> list[dict]:
    """최근 공고 가운데 PDF 공고문(또는 지원서·직무기술서 PDF)이 붙은 것. 한 공고에서 PDF 둘까지."""
    docs = []
    for r in rows:
        files = (((r.get("raw") or {}).get("gojobs") or {}).get("files")) or []
        pdfs = [f for f in files if (f.get("ext") or "").lower() == "pdf" or (f.get("name") or "").lower().endswith(".pdf")]
        pdfs.sort(key=lambda f: (classify_file(f.get("name", "")) not in ("공고문", "입사지원서·응시원서", "자기소개서", "직무수행계획서"), f.get("name", "")))
        if pdfs:
            docs.append({"id": r["source_id"], "title": r.get("title") or "", "reg": r.get("reg_date"), "files": pdfs[:2]})
        if len(docs) >= limit:
            break
    return docs


def fetch_docs(docs: list[dict]) -> list[dict]:
    import requests
    out = []
    for d in docs:
        texts = []
        for f in d["files"]:
            try:
                r = requests.get(file_url(f), timeout=40, headers={"User-Agent": "Mozilla/5.0 (compatible; NarajiwonBot/1.0; +https://jiwon.knowhow-it.com/about)"}, stream=True)
                if r.status_code != 200 or int(r.headers.get("content-length") or 0) > PDF_MAX_BYTES:
                    continue
                data = r.raw.read(PDF_MAX_BYTES + 1, decode_content=True)
                if len(data) > PDF_MAX_BYTES or not data.startswith(b"%PDF"):
                    continue
                t = pdf_text(data)
                if len(t) >= 200:
                    texts.append(f"[{f.get('name')}]\n{t}")
            except Exception as e:  # noqa: BLE001
                print(f"  첨부 못 읽음 {f.get('name')}: {type(e).__name__}", file=sys.stderr)
        if texts:
            out.append({**d, "text": "\n\n".join(texts)[:DOC_CHARS]})
    return out


def doc_prompt(org: str, docs: list[dict]) -> str:
    head = (f"다음은 '{org}'가 나라일터에 올린 채용 공고문(첨부 PDF)에서 뽑은 글이다. 문서에 적힌 것만 JSON 으로 정리해라. "
            "문서에 없는 것은 빈 문자열·빈 배열로 둔다. 추측하거나 흔한 예를 만들어 넣지 마라.\n"
            "- process.steps: 전형 절차를 순서대로(예: 서류전형, 필기시험, 면접). blind: 블라인드(무기명·학력 미기재) 채용이라고 적혀 있으면 yes.\n"
            "- essay_questions: 자기소개서 문항이 문서에 '문항 원문'으로 있을 때만. limit 에 글자 수. position 에 어느 자리 공고인지.\n"
            "- plan: 직무수행계획서(직무계획서·업무수행계획서)를 제출 서류로 요구하면 required=yes, 분량·양식을 format 에.\n"
            "- rules: 기재 금지, 가점·우대, 제출 서류 유의사항 가운데 지원서 작성에 영향 주는 것.\n"
            "- 각 항목의 source 에는 그 내용이 나온 문서의 [출처 주소]를 그대로 넣어라. mission·vision·values·ideal·official_site·recruit_page 는 공고문에 명시된 경우만.\n\n")
    body = "\n\n".join(f"=== 문서 {i + 1}: {d['title']} ({kdate(d.get('reg'))} 등록) [출처 주소] {SITE}/jobs/{d['id']}\n{d['text']}" for i, d in enumerate(docs))
    return head + body


def doc_facts(client, org: str, docs: list[dict]) -> dict:
    """공고문 PDF 에서 사실을 뽑는다. 일반 호출(접지 없음)이라 무료 할당량으로 돈다."""
    if not docs:
        return {}
    from google.genai import types
    r = generate(client, "공고문", contents=doc_prompt(org, docs),
                 config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=FACT_SCHEMA, temperature=0))
    try:
        return json.loads(r.text or "{}")
    except json.JSONDecodeError:
        return {}


def merge_facts(doc: dict, web: dict) -> dict:
    """공고문(1차 자료)이 우선. 인재상·누리집처럼 공고문에 없는 것은 웹 검색으로 채운다."""
    out = dict(web)
    for k in ("essay_questions", "rules", "values", "ideal"):
        seen = {x["text"] for x in doc.get(k) or []}
        out[k] = (doc.get(k) or []) + [x for x in (web.get(k) or []) if x["text"] not in seen]
    out["process"] = doc.get("process") or web.get("process")
    out["plan"] = doc.get("plan") or web.get("plan")
    for k in ("official_site", "recruit_page", "mission", "vision"):
        out[k] = doc.get(k) or web.get(k) or ""
    return out


def clean_facts(facts: dict, sources: list[dict]) -> dict:
    """출처 없는 것, 포털·커뮤니티 출처인 것을 버린다. 접지가 읽은 도메인 목록(제목이 도메인으로 온다)을 허용 목록에 더한다."""
    allowed = {s["domain"] for s in sources if s.get("domain")} | {domain(SITE)}
    out: dict = {"official_site": "", "recruit_page": "", "mission": "", "vision": "", "values": [], "ideal": [], "process": None, "essay_questions": [], "plan": None, "rules": []}
    for k in ("official_site", "recruit_page"):
        v = (facts.get(k) or "").strip()
        if v.startswith("http") and not BAD_SOURCE.search(domain(v)):
            out[k] = v
    for k in ("mission", "vision"):
        v = (facts.get(k) or "").strip()
        if 0 < len(v) <= 160:
            out[k] = v
    for k in ("values", "ideal", "rules"):
        seen = set()
        for it in facts.get(k) or []:
            text = (it.get("text") or "").strip()
            if text and len(text) <= 200 and ok_source(it.get("source"), allowed) and text not in seen:
                seen.add(text)
                out[k].append({"text": text, "source": it["source"]})
        out[k] = out[k][:8]
    pr = facts.get("process") or {}
    steps = [s.strip() for s in (pr.get("steps") or []) if s and s.strip()]
    if steps and ok_source(pr.get("source"), allowed):
        out["process"] = {"steps": steps[:8], "blind": (pr.get("blind") or "unknown").lower(), "source": pr["source"]}
    qs, seen_q = [], set()
    for q in facts.get("essay_questions") or []:
        text = (q.get("text") or "").strip()
        if len(text) < 8 or len(text) > 300 or text in seen_q or not ok_source(q.get("source"), allowed):
            continue
        seen_q.add(text)
        qs.append({"text": text, "limit": (q.get("limit") or "").strip(), "year": (q.get("year") or "").strip(), "position": (q.get("position") or "").strip(), "source": q["source"]})
    out["essay_questions"] = qs[:10]
    pl = facts.get("plan") or {}
    if ok_source(pl.get("source"), allowed) and (pl.get("required") or "unknown").lower() in ("yes", "no"):
        out["plan"] = {"required": pl["required"].lower(), "positions": [p for p in (pl.get("positions") or []) if p][:6], "format": (pl.get("format") or "").strip(), "source": pl["source"]}
    return out


def source_label(url: str) -> str:
    d = domain(url)
    names = {"alio.go.kr": "알리오", "job.alio.go.kr": "잡알리오", "gojobs.go.kr": "나라일터", "work24.go.kr": "고용24", domain(SITE): "공고문"}
    return names.get(d, d)


# ── 작성 틀(우리가 쓴 일반 안내) ─────────────────────────
QTYPE = [
    ("지원 동기", re.compile(r"지원\s*동기|지원한\s*이유|입사\s*후|포부|왜\s*우리"), "기관의 사업과 내 경험이 만나는 지점 하나를 고른다. 기관 소개 문구를 옮겨 적지 말고, 그 사업에서 내가 맡고 싶은 일과 이유를 쓴다. 마지막 두 문장은 입사 뒤 1년 안에 하고 싶은 일로 끝낸다."),
    ("직무 역량·경험", re.compile(r"직무|역량|경험|전문성|수행|능력|강점|준비"), "직무기술서의 '필요 능력' 가운데 하나를 고르고, 그 능력을 쓴 경험 하나를 상황·내 역할·한 일·결과 순서로 적는다. 결과는 숫자나 변화로 끝낸다. 자격증·교육은 그 경험 안에서 어떻게 쓰였는지로만 등장시킨다."),
    ("협업·조직 이해", re.compile(r"협업|팀|조직|소통|갈등|동료|관계|공동"), "의견이 갈린 상황을 고른다. 내가 상대의 입장을 어떻게 확인했고, 무엇을 양보하고 무엇을 지켰는지, 결과가 어땠는지를 쓴다. '잘 해냈다'가 아니라 그 뒤로 내가 바꾼 일하는 방식으로 끝낸다."),
    ("문제 해결", re.compile(r"문제|어려움|실패|극복|개선|해결|위기|도전"), "문제의 원인을 어떻게 찾았는지가 핵심이다. 증상이 아닌 원인, 시도한 방법과 버린 방법, 결과와 배운 점을 쓴다. 실패를 묻는 문항은 실패를 숨기지 않고 그 뒤에 바뀐 행동을 적는다."),
    ("직업윤리·공직 가치", re.compile(r"윤리|가치|공정|청렴|책임|공익|원칙|규정|신념"), "규정과 현실이 부딪힌 순간을 고른다. 어떤 기준으로 판단했는지, 누구에게 어떻게 알렸는지를 쓴다. 공공기관은 '빠른 해결'보다 '절차를 지킨 해결'을 묻는다."),
    ("성장 과정·가치관", re.compile(r"성장|가치관|성격|좌우명|인생|삶"), "유년기부터 늘어놓지 않는다. 지금의 일하는 태도를 만든 경험 하나를 고르고, 그 태도가 이 직무에서 어떻게 쓰이는지로 연결한다."),
]

def qtype_of(text: str) -> tuple[str, str]:
    for label, rx, tip in QTYPE:
        if rx.search(text):
            return label, tip
    return "직무 역량·경험", QTYPE[1][2]


# ── 글 ───────────────────────────────────────────────────
def compose(org: str, s: dict, posts: dict, facts: dict, sources: list[dict]) -> dict:
    t = today()
    year = t.year
    n3y, open_n = int(s.get("n3y") or 0), int(s.get("open_n") or 0)
    med, win_n, le7 = s.get("win_med"), int(s.get("win_n") or 0), int(s.get("win_le7") or 0)
    org_url = f"/jobs/org/{org}"
    kinds = posts["kinds"]
    blocks, toc = [], []

    # 머리
    lead = f"{josa('**' + org + '**', '은는')} 최근 3년 나라일터에 채용 공고 **{n(n3y)}건**을 냈습니다"
    lead += f" (지금 접수 중 {n(open_n)}건). " if open_n else ". "
    if kinds:
        lead += "자리는 " + ", ".join(f"{k['k']} {n(k['n'])}건" for k in kinds[:3]) + " 순으로 많습니다. "
    if med is not None and win_n >= 5:
        lead += f"접수 기간은 보통 **{n(med)}일**이라, 공고가 뜬 뒤에 처음부터 쓰면 늦습니다. "
    found = []
    if facts.get("ideal") or facts.get("values"):
        found.append("인재상·핵심가치")
    if facts.get("essay_questions"):
        found.append(f"공식 공고의 자기소개서 문항 {len(facts['essay_questions'])}개")
    if facts.get("process"):
        found.append("전형 절차")
    if facts.get("rules"):
        found.append(f"지원서 유의사항 {len(facts['rules'])}개")
    if found:
        lead += "기관이 공식 누리집과 공고에서 밝힌 " + "·".join(found) + "를 찾아 두었고, 그에 맞춰 쓰는 순서를 적었습니다."
    else:
        lead += "이 기관의 인재상과 자기소개서 문항은 공식 문서에서 확인하지 못해, 공고문에서 직접 확인하는 방법과 공공기관 공통의 작성 틀을 적었습니다."
    blocks.append(P(lead.strip()))
    links = [{"href": org_url, "label": f"{org} 채용 공고 전체"}]
    if facts.get("recruit_page"):
        links.append({"href": facts["recruit_page"], "label": f"{org} 채용 안내 (공식)"})
    elif facts.get("official_site"):
        links.append({"href": facts["official_site"], "label": f"{org} 공식 누리집"})
    blocks.append(LINKS(links))

    # 인재상
    toc.append(("ideal", "이 기관이 밝힌 인재상과 핵심가치"))
    blocks.append(H2("이 기관이 밝힌 인재상과 핵심가치", "ideal"))
    if facts.get("mission") or facts.get("vision"):
        mv = []
        if facts.get("mission"):
            mv.append(f"미션: {facts['mission']}")
        if facts.get("vision"):
            mv.append(f"비전: {facts['vision']}")
        blocks.append(P(" / ".join(mv)))
    if facts.get("ideal"):
        blocks.append(P("인재상:"))
        blocks.append(LIST([f"{x['text']} ({source_label(x['source'])})" for x in facts["ideal"]]))
    if facts.get("values"):
        blocks.append(P("핵심가치:"))
        blocks.append(LIST([f"{x['text']} ({source_label(x['source'])})" for x in facts["values"]]))
    if facts.get("ideal") or facts.get("values"):
        blocks.append(P("인재상 낱말을 자기소개서에 그대로 쓰면 누구나 쓰는 문장이 됩니다. 낱말 하나를 고르고, 그 낱말에 해당하는 **내 경험 하나**를 상황·역할·행동·결과로 적습니다. 심사자는 낱말이 아니라 경험이 인재상과 맞는지를 봅니다."))
    else:
        blocks.append(P(f"공식 누리집에서 인재상·핵심가치 문구를 확인하지 못했습니다. 기관 누리집의 '기관 소개 → 미션·비전' 또는 '경영 공시'에서 찾고, 없으면 최근 공고문의 **직무기술서**에 적힌 '필요 역량'을 인재상 자리에 놓고 씁니다."))

    # 전형 절차
    toc.append(("process", "전형 절차와 접수 기간"))
    blocks.append(H2("전형 절차와 접수 기간", "process"))
    pr = facts.get("process")
    if pr:
        blocks.append(P("최근 공고의 전형 절차: **" + " → ".join(pr["steps"]) + f"** ({source_label(pr['source'])})"
                        + (" 블라인드 채용으로 진행합니다." if pr.get("blind") == "yes" else "")))
    txt = ""
    if med is not None and win_n >= 5:
        txt += f"등록일부터 마감까지 중앙값은 **{n(med)}일**, 공고 {n(win_n)}건 가운데 {pct(le7, win_n)}%는 일주일 안에 마감했습니다. "
    txt += "자기소개서와 경력 기술은 공고 전에 초안을 두고, 공고가 뜨면 문항에 맞춰 고치기만 하는 것이 맞습니다."
    blocks.append(P(txt))
    if s.get("open_list"):
        blocks.append(P("지금 접수 중인 공고:"))
        blocks.append(LINKS([{"href": f"/jobs/{r['id']}", "label": f"{r['title']} — {kdate(r['end'])} 마감"} for r in s["open_list"][:5]]))

    # 자소서 문항
    toc.append(("essay", "자기소개서 문항과 쓰는 순서"))
    blocks.append(H2("자기소개서 문항과 쓰는 순서", "essay"))
    qs = facts.get("essay_questions") or []
    if qs:
        blocks.append(P(f"공식 공고문·지원서에서 확인한 {org} 자기소개서 문항입니다. 공고마다 바뀌니, 지원하는 공고의 지원서 양식을 기준으로 삼으세요."))
        blocks.append(TABLE(["문항", "글자 수", "연도·자리", "출처"],
                            [[q["text"], q["limit"] or "—", " ".join(x for x in (q["year"], q["position"]) if x) or "—", source_label(q["source"])] for q in qs]))
        blocks.append(P("문항별로 이렇게 씁니다."))
        tips, seen = [], set()
        for q in qs:
            label, tip = qtype_of(q["text"])
            if label in seen:
                continue
            seen.add(label)
            tips.append(f"**{label}** 문항 — {tip}")
        blocks.append(LIST(tips))
    else:
        blocks.append(P(f"{org}의 자기소개서 문항은 공식 문서에서 확인하지 못했습니다. 문항은 공고문에 붙은 **입사지원서(응시원서) 양식** 안에 있습니다. "
                        + ("아래 '공고문과 첨부 파일' 항목의 지난 공고에서 지원서 파일을 열어 보세요. " if posts["with_files"] else "")
                        + "공공기관 자기소개서는 대개 다음 다섯 유형 안에서 나옵니다."))
        blocks.append(LIST([f"**{label}** — {tip}" for label, _, tip in QTYPE[:5]]))
    blocks.append(P("공통 규칙: 한 문항에 경험 하나. 첫 문장에 결론. 글자 수 제한의 90% 이상을 채우되 넘기지 않습니다. 블라인드 공고라면 학교 이름·나이·가족·출신 지역이 드러나는 표현을 지웁니다. 공고문에 '기재 금지' 항목이 따로 있으면 그것이 기준입니다."))
    if facts.get("rules"):
        blocks.append(P("이 기관 공고에 적힌 규정:"))
        blocks.append(LIST([f"{x['text']} ({source_label(x['source'])})" for x in facts["rules"]]))

    # 직무수행계획서
    toc.append(("plan", "직무수행계획서를 내야 할 때"))
    blocks.append(H2("직무수행계획서를 내야 할 때", "plan"))
    pl = facts.get("plan")
    plan_n = posts["plan_n"]
    txt = ""
    if pl and pl["required"] == "yes":
        txt += f"{org}은 " + (", ".join(pl["positions"]) + " 등 " if pl["positions"] else "") + f"일부 공고에서 직무수행계획서를 함께 내게 합니다 ({source_label(pl['source'])}). "
        if pl.get("format"):
            txt += f"요건: {pl['format']}. "
    if plan_n:
        txt += f"최근 3년 공고 가운데 임기제·전문경력관·개방형처럼 **직무수행계획서를 요구하는 일이 많은 자리는 {n(plan_n)}건**입니다. "
    elif not (pl and pl["required"] == "yes"):
        txt += f"최근 3년 {org} 공고 제목에는 임기제·전문경력관·개방형 자리가 보이지 않습니다. 직무수행계획서를 요구하는 공고가 드문 기관입니다. "
    if posts["has_plan_file"]:
        txt += "공고 첨부에 직무수행계획서 양식이 들어 있는 공고가 있습니다(아래 목록). "
    txt += "제출 여부와 분량은 공고문의 **제출 서류** 칸이 기준입니다."
    blocks.append(P(txt.strip()))
    if posts["plan_open"] or posts["plan_recent"]:
        blocks.append(LINKS([{"href": f"/jobs/{p['id']}", "label": p["title"] + (f" — {kdate(p['end'])} 마감" if p["open"] else "")} for p in (posts["plan_open"] or posts["plan_recent"])[:5]]))
    blocks.append(P("직무수행계획서는 '내가 이 자리에서 무엇을 어떻게 하겠다'는 계획서입니다. 자기소개서처럼 경험을 늘어놓는 글이 아닙니다. 뼈대는 여섯 칸입니다."))
    blocks.append(LIST([
        "**직무 이해** — 공고의 직무기술서를 내 말로 요약합니다. 이 자리가 맡는 업무 범위, 함께 일하는 부서, 관련 법령·사업명을 적습니다.",
        "**현황과 과제** — 기관 누리집·경영공시·보도자료에서 이 업무의 현재 상황을 찾고, 풀어야 할 과제 두세 개를 짚습니다. 숫자가 있으면 숫자로.",
        "**목표** — 임기(또는 첫 2년) 안에 도달할 상태를 측정할 수 있게 적습니다. '활성화'가 아니라 '처리 기간 30일에서 20일로'.",
        "**추진 계획** — 1년차·2년차·3년차로 나누고, 분기 단위로 할 일을 적습니다. 예산·인력·협업 부서가 필요한 일은 그것까지 적습니다.",
        "**기대 효과와 점검 방법** — 목표가 달성됐는지 무엇으로 확인할지(지표·보고 주기)를 적습니다.",
        "**내가 적합한 이유** — 위 계획 가운데 이미 비슷하게 해 본 일을 경력에서 골라 연결합니다. 마지막에 한 번만.",
    ]))
    blocks.append(P("분량은 공고가 정한 쪽수를 따릅니다. 적혀 있지 않으면 핵심만 A4 3쪽 안팎으로 쓰고, 표와 일정표를 써서 읽는 사람이 한눈에 보게 합니다. 기관 이름과 사업 이름은 공식 표기 그대로 적습니다."))

    # 첨부 파일
    if posts["with_files"]:
        toc.append(("files", "공고문과 첨부 파일로 직접 확인하기"))
        blocks.append(H2("공고문과 첨부 파일로 직접 확인하기", "files"))
        blocks.append(P(f"{org}의 최근 공고 가운데 공고문·지원서·직무기술서 파일이 붙은 공고입니다. 공고 쪽에서 파일을 내려받아 **지원서 양식의 자기소개서 칸**과 **직무기술서의 필요 역량**을 확인하세요. 문항은 여기서 바뀝니다."))
        blocks.append(TABLE(["공고", "등록", "붙은 파일"],
                            [[f"[{w['title']}](/jobs/{w['id']})", kdate(w["reg"]) or "—", "·".join(w["files"])] for w in posts["with_files"]]))

    # 준비 순서
    toc.append(("howto", "이렇게 준비하세요"))
    blocks.append(H2("이렇게 준비하세요", "howto"))
    steps = [
        f"[{org} 채용 공고]({org_url})에서 지난 공고 두세 건의 공고문과 지원서 양식을 내려받아 문항과 제출 서류를 표로 정리합니다.",
        "직무기술서의 '필요 능력' 항목마다 내 경험 하나를 붙인 목록을 만듭니다. 이것이 자기소개서와 면접의 재료입니다.",
    ]
    if facts.get("ideal") or facts.get("values"):
        steps.append("인재상·핵심가치 낱말마다 경험 하나를 짝지어 둡니다. 문항이 바뀌어도 재료는 같습니다.")
    if plan_n or (pl and pl["required"] == "yes"):
        steps.append("임기제·개방형에 지원한다면 직무수행계획서 뼈대(위 여섯 칸)를 먼저 채우고, 자기소개서는 그 계획에 맞춰 씁니다.")
    if med is not None and win_n >= 5 and int(med) <= 10:
        steps.append(f"접수 기간이 {n(med)}일 안팎으로 짧습니다. 경력증명서·자격증 사본·졸업증명서는 파일로 미리 준비합니다.")
    steps.append("제출 전에 공고문의 '기재 금지'와 '제출 서류' 칸을 다시 읽고, 파일 이름과 형식(hwp·pdf)을 공고가 정한 대로 맞춥니다.")
    blocks.append(LIST(steps))

    src_domains = sorted({source_label(x["source"]) for k in ("ideal", "values", "rules", "essay_questions") for x in (facts.get(k) or [])}
                         | ({source_label(pr["source"])} if pr else set()) | ({source_label(pl["source"])} if pl else set()))
    note = f"{t.isoformat()} 기준. 공고 수·접수 기간은 나라일터 공고를 {BRAND}이 모아 센 것이고, "
    note += ("인재상·전형·문항은 " + ", ".join(src_domains) + "에서 확인한 것입니다. " if src_domains else "인재상·문항은 공식 문서에서 확인하지 못했습니다. ")
    note += "작성 틀은 공공기관 채용 공통 안내이며, 지원하는 공고의 공고문이 늘 우선입니다."
    blocks.append(NOTE(note))

    # FAQ
    faq = [
        {"q": f"{org} 자기소개서 문항은 어디서 확인하나요?",
         "a": (f"공식 공고문·지원서에서 확인한 문항 {len(qs)}개를 위 표에 정리했습니다. " if qs else "") + f"문항은 공고마다 바뀌므로 지원하는 공고의 입사지원서(응시원서) 양식을 기준으로 합니다. {org} 채용 공고 쪽에서 공고문과 지원서 파일을 내려받을 수 있습니다."},
        {"q": f"{org}에 지원할 때 직무수행계획서가 필요한가요?",
         "a": (f"일부 공고에서 요구합니다 ({source_label(pl['source'])} 확인). " if pl and pl["required"] == "yes" else "")
              + (f"최근 3년 공고 중 임기제·전문경력관·개방형 자리가 {n(plan_n)}건이며, 이런 자리는 직무수행계획서를 함께 내게 하는 경우가 많습니다. " if plan_n else "최근 3년 공고 제목에서는 임기제·개방형 자리가 보이지 않아 요구하는 공고가 드뭅니다. ")
              + "제출 여부와 분량은 공고문의 제출 서류 칸이 기준입니다."},
        {"q": "블라인드 채용이면 자기소개서에 무엇을 쓰면 안 되나요?",
         "a": "출신 학교·나이·가족·출신 지역처럼 직무와 무관하게 사람을 짐작하게 하는 정보를 적지 않습니다. 공고문에 '기재 금지' 항목이 따로 있으면 그것이 기준이고, 어기면 불이익이 있을 수 있습니다. 대신 직무기술서의 필요 능력에 맞는 경험을 상황·역할·행동·결과로 적습니다."},
        {"q": f"{org} 공고는 접수 기간이 얼마나 되나요?",
         "a": (f"최근 3년 공고 {n(win_n)}건의 등록일부터 마감까지 중앙값은 {n(med)}일이고, {pct(le7, win_n)}%는 일주일 안에 마감했습니다. " if med is not None and win_n >= 5 else "공고마다 다르지만 공공기관 공고는 일주일에서 보름 사이가 많습니다. ")
              + "공고가 뜬 뒤 처음부터 쓰면 늦으니 초안을 미리 두는 편이 안전합니다."},
    ]

    got = [x for x, ok_ in (("인재상", facts.get("ideal") or facts.get("values")), ("문항", qs), ("전형 절차", pr), ("유의사항", facts.get("rules"))) if ok_]
    tail = ", ".join(got) if got else "공고문으로 확인하는 법과 작성 틀"
    title = f"{org} 자기소개서·직무수행계획서 작성법 — {tail} ({year}년 채용 기준)"
    summary = (f"{josa(org, '이가')} 공식 누리집과 공고에서 밝힌 " + ("·".join(got) if got else "자료")
               + (f"(자기소개서 문항 {len(qs)}개 포함)" if qs else "")
               + f"를 모으고, 최근 3년 공고 {n(n3y)}건의 자리 구성과 접수 기간에 맞춰 자기소개서와 직무수행계획서 쓰는 순서를 정리했습니다.")
    kw = [f"{org} 자소서", f"{org} 자기소개서", f"{org} 자기소개서 문항", f"{org} 직무수행계획서", f"{org} 인재상", f"{org} 채용 전형", f"{org} 채용",
          "공공기관 자기소개서 작성법", "직무수행계획서 작성법", BRAND]
    return {"org": org, "slug": slugify(org), "title": title, "summary": summary, "keywords": kw,
            "body": [{"type": "toc", "items": [{"id": i, "label": l} for i, l in toc]}] + blocks, "faq": faq}


# ── 글감 고르기 ──────────────────────────────────────────
def decode_org(landing: str) -> str | None:
    m = re.match(r"^/jobs/org/([^/?#]+)", landing or "")
    return unquote(m.group(1)).strip() if m else None


def rank(stats: list[dict], visits: dict[str, int], done: dict[str, str], today_: dt.date) -> list[dict]:
    """찾는 사람(최근 90일 방문) × 10 + 접수 중 × 5 + 3년 공고 / 20. 120일 안에 쓴 기관은 뺀다."""
    out = []
    for r in stats:
        org = r["org"]
        upd = done.get(org)
        if upd and (today_ - dt.date.fromisoformat(upd[:10])).days < REFRESH_DAYS:
            continue
        score = visits.get(org, 0) * 10 + int(r.get("open_n") or 0) * 5 + int(r.get("n") or 0) / 20
        out.append({"org": org, "score": score, "visits": visits.get(org, 0), "open_n": int(r.get("open_n") or 0), "n": int(r.get("n") or 0)})
    return sorted(out, key=lambda x: -x["score"])


def candidates(sb, count: int) -> list[str]:
    stats = sb.table("job_org_stats").select("org,n,open_n").gte("n", 20).order("n", desc=True).limit(800).execute().data or []
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=90)).isoformat()
    vis = sb.table("visit_log").select("landing").gte("at", since).like("landing", "/jobs/org/%").limit(5000).execute().data or []
    visits: dict[str, int] = {}
    for v in vis:
        o = decode_org(v.get("landing") or "")
        if o:
            visits[o] = visits.get(o, 0) + 1
    done_rows = sb.table("org_guides").select("org,updated_at").execute().data or []
    done = {r["org"]: r["updated_at"] for r in done_rows}
    ranked = rank(stats, visits, done, today())
    for r in ranked[:count]:
        print(f"  후보 {r['org']}: 방문 {r['visits']} · 접수 중 {r['open_n']} · 3년 {r['n']}")
    return [r["org"] for r in ranked[:count]]


def rpc(sb, name: str, params: dict):
    return with_retry(lambda: sb.rpc(name, params).execute().data, what=name)


def build(sb, client, org: str, dry: bool, exists: bool) -> dict:
    s = rpc(sb, "blog_org_stats", {"p_org": org}) or {}
    rows = sb.table("job_posts").select("source_id,title,reg_date,end_date,raw").eq("source", "gojobs").eq("org", org) \
        .order("reg_date", desc=True).limit(80).execute().data or []
    posts = shape_posts(rows)
    docs = fetch_docs(pick_docs(rows))
    print(f"[{org}] 공고문 PDF {len(docs)}건 읽음" + (": " + ", ".join(d["title"][:30] for d in docs) if docs else ""))
    facts_doc = doc_facts(client, org, docs)
    raw_web, sources, memo = search_facts(client, org)
    facts = clean_facts(merge_facts(facts_doc, raw_web), sources)
    sources = sources + [{"title": d["title"], "uri": f"{SITE}/jobs/{d['id']}", "domain": domain(SITE)} for d in docs]
    post = compose(org, s, posts, facts, sources)
    kept = sum(len(facts[k]) for k in ("ideal", "values", "rules", "essay_questions")) + bool(facts["process"]) + bool(facts["plan"])
    print(f"[{org}] 출처 {len(sources)}곳, 살린 사실 {kept}개, 문항 {len(facts['essay_questions'])}개 → /jobs/guide/{post['slug']}")
    if dry:
        print(json.dumps({"facts": facts, "sources": sources[:8], "title": post["title"], "summary": post["summary"], "body": post["body"][:6], "faq": post["faq"]}, ensure_ascii=False, indent=1)[:6000])
        return post
    row = {**post, "facts": facts, "sources": sources, "stats": {"org": s, "posts": posts}, "model": MODEL, "updated_at": "now()"}
    if not exists:
        row["published_at"] = today().isoformat()
    sb.table("org_guides").upsert(row, on_conflict="org").execute()
    print(f"저장: {SITE}/jobs/guide/{post['slug']}")
    return post


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--org")
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    from supabase import create_client
    url, key = os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]
    try:
        from supabase import ClientOptions
        sb = create_client(url, key, options=ClientOptions(postgrest_client_timeout=120))
    except Exception:  # noqa: BLE001
        sb = create_client(url, key)
    client = gemini_client()

    orgs = [a.org] if a.org else candidates(sb, a.count)
    done = {r["org"] for r in (sb.table("org_guides").select("org").execute().data or [])}
    written = 0
    for org in orgs:
        try:
            build(sb, client, org, a.dry, org in done)
            written += 1
        except Exception as e:  # noqa: BLE001 — 한 기관이 실패해도 다음 기관은 쓴다
            print(f"[{org}] 실패: {type(e).__name__}: {str(e)[:900]}", file=sys.stderr)
    if not written:
        sys.exit(1)


if __name__ == "__main__":
    main()
