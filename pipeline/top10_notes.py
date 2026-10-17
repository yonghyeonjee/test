"""
top10_notes.py — 직무·직렬마다 "어려운 점"을 심리 개념과 함께 적은 자료. top10.py(jiwon 글)와 tistory_top10.py(티스토리 글)가 쓴다.

구조: HARD[묶음][key] = {"hard": 어려운 점(2~3문장), "psy": [개념 키, ...]}
개념 키는 PSY 에 있다 — 이름, 한 줄 설명, jeepedia(우리 심리 사이트) 글 주소. 글에서는 "관련 심리: 번아웃 → 자가진단" 식으로 링크한다.
사실이 아닌 수치는 쓰지 않는다. 일반적으로 알려진 직무 특성과 심리학 개념만 적는다.
"""

JEEPEDIA = "https://jeepedia.com/psychology-test/"

PSY: dict[str, dict] = {
    "burnout":   {"name": "번아웃(소진)", "desc": "오래 지속된 직무 스트레스가 정서적 고갈·냉소·효능감 저하로 이어지는 상태. 매슬랙 소진 척도로 잰다.", "href": f"{JEEPEDIA}burnout/", "label": "번아웃 자가진단(16문항, 2분)"},
    "emotion":   {"name": "감정노동", "desc": "느끼는 감정과 다르게 표정·말투를 관리해야 하는 노동. 표면 연기가 길어지면 소진이 빨라진다.", "href": f"{JEEPEDIA}burnout/", "label": "번아웃 자가진단"},
    "shift":     {"name": "교대근무와 생체리듬", "desc": "야간·교대 근무는 수면 리듬을 깨뜨려 피로·실수·기분 저하를 키운다. 내 수면 성향을 알면 회복 전략을 세울 수 있다.", "href": f"{JEEPEDIA}rank-sleep/", "label": "수면 성향 테스트"},
    "conflict":  {"name": "대인 갈등과 민원 스트레스", "desc": "반복되는 항의·갈등 상황은 통제감을 떨어뜨린다. 내 갈등 대처 유형(회피·경쟁·협력)을 알면 소모가 줄어든다.", "href": f"{JEEPEDIA}rank-conflict/", "label": "갈등 대처 유형 테스트"},
    "insecure":  {"name": "고용 불안정 스트레스", "desc": "계약 만료가 정해진 일은 '다음 자리' 걱정이 일 자체보다 더 큰 스트레스가 된다. 경력 연결 계획이 완충재가 된다.", "href": f"{JEEPEDIA}big-five-personality-workplace-job-satisfaction/", "label": "직장인 성격 유형·직무 만족 테스트"},
    "ambiguity": {"name": "역할 모호성·과부하", "desc": "무엇을 어디까지 해야 하는지 불분명하거나 한 사람에게 일이 몰리면 효능감이 떨어진다.", "href": f"{JEEPEDIA}rank-work/", "label": "업무 스타일 테스트"},
    "autonomy":  {"name": "자율성 부족(요구-통제 모델)", "desc": "요구는 높은데 결정권이 적은 일이 스트레스가 가장 크다. 작은 재량이라도 확보하는 것이 보호 요인이다.", "href": f"{JEEPEDIA}rank-work/", "label": "업무 스타일 테스트"},
    "trauma":    {"name": "2차 외상·공감 피로", "desc": "타인의 고통을 가까이서 듣고 다루는 일은 본인에게도 외상 반응을 남긴다. 정기적인 수퍼비전과 휴식이 필요하다.", "href": f"{JEEPEDIA}burnout/", "label": "번아웃 자가진단"},
    "monotony":  {"name": "단조로움과 지루함", "desc": "같은 동작·같은 화면이 반복되면 주의가 흩어지고 실수가 는다. 일의 의미를 찾는 재구성(잡 크래프팅)이 도움이 된다.", "href": f"{JEEPEDIA}sixteen-types/", "label": "16가지 성향 테스트"},
    "isolation": {"name": "사회적 고립", "desc": "혼자 하는 현장 업무는 지지 자원이 적어 스트레스가 쌓인다. 동료 연결망을 의식적으로 만들어야 한다.", "href": f"{JEEPEDIA}sixteen-types/", "label": "16가지 성향 테스트"},
    "physical":  {"name": "신체 피로와 안전 불안", "desc": "서서 하는 일·무거운 것을 드는 일은 몸의 피로가 정서로 번진다. 회복 시간이 성과보다 먼저다.", "href": f"{JEEPEDIA}rank-sleep/", "label": "수면 성향 테스트"},
    "fit":       {"name": "적성 불일치", "desc": "성격과 일의 성격이 어긋나면 같은 일도 더 소모된다. 빅파이브로 어떤 일이 맞는지 가늠할 수 있다.", "href": f"{JEEPEDIA}big-five-personality-workplace-job-satisfaction/", "label": "직장인 성격 유형 테스트"},
}

