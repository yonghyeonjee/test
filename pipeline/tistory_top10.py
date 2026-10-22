"""
tistory_top10.py — top10.py 가 jiwon 에 쓴 순위 글(stats 포함)을 자료로, 티스토리(abcfact)용 글을 따로 쓴다.
주제가 무엇이든 같은 틀: 들머리 → 목차 → 현황 → 1위…10위(요약 목록 · 어떤 것인가 · 어려운 점(심리) · 흐름 · 이렇게 준비 · 출처)
→ 비교 표 → 정리 → 참고 문헌. jiwon 원문 문단을 옮기지 않고 새로 쓴다. 숫자마다 출처 줄, 심리 개념은 jeepedia 로 잇는다.

tistory_publish.py --composer top10 이 부른다. 옛 직무 글(stats 에 items 가 없고 roles 만 있는 것)은 tistory_top_roles 로 넘긴다.
"""

from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import blog_daily as b  # noqa: E402
from blog_top_roles import NOTES as ROLE_NOTES  # noqa: E402
from top10_notes import MY_SITES, OFFICIAL_SITES, PSY, hard_for, psy_links, term_links_md  # noqa: E402
from tistory_top_roles import TIPS as ROLE_TIPS  # noqa: E402
from tistory_top_roles import compose as compose_roles_legacy  # noqa: E402
from top10_links import for_item  # noqa: E402

SITE, BRAND = b.SITE, b.BRAND
GOJOBS, ALIO, QNET, BOKJIRO = "https://www.gojobs.go.kr", "https://job.alio.go.kr", "https://www.q-net.or.kr", "https://www.bokjiro.go.kr"
BIZINFO = "https://www.bizinfo.go.kr"

