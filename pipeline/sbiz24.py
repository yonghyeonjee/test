"""
sbiz24.py — 소상공인24(sbiz24.kr) 지원사업 통합조회를 가져온다.

공개 API 문서가 없어서 화면(Vue)이 쓰는 내부 호출을 그대로 흉내 낸다.
탐침 9차(explore_sbiz24.py)에서 확정한 계약:

  목록  POST /api/combinePbanc/list
        본문 {"sortModel":[], "search":{}, "paging":true,
              "startRow": size*(page-1), "endRow": size*page}
        응답 data.default = { page(Spring Pageable), total, list[] }
        한 번에 1,000건까지 준다.

  상세  공고 구분(pbancGubun)마다 다른 테이블이다.
        A 공단지원사업, D 지방정부사업  POST /api/pbanc/{pbancSn}
        C 대출상품                       POST /api/loanProduct/{pbancSn}
        B 유관기관지원사업               기업마당(bizinfo) 미러. pbancId 가
          기업마당 pblancId 와 같아서 bizinfo_support 로 이미 들어온다 → 건너뜀.

  모든 호출은 POST 이고 헤더 Origin-Method: GET 을 붙여야 한다. 화면의 http
  래퍼가 /api/ 아래 GET 을 그렇게 바꿔 보낸다. 없으면 500 이 온다.

이 파일은 네트워크만 다룬다. DB 적재는 collect.py 의 run_sbiz24, 필드
매핑은 sources.py 의 from_sbiz24 가 한다.
"""

import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE = "https://www.sbiz24.kr"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36 narajiwon-collect/1.0 (+https://jiwon.knowhow-it.com)")
PAGE = 500
SLEEP = 0.3
TIMEOUT = 30

# 상세를 가져올 구분과 그 경로. B 는 기업마당 미러라 뺀다.
DETAIL_PATH = {"A": "/api/pbanc/{sn}", "D": "/api/pbanc/{sn}", "C": "/api/loanProduct/{sn}"}

# 화면 주소. 해시 라우터라 서버 경로가 아니라 #/ 뒤에 붙는다.
PAGE_URL = {
    "A": BASE + "/#/pbanc/{sn}",
    "D": BASE + "/#/lcgPbanc/{sn}",
    "C": BASE + "/#/loanProduct/{sn}",
    "B": BASE + "/#/extldPbanc/{id}",
}


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": BASE + "/",
        "Origin": BASE,
        "Origin-Method": "GET",
    })
    # 읽기 전용 POST 라 재시도해도 안전하다.
    retry = Retry(total=2, connect=2, read=2, backoff_factor=1,
                  status_forcelist=[429, 500, 502, 503, 504],
                  allowed_methods=["GET", "POST"])
    s.mount("https://", HTTPAdapter(max_retries=retry))
    return s


def post(s: requests.Session, path: str, body: dict) -> dict:
    r = s.post(BASE + path, json=body, timeout=TIMEOUT)
    time.sleep(SLEEP)
    r.raise_for_status()
    j = r.json()
    if not isinstance(j, dict) or not j.get("result"):
        raise RuntimeError(f"sbiz24 {path}: result={j.get('result') if isinstance(j, dict) else j!r}")
    return j["data"]["default"]


def list_body(page: int, size: int = PAGE, search: dict | None = None) -> dict:
    return {"sortModel": [], "search": search or {}, "paging": True,
            "startRow": size * (page - 1), "endRow": size * page}


def list_page(s: requests.Session, page: int, size: int = PAGE):
    """(항목 목록, 전체 건수)"""
    d = post(s, "/api/combinePbanc/list", list_body(page, size))
    return d.get("list") or [], int(d.get("total") or 0)


def iter_list(s: requests.Session, size: int = PAGE, max_pages: int = 20):
    """목록을 끝까지 넘긴다. 페이지마다 (page, items, total) 을 낸다."""
    page, seen = 1, 0
    while page <= max_pages:
        items, total = list_page(s, page, size)
        if not items:
            return
        seen += len(items)
        yield page, items, total
        if seen >= total:
            return
        page += 1


def detail_path(item: dict) -> str | None:
    g, sn = item.get("pbancGubun"), item.get("pbancSn")
    tpl = DETAIL_PATH.get(g)
    if not tpl or sn is None:
        return None
    return tpl.replace("{sn}", str(sn))


def fetch_detail(s: requests.Session, item: dict) -> dict | None:
    path = detail_path(item)
    if not path:
        return None
    d = post(s, path, {"search": {}})
    return d if isinstance(d, dict) else None
