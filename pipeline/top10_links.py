"""
top10_links.py — TOP10 글의 순위 절마다 붙이는 '그 항목의' 공식 사이트(자격 시험·협회·부처·시도청).
절마다 같은 나라일터 링크만 반복하지 않도록, 항목에 맞는 원 자료 하나·둘을 고른다. 주소는 러너 탐침(probe_pages.py head:)으로
살아 있는 것을 확인한 것만 둔다. 없으면 빈 목록 — 그 절은 출처 줄(나라일터·잡알리오)만 남는다.

  for_item(entity, topic, item) -> [(이름, 주소), …]
"""

from __future__ import annotations

KUKSIWON = ("한국보건의료인국가시험원 — 면허 국가시험 일정·응시 자격", "https://www.kuksiwon.or.kr")
QNET = ("큐넷 — 관련 국가기술자격 시험 일정", "https://www.q-net.or.kr")
GOSI = ("사이버국가고시센터 — 국가직 공채 시험 공고·과목", "https://www.gosi.kr")
LOCAL_GOSI = ("지방자치단체 인터넷원서접수센터 — 지방직 시험 공고·원서", "https://local.gosi.go.kr")
MOE = ("교육부 — 교원·교육공무직 정책", "https://www.moe.go.kr")
MOHW = ("보건복지부 — 보건·복지 인력 정책", "https://www.mohw.go.kr")
MOJ = ("법무부 — 소속기관 채용·업무 안내", "https://www.moj.go.kr")
NL = ("국립중앙도서관 — 사서 업무·도서관 정책", "https://www.nl.go.kr")