# 항목 종류별 말투 재료
INTRO = {
    "keyword": ["어떤 직무로 갈지 정하지 못했다면, 공고가 실제로 많이 나오는 직무부터 보는 것이 빠릅니다. 정규직 공채보다 수시 채용이 훨씬 많다는 사실도 함께 보입니다.",
                "이 글은 {source}를 {brand}이 모아 센 숫자로, 많이 뽑는 {what} 10개를 순위로 정리한 것입니다. 기준일은 {date}입니다."],
    "org": ["공공기관 취업은 '어느 기관이 자주 뽑나'를 알면 절반은 준비가 됩니다. 자주 뽑는 기관은 해마다 비슷한 시기에 비슷한 자리를 다시 올리기 때문입니다.",
            "이 글은 {source}를 {brand}이 세어 공고를 가장 많이 낸 {what} 10곳을 정리한 것입니다. 기준일은 {date}입니다."],
    "region": ["같은 직무라도 지역에 따라 공고 수가 크게 다릅니다. 내가 갈 수 있는 지역에 자리가 얼마나 있는지부터 보면 지원 전략이 달라집니다.",
               "이 글은 {source}를 {brand}이 세어 공고가 많은 {what} 10곳을 정리한 것입니다. 기준일은 {date}입니다."],
    "welfare_region": ["정부·지자체 지원사업은 어디 사느냐에 따라 받을 수 있는 것이 다릅니다. 사업 수가 많은 지역은 그만큼 내 조건에 맞는 것이 있을 가능성이 큽니다.",
                       "이 글은 {brand}이 모은 {source}를 세어 사업이 많은 {what} 10곳을 정리한 것입니다. 기준일은 {date}입니다."],
    "welfare_topic": ["지원사업은 '어느 분야가 두터운가'를 알면 어디서 찾아야 할지 보입니다. 분야마다 지원 방식(현금·바우처·서비스)도 다릅니다.",
                      "이 글은 {brand}이 모은 {source}를 세어 사업이 많은 {what} 10개를 정리한 것입니다. 기준일은 {date}입니다."],
    "license": ["자격증은 사람이 많이 보는 종목일수록 교재·강의가 많고, 합격률이 높은 종목일수록 빨리 손에 쥘 수 있습니다. 둘 다 숫자로 확인할 수 있습니다.",
                "이 글은 {source}을 {brand}이 세어 {what} 10개를 순위로 정리한 것입니다. 기준일은 {date}입니다."],
}
PREP = {  # 항목 종류별 "이렇게 준비하세요" 기본 문장(직무별 TIPS 가 없을 때)
    "keyword": "공고 본문의 응시 자격과 우대 사항을 먼저 확인하고, 같은 기관의 지난 공고로 전형 방식을 파악하세요.",
    "org": "이 기관의 지난 공고에서 채용 시기와 자격 요건의 패턴을 읽고, 자기소개서 항목을 미리 써 두세요.",
    "region": "이 지역 공고를 고용 형태(국가·지자체·공공·교육)로 나눠 보고, 내가 노릴 쪽의 접수 기간이 얼마나 짧은지 확인하세요.",
    "welfare_region": "조건(나이·소득·가구)을 넣어 내게 해당되는 사업만 추리고, 상시 접수 사업은 예산이 남아 있을 때 바로 신청하세요.",
    "welfare_topic": "분야 안에서 내 상황(청년·신혼·한부모 등)에 맞는 사업을 다시 걸러 보고, 지원 방식이 현금인지 서비스인지 확인하세요.",
    "license": "채용 공고가 이 자격을 적는지 먼저 확인하고, 고비가 필기인지 실기인지에 따라 공부 시간을 나누세요.",
}
WRAP = {
    "keyword": ["**자격이 없다면** 공고가 많은 직무부터 보되, 지원자가 몰리니 같은 기관의 지난 공고로 전형을 미리 익히세요.",
                "**면허·자격이 있다면** 자격이 곧 지원 자격인 직무가 유리합니다. 공고 수는 적어도 경쟁이 덜합니다.",
                "**접수 기간이 짧은 직무**는 공고를 본 날 서류를 내야 합니다. 매일 아침 새 공고를 확인하는 루틴이 먼저입니다.",
                "**어려운 점을 미리 알면** 입사 뒤 번아웃을 줄일 수 있습니다. 항목마다 적은 심리 개념과 자가진단을 지원 전에 한 번 해 보세요."],
    "org": ["**자주 뽑는 기관**은 결원이 잦다는 뜻이기도 합니다. 계약 기간과 근무지를 공고 본문에서 꼭 확인하세요.",
            "**기관별 자기소개서 항목**은 다릅니다. 지난 공고로 묻는 것을 미리 파악하세요.",
            "**관심 기관을 저장**해 두면 새 공고가 뜰 때 바로 볼 수 있습니다."],
    "region": ["**'전국' 공고**는 본사 채용이거나 근무지 미정입니다. 실제 근무지는 공고 본문이 기준입니다.",
               "**교육청 공고가 많은 지역**은 접수 기간이 짧은 공고가 많으니 매일 확인이 필요합니다.",
               "**지역을 옮길 수 있다면** 공고 수 대비 지원자가 적은 지역이 유리합니다."],
    "welfare_region": ["**사업 수가 많다고 받을 돈이 많은 것은 아닙니다.** 조건을 넣어 내게 해당되는 것만 추리세요.",
                       "**상시 접수 사업**은 예산이 소진되면 일찍 닫힙니다. 신청 가능 표시가 있을 때 바로 신청하세요.",
                       "**같은 이름의 사업**도 시·군·구마다 금액과 조건이 다릅니다. 내 주소지 기준으로 다시 확인하세요."],
    "welfare_topic": ["**분야 이름은 넓습니다.** 분야 안에서 내 상황에 맞는 사업을 다시 걸러야 합니다.",
                      "**현금 지급과 바우처·서비스**는 체감이 다릅니다. 지원 방식을 함께 보세요.",
                      "**접수 기간이 있는 사업**은 마감 2~3일 전에 서류를 내는 편이 안전합니다."],
    "license": ["**응시자가 많은 종목**은 공부 자료가 풍부한 대신 가산점 효과는 작습니다. 채용 공고가 그 자격을 적는지 먼저 확인하세요.",
                "**필기 합격 후 2년** 안에 실기를 여러 번 볼 수 있습니다. 고비가 실기인 종목은 실기에 시간을 더 두세요.",
                "**상시 시험 종목**은 큐넷에서 날짜를 고를 수 있습니다. 정기 시험은 연초에 한 해 일정을 확인하세요."],
}


