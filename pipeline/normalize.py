"""
normalize.py — programs 의 원문(raw_target / raw_criteria)에서 매칭 조건을 뽑는다

사용:
    python pipeline/normalize.py            # norm_at 이 비어 있는 행만
    python pipeline/normalize.py --all      # 전부 다시 (규칙을 고쳤을 때)
    python pipeline/normalize.py --dry      # DB 에 쓰지 않고 통계만

왜 규칙 기반인가
  처음 1,000건은 LLM 으로 돌렸는데, 그 스크립트는 저장소에 남지 않았고
  PostgREST 기본 상한(1,000행)에 걸려 나머지 4,000여 건이 영영 정규화되지
  않은 채 화면에서 빠져 있었다. 진천군·음성군처럼 지역 전체가 안 보이던
  원인이다. 규칙은 느리게 나아지지만, 비용이 없고 매일 돌릴 수 있고
  같은 입력이면 같은 답이 나온다. 이미 LLM 이 채운 행은 건드리지 않는다.

뽑는 것
  welfare : age_min, age_max, employment[], household[], income_pct
  business: biz_target[], biz_years_min, biz_years_max, industry[]
  공통    : norm_confidence, norm_at, norm_model, norm_notes

확신도
  0.2 = 원문은 읽었지만 걸 만한 조건을 하나도 못 찾음 (화면에서 제외)
  0.6 이상 = 조건을 하나 이상 찾음. 나이 숫자를 직접 찾으면 가장 높다.
  programs_public 뷰와 match_* 함수는 0.3 초과만 보여 준다.
"""

import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

MODEL = "rules-v1"
PAGE = 1000

# ── 나이 ─────────────────────────────────────────────────────

# "세" 뒤에 대·기·계 가 붙으면 나이가 아니다 (세대, 세기, 3세계)
AGE = r"(?<![\d.])(\d{1,3})\s*세(?![대기계])"
SEP = r"\s*(?:~|∼|～|-|－|–|—|부터|에서)\s*"

# 19~39세 / 19세~39세 / 만 19세 이상~만 39세 미만 / 19세부터 39세까지
RANGE = re.compile(
    rf"(?<![\d.])(?:만\s*)?(\d{{1,3}})\s*세?\s*(?:이상)?{SEP}(?:만\s*)?(\d{{1,3}})\s*세\s*(미만|이하|까지)?(?![대기계])"
)
# 19세 이상 39세 이하 (물결 없이 띄어쓴 것)
RANGE2 = re.compile(rf"(?:만\s*)?{AGE}\s*(?:이상|초과)\s*[,·]?\s*(?:만\s*)?{AGE}\s*(미만|이하|까지)")
MIN = re.compile(rf"(?:만\s*)?{AGE}\s*(이상|부터|초과)")
MAX = re.compile(rf"(?:만\s*)?{AGE}\s*(미만|이하|까지|이전)")
MONTHS = re.compile(r"(?:생후\s*)?(\d{1,3})\s*개월\s*(미만|이하|까지)")

# 숫자가 전혀 없을 때만 쓰는 어휘 단서. 대상이 분명한 말만.
STAGE_HINTS = [
    (re.compile(r"영유아|영아|미취학|어린이집\s*(?:재원|이용|다니)"), (0, 6)),
    (re.compile(r"초등학생|초등학교\s*(?:재학|입학)"), (6, 12)),
    (re.compile(r"중학생"), (13, 15)),
    (re.compile(r"고등학생"), (16, 18)),
    (re.compile(r"어르신|고령자"), (65, None)),
]
# 종사자·시설 이야기면 대상이 그 나이대가 아니다. 어휘 단서를 쓰지 않는다.
STAGE_BLOCK = re.compile(r"종사자|교사|교직원|근무자|운영자|요양보호사|돌보미|시설\s*장")


def _ok(lo, hi):
    if lo is not None and not 0 <= lo <= 120:
        return False
    if hi is not None and not 0 <= hi <= 120:
        return False
    if lo is not None and hi is not None and lo > hi:
        return False
    return True