# 직무·직렬·의료 직종(낱말 묶음 key) — 같은 key 를 여러 주제가 함께 쓴다
KEYWORD = {
    "doctor": [KUKSIWON, ("국립중앙의료원 — 공공의료 채용·공공보건의료 안내", "https://www.nmc.or.kr")],
    "nurse": [KUKSIWON, ("대한간호협회 — 간호사 면허·보수교육", "https://www.koreanurse.or.kr")],
    "aide": [KUKSIWON],
    "pharma": [KUKSIWON, ("대한약사회 — 약사 면허·근무 분야", "https://www.kpanet.or.kr")],
    "medtech": [KUKSIWON, ("대한임상병리사협회 — 임상병리사 업무·교육", "https://www.kamt.or.kr")],
    "radio": [KUKSIWON, ("대한방사선사협회 — 방사선사 업무·교육", "https://www.krta.or.kr")],
    "therapy": [KUKSIWON, ("대한물리치료사협회 — 물리치료사 업무·교육", "https://www.kpta.co.kr")],
    "nutrition": [KUKSIWON, ("대한영양사협회 — 영양사 업무·급식 기준", "https://www.dietitian.or.kr")],
    "dental": [KUKSIWON, ("대한치과위생사협회 — 치과위생사 업무·교육", "https://www.kdha.or.kr")],
    "emt": [KUKSIWON, ("소방청 — 구급대원·119 구급 업무", "https://www.nfa.go.kr")],
    "care": [KUKSIWON, ("국민건강보험공단 노인장기요양보험 — 요양기관·요양보호사", "https://www.longtermcare.or.kr")],
    "health-mgr": [("한국산업안전보건공단 — 보건관리자 선임·업무", "https://www.kosha.or.kr")],
    "librarian": [NL, ("한국도서관협회 — 사서 자격·도서관 채용", "https://www.kla.kr")],
    "library": [NL, ("한국도서관협회 — 사서 자격·도서관 채용", "https://www.kla.kr")],
    "cook": [("식품의약품안전처 — 집단급식소 위생 기준", "https://www.mfds.go.kr"), QNET],
    "cleaning": [("고용24 — 직업 정보·채용 공고", "https://www.work24.go.kr")],
    "driver": [("한국교통안전공단 — 운전 자격·운수 종사자 교육", "https://www.kotsa.or.kr"), ("도로교통공단 — 운전면허 종류·갱신", "https://www.koroad.or.kr")],
    "guard": [("경찰청 — 청원경찰·경비 업무 안내", "https://www.police.go.kr")],
    "it": [("한국인터넷진흥원 — 정보보호 인력·자격", "https://www.kisa.or.kr"), QNET],
    "research": [("국가과학기술연구회 — 출연연 채용·연구기관", "https://www.nst.re.kr")],
    "welfare": [("한국사회복지사협회 — 사회복지사 자격·보수교육", "https://www.welfare.net"), MOHW],
    "teacher-temp": [MOE],
    "lecturer": [MOE],
    "ta": [MOE],
    "childcare": [("한국보육진흥원 — 보육교사 자격·평가", "https://www.kcpi.or.kr")],
    "counsel": [("한국청소년상담복지개발원 — 상담 인력·청소년 상담", "https://www.kyci.or.kr")],
    "youth": [("한국청소년활동진흥원 — 청소년지도사·활동 시설", "https://www.kywa.or.kr"), ("한국청소년상담복지개발원 — 청소년상담사", "https://www.kyci.or.kr")],
    "lang": [("한국문학번역원 — 번역 아카데미·번역 지원", "https://www.ltikorea.or.kr")],
    "interp": [("한국문학번역원 — 번역 아카데미·번역 지원", "https://www.ltikorea.or.kr")],
    "clerical": [("NCS 국가직무능력표준 — 사무·행정 직무기술서", "https://www.ncs.go.kr")],
    "intern": [("온통청년 — 청년 일경험·인턴 정책", "https://www.youthcenter.go.kr")],
    "public-worker": [("고용노동부 — 공무직(무기계약직) 근로조건", "https://www.moel.go.kr")],
    "term-official": [GOSI, ("인사혁신처 — 임기제·개방형 직위 제도", "https://www.mpm.go.kr")],
    "facility": [("한국전기안전공사 — 전기안전관리자 업무", "https://www.kesco.or.kr"), QNET],
    "postal": [("우정사업본부 — 집배·우편 업무와 채용", "https://www.koreapost.go.kr")],
    "martial": [MOJ],
    # 공무원 직렬
    "police": [("경찰청 — 경찰공무원 채용 안내", "https://www.police.go.kr")],
    "facility-mech": [GOSI, QNET],
    "env": [("기후에너지환경부 — 환경직 업무", "https://www.me.go.kr")],
    "admin": [GOSI, LOCAL_GOSI],
    "marine": [("해양수산부 — 해양수산직 업무", "https://www.mof.go.kr")],
    "health": [MOHW, LOCAL_GOSI],
    "pr": [GOSI],
    "green": [("산림청 — 산림직 업무·산림 일자리", "https://www.forest.go.kr")],
    "legal": [MOJ],
    "justice": [("법무부 교정본부 — 교정직 업무·채용", "https://www.corrections.go.kr"), MOJ],
    "curator": [("국립중앙박물관 — 학예연구직 업무", "https://www.museum.go.kr"), ("국가기록원 — 기록연구직 업무", "https://www.archives.go.kr")],
    "industry": [GOSI, QNET],
    "agri": [("농림축산식품부 — 농업·축산직 업무", "https://www.mafra.go.kr")],
    "stat": [("국가통계포털 KOSIS — 통계직이 만드는 국가통계", "https://kosis.kr")],
    "build": [("국토교통부 — 건축·토목 정책", "https://www.molit.go.kr"), QNET],
    "tax": [("국세청 — 세무직 업무", "https://www.nts.go.kr"), ("관세청 — 관세직 업무", "https://www.customs.go.kr")],
    "fire": [("소방청 — 소방공무원 채용 안내", "https://www.nfa.go.kr")],
}