OFFICIAL = [("나라일터", GOJOBS, ("나라일터",)), ("잡알리오", ALIO, ("잡알리오",)), ("큐넷", QNET, ("큐넷",)),
            ("복지로", BOKJIRO, ("지원사업", "복지")), ("기업마당", BIZINFO, ("기업마당", "기업지원"))]


# 정리 절에 넣는 원 자료 사이트 화면(shot_top10.py 가 찍는 key)과 안내 문장
WRAP_SHOTS = {"keyword": ["gojobs", "alio"], "org": ["gojobs", "alio"], "region": ["gojobs", "alio"],
              "welfare_region": ["bokjiro", "bizinfo"], "welfare_topic": ["bokjiro", "bizinfo"], "license": ["qnet"]}
WRAP_LINE = {
    **{e: f"공고 원문은 [인사혁신처 나라일터]({GOJOBS})(국가·지자체)와 [잡알리오]({ALIO})(공공기관)에서 확인하고 접수합니다. 마감 시각과 제출 서류는 공고 본문이 기준입니다."
       for e in ("keyword", "org", "region")},
    **{e: f"신청은 [복지로]({BOKJIRO})(복지 서비스)와 [기업마당]({BIZINFO})(기업 지원사업)에서 합니다. 조건과 금액은 사업 안내문이 기준입니다."
       for e in ("welfare_region", "welfare_topic")},
    "license": f"시험 일정과 원서 접수는 [큐넷]({QNET})에서 합니다. 합격 기준과 응시 자격은 종목별 시행 공고가 기준입니다.",
}


def official_links(source: str) -> list[tuple[str, str]]:
    """자료 설명 문자열(예: '나라일터·잡알리오 공고')에서 원 자료 사이트를 고른다. 글의 출처 줄은 이 사이트들로 간다."""
    out = [(name, href) for name, href, keys in OFFICIAL if any(k in source for k in keys)]
    return out or [("나라일터", GOJOBS), ("잡알리오", ALIO)]


def josa(word: str, pair: str) -> str:
    """'외교부'+'은/는' → '외교부는'. 한글로 끝나지 않으면 뒤 것을 쓴다."""
    a, b_ = pair.split("/")
    ch = (word or " ")[-1]
    if "가" <= ch <= "힣":
        has = (ord(ch) - 0xAC00) % 28 != 0
        if pair == "으로/로" and (ord(ch) - 0xAC00) % 28 == 8:      # ㄹ 받침은 '로'
            has = False
        return word + (a if has else b_)
    return word + b_


def item_prep(entity: str, it: dict, name: str) -> str | None:
    """기관·지역 항목의 '이렇게 준비하세요'를 그 항목의 숫자로 쓴다(몰리는 달·많이 뽑는 직무)."""
    months = [m for m in (it.get("by_month") or [])[:-1] if m.get("n")]
    jobs = [x["label"] for x in (it.get("bars") or {}).get("items", [])[:2]]
    if not months or entity not in ("org", "region", "keyword"):
        return None
    peak = max(months, key=lambda m: m["n"])
    pm = int(peak["m"].split("-")[1])
    prev = 12 if pm == 1 else pm - 1
    lead = f"{josa(name, '은/는')} 지난 1년 **{pm}월**에 {b.n(peak['n'])}건으로 공고가 가장 많았습니다."
    if entity == "org":
        what = f" 자리는 {'·'.join(jobs)} 쪽이 많습니다." if jobs else ""
        return f"{lead}{what} {prev}월까지 지난 공고의 자격 요건과 자기소개서 항목을 모아 두면 {pm}월 공고에 바로 낼 수 있습니다."
    what = f" 공고는 {'·'.join(jobs)}에서 많이 나왔습니다." if jobs else ""
    if entity == "keyword":
        return (f"{name} 공고는 지난 1년 **{pm}월**({b.n(peak['n'])}건)에 가장 많았고," + (f" {'·'.join(jobs)}에서 자주 냈습니다." if jobs else " 여러 기관이 고르게 냈습니다.")
                + f" {prev}월까지 이 기관들의 지난 공고에서 응시 자격·우대 사항·전형 순서를 정리해 두면 {pm}월 공고에 바로 낼 수 있습니다.")
    return f"{lead}{what} 이 지역에서 일할 수 있다면 {prev}월부터 매일 새 공고를 확인하는 편이 좋습니다."