def parse_age(text):
    """(age_min, age_max, explicit, note). explicit = 숫자를 직접 읽었는가."""
    if not text:
        return None, None, False, ""
    t = text

    for m in RANGE.finditer(t):
        lo, hi = int(m.group(1)), int(m.group(2))
        if m.group(3) == "미만":
            hi -= 1
        if _ok(lo, hi):
            return lo, hi, True, ""
    m = RANGE2.search(t)
    if m:
        lo, hi = int(m.group(1)), int(m.group(2))
        if m.group(3) == "미만":
            hi -= 1
        if _ok(lo, hi):
            return lo, hi, True, ""
    m = MIN.search(t)
    if m:
        lo = int(m.group(1)) + (1 if m.group(2) == "초과" else 0)
        hi = None
        m2 = MAX.search(t, m.end())
        if m2:
            hi = int(m2.group(1)) - (1 if m2.group(2) == "미만" else 0)
        if _ok(lo, hi):
            return lo, hi, True, ""
        if _ok(lo, None):
            return lo, None, True, "age:max-dropped"
    m = MAX.search(t)
    if m:
        hi = int(m.group(1)) - (1 if m.group(2) == "미만" else 0)
        if _ok(None, hi):
            return None, hi, True, ""
    m = MONTHS.search(t)
    if m:
        months = int(m.group(1))
        if months <= 240:
            hi = months // 12
            if m.group(2) == "미만" and months % 12 == 0:
                hi -= 1
            return None, max(hi, 0), True, "age:months"

    if STAGE_BLOCK.search(t):
        return None, None, False, ""
    lo = hi = None
    hit = open_top = False
    for rx, (a, b) in STAGE_HINTS:
        if rx.search(t):
            hit = True
            lo = a if lo is None else min(lo, a)
            if b is None:
                open_top = True
            else:
                hi = b if hi is None else max(hi, b)
    if hit:
        return lo, (None if open_top else hi), False, "age:stage"
    return None, None, False, ""


# ── 취업 상태 / 가구 사정 / 소득 ────────────────────────────

EMPLOYMENT = [
    ("학생", re.compile(r"대학생|대학원생|재학생|휴학생|초등학생|중학생|고등학생|(?<!졸업)학생|재학\s*중|재학중")),
    ("미취업", re.compile(r"미취업|실업자|실직|무직|미취업자")),
    ("구직중", re.compile(r"구직|취업\s*준비|취준|취업을?\s*희망|취업희망")),
    ("재직", re.compile(r"재직|근로자|종사자|직장인|노동자|근무\s*중|근무중|재직자")),
    ("자영업", re.compile(r"자영업|소상공인|농업인|어업인|임업인|농업경영체|사업자등록|개인사업자|농어업인")),
    ("퇴직", re.compile(r"퇴직|은퇴|정년")),
]

HOUSEHOLD = [
    ("저소득", re.compile(r"기초생활|수급자|수급권자|차상위|저소득|취약계층|중위소득\s*\d{2,3}\s*%?\s*이하")),
    ("장애인", re.compile(r"장애인|장애\s*등급|중증장애|장애아동")),
    ("한부모·조손", re.compile(r"한부모|조손|모자가정|부자가정|한 부모")),
    ("다자녀", re.compile(r"다자녀|셋째|세\s*자녀|3자녀|자녀\s*3명|자녀가?\s*3명|세째")),
    ("다문화·탈북민", re.compile(r"다문화|탈북|북한이탈|새터민|결혼이민|결혼\s*이주")),
    ("보훈대상자", re.compile(r"보훈|국가유공|참전|독립유공|유공자|고엽제|특수임무")),
    ("1인가구", re.compile(r"1인\s*가구|독거|홀로\s*사는|혼자\s*사는")),
    ("임산부", re.compile(r"임산부|임신|출산|산모|임부|산후|출생아|출생\s*가정|신생아")),
    ("무주택", re.compile(r"무주택")),
]

INCOME = re.compile(r"중위\s*소득\s*(?:의\s*)?(\d{2,3})\s*(?:%|퍼센트|프로)")


def pick(rules, text):
    if not text:
        return None
    out = [k for k, rx in rules if rx.search(text)]
    return out or None


