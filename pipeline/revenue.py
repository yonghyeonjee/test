"""
공고 원문에서 '연매출 ○○ 이하' 같은 신청 자격 상한을 뽑는다.

원문에는 매출이 두 가지 뜻으로 섞여 나온다.

  자격 기준 — "연매출액이 3억 원 이하인 소상공인"        ← 뽑아야 하는 것
  지원 한도 — "전년도 매출액의 1/4 범위 내에서 3억원"    ← 뽑으면 안 되는 것

둘을 못 가르면 지원금 액수를 매출 상한으로 넣어 버려서, 멀쩡한 기업이
검색에서 빠진다. 그래서 '이하/미만'이 붙은 것만 받고, 한도를 뜻하는
낱말이 근처에 있으면 버린다. 애매하면 뽑지 않는 쪽을 택한다 —
값이 없으면 그 공고는 매출로 거르지 않지만, 틀린 값이 들어가면 거른다.
"""

import re

# 단위 → 원
UNITS = [("억", 100_000_000), ("천만", 10_000_000), ("백만", 1_000_000), ("만", 10_000)]

# 이 낱말이 매출과 숫자 사이에 끼면 자격이 아니라 지원 한도다.
LIMIT_WORDS = ("한도", "최대", "범위", "이내", "지원금", "보조금", "융자", "대출금")

# 숫자 + 단위 + (원) + 이하/미만
CAP = re.compile(
    r"(\d[\d,.]*)\s*(억|천만|백만|만)\s*원?\s*(?:이하|미만)"
)

# '매출' 뒤 이 정도 안에서만 찾는다. 멀어지면 다른 문장 얘기다.
WINDOW = 28


def _to_won(num: str, unit: str) -> int | None:
    try:
        v = float(num.replace(",", ""))
    except ValueError:
        return None
    for u, mult in UNITS:
        if unit == u:
            return int(v * mult)
    return None


def parse_revenue_cap(*texts) -> int | None:
    """여러 원문 조각에서 매출 상한(원)을 찾는다. 못 찾으면 None."""
    best: int | None = None

    for text in texts:
        if not text or "매출" not in text:
            continue
        for m in re.finditer("매출", text):
            window = text[m.end() : m.end() + WINDOW]

            # 분수 표현(1/3, 1/4)은 언제나 지원 한도 쪽이다.
            if re.search(r"\d\s*/\s*\d", window):
                continue

            hit = CAP.search(window)
            if not hit:
                continue

            # 숫자에 닿기 전에 한도 낱말이 나오면 자격 기준이 아니다.
            before = window[: hit.start()]
            if any(w in before for w in LIMIT_WORDS):
                continue

            won = _to_won(hit.group(1), hit.group(2))
            if won is None:
                continue
            # 억 단위 미만의 상한은 자격 기준으로 쓰기엔 너무 작다.
            # 대개 지원 금액이라 버린다.
            if won < 100_000_000:
                continue
            # 가장 낮은 상한이 실제로 통과해야 하는 기준이다.
            best = won if best is None else min(best, won)

    return best


def won_to_label(won: int | None) -> str | None:
    """사람이 읽는 표기. 화면과 로그에 같이 쓴다."""
    if not won:
        return None
    if won % 100_000_000 == 0:
        return f"{won // 100_000_000}억원"
    return f"{won / 100_000_000:.1f}억원"