HARD: dict[str, dict[str, dict]] = {
    # ── blog_daily.ROLES 의 key ──
    "roles": {
        "public-worker": {"hard": "정년이 보장되는 대신 승진·보수 체계가 단순해 '해도 달라지지 않는다'는 느낌이 쌓이기 쉽습니다. 민원 접점에 서는 자리가 많아 감정노동이 크고, 공무원과 같은 공간에서 다른 처우를 받는 데서 오는 소외감도 흔한 고충입니다.", "psy": ["emotion", "autonomy", "burnout"]},
        "term-official": {"hard": "임기가 정해져 있어 계약 만료 1년 전부터 다음 자리를 찾아야 하는 압박이 일 자체보다 큽니다. 전문직으로 뽑혔지만 조직 안에서 결정권은 작아 역할 모호성과 자율성 부족을 함께 겪습니다.", "psy": ["insecure", "autonomy", "ambiguity"]},
        "teacher-temp": {"hard": "학기 단위 계약이라 매 학기 채용 시장에 다시 서야 하고, 정교사와 같은 수업·담임 업무를 하면서도 신분이 다릅니다. 학생·학부모 응대에서 오는 감정노동과 고용 불안이 겹쳐 소진이 빠른 직무입니다.", "psy": ["insecure", "emotion", "burnout"]},
        "clerical": {"hard": "민원 창구와 문서 업무가 동시에 몰려 역할 과부하가 잦습니다. 성과가 눈에 띄지 않아 인정받기 어렵고, 반복 업무가 많아 지루함과 효능감 저하가 함께 옵니다.", "psy": ["ambiguity", "conflict", "monotony"]},
        "lecturer": {"hard": "시간제라 수입이 학기마다 달라지고 여러 기관을 오가며 시간표를 채워야 합니다. 강의 준비 시간은 보수에 잡히지 않아 보이지 않는 노동이 쌓이고, 평가에 따라 다음 학기 계약이 갈립니다.", "psy": ["insecure", "ambiguity", "burnout"]},
        "intern": {"hard": "몇 달짜리 자리라 일을 익힐 즈음 끝나고, 정규직 전환이 거의 없어 '경력이 될까' 하는 불안이 큽니다. 보조 업무 위주라 의미를 찾기 어렵고 소속감도 약합니다.", "psy": ["insecure", "monotony", "fit"]},
        "research": {"hard": "과제 단위 계약이라 연구비가 끊기면 자리도 끊깁니다. 성과 압박과 긴 호흡의 연구 사이에서 번아웃이 오기 쉽고, 혼자 하는 작업이 많아 고립감도 큽니다.", "psy": ["insecure", "burnout", "isolation"]},
        "facility": {"hard": "야간·휴일 당직과 비상 호출이 있어 생체리듬이 흔들립니다. 사고가 나면 책임이 집중되는 안전 불안이 상시적이고, 문제가 없을 때는 존재가 보이지 않는 일입니다.", "psy": ["shift", "physical", "autonomy"]},
        "postal": {"hard": "하루 종일 혼자 오토바이나 차량으로 이동하는 신체 노동이고, 날씨와 물량에 따라 업무량이 크게 출렁입니다. 배달 지연 민원과 안전사고 위험이 겹쳐 긴장이 풀리지 않습니다.", "psy": ["physical", "isolation", "conflict"]},
        "guard": {"hard": "24시간 교대와 야간 근무로 수면이 무너지기 쉽고, 출입 통제 과정에서 언쟁과 항의를 자주 겪습니다. 사건이 없는 긴 시간의 단조로움과 사건이 터졌을 때의 긴장이 극단적으로 오갑니다.", "psy": ["shift", "conflict", "monotony"]},
        "cook": {"hard": "새벽 출근과 점심 전 집중 노동으로 몸의 피로가 크고, 화상·미끄럼 같은 안전 위험이 상존합니다. 위생 점검과 식수 변동 압박이 있고, 학교 급식은 방학 중 무급 기간이 생활 불안을 만듭니다.", "psy": ["physical", "insecure", "ambiguity"]},
        "cleaning": {"hard": "이른 새벽 근무와 반복되는 신체 노동이 기본이고, 일한 흔적이 '깨끗함'이라 눈에 띄지 않아 인정받기 어렵습니다. 단시간 근로 공고가 많아 소득이 불안정합니다.", "psy": ["physical", "monotony", "insecure"]},
        "counsel": {"hard": "하루 종일 타인의 고통과 분노를 받아내는 일이라 공감 피로와 2차 외상이 쌓입니다. 상담 성과가 바로 보이지 않고, 콜센터형 상담은 응대 건수 압박까지 더해집니다.", "psy": ["trauma", "emotion", "burnout"]},
        "childcare": {"hard": "아이의 안전을 한순간도 놓칠 수 없는 긴장이 하루 종일 이어지고, 학부모 응대에서 감정노동이 큽니다. 행정 서류와 평가 준비가 보육 시간 밖으로 밀려 초과 노동이 됩니다.", "psy": ["emotion", "ambiguity", "burnout"]},
        "driver": {"hard": "장시간 운전의 신체 피로와 사고 책임 부담이 크고, 대기 시간이 길어 하루가 늘어집니다. 탑승자 응대에서 오는 감정노동이 운전 집중을 방해하기도 합니다.", "psy": ["physical", "monotony", "conflict"]},
        "doctor": {"hard": "공공병원은 인력이 적어 당직과 외래가 겹치고, 환자 수에 비해 결정권은 제한됩니다. 생명을 다루는 결정 피로와 의료 분쟁 불안이 소진을 앞당깁니다.", "psy": ["burnout", "shift", "autonomy"]},
        "it": {"hard": "전산 장애는 밤낮을 가리지 않아 대기 상태가 길고, 문제가 없을 때는 일이 보이지 않습니다. 보안 사고의 책임은 크지만 예산·인력 결정권은 작아 요구와 통제가 어긋나는 전형적인 자리입니다.", "psy": ["autonomy", "shift", "ambiguity"]},
        "librarian": {"hard": "조용해 보이지만 이용자 민원과 야간·주말 개관이 있고, 한 사람이 자료·행사·행정을 모두 맡는 소규모 도서관이 많습니다. 전문성이 인정되지 않는다는 좌절이 흔합니다.", "psy": ["ambiguity", "conflict", "fit"]},
        "nurse": {"hard": "3교대와 야간 근무가 수면과 식사를 무너뜨리고, 환자·보호자 응대의 감정노동이 큽니다. 인력 부족으로 한 사람이 맡는 환자 수가 많아 번아웃이 가장 빨리 오는 직군 가운데 하나입니다.", "psy": ["shift", "emotion", "burnout"]},
        "nutrition": {"hard": "급식 사고의 책임은 영양사에게 집중되는데 조리 인력 관리와 식자재 예산까지 혼자 맡는 경우가 많습니다. 식단 민원과 위생 점검 압박이 겹쳐 역할 과부하가 큽니다.", "psy": ["ambiguity", "conflict", "burnout"]},
        "welfare": {"hard": "위기 가구를 직접 대하며 타인의 고통을 흡수하는 일이라 공감 피로가 큽니다. 행정 서류와 실적 보고가 돌봄 시간을 잠식하고, 폭언·위협을 겪는 경우도 적지 않습니다.", "psy": ["trauma", "emotion", "burnout"]},
        "survey": {"hard": "현장을 혼자 다니는 기간제 일이라 고립감이 크고, 조사 거부와 항의를 반복해서 겪습니다. 조사 기간이 끝나면 계약도 끝나 소득이 끊깁니다.", "psy": ["isolation", "conflict", "insecure"]},
        "youth": {"hard": "저녁·주말 프로그램이 많아 생활 리듬이 뒤집히고, 위기 청소년을 대할 때 2차 외상이 생깁니다. 재단 예산에 따라 자리가 흔들리는 고용 불안도 있습니다.", "psy": ["shift", "trauma", "insecure"]},
        "ta": {"hard": "임기 1~2년에 학과 행정·교수 지원·학생 응대를 한 사람이 맡아 역할이 모호합니다. 다음 진로(대학원·취업) 준비와 병행해야 해 시간 압박이 큽니다.", "psy": ["ambiguity", "insecure", "fit"]},
        "psy": {"hard": "교정·보호 시설에서 심리 검사와 상담을 하며 강한 분노·외상 이야기를 매일 듣습니다. 수퍼비전이 부족한 기관이 많아 공감 피로가 개인 몫이 되기 쉽습니다.", "psy": ["trauma", "burnout", "isolation"]},
        "medtech": {"hard": "검사 결과의 정확성에 대한 압박이 크고, 응급 검사로 야간 호출이 있습니다. 환자와 직접 만나지 않는 자리는 성과가 보이지 않아 인정 결핍을 느끼기 쉽습니다.", "psy": ["shift", "monotony", "ambiguity"]},
        "pharma": {"hard": "조제 오류는 곧 사고라는 긴장이 상시적이고, 공공병원은 야간·주말 약사가 혼자인 경우가 많습니다. 반복 조제의 단조로움과 고도의 주의가 동시에 요구됩니다.", "psy": ["monotony", "shift", "burnout"]},
        "therapy": {"hard": "환자 몸을 직접 다루는 신체 노동이고, 재활은 호전이 느려 효능감이 늦게 옵니다. 하루 치료 건수 압박이 있는 기관에서는 소진이 빠릅니다.", "psy": ["physical", "burnout", "autonomy"]},
        "lang": {"hard": "통역은 실시간 인지 부하가 매우 크고, 번역은 마감이 몰립니다. 기관 안에 같은 직무 동료가 거의 없어 고립감과 평가 기준의 모호함을 함께 겪습니다.", "psy": ["isolation", "ambiguity", "burnout"]},
        "martial": {"hard": "보호관찰 대상자를 지도·호송하며 물리적 충돌 위험에 노출됩니다. 교대 근무와 긴장 상태가 길고, 대상자의 재범을 보면서 무력감을 느끼기 쉽습니다.", "psy": ["shift", "trauma", "conflict"]},
    },
    # ── top10.CIVIL 의 key ──
    "civil": {
        "police": {"hard": "교대와 야간 근무가 기본이고 사건 현장에서 폭언·폭력, 참혹한 장면을 반복해 겪습니다. 외상 노출과 수면 부족이 겹치는 대표적인 고위험 직렬입니다.", "psy": ["shift", "trauma", "burnout"]},
        "research": {"hard": "연구와 행정 보고를 동시에 하며 성과 평가를 받습니다. 과제 수주에 따라 연구 방향이 바뀌어 자율성이 제한되고, 전문성과 공무원 체계가 부딪히는 좌절이 흔합니다.", "psy": ["autonomy", "burnout", "isolation"]},
        "facility-mech": {"hard": "설비 고장은 밤낮이 없어 비상 호출과 당직이 잦고, 사고 시 책임이 집중됩니다. 문제 없이 돌아갈 때는 존재가 보이지 않아 인정받기 어렵습니다.", "psy": ["shift", "physical", "ambiguity"]},
        "guard": {"hard": "청사 출입 통제에서 언쟁과 항의가 반복되고, 야간·휴일 교대가 많습니다. 긴 대기의 단조로움과 돌발 상황의 긴장이 극단적으로 오갑니다.", "psy": ["shift", "conflict", "monotony"]},
        "env": {"hard": "단속·점검 현장에서 사업주와 갈등이 잦고, 환경 민원은 해결이 느려 반복 항의를 받습니다. 야외 현장과 사무 보고가 겹쳐 과부하가 큽니다.", "psy": ["conflict", "ambiguity", "physical"]},
        "admin": {"hard": "민원 창구에서 감정노동이 크고, 순환보직으로 2~3년마다 전혀 다른 일을 새로 배워야 합니다. 의사결정 권한은 위에 있고 책임은 아래로 오는 구조가 스트레스를 키웁니다.", "psy": ["emotion", "autonomy", "conflict"]},
        "marine": {"hard": "선박·항만 현장은 기상에 좌우되고 장기 승선이나 교대가 있어 가정생활과 리듬이 어긋납니다. 안전사고 위험이 상존하는 신체 노동입니다.", "psy": ["shift", "physical", "isolation"]},
        "it": {"hard": "전산 장애와 보안 사고는 시간을 가리지 않아 대기 상태가 길고, 예산·인력은 적은데 책임은 큽니다. 비전공 상사에게 상황을 설명해야 하는 소통 부담도 큽니다.", "psy": ["autonomy", "shift", "ambiguity"]},
        "health": {"hard": "보건소·검역소는 감염병 상황에 인력이 그대로 투입돼 과로가 집중됩니다. 민원과 행정 보고가 많아 임상 전문성을 쓰지 못한다는 좌절이 흔합니다.", "psy": ["burnout", "emotion", "fit"]},
        "pr": {"hard": "언론 대응은 밤낮과 주말이 없고, 부정 기사 하나에 조직 전체의 압박이 홍보 담당에게 쏠립니다. 성과를 수치로 증명하기 어려워 인정 결핍이 큽니다.", "psy": ["shift", "ambiguity", "burnout"]},
        "driver": {"hard": "장시간 대기와 운전이 반복되고 사고 책임 부담이 큽니다. 상급자 일정에 맞춰 근무 시간이 늘어나 생활이 불규칙해집니다.", "psy": ["monotony", "physical", "autonomy"]},
        "green": {"hard": "산불·병해충 같은 비상 상황에 휴일 없이 투입되고, 산지 현장 근무의 신체 부담이 큽니다. 지역 주민과 개발·보전을 두고 갈등을 겪습니다.", "psy": ["physical", "conflict", "shift"]},
        "legal": {"hard": "소송·자문 업무가 몰리고 결과에 대한 책임이 무겁지만 조직의 결정을 뒤집을 권한은 적습니다. 변호사 자격자가 임기제로 일하며 느끼는 신분 불안도 큽니다.", "psy": ["autonomy", "insecure", "burnout"]},
        "justice": {"hard": "교도소·소년원 근무는 폭력 위험과 교대 근무, 폐쇄된 공간이 겹칩니다. 대상자의 재범을 보며 무력감을 느끼기 쉽고 외상 노출도 잦습니다.", "psy": ["trauma", "shift", "burnout"]},
        "curator": {"hard": "전시·기록 업무에 행사 운영과 행정이 얹혀 한 사람이 여러 역할을 맡습니다. 전문성에 비해 인원이 적어 고립되고, 학예 자격의 가치가 조직에서 인정되지 않는다고 느끼기 쉽습니다.", "psy": ["ambiguity", "isolation", "fit"]},
        "industry": {"hard": "전기·설비 안전 사고의 책임이 집중되고, 점검은 야간·휴일에 하는 경우가 많습니다. 사고가 없을 때는 일이 보이지 않습니다.", "psy": ["shift", "physical", "ambiguity"]},
        "agri": {"hard": "농가 현장 방문과 가축 질병 방역 때 휴일 없는 투입이 반복됩니다. 재해·질병 발생 시 농가의 분노를 직접 받는 감정노동이 큽니다.", "psy": ["physical", "emotion", "shift"]},
        "stat": {"hard": "조사 현장에서 응답 거부와 항의를 반복해서 겪고, 조사 기간에는 업무가 폭증합니다. 데이터 정확성 압박과 단조로운 입력 작업이 함께 있습니다.", "psy": ["conflict", "monotony", "ambiguity"]},
        "library": {"hard": "야간·주말 개관과 이용자 민원이 있고, 작은 도서관은 한 사람이 모든 일을 맡습니다. 전문직인데 단순 대출 업무로만 보는 시선에서 오는 좌절이 흔합니다.", "psy": ["ambiguity", "conflict", "fit"]},
        "build": {"hard": "공사 현장과 인허가 민원 사이에서 갈등이 크고, 안전사고의 책임이 무겁습니다. 공기 압박과 야외 현장 근무가 신체·정신 피로를 함께 키웁니다.", "psy": ["conflict", "physical", "burnout"]},
        "tax": {"hard": "납세자 항의와 체납 처분 현장의 갈등이 일상이고, 신고 기간에는 업무가 폭증합니다. 숫자 하나의 실수가 큰 문제가 되는 긴장이 상시적입니다.", "psy": ["conflict", "emotion", "burnout"]},
        "fire": {"hard": "24시간 교대와 출동 대기, 참혹한 현장 노출이 반복됩니다. 외상 후 스트레스와 수면 장애 위험이 가장 큰 직렬 가운데 하나입니다.", "psy": ["trauma", "shift", "burnout"]},
        "welfare": {"hard": "위기 가구와 급여 민원을 혼자 감당하며 폭언·위협에 노출되는 일이 잦습니다. 담당 가구 수가 많아 사례관리를 깊이 하지 못한다는 죄책감이 소진으로 이어집니다.", "psy": ["trauma", "emotion", "burnout"]},
        "interp": {"hard": "실시간 통역의 인지 부하가 크고 실수가 외교·법적 문제로 번질 수 있다는 긴장이 있습니다. 기관 안에 같은 직무 동료가 거의 없어 고립감이 큽니다.", "psy": ["isolation", "burnout", "ambiguity"]},
    },
    # ── top10.MEDICAL ──
    "medical": {
        "doctor": {"hard": "공공병원은 인력이 적어 외래·당직이 겹치고, 생명을 다루는 결정 피로가 큽니다. 의료 분쟁 불안과 제한된 결정권이 소진을 앞당깁니다.", "psy": ["burnout", "shift", "autonomy"]},
        "nurse": {"hard": "3교대와 야간 근무가 수면을 무너뜨리고 환자·보호자 응대의 감정노동이 큽니다. 담당 환자 수가 많아 번아웃이 가장 빨리 오는 직군입니다.", "psy": ["shift", "emotion", "burnout"]},
        "aide": {"hard": "간호사와 같은 현장에서 보조 업무를 맡지만 처우와 인정이 다릅니다. 신체 노동과 교대 근무, 역할 경계의 모호함이 겹칩니다.", "psy": ["physical", "ambiguity", "shift"]},
        "pharma": {"hard": "조제 오류는 곧 사고라는 긴장이 상시적이고, 야간·주말에 혼자 근무하는 자리가 많습니다. 반복 조제의 단조로움과 높은 주의가 동시에 요구됩니다.", "psy": ["monotony", "shift", "burnout"]},
        "medtech": {"hard": "검사 정확성 압박과 응급 야간 호출이 있고, 환자를 직접 보지 않아 성과가 드러나지 않습니다.", "psy": ["shift", "monotony", "ambiguity"]},
        "radio": {"hard": "방사선 피폭 관리와 장비 사고 책임이 있고, 응급 촬영으로 야간 호출이 잦습니다. 검사 대기 민원을 직접 받습니다.", "psy": ["shift", "conflict", "physical"]},
        "therapy": {"hard": "환자 몸을 직접 다루는 신체 노동이고 재활은 호전이 느려 효능감이 늦게 옵니다. 하루 치료 건수 압박이 소진을 키웁니다.", "psy": ["physical", "burnout", "autonomy"]},
        "nutrition": {"hard": "급식 사고 책임이 집중되고 조리 인력 관리·예산·위생 점검을 혼자 맡는 경우가 많습니다.", "psy": ["ambiguity", "conflict", "burnout"]},
        "dental": {"hard": "같은 자세로 장시간 진료를 보조해 근골격계 부담이 크고, 치료 공포가 있는 환자를 달래는 감정노동이 있습니다.", "psy": ["physical", "emotion", "monotony"]},
        "emt": {"hard": "출동 대기와 교대 근무, 참혹한 현장 노출이 반복돼 외상 후 스트레스 위험이 큽니다. 이송 중 결정의 무게가 혼자에게 실립니다.", "psy": ["trauma", "shift", "burnout"]},
        "care": {"hard": "어르신의 신체를 직접 돌보는 중노동이고, 폭언·치매 증상 대응에서 감정노동이 큽니다. 임종을 반복해서 겪는 상실감도 쌓입니다.", "psy": ["physical", "emotion", "trauma"]},
        "health-mgr": {"hard": "사업장 안전·보건을 혼자 책임지며 현장과 경영진 사이에서 갈등을 중재합니다. 사고가 나면 책임이 집중됩니다.", "psy": ["ambiguity", "conflict", "autonomy"]},
    },
    # ── top10.EDUCATION ──
    "education": {
        "teacher-temp": {"hard": "학기 단위 계약으로 매 학기 다시 지원해야 하고, 정교사와 같은 담임·수업을 하면서도 신분이 다릅니다. 학부모 응대의 감정노동이 겹칩니다.", "psy": ["insecure", "emotion", "burnout"]},
        "lecturer": {"hard": "시간제라 수입이 불안정하고 강의 준비 시간은 보수에 잡히지 않습니다. 평가에 따라 다음 학기 계약이 갈립니다.", "psy": ["insecure", "ambiguity", "burnout"]},
        "cook": {"hard": "새벽 출근과 점심 전 집중 노동, 화상·미끄럼 위험이 있고 방학 중 무급 기간이 생활 불안을 만듭니다.", "psy": ["physical", "insecure", "ambiguity"]},
        "care": {"hard": "하교 후 아이들의 안전을 혼자 맡아 긴장이 이어지고, 학부모 요구와 학교 행정 사이에서 역할이 모호합니다.", "psy": ["emotion", "ambiguity", "isolation"]},
        "special": {"hard": "장애 학생의 신체 지원과 돌발 행동 대응으로 신체·정서 부담이 크고, 교사와 실무사 사이의 역할 경계가 흐릿합니다.", "psy": ["physical", "ambiguity", "emotion"]},
        "admin": {"hard": "교무·행정 잡무가 끝없이 쏟아지고, 교사·학부모·교육청 사이에서 민원이 몰립니다. 성과가 드러나지 않아 인정이 적습니다.", "psy": ["ambiguity", "conflict", "monotony"]},
        "counsel": {"hard": "위기 학생의 이야기를 매일 들으며 2차 외상이 쌓이고, 학교 안에서 상담사가 혼자라 수퍼비전이 부족합니다.", "psy": ["trauma", "isolation", "burnout"]},
        "library": {"hard": "학교도서관은 한 사람이 운영·수업 지원·행사를 다 맡고, 전문성이 인정되지 않는다는 좌절이 흔합니다.", "psy": ["ambiguity", "isolation", "fit"]},
        "nutrition": {"hard": "급식 사고 책임이 영양사에게 집중되고 조리 인력 관리와 식단 민원을 혼자 감당합니다.", "psy": ["ambiguity", "conflict", "burnout"]},
        "health": {"hard": "보건실에 혼자 근무하며 응급 상황 판단을 즉시 내려야 하고, 감염병 시기에는 업무가 폭증합니다.", "psy": ["isolation", "autonomy", "burnout"]},
        "cleaning": {"hard": "이른 새벽 근무와 반복 신체 노동이 기본이고, 일한 흔적이 눈에 띄지 않아 인정받기 어렵습니다.", "psy": ["physical", "monotony", "insecure"]},
        "kinder": {"hard": "유아의 안전을 한순간도 놓칠 수 없는 긴장과 학부모 응대의 감정노동이 큽니다. 서류 업무가 보육 시간 밖으로 밀립니다.", "psy": ["emotion", "ambiguity", "burnout"]},
    },
    # ── top10.TECH ──
    "tech": {
        "elec": {"hard": "감전·정전 사고 책임이 집중되고 점검은 야간·휴일에 하는 경우가 많습니다. 설비가 멀쩡할 때는 일이 보이지 않습니다.", "psy": ["shift", "physical", "ambiguity"]},
        "mech": {"hard": "설비 고장은 시간을 가리지 않아 비상 호출과 당직이 잦고, 중량물 작업의 신체 부담이 큽니다.", "psy": ["shift", "physical", "autonomy"]},
        "facility": {"hard": "건물 전체의 문제를 혼자 받아내고, 민원과 사고 책임이 동시에 옵니다. 당직과 비상 대기가 생활 리듬을 깨뜨립니다.", "psy": ["shift", "conflict", "ambiguity"]},
        "civil": {"hard": "공사 현장과 인허가 민원 사이에서 갈등이 크고, 안전사고 책임이 무겁습니다. 공기 압박과 야외 근무가 겹칩니다.", "psy": ["conflict", "physical", "burnout"]},
        "arch": {"hard": "설계 변경과 민원, 준공 일정 압박이 겹치고 하자 책임이 오래 따라옵니다.", "psy": ["conflict", "ambiguity", "burnout"]},
        "fire": {"hard": "안전 점검과 훈련, 사고 대응이 반복되고 사고 시 책임이 집중됩니다. 비상 대기가 상시적입니다.", "psy": ["shift", "trauma", "ambiguity"]},
        "ict": {"hard": "통신 장애는 즉시 복구해야 해 야간 출동이 잦고, 문제 없을 때는 존재가 보이지 않습니다.", "psy": ["shift", "autonomy", "monotony"]},
        "env": {"hard": "수질·대기 측정 현장은 날씨와 악취·유해물질에 노출되고, 단속 현장에서 갈등을 겪습니다.", "psy": ["physical", "conflict", "ambiguity"]},
        "chem": {"hard": "화학물질·가스 사고 위험이 상존해 긴장이 풀리지 않고, 교대 근무가 많습니다.", "psy": ["physical", "shift", "burnout"]},
        "survey": {"hard": "야외 측량의 신체 부담과 경계 분쟁 민원이 겹칩니다. 결과 오류가 재산권 다툼으로 번질 수 있다는 압박이 있습니다.", "psy": ["physical", "conflict", "ambiguity"]},
        "it": {"hard": "장애와 보안 사고는 밤낮이 없고 예산·인력은 적은데 책임은 큽니다. 비전공 상사와의 소통 부담이 더해집니다.", "psy": ["autonomy", "shift", "ambiguity"]},
        "energy": {"hard": "발전·에너지 설비는 24시간 교대 운전이 기본이고, 사고의 파급이 커 긴장이 상시적입니다.", "psy": ["shift", "physical", "burnout"]},
    },
}


def hard_for(topic: str, key: str) -> dict | None:
    """주제 키 → 어려운 점. roles 계열(short-window·long-window)은 roles 자료를 쓴다."""
    group = {"roles": "roles", "short-window": "roles", "long-window": "roles", "civil": "civil",
             "medical": "medical", "education": "education", "tech": "tech"}.get(topic)
    if not group:
        return None
    return HARD.get(group, {}).get(key)


def psy_links(keys: list[str]) -> list[dict]:
    return [{"href": PSY[k]["href"], "label": f"{PSY[k]['name']} — {PSY[k]['label']}"} for k in keys if k in PSY]