def parse_income(text):
    if not text:
        return None
    ns = [int(m) for m in INCOME.findall(text) if 10 <= int(m) <= 300]
    # 여러 기준이 있으면 가장 넓은 쪽. 좁게 잡아 놓치는 것보다 낫다.
    return max(ns) if ns else None


# ── 기업 ─────────────────────────────────────────────────────

# 기업마당 trgetNm 값 → 사이트 어휘. 하나가 여럿에 걸칠 수 있다.
BIZ_TARGET_MAP = {
    "중소기업": ["중소기업"],
    "소상공인": ["소상공인"],
    "창업벤처": ["예비창업자", "창업기업"],
    "사회적기업": ["사회적기업", "협동조합"],
    "협동조합": ["협동조합"],
    "마을기업": ["협동조합", "사회적기업"],
    "장애인기업": ["소상공인", "중소기업"],
    "여성기업": ["소상공인", "중소기업"],
    "제조업": ["중소기업", "중견기업"],
    "중견기업": ["중견기업"],
}
BIZ_TARGET_TEXT = [
    ("예비창업자", re.compile(r"예비\s*창업")),
    ("창업기업", re.compile(r"초기\s*창업|창업\s*기업|창업\s*후|스타트업|재창업")),
    ("중견기업", re.compile(r"중견기업")),
    ("소상공인", re.compile(r"소상공인|(?<!중)소기업")),
    ("협동조합", re.compile(r"협동조합")),
    ("사회적기업", re.compile(r"사회적\s*기업|사회적경제")),
]

# 업종은 보수적으로 붙인다. 붙는 순간 다른 업종으로 검색한 사람에게는
# 안 보이기 때문이다. 해시태그가 아니라 제목과 대상 필드에서, 업종을
# 콕 집어 말하는 표현만 본다.
INDUSTRY = [
    ("제조업", re.compile(r"제조업|제조기업|제조업체|뿌리기업|뿌리산업|스마트공장")),
    ("음식점업", re.compile(r"음식점|외식업|외식기업")),
    ("정보통신업", re.compile(r"정보통신|소프트웨어|SW기업|IT기업|ICT기업|게임기업|콘텐츠기업")),
    ("농림어업", re.compile(r"농업인|농식품|농어업|임업|어업인|수산업|축산")),
    ("도소매업", re.compile(r"도소매|유통업|전통시장|상점가")),
    ("개인서비스업", re.compile(r"미용업|세탁업|이용업")),
    ("건설업", re.compile(r"건설업|건설기업|건설업체")),
    ("운수·물류업", re.compile(r"운수업|물류기업|물류업|화물운송")),
    ("숙박업", re.compile(r"숙박업")),
    ("전문·과학·기술서비스업", re.compile(r"엔지니어링|연구개발서비스|디자인기업")),
    ("교육서비스업", re.compile(r"교육서비스업|학원")),
    ("예술·스포츠·여가업", re.compile(r"관광기업|관광업|스포츠산업|공연예술")),
    ("금융·보험업", re.compile(r"핀테크|금융업|보험업")),
]

YEARS_MAX = re.compile(r"(?:창업|업력|설립)\s*(?:후\s*)?(?:만\s*)?(\d{1,2})\s*년\s*(이내|미만|이하|까지)")
YEARS_MIN = re.compile(r"(?:창업|업력|설립)\s*(?:후\s*)?(?:만\s*)?(\d{1,2})\s*년\s*(이상|초과|경과)")


def parse_years(text):
    if not text:
        return None, None
    lo = hi = None
    m = YEARS_MIN.search(text)
    if m:
        lo = int(m.group(1)) + (1 if m.group(2) == "초과" else 0)
    m = YEARS_MAX.search(text)
    if m:
        hi = int(m.group(1)) - (1 if m.group(2) == "미만" else 0)
    if lo is not None and hi is not None and lo > hi:
        return None, None
    return lo, hi


# ── 행 하나 ──────────────────────────────────────────────────

def _uniq(*lists):
    seen, out = set(), []
    for xs in lists:
        for x in xs or []:
            if x not in seen:
                seen.add(x)
                out.append(x)
    return out or None