# 시·도 — 항목 이름(짧은 이름·정식 이름 모두)으로 찾는다
REGION = {
    "서울": "https://www.seoul.go.kr", "부산": "https://www.busan.go.kr", "대구": "https://www.daegu.go.kr",
    "인천": "https://www.incheon.go.kr", "광주": "https://www.gwangju.go.kr", "대전": "https://www.daejeon.go.kr",
    "울산": "https://www.ulsan.go.kr", "세종": "https://www.sejong.go.kr", "경기": "https://www.gg.go.kr",
    "강원": "https://state.gwd.go.kr", "충청북도": "https://www.chungbuk.go.kr", "충북": "https://www.chungbuk.go.kr",
    "충청남도": "https://www.chungnam.go.kr", "충남": "https://www.chungnam.go.kr", "전북": "https://www.jeonbuk.go.kr",
    "전라북도": "https://www.jeonbuk.go.kr", "전라남도": "https://www.jeonnam.go.kr", "전남": "https://www.jeonnam.go.kr",
    "경상북도": "https://www.gb.go.kr", "경북": "https://www.gb.go.kr", "경상남도": "https://www.gyeongnam.go.kr",
    "경남": "https://www.gyeongnam.go.kr", "제주": "https://www.jeju.go.kr",
}

# 중앙부처·소속기관·국립대 — 기관 이름 앞부분으로 찾는다(긴 이름부터)
ORG = {
    "외교부": "https://www.mofa.go.kr", "조달청": "https://www.pps.go.kr", "국방부": "https://www.mnd.go.kr",
    "공정거래위원회": "https://www.ftc.go.kr", "행정안전부": "https://www.mois.go.kr", "기획예산처": "https://www.mpb.go.kr",
    "재정경제부": "https://www.mofe.go.kr", "법무부": "https://www.moj.go.kr", "보건복지부": "https://www.mohw.go.kr",
    "고용노동부": "https://www.moel.go.kr", "국토교통부": "https://www.molit.go.kr", "해양수산부": "https://www.mof.go.kr",
    "농림축산식품부": "https://www.mafra.go.kr", "교육부": "https://www.moe.go.kr", "문화체육관광부": "https://www.mcst.go.kr",
    "과학기술정보통신부": "https://www.msit.go.kr", "국세청": "https://www.nts.go.kr", "관세청": "https://www.customs.go.kr",
    "경찰청": "https://www.police.go.kr", "소방청": "https://www.nfa.go.kr", "해양경찰청": "https://www.kcg.go.kr",
    "산림청": "https://www.forest.go.kr", "기상청": "https://www.kma.go.kr", "질병관리청": "https://www.kdca.go.kr",
    "식품의약품안전처": "https://www.mfds.go.kr", "인사혁신처": "https://www.mpm.go.kr", "병무청": "https://www.mma.go.kr",
    "국가보훈부": "https://www.mpva.go.kr", "통일부": "https://www.unikorea.go.kr", "국가데이터처": "https://kosis.kr",
    "국방부 국군조직 육군": "https://www.army.mil.kr", "국방부 국군조직 해군": "https://www.navy.mil.kr",
    "국방부 국군조직 공군": "https://www.airforce.mil.kr",
    "충남대학교": "https://plus.cnu.ac.kr", "제주대학교": "https://www.jejunu.ac.kr", "서울대학교": "https://www.snu.ac.kr",
    "부산대학교": "https://www.pusan.ac.kr", "경북대학교": "https://www.knu.ac.kr", "전남대학교": "https://www.jnu.ac.kr",
    "충북대학교": "https://www.chungbuk.ac.kr", "강원대학교": "https://www.kangwon.ac.kr", "전북대학교": "https://www.jbnu.ac.kr",
    "경상국립대학교": "https://www.gnu.ac.kr",
}


def for_item(entity: str, topic: str, it: dict) -> list[tuple[str, str]]:
    name = (it.get("full_name") or it.get("name") or "").strip()
    if entity == "keyword":
        return list(KEYWORD.get(it.get("key", ""), []))
    if entity == "region":
        for k in sorted(REGION, key=len, reverse=True):
            if name.startswith(k) or it.get("name", "").startswith(k):
                return [(f"{name} 누리집 — 시·도 채용·시험 공고", REGION[k])]
        return []
    if entity == "org":
        for k in sorted(ORG, key=len, reverse=True):
            if name.startswith(k):
                return [(f"{k} 누리집 — 기관 소개·채용 공지", ORG[k])]
        return []
    return []


def all_urls() -> list[str]:
    """탐침으로 한꺼번에 확인할 주소 목록."""
    urls = {u for v in KEYWORD.values() for _, u in v} | set(REGION.values()) | set(ORG.values())
    return sorted(urls)