def src(label: str, href: str) -> dict:
    return b.P(f"출처: [{label}]({href})")


def src_official(source: str, tail: str = "") -> dict:
    """출처 줄은 원 자료(공공 사이트)로 하이퍼링크한다. 집계한 쪽(K나라지원)은 글자로만 적는다 — 한 도메인으로 링크가 몰리지 않게."""
    links = " · ".join(f"[{n}]({h})" for n, h in official_links(source))
    return b.P(f"출처: {links}{tail} · 집계 {BRAND}")


def compose(post: dict) -> dict:
    st = post.get("stats") or {}
    if "items" not in st:                        # 옛 직무 TOP10 글(roles 키만 있음)
        return compose_roles_legacy(post)
    entity, items, ov = st["entity"], st["items"][:10], st["overview"]
    topic, unit, what, source = st["topic"], st["unit"], st["what"], st["source"]
    today = dt.date.fromisoformat(ov["today"]) if ov.get("today") else b.today()
    origin = f"/story/{post['slug']}"
    total = int(ov.get("n_total") or 0)
    top = items[0]
    notes = {"roles": ROLE_NOTES, "short-window": ROLE_NOTES, "long-window": ROLE_NOTES}.get(topic)
    if notes is None:
        from top10 import TOPICS
        notes = TOPICS.get(topic, {}).get("notes") or {}
    tips = {"roles": ROLE_TIPS, "short-window": ROLE_TIPS, "long-window": ROLE_TIPS}.get(topic, {})

    title = st["name"].replace("TOP10", "").strip()
    title = f"{title} 순위 TOP10 | {today.year}년 현황과 {'직무별 어려운 점·준비 방법' if entity == 'keyword' else '지금 할 수 있는 것'}"
    summary = (f"{source}를 바탕으로 {what} 10개를 순위로 정리했습니다. 1위는 {top['name']} {b.n(top['n'])}{unit}. "
               f"항목마다 숫자와 요건, {'어려운 점(번아웃·감정노동 같은 심리 요인)과 ' if entity == 'keyword' else ''}지금 할 수 있는 것을 적었습니다. 원 자료는 {' · '.join(n for n, _ in official_links(source))}입니다.")

    short = [it["name"] for it in items]
    disp = {id(it): (it.get("full_name") or it["name"]) if short.count(it["name"]) > 1 else it["name"] for it in items}   # 이름이 겹치면 정식 이름
    toc = [("now", "현황은?")] + [(f"r{i+1}", f"{i+1}위 {disp[id(it)]}") for i, it in enumerate(items)] \
        + [("compare", f"{what} TOP10 비교"), ("wrap", "정리"), ("sites", "함께 보면 좋은 사이트"), ("refs", "참고 문헌")]
    blocks: list[dict] = []
    for line in INTRO[entity]:
        blocks.append(b.P(line.format(source=source, brand=BRAND, what=what, date=b.kdate(today.isoformat()))))
    if entity == "keyword":
        blocks.append(b.P("순위마다 공고 수와 접수 중인 자리, 자주 뽑는 기관, 접수 기간, 자격 요건을 적었습니다. 그리고 하나 더, **그 일이 왜 힘든지**를 번아웃·감정노동·교대근무 같은 심리학 개념으로 풀었습니다. 들어가기 전에 알면 버티는 방법이 달라집니다."))
    blocks.append(b.P("순위는 " + ("채용 인원이 아니라 공고 건수" if entity in ("keyword", "org", "region") else "지원 금액이 아니라 사업 수" if entity.startswith("welfare") else "최근 연도 필기 응시자 수")
                      + " 기준입니다. 원 자료 사이트는 절마다 출처 줄에, 전체 표와 숫자는 참고 문헌에 적었습니다."))

    # 현황
    blocks.append(b.H2("현황은?", "now"))
    blocks.append({"type": "image", "key": "open"})
    blocks.append(b.LIST(ov["facts"]))
    if ov.get("by_month"):
        months = ov["by_month"]
        peak = max(months[:-1] or months, key=lambda m: m["n"])
        blocks.append(b.P(f"지난 1년은 **{int(peak['m'].split('-')[1])}월**에 {b.n(peak['n'])}{unit}로 가장 많았습니다. 몰리는 달 전에 서류 틀을 만들어 두면 접수 기간이 짧은 공고에도 바로 낼 수 있습니다."))
        blocks.append(b.BARS([{"label": f"{int(x['m'].split('-')[1])}월", "n": x["n"]} for x in months], unit=unit))
    elif ov.get("bars", {}).get("items"):
        blocks.append(b.BARS(ov["bars"]["items"], unit=unit))
    blocks.append({"type": "image", "key": "overview"})
    blocks.append(src_official(source, f" · {b.kdate(today.isoformat())} 기준"))

    # 1위 … 10위
    for i, it in enumerate(items):
        unit_lbl = f"{b.n(it['n'])}{unit}"
        name = disp[id(it)]
        blocks.append(b.H2(f"{i+1}위 {name} — {'최근 1년 공고' if entity in ('keyword','org','region') else '사업' if entity.startswith('welfare') else '필기 응시자'} {unit_lbl}", f"r{i+1}"))
        blocks.append({"type": "image", "key": f"item_{i+1}"})
        blocks.append(b.LIST([f for f in it["facts"] if "보통 **0일**" not in f and "보통 0일" not in f]))   # 접수 기간 0일은 자료 빈칸
        desc = it.get("desc") or notes.get(it["key"], "")
        if desc:
            blocks.append(b.P(f"**어떤 {'일' if entity in ('keyword',) else '곳' if entity in ('org', 'region', 'welfare_region') else '것'}인가요?** {desc}"))
        elif entity == "org":
            first = it["bars"]["items"][0]["label"] if it["bars"]["items"] else None
            blocks.append(b.P(f"**어떤 곳인가요?** {josa(it.get('full_name') or it['name'], '은/는')} 최근 1년 공고 {b.n(it['n'])}건을 냈고, " + (f"그중 **{first}** 직무가 가장 많습니다." if first else "직무가 고르게 섞여 있습니다.")
                              + (f" 접수 기간은 보통 {int(it['win_med'])}일입니다." if it.get("win_med") else "")))
        elif entity == "region":
            first = it["bars"]["items"][0]["label"] if it["bars"]["items"] else None
            blocks.append(b.P(f"**어떤 곳인가요?** {it['name']}에서 최근 1년 {b.n(it['n'])}건이 올라왔고, " + (f"**{josa(first, '이/가')}** 가장 많이 냈습니다." if first else "여러 기관이 고르게 냈습니다.")))
        elif entity.startswith("welfare"):
            first = it["bars"]["items"][0]["label"] if it["bars"]["items"] else None
            blocks.append(b.P(f"**어떤 것인가요?** {it['name']}의 사업 {b.n(it['n'])}건 가운데 지금 신청할 수 있는 것은 {b.n(it['n_open'])}건이고, " + (f"**{first}** 쪽이 가장 많습니다." if first else "분야가 고르게 섞여 있습니다.")))
        elif entity == "license":
            blocks.append(b.P(f"**어떤 것인가요?** {it['name']}은(는) {it.get('series') or ''} 등급, {it.get('field') or ''} 분야 국가자격입니다. "
                              + (f"필기 {int(it['w_rate'])}%·실기 {int(it['p_rate'])}%라 고비는 **{'실기' if it['p_rate'] < it['w_rate'] else '필기'}**입니다." if it.get("w_rate") is not None and it.get("p_rate") is not None else "")))
        # 어려운 점 (심리)
        hard = hard_for(topic, it["key"])
        if hard:
            concepts = ", ".join(f"[{PSY[k]['name']}]({PSY[k]['href']})" for k in hard["psy"] if k in PSY)
            last = next((PSY[k]["name"] for k in reversed(hard["psy"]) if k in PSY), "")
            blocks.append(b.P(f"**이 일이 힘든 이유.** {hard['hard']} 심리학에서는 이를 {concepts}{josa(last, '으로/로')[len(last):]} 설명합니다."))
            one = PSY[hard["psy"][0]]
            terms = term_links_md(hard["psy"])
            blocks.append(b.P(f"**들어가기 전에 점검.** {one['desc']} [{one['label']}]({one['href']})으로 내 상태를 먼저 재 보세요."
                              + (f" 용어가 낯설면 jeepedia 심리학 용어 사전의 {terms} 항목을 먼저 읽으면 됩니다." if terms else "")))
        # 흐름
        if it.get("n90") is not None and it["n"]:
            s90 = b.pct(it["n90"], it["n"])
            blocks.append(b.P("**요즘 흐름.** " + (f"최근 석 달에만 {b.n(it['n90'])}건({s90}%)이 나와 지금이 지원하기 좋은 시기입니다." if s90 >= 30 else
                                              f"최근 석 달에 {b.n(it['n90'])}건({s90}%)으로 한 해 내내 꾸준히 열립니다." if s90 >= 20 else
                                              f"최근 석 달에는 {b.n(it['n90'])}건({s90}%)으로 뜸한 편이라 몰리는 달을 기다리는 편이 낫습니다.")))
        blocks.append({"type": "image", "key": f"live_{i+1}"})
        blocks.append(b.P(f"**이렇게 준비하세요.** {tips.get(it['key']) or item_prep(entity, it, name) or PREP[entity]}"))
        own = for_item(entity, topic, it)
        if own:                                  # 절마다 그 항목의 공식 사이트(면허 시험·협회·부처·시도청) — 같은 링크만 반복하지 않게
            blocks.append(b.P("**공식 사이트.** " + " · ".join(f"[{n}]({h})" for n, h in own)))
            blocks.append(b.P(f"출처: {' · '.join(n for n, _ in official_links(source))} 공고 · 집계 {BRAND}"))
        else:
            blocks.append(src_official(source))

    # 비교
    blocks.append(b.H2(f"{what} TOP10 비교", "compare"))
    blocks.append(b.P(f"한눈에 보면 이렇습니다. 상위 세 항목이 전체의 **{b.pct(sum(i['n'] for i in items[:3]), total)}%**입니다." if total else "한눈에 보면 이렇습니다."))
    blocks.append({"type": "image", "key": "top10"})
    if entity in ("keyword", "org", "region"):
        blocks.append(b.TABLE(["순위", what, "최근 1년 공고", "접수 중", "접수 기간"],
                              [[f"{i+1}위", disp[id(it)], f"{b.n(it['n'])}건", f"{b.n(it['n_open'])}건", f"{int(it['win_med'])}일" if it.get("win_med") else "-"] for i, it in enumerate(items)]))
    elif entity.startswith("welfare"):
        blocks.append(b.TABLE(["순위", what, "사업 수", "신청 가능", "상시", "현금"],
                              [[f"{i+1}위", disp[id(it)], f"{b.n(it['n'])}건", f"{b.n(it['n_open'])}건", f"{b.n(it['always'])}건", f"{b.n(it['cash'])}건"] for i, it in enumerate(items)]))
    else:
        blocks.append(b.TABLE(["순위", "종목", "필기 응시자", "필기 합격률", "실기 합격률"],
                              [[f"{i+1}위", it["name"], f"{b.n(it['n'])}명", f"{int(it['w_rate'])}%" if it.get("w_rate") is not None else "-", f"{int(it['p_rate'])}%" if it.get("p_rate") is not None else "-"] for i, it in enumerate(items)]))
    blocks.append(src_official(source, " · 표의 숫자 전체는 참고 문헌의 원문에"))

    # 정리
    blocks.append(b.H2("정리", "wrap"))
    blocks.append(b.LIST(WRAP[entity]))
    ws = WRAP_SHOTS[entity]
    blocks.append({"type": "image", "key": ws[0]})
    blocks.append(b.P(WRAP_LINE[entity]))
    for k in ws[1:]:
        blocks.append({"type": "image", "key": k})
    blocks.append(b.P("실제 지원·신청은 아래 공식 사이트에서 하고, 일이 힘든 이유를 심리학으로 풀어 보고 싶다면 "
                      f"[jeepedia 심리 테스트]({PSY['burnout']['href'].rsplit('/', 2)[0]}/)도 함께 보세요."))

    # 함께 보면 좋은 사이트 — 공식 자료 + 운영 사이트
    blocks.append(b.H2("함께 보면 좋은 사이트", "sites"))
    group = "jobs" if entity in ("keyword", "org", "region") else "welfare" if entity.startswith("welfare") else "license"
    blocks.append(b.P("**공식 자료.** 이 글의 숫자가 나온 원 자료와, 실제 신청·접수를 하는 곳입니다."))
    blocks.append(b.LIST([f"[{x['name']}]({x['href']}) — {x['desc']}" for x in OFFICIAL_SITES[group]]))
    blocks.append(b.P("**제가 운영하는 사이트.** 숫자를 세고 글을 쓰는 데 쓴 도구들입니다. 전부 무료입니다."))
    blocks.append(b.LIST([f"[{x['name']}]({x['href']}) — {x['desc']}" for x in MY_SITES]))

    # 참고 문헌
    blocks.append(b.H2("참고 문헌", "refs"))
    refs = [{"href": origin, "label": f"{BRAND}, 「{post['title']}」 — 표·숫자 전체 ({today.isoformat()})"}]   # 운영 사이트 링크는 여기 한 번
    if entity in ("keyword", "org", "region"):
        refs += [{"href": GOJOBS, "label": "인사혁신처 나라일터 (원 자료)"}, {"href": ALIO, "label": "기획재정부 잡알리오 (원 자료)"}]
    elif entity.startswith("welfare"):
        refs += [{"href": BOKJIRO, "label": "보건복지부 복지로 (원 자료)"}, {"href": BIZINFO, "label": "중소벤처기업부 기업마당 (원 자료)"}]
    else:
        refs += [{"href": QNET, "label": "한국산업인력공단 큐넷 수험자 동향 (원 자료)"}]
    used = sorted({k for it in items for k in ((hard_for(topic, it["key"]) or {}).get("psy") or [])})
    refs += psy_links(used)
    if entity == "keyword":
        refs.append({"href": "https://www.mindgarden.com/117-maslach-burnout-inventory-mbi", "label": "Maslach & Jackson, Maslach Burnout Inventory (번아웃 척도)"})
        refs.append({"href": "https://doi.org/10.2307/2392498", "label": "Karasek (1979), Job demands, job decision latitude, and mental strain (요구-통제 모델)"})
    blocks.append(b.LINKS(refs))
    blocks.append(b.NOTE(f"숫자는 {today.isoformat()} 기준 {BRAND} 집계입니다. " + ("공고 건수이며 채용 인원이 아닙니다. 어려운 점은 일반적으로 알려진 직무 특성과 심리학 개념을 적은 것이고, 자격 요건은 공고 본문이 기준입니다." if entity in ("keyword", "org", "region") else
                                                                     "사업 수이며 지원 금액이 아닙니다. 조건은 각 사업 안내가 기준입니다." if entity.startswith("welfare") else "합격률은 응시자 대비 합격자입니다. 일정은 큐넷 공고가 기준입니다.")))

    keywords = [st["name"], f"{what} 순위", "TOP10", BRAND, f"{today.year}"] + [it["name"] for it in items[:4]] + (["번아웃", "직무 스트레스"] if entity == "keyword" else [])
    return {**post, "title": title, "summary": summary, "keywords": keywords[:10],
            "body": [{"type": "toc", "items": [{"id": i, "label": l} for i, l in toc]}] + blocks}


COMPOSERS = {"top10": compose}