def normalize_welfare(row):
    text = "\n".join(t for t in (row.get("raw_target"), row.get("raw_criteria")) if t)
    lo, hi, explicit, note = parse_age(text)
    emp = pick(EMPLOYMENT, text)
    hh = _uniq(row.get("household"), pick(HOUSEHOLD, text))
    inc = parse_income(text)

    conf = 0.2
    if explicit:
        conf += 0.4
    elif lo is not None or hi is not None:
        conf += 0.3
    if hh:
        conf += 0.3
    if emp:
        conf += 0.2
    if inc:
        conf += 0.1
    conf = min(round(conf, 1), 1.0)

    return {
        "age_min": lo, "age_max": hi,
        "employment": emp, "household": hh, "income_pct": inc,
        "norm_confidence": conf, "norm_notes": note or None,
    }


def normalize_business(row):
    tgt = (row.get("raw_target") or "").strip()
    text = "\n".join(t for t in (row.get("title"), tgt, row.get("raw_criteria")) if t)

    targets = _uniq(BIZ_TARGET_MAP.get(tgt), pick(BIZ_TARGET_TEXT, text))
    industry = pick(INDUSTRY, "\n".join(t for t in (row.get("title"), tgt) if t))
    lo, hi = parse_years(text)

    conf = 0.2
    if targets:
        conf += 0.5
    if industry:
        conf += 0.2
    if lo is not None or hi is not None:
        conf += 0.2
    conf = min(round(conf, 1), 1.0)

    return {
        "biz_target": targets, "industry": industry,
        "biz_years_min": lo, "biz_years_max": hi,
        "norm_confidence": conf, "norm_notes": None,
    }


def normalize(row):
    if row["kind"] == "welfare":
        return normalize_welfare(row)
    if row["kind"] == "business":
        return normalize_business(row)
    return None


# ── 실행 ─────────────────────────────────────────────────────

COLS = ("id,kind,source,source_id,title,raw_target,raw_criteria,household,"
        "norm_at")


def fetch_all(sb, redo):
    """
    PostgREST 는 한 번에 1,000행까지만 준다. 이걸 몰라서 앞 1,000건만
    정규화되고 끝났던 것이 이 스크립트가 생긴 이유다. id 순으로 페이지를
    넘기며 끝까지 읽는다.
    """
    rows, last = [], 0
    while True:
        q = (sb.table("programs").select(COLS)
             .in_("kind", ["welfare", "business"])
             .not_.is_("raw_target", "null")
             .gt("id", last).order("id").limit(PAGE))
        if not redo:
            q = q.is_("norm_at", "null")
        page = q.execute().data
        if not page:
            break
        rows.extend(page)
        last = page[-1]["id"]
        print(f"  읽음 {len(rows)}건 (id ≤ {last})", flush=True)
        if len(page) < PAGE:
            break
    return rows


def main():
    redo = "--all" in sys.argv
    dry = "--dry" in sys.argv

    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    print("정규화 대상을 읽습니다" + (" (전부 다시)" if redo else ""))
    rows = fetch_all(sb, redo)
    print(f"대상 {len(rows)}건")

    stats = {"welfare": [0, 0], "business": [0, 0]}
    batch, t0 = [], time.time()
    for r in rows:
        out = normalize(r)
        if out is None:
            continue
        k = r["kind"]
        stats[k][0] += 1
        if out["norm_confidence"] > 0.3:
            stats[k][1] += 1
        out.update({
            "source": r["source"], "source_id": r["source_id"],
            "kind": k, "title": r["title"],
            "norm_at": "now()", "norm_model": MODEL,
        })
        batch.append(out)

    print(f"welfare  {stats['welfare'][0]}건 중 화면에 나올 것 {stats['welfare'][1]}건")
    print(f"business {stats['business'][0]}건 중 화면에 나올 것 {stats['business'][1]}건")

    if dry:
        print("--dry: 쓰지 않습니다")
        return

    n = 0
    for i in range(0, len(batch), 500):
        chunk = batch[i:i + 500]
        sb.table("programs").upsert(chunk, on_conflict="source,source_id").execute()
        n += len(chunk)
        print(f"  저장 {n}/{len(batch)}", flush=True)
    print(f"완료 {n}건, {time.time() - t0:.0f}초")


if __name__ == "__main__":
    main()
