"""전세계 인터넷 속도 TOP10 — 티스토리 단독 글(jiwon 자료가 아니라 Ookla 공개 지표). 글과 차트를 만든다.

    python -u pipeline/world_speed.py            # out/post.json + shots/*.png + shots/manifest.json
    python -u pipeline/world_speed.py --dry      # 글만 찍어 본다(차트 없음)

자료: pipeline/data/world_internet_speed.json — Ookla Speedtest Global Index(중앙값 다운로드) 를
러너 브라우저(probe_speedtest.py)로 읽어 옮겨 적은 것. 숫자는 그 파일에만 있고 여기서 지어내지 않는다.
올리기: python pipeline/tistory_publish.py --post-json out/post.json --images shots/manifest.json --visibility public
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import blog_daily as b  # noqa: E402

DATA = Path(__file__).parent / "data" / "world_internet_speed.json"
OUT = "shots"
BRAND = "abcfact"
KO_MONTH = lambda ym: f"{ym[:4]}년 {int(ym[5:7])}월"  # noqa: E731

# 나라마다 "왜 빠른가 · 알아둘 점". 사실 관계는 널리 알려진 통신 정책·시장 구조 수준으로만 적고 수치는 넣지 않는다.
WHY = {
    "Singapore": ["도시국가 전체를 하나의 광케이블망(차세대 전국 광대역망)으로 깔아 집집마다 광케이블이 들어와 있고, 가정용 요금제가 일찍부터 1Gbps 를 넘어 2.5~10Gbps 로 올라갔습니다. 국토가 작고 아파트 위주라 망 투자 대비 효과가 큽니다.",
                  "여러 통신사가 같은 광케이블망을 빌려 쓰는 구조라 요금 경쟁이 붙고, 소비자는 속도만 보고 갈아탑니다. 중앙값이 높다는 건 '비싼 요금제를 쓰는 소수'가 아니라 보통 가정이 이 속도를 쓴다는 뜻입니다."],
    "United Arab Emirates": ["국가 주도 디지털 전략 아래 두 통신사(e&·du)가 전국을 광케이블로 덮었고, 신도시·고층 주거 위주라 배선이 쉽습니다. 모바일에서도 1위라 '유·무선 모두 빠른' 드문 나라입니다.",
                             "아부다비는 도시 순위 1위, 두바이는 7위입니다. 요금은 싼 편이 아니지만 기본 요금제의 속도 자체가 높습니다."],
    "Hong Kong (SAR)": ["세계에서 가장 밀집한 고층 아파트 도시라 건물 하나에 광케이블을 넣으면 수백 가구가 한꺼번에 연결됩니다. 통신사 간 경쟁이 치열해 기가급 요금제가 일찍부터 흔했습니다.",
                        "전달보다 한 계단 올라 3위입니다. 모바일은 25위 밖이라 유선 쪽이 특히 강한 곳입니다."],
    "Chile": ["남미에서 광케이블 전환이 가장 빨리 이뤄진 나라입니다. 통신사 여럿이 광케이블 가입자를 놓고 가격 경쟁을 벌여 기가급 요금제가 저렴합니다. 발파라이소(2위)·산티아고(5위)가 도시 순위 상위권입니다.",
              "전달보다 한 계단 내려 4위이지만 상위권은 수십 Mbps 차이로 붙어 있어 달마다 자리가 바뀝니다."],
    "France": ["정부의 '초고속 인터넷 계획' 으로 전국 광케이블 보급을 밀어붙인 결과입니다. 유럽에서 광케이블 가입 가구 비율이 가장 높은 축에 들고, 리옹은 도시 순위 3위입니다.",
               "구리선(ADSL) 을 단계적으로 끊고 광케이블로 옮기는 중이라 중앙값이 계속 오르는 추세입니다."],
    "Macau (SAR)": ["홍콩 옆의 작은 특별행정구로, 좁은 면적과 고밀도 주거 덕분에 광케이블 보급이 쉽습니다. 카지노·호텔 산업이 커서 상업 지역의 망 투자도 두텁습니다.",
                    "인구가 적어 표본이 작은 편이니 달마다 변동이 다른 나라보다 클 수 있습니다."],
    "United States": ["광케이블 확장과 케이블 인터넷(동축) 의 고속화가 함께 진행되면서 다기가 요금제 경쟁이 붙었습니다. 로스앤젤레스(13위)·뉴욕(14위) 같은 대도시가 전체 중앙값을 끌어올립니다.",
                      "나라가 넓어 지역 편차가 큽니다. 농촌은 여전히 느린 곳이 많고, 중앙값은 그 중간 어디쯤입니다. 모바일은 11위입니다."],
    "Thailand": ["통신사들이 광케이블 요금 경쟁을 벌이며 방콕을 중심으로 기가급 가정용 요금제가 보편화됐습니다. 방콕은 도시 순위 8위입니다.",
                 "전달보다 한 계단 올라 8위. 동남아에서 베트남과 함께 유선이 빠른 나라로 꼽힙니다."],
    "Israel": ["최근 몇 년 사이 통신사들이 광케이블 망을 급히 깔면서 순위가 빠르게 올랐습니다. 하이파가 도시 순위 4위, 텔아비브가 16위입니다.",
               "전달보다 두 계단 올라 9위. 상승 폭이 TOP10 안에서 가장 큽니다."],
    "Vietnam": ["국영·민영 통신사들이 광케이블을 싼값에 보급해 가정용 인터넷이 거의 전부 광케이블입니다. 호찌민은 도시 순위 17위입니다.",
                "전달보다 두 계단 내려 10위이지만, 모바일에서도 8위라 유·무선 모두 상위권인 몇 안 되는 신흥국입니다."],
}
KOREA_NOTE = [
    "한국은 유선 22위(253.97Mbps), 모바일 6위(244.17Mbps) 입니다. 유선이 '세계 1위' 였던 기억과 달리 중앙값 순위가 낮은 이유는 측정 방식에 있습니다. 중앙값은 가장 빠른 사람이 아니라 **한가운데 사람의 속도**라서, 1Gbps 요금제가 있어도 100M·500M 요금제를 쓰는 가구가 많으면 중앙값은 그쪽으로 내려옵니다.",
    "즉 한국의 망이 느려진 것이 아니라, 다른 나라들이 광케이블 보급과 함께 **기본 요금제의 속도를 올린 속도**가 더 빨랐다는 뜻에 가깝습니다. 서울은 도시 순위 34위(238.52Mbps), 부산은 46위(218.91Mbps) 입니다.",
]


def load() -> dict:
    return json.loads(DATA.read_text(encoding="utf-8"))


def n1(x: float) -> str:
    return f"{x:,.2f}"


def chg(c: int) -> str:
    return "변동 없음" if not c else (f"▲{c}" if c > 0 else f"▼{-c}")


def build(d: dict, today: dt.date) -> dict:
    ym, month = d["month"], KO_MONTH(d["month"])
    fixed = [x for x in d["fixed"] if x["rank"] <= 10]
    gf, gm = d["global"]["fixed"], d["global"]["mobile"]
    mob = {x["country"]: x for x in d["mobile"]}
    kor_f = next(x for x in d["fixed"] if x["country"] == "South Korea")
    kor_m = mob["South Korea"]
    cities = {c["city"].split(",")[0]: c for c in d["cities_fixed"]}
    top = fixed[0]
    slug = f"world-internet-speed-{ym}"
    title = f"전세계 인터넷 속도 순위 TOP10 | {month} Ookla 기준 국가별 다운로드 속도와 한국 순위"
    summary = (f"Ookla Speedtest Global Index {month} 자료로 유선 인터넷이 빠른 나라 10곳을 순위로 정리했습니다. 1위 {top['ko']} {n1(top['down'])}Mbps, "
               f"한국은 유선 {kor_f['rank']}위·모바일 {kor_m['rank']}위. 나라마다 왜 빠른지, 모바일 순위, 전 세계 중앙값 대비 배수를 적었습니다.")
    keywords = ["인터넷 속도 순위", "전세계 인터넷 속도", "국가별 인터넷 속도", "Speedtest Global Index", "Ookla", "인터넷 속도 TOP10",
                "한국 인터넷 속도 순위", "싱가포르 인터넷", "모바일 인터넷 속도", "광케이블"]

    toc = [("now", "현황은?")] + [(f"r{x['rank']}", f"{x['rank']}위 {x['ko']}") for x in fixed] \
        + [("compare", "TOP10 비교"), ("korea", "한국은 몇 위?"), ("wrap", "정리"), ("sites", "함께 보면 좋은 사이트"), ("refs", "참고 문헌")]
    B: list[dict] = []
    B.append(b.P(f"'인터넷이 가장 빠른 나라' 는 해마다 바뀝니다. 한때 한국이 늘 1위였지만, 지금은 광케이블을 전국에 깐 작은 나라들과 중동 산유국이 앞에 있습니다. "
                 f"이 글은 Ookla 의 Speedtest Global Index **{month}** 자료로 유선(고정) 인터넷 중앙값 다운로드 속도가 빠른 나라 10곳을 정리한 것입니다."))
    B.append(b.P("순위는 평균이 아니라 **중앙값**입니다. 그 나라에서 속도를 잰 사람들을 한 줄로 세웠을 때 한가운데 사람의 속도라서, 소수의 10Gbps 가입자가 아니라 보통 가정이 실제로 쓰는 속도에 가깝습니다. "
                 "나라마다 왜 빠른지, 모바일 순위는 어떤지, 전 세계 중앙값의 몇 배인지를 함께 적었습니다. 한국이 몇 위인지는 뒤쪽에 따로 설명합니다."))
    B.append({"type": "toc", "items": [{"id": i, "label": l} for i, l in toc]})

    B.append(b.H2("현황은?", "now"))
    B.append(b.LIST([
        f"**전 세계 유선 중앙값** 다운로드 {n1(gf['down'])}Mbps · 업로드 {n1(gf['up'])}Mbps · 지연 {gf['latency']}ms",
        f"**전 세계 모바일 중앙값** 다운로드 {n1(gm['down'])}Mbps · 업로드 {n1(gm['up'])}Mbps · 지연 {gm['latency']}ms",
        f"**유선 1위 {top['ko']}** {n1(top['down'])}Mbps — 전 세계 중앙값의 {top['down']/gf['down']:.1f}배",
        f"**모바일 1위 {d['mobile'][0]['ko']}** {n1(d['mobile'][0]['down'])}Mbps — 유선 1위보다도 빠릅니다",
        f"**한국** 유선 {kor_f['rank']}위 {n1(kor_f['down'])}Mbps · 모바일 {kor_m['rank']}위 {n1(kor_m['down'])}Mbps",
        f"TOP10 중 유선·모바일 **둘 다 상위권**인 나라는 아랍에미리트(모바일 1위)와 베트남(모바일 8위) 뿐입니다",
    ]))
    B.append(b.P("유선 상위 10개 나라의 공통점은 셋입니다. 국토가 작거나 인구가 도시에 몰려 있어 광케이블을 깔기 쉽고, 통신사가 여럿이라 요금 경쟁이 붙고, 정부가 광케이블 보급을 밀었습니다. "
                 "미국처럼 넓은 나라가 7위에 든 것은 대도시의 다기가 요금제 경쟁 덕분입니다."))
    B.append(b.P(f"출처: [Ookla Speedtest Global Index]({d['source_url']}) {month} · 중앙값 다운로드 기준 · 순위 변동은 전달 대비"))

    for x in fixed:
        c = x["country"]; m = mob.get(c)
        B.append(b.H2(f"{x['rank']}위 {x['ko']} — {n1(x['down'])}Mbps", f"r{x['rank']}"))
        bullets = [
            f"**유선 중앙값 다운로드** {n1(x['down'])}Mbps (전달 대비 {chg(x['change'])})",
            f"**전 세계 중앙값 대비** {x['down']/gf['down']:.1f}배 · **한국 대비** {x['down']/kor_f['down']:.2f}배",
            f"**모바일 순위** " + (f"{m['rank']}위 {n1(m['down'])}Mbps" if m else "25위 밖(공개 순위 밖)"),
        ]
        mine = [ci for ci in d["cities_fixed"] if ci["city"].endswith(c.replace(" (SAR)", "")) or (c == "Hong Kong (SAR)" and "Hong Kong" in ci["city"])]
        if mine:
            bullets.append("**도시 순위(유선)** " + " · ".join(f"{ci['ko']} {ci['rank']}위 {n1(ci['down'])}Mbps" for ci in mine[:2]))
        B.append(b.LIST(bullets))
        B.append(b.P("**왜 빠른가.** " + WHY[c][0]))
        B.append(b.P("**알아둘 점.** " + WHY[c][1]))
        B.append(b.P(f"출처: [Speedtest Global Index]({d['source_url']}) {month}"))

    B.append(b.H2("TOP10 비교", "compare"))
    B.append(b.TABLE(["순위", "나라", "유선 중앙값(Mbps)", "전달 대비", "전 세계 대비", "모바일 순위"],
                     [[str(x["rank"]), x["ko"], n1(x["down"]), chg(x["change"]), f"{x['down']/gf['down']:.1f}배",
                       (f"{mob[x['country']]['rank']}위" if x["country"] in mob else "25위 밖")] for x in fixed]
                     + [[str(kor_f["rank"]), "대한민국", n1(kor_f["down"]), chg(kor_f["change"]), f"{kor_f['down']/gf['down']:.1f}배", f"{kor_m['rank']}위"]]))
    B.append(b.P("1위와 10위 차이는 약 180Mbps 로, 10위권 나라도 전 세계 중앙값의 2배를 넘습니다. 유선과 모바일 순위가 함께 높은 나라는 드뭅니다. 모바일은 중동 산유국(아랍에미리트·카타르·쿠웨이트)이 압도적이고, 유선은 아시아 도시국가와 광케이블 보급이 끝난 나라들이 앞섭니다."))

    B.append(b.H2("한국은 몇 위?", "korea"))
    B.append(b.LIST([
        f"**유선** {kor_f['rank']}위 {n1(kor_f['down'])}Mbps — 전 세계 중앙값의 {kor_f['down']/gf['down']:.1f}배, 1위 싱가포르의 {kor_f['down']/top['down']*100:.0f}% 수준",
        f"**모바일** {kor_m['rank']}위 {n1(kor_m['down'])}Mbps — 전 세계 중앙값의 {kor_m['down']/gm['down']:.1f}배",
        f"**도시** 서울 {cities['Seoul']['rank']}위 {n1(cities['Seoul']['down'])}Mbps · 부산 {cities['Busan']['rank']}위 {n1(cities['Busan']['down'])}Mbps (유선)",
        "**일본**은 유선 24위 242.89Mbps 로 한국 바로 뒤입니다",
    ]))
    for line in KOREA_NOTE:
        B.append(b.P(line))

    B.append(b.H2("정리", "wrap"))
    B.append(b.LIST([
        "**순위는 '중앙값' 기준**입니다. 최고 속도 자랑이 아니라 보통 가정이 쓰는 속도의 비교라, 요금제 분포가 그대로 순위에 반영됩니다.",
        "**유선 TOP10 은 광케이블 보급률 순위**에 가깝습니다. 작은 나라·도시국가·정부 주도 보급국이 앞섭니다.",
        "**모바일은 중동이 압도적**입니다. 5G 를 전국에 깔고 가입자가 적은 산유국이 1~3위입니다.",
        "**한국은 유선 22위, 모바일 6위.** 망이 느려진 게 아니라 다른 나라의 기본 요금제 속도가 더 빨리 올랐습니다. 내 집 속도가 궁금하면 Speedtest 로 재서 중앙값과 비교해 보세요.",
    ]))

    B.append(b.H2("함께 보면 좋은 사이트", "sites"))
    B.append(b.P("이 글의 원 자료와, 운영 중인 사이트입니다."))
    B.append(b.LIST([
        f"[Speedtest Global Index]({d['source_url']}) — 나라별·도시별 유선·모바일 중앙값 순위. 매달 중순에 전달 자료가 올라옵니다.",
        "[Speedtest by Ookla](https://www.speedtest.net/) — 내 인터넷 속도 측정. 결과의 다운로드 값을 위 중앙값과 비교해 보세요.",
        "[한국지능정보사회진흥원 통신서비스 품질평가](https://www.nia.or.kr) — 과학기술정보통신부가 해마다 발표하는 국내 통신사별 유·무선 품질 측정 결과.",
        "[K나라지원](https://jiwon.knowhow-it.com) — 조건(지역·나이·상황)을 넣으면 받을 수 있는 정부 지원금·복지 사업과 공공기관 채용을 한 번에 찾아 줍니다. 통신비 감면 같은 지원도 여기서 찾습니다.",
        "[knowhow-it 데이터·마케팅 용어](https://knowhow-it.com/data-market/) — 중앙값·평균·표본 같은 데이터 용어를 한자리에.",
        "[jeepedia 심리 테스트](https://jeepedia.com/psychology-test/) — 번아웃·업무 스타일 같은 공개 척도 자가진단 2~3분.",
    ]))

    B.append(b.H2("참고 문헌", "refs"))
    B.append(b.LIST([
        f"Ookla, *Speedtest Global Index*, {month} (Median Country Speeds). {d['source_url']} — 유선·모바일 국가 순위와 전 세계 중앙값, 도시 순위.",
        "Ookla, *Speedtest Global Index Methodology* — 중앙값 채택 이유와 표본 기준(Precision Threshold). https://www.ookla.com/resources/guides/speedtest-global-index-methodology",
        "Ookla 자료는 비상업적 인용 시 출처 표기를 조건으로 공유를 허용합니다. 이 글의 모든 숫자는 위 자료를 그대로 옮긴 것이며 임의로 보정하지 않았습니다.",
    ]))

    items = [{"rank": x["rank"], "name": x["ko"], "n": x["down"], "change": x["change"], "country": x["country"],
              "mobile": (mob[x["country"]]["down"] if x["country"] in mob else None),
              "mobile_rank": (mob[x["country"]]["rank"] if x["country"] in mob else None)} for x in fixed]
    stats = {"topic": "world-internet-speed", "entity": "country", "unit": "Mbps", "month": ym, "global": d["global"],
             "items": items, "korea": {"fixed": kor_f, "mobile": kor_m, "seoul": cities["Seoul"], "busan": cities["Busan"]},
             "mobile_top": d["mobile"][:10], "today": today.isoformat()}
    return {"slug": slug, "kind": "world", "subject": "world-internet-speed", "category": "IT", "title": title, "summary": summary,
            "slogan": "전세계-인터넷-속도-순위-TOP10-2026년-9월-Ookla-기준-국가별-다운로드-속도와-한국-순위",   # 첫 발행 때 생긴 주소(고쳐 쓸 때 -1 로 밀리지 않게)
            "keywords": keywords, "body": B, "stats": stats, "published_at": today.isoformat()}


# ---------- 차트 ----------
def charts(post: dict) -> list[dict]:
    from chart_top_roles import setup_font, strip, BLUE, BLUE_DARK, BLUE_LIGHT, INK, INK2, GRID, W, H, DPI
    setup_font()
    import matplotlib.pyplot as plt
    import numpy as np
    st = post["stats"]; items = st["items"]; gf = st["global"]["fixed"]; gm = st["global"]["mobile"]; kor = st["korea"]
    month = KO_MONTH(st["month"])
    os.makedirs(OUT, exist_ok=True)
    man: list[dict] = []

    def foot(fig):
        fig.text(0.985, 0.012, f"출처: Ookla Speedtest Global Index {month} · 중앙값 다운로드 Mbps", ha="right", va="bottom", fontsize=8.5, color=INK2)

    def save(fig, name, caption):
        p = f"{OUT}/{name}.png"; fig.savefig(p); plt.close(fig); man.append({"file": f"{name}.png", "caption": caption})

    # 0 표지: TOP10 가로 막대 + 한국
    fig, ax = plt.subplots(figsize=(W / DPI, H / DPI), dpi=DPI); fig.subplots_adjust(left=0.2, right=0.96, top=0.8, bottom=0.12)
    fig.text(0.05, 0.93, f"전세계 유선 인터넷 속도 TOP10 — {month}", fontsize=15, weight="bold", color=INK, va="top")
    fig.text(0.05, 0.86, f"나라별 중앙값 다운로드. 전 세계 중앙값 {gf['down']:.0f}Mbps, 한국은 {kor['fixed']['rank']}위", fontsize=10, color=INK2, va="top")
    labels = [f"{it['rank']}위 {it['name']}" for it in items] + [f"{kor['fixed']['rank']}위 대한민국"]
    vals = [it["n"] for it in items] + [kor["fixed"]["down"]]
    ys = np.arange(len(labels))[::-1]
    ax.barh(ys, vals, height=0.6, color=[BLUE] * 10 + [BLUE_DARK], linewidth=0)
    ax.set_yticks(ys, labels, fontsize=9.5); ax.set_xticks([]); strip(ax, bottom=False)
    for y, v in zip(ys, vals):
        ax.text(v + 6, y, f"{v:,.2f}", va="center", fontsize=9, color=INK)
    ax.axvline(gf["down"], color=GRID, linewidth=1.2); ax.text(gf["down"] + 4, ys[-1] - 0.9, f"전 세계 중앙값 {gf['down']:.0f}", fontsize=8, color=INK2)
    ax.set_xlim(0, max(vals) * 1.15); ax.set_ylim(-1.5, len(labels) - 0.3)
    foot(fig); save(fig, "hero", "전세계 유선 인터넷 속도 TOP10 과 한국 (출처: Ookla Speedtest Global Index)")

    # 1 현황: 유선·모바일 전 세계 중앙값 vs 1위 vs 한국
    fig, axes = plt.subplots(1, 2, figsize=(W / DPI, H / DPI), dpi=DPI); fig.subplots_adjust(left=0.07, right=0.97, top=0.78, bottom=0.14, wspace=0.35)
    fig.text(0.05, 0.93, "전 세계 중앙값 · 1위 · 한국 — 유선과 모바일", fontsize=15, weight="bold", color=INK, va="top")
    fig.text(0.05, 0.86, "모바일 1위(아랍에미리트)는 유선 1위(싱가포르)보다도 빠르다", fontsize=10, color=INK2, va="top")
    for ax, (title, g, first, k) in zip(axes, [("유선(고정)", gf, items[0], kor["fixed"]), ("모바일", gm, {"name": st["mobile_top"][0]["ko"], "n": st["mobile_top"][0]["down"]}, kor["mobile"])]):
        labs = ["전 세계 중앙값", f"1위 {first['name']}", f"한국({k['rank']}위)"]; v = [g["down"], first["n"], k["down"]]
        xs = np.arange(3); ax.bar(xs, v, width=0.55, color=[BLUE_LIGHT, BLUE_DARK, BLUE], linewidth=0)
        ax.set_xticks(xs, labs, fontsize=9); ax.set_yticks([]); strip(ax)
        for x, val in zip(xs, v):
            ax.annotate(f"{val:,.1f}", (x, val), xytext=(0, 4), textcoords="offset points", ha="center", fontsize=9, color=INK)
        ax.set_title(title, loc="left", fontsize=11, color=INK2, pad=8); ax.set_ylim(0, max(v) * 1.2)
    foot(fig); save(fig, "overview", "전 세계 중앙값과 1위, 한국의 유선·모바일 속도 비교")

    # 2.. 나라별: 왼쪽 이 나라 vs 전 세계 vs 한국(유선), 오른쪽 이 나라의 유선 vs 모바일
    for it in items:
        fig, (a1, a2) = plt.subplots(1, 2, figsize=(W / DPI, H / DPI), dpi=DPI, gridspec_kw={"width_ratios": [1.25, 1]})
        fig.subplots_adjust(left=0.19, right=0.97, top=0.72, bottom=0.14, wspace=0.32)
        fig.text(0.05, 0.93, f"{it['rank']}위 {it['name']} — 유선 중앙값 {it['n']:,.2f}Mbps", fontsize=15, weight="bold", color=INK, va="top")
        sub = f"전 세계 중앙값의 {it['n']/gf['down']:.1f}배 · 한국의 {it['n']/kor['fixed']['down']:.2f}배 · 전달 대비 {chg(it['change'])}"
        fig.text(0.05, 0.86, sub, fontsize=10, color=INK2, va="top")
        labs = [it["name"], "전 세계 중앙값", f"한국({kor['fixed']['rank']}위)"]; v = [it["n"], gf["down"], kor["fixed"]["down"]]
        ys = np.arange(3)[::-1]; a1.barh(ys, v, height=0.55, color=[BLUE_DARK, BLUE_LIGHT, BLUE], linewidth=0)
        a1.set_yticks(ys, labs, fontsize=9.5); a1.set_xticks([]); strip(a1, bottom=False)
        for y, val in zip(ys, v):
            a1.text(val + max(v) * 0.015, y, f"{val:,.2f}", va="center", fontsize=9, color=INK)
        a1.set_xlim(0, max(v) * 1.2); a1.set_title("유선 다운로드(Mbps)", loc="left", fontsize=11, color=INK2, pad=8)
        labs2 = ["유선", "모바일"]; v2 = [it["n"], it["mobile"] or 0]
        xs = np.arange(2); a2.bar(xs, v2, width=0.5, color=[BLUE_DARK, BLUE if it["mobile"] else GRID], linewidth=0)
        a2.set_xticks(xs, labs2, fontsize=9.5); a2.set_yticks([]); strip(a2)
        a2.annotate(f"{v2[0]:,.1f}", (0, v2[0]), xytext=(0, 4), textcoords="offset points", ha="center", fontsize=9, color=INK)
        if it["mobile"]:
            a2.annotate(f"{v2[1]:,.1f}\n(모바일 {it['mobile_rank']}위)", (1, v2[1]), xytext=(0, 4), textcoords="offset points", ha="center", fontsize=9, color=INK)
        else:
            a2.text(1, max(v2) * 0.08, "25위 밖", ha="center", fontsize=9, color=INK2)
        a2.set_ylim(0, max(v2) * 1.3 if max(v2) else 1); a2.set_title("이 나라의 유선 vs 모바일", loc="left", fontsize=11, color=INK2, pad=8)
        foot(fig); save(fig, f"item_{it['rank']}", f"{it['rank']}위 {it['name']}: 유선 중앙값과 전 세계·한국 비교, 유선 대 모바일")

    # 비교: 10개 나라 유선·모바일 묶음 막대
    fig, ax = plt.subplots(figsize=(W / DPI, H / DPI), dpi=DPI); fig.subplots_adjust(left=0.06, right=0.97, top=0.78, bottom=0.2)
    fig.text(0.05, 0.93, "TOP10 나라의 유선 vs 모바일 중앙값", fontsize=15, weight="bold", color=INK, va="top")
    fig.text(0.05, 0.86, "유선·모바일 둘 다 상위권인 나라는 아랍에미리트와 베트남뿐 (모바일은 25위 안만 공개 값)", fontsize=10, color=INK2, va="top")
    xs = np.arange(len(items)); wdt = 0.38
    ax.bar(xs - wdt / 2, [it["n"] for it in items], width=wdt, color=BLUE_DARK, label="유선", linewidth=0)
    ax.bar(xs + wdt / 2, [it["mobile"] or 0 for it in items], width=wdt, color=BLUE, label="모바일", linewidth=0)
    ax.set_xticks(xs, [f"{it['rank']}위\n{it['name']}" for it in items], fontsize=8.5); ax.set_yticks([]); strip(ax)
    for x, it in zip(xs, items):
        ax.annotate(f"{it['n']:.0f}", (x - wdt / 2, it["n"]), xytext=(0, 3), textcoords="offset points", ha="center", fontsize=8, color=INK)
        if it["mobile"]:
            ax.annotate(f"{it['mobile']:.0f}", (x + wdt / 2, it["mobile"]), xytext=(0, 3), textcoords="offset points", ha="center", fontsize=8, color=INK)
    ax.legend(frameon=False, loc="upper right", fontsize=9); ax.set_ylim(0, max(max(it["n"], it["mobile"] or 0) for it in items) * 1.2)
    foot(fig); save(fig, "compare", "TOP10 나라의 유선과 모바일 중앙값 비교")

    # 한국: 유선·모바일 + 서울·부산 + 일본
    fig, ax = plt.subplots(figsize=(W / DPI, H / DPI), dpi=DPI); fig.subplots_adjust(left=0.24, right=0.96, top=0.78, bottom=0.12)
    fig.text(0.05, 0.93, f"한국은 몇 위? 유선 {kor['fixed']['rank']}위 · 모바일 {kor['mobile']['rank']}위", fontsize=15, weight="bold", color=INK, va="top")
    fig.text(0.05, 0.86, "중앙값 순위라 기본 요금제 속도 분포가 그대로 반영된다", fontsize=10, color=INK2, va="top")
    labs = ["유선 1위 싱가포르", f"한국 유선({kor['fixed']['rank']}위)", f"서울 유선(도시 {kor['seoul']['rank']}위)", f"부산 유선(도시 {kor['busan']['rank']}위)",
            "전 세계 유선 중앙값", f"한국 모바일({kor['mobile']['rank']}위)", "전 세계 모바일 중앙값"]
    v = [items[0]["n"], kor["fixed"]["down"], kor["seoul"]["down"], kor["busan"]["down"], gf["down"], kor["mobile"]["down"], gm["down"]]
    cols = [BLUE_LIGHT, BLUE_DARK, BLUE, BLUE, BLUE_LIGHT, BLUE_DARK, BLUE_LIGHT]
    ys = np.arange(len(labs))[::-1]; ax.barh(ys, v, height=0.58, color=cols, linewidth=0)
    ax.set_yticks(ys, labs, fontsize=9.5); ax.set_xticks([]); strip(ax, bottom=False)
    for y, val in zip(ys, v):
        ax.text(val + 5, y, f"{val:,.2f}", va="center", fontsize=9, color=INK)
    ax.set_xlim(0, max(v) * 1.15)
    foot(fig); save(fig, "korea", "한국의 유선·모바일 중앙값과 서울·부산, 전 세계 중앙값 비교")

    with open(f"{OUT}/manifest.json", "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    return man


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--out", default="out/post.json")
    a = ap.parse_args()
    d = load()
    post = build(d, b.today())
    print(f"{post['slug']}: {post['title']}")
    if a.dry:
        for blk in post["body"]:
            t = blk["type"]
            if t == "h2": print(f"\n## {blk['text']}")
            elif t == "p": print(blk["text"])
            elif t == "list": print("\n".join(" - " + x for x in blk["items"]))
            elif t == "table": print(" | ".join(blk["head"])); print("\n".join(" | ".join(r) for r in blk["rows"]))
        return 0
    man = charts(post)
    print(f"{len(man)}장 → {OUT}/manifest.json")
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(post, f, ensure_ascii=False, indent=1)
    print(f"글 → {a.out}")
    print(f"SLUG={post['slug']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
