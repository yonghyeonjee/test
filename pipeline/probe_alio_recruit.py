"""알리오 공공기관 채용정보 API(재정경제부_공공기관 채용정보 조회서비스)를 불러 응답 모양을 본다. 키 값은 찍지 않는다.
Base opendata.alio.go.kr, POST /new/v1/recruit/list.do · /new/v1/recruit/detail.do (2026-10-17 사용자가 알려 준 명세).
인증 칸 이름이 명세 요약에 없어 몇 가지 꼴을 차례로 시험하고, 처음 되는 꼴로 상세까지 본다.
"""
import json
import os

import requests

KEY = os.environ.get("ALIO_RECRUIT_KEY", "").strip()
BASES = ["https://opendata.alio.go.kr/new/v1/recruit", "http://opendata.alio.go.kr/new/v1/recruit"]


def mask(s: str) -> str:
    return s.replace(KEY, "***").replace(requests.utils.quote(KEY, safe=""), "***") if KEY else s


def variants(extra: dict):
    yield "form X-API-AUTH-KEY", dict(data={"X-API-AUTH-KEY": KEY, **extra})
    yield "header X-API-AUTH-KEY + form", dict(headers={"X-API-AUTH-KEY": KEY}, data=extra)
    yield "form serviceKey", dict(data={"serviceKey": KEY, **extra})
    yield "query serviceKey", dict(params={"serviceKey": KEY, **extra})
    yield "json serviceKey", dict(json={"serviceKey": KEY, **extra})


print(f"키: {'있음 ' + str(len(KEY)) + '자' if KEY else '없음'}")
ok = None
for base in BASES:
    for label, kw in variants({"pageNo": "1", "numOfRows": "3", "pageSize": "3"}):
        try:
            r = requests.post(f"{base}/list.do", timeout=40, **kw)
        except Exception as e:  # noqa: BLE001
            print(f"[{base} | {label}] 실패 {type(e).__name__}: {mask(str(e))[:200]}")
            continue
        body = mask(r.text)
        print(f"[{base} | {label}] status {r.status_code} {r.headers.get('content-type')}  {body[:400]!r}")
        try:
            d = r.json()
        except Exception:  # noqa: BLE001
            continue
        # 성공 응답에는 resultCode 가 없을 수 있다(2026-10-17 확인). result 목록이 있으면 된 것으로 본다.
        if isinstance(d, dict) and isinstance(d.get("result"), list) and d["result"]:
            ok = (base, label, kw, d)
            break
    if ok:
        break

if ok:
    base, label, kw, d = ok
    print(f"\n== 됨: {base} | {label}  totalCount {d.get('totalCount')}")
    first = d["result"][0]
    print(f"받은 줄 {len(d['result'])}, 위 칸: {[k for k in d if k != 'result']}")
    print(json.dumps(first, ensure_ascii=False)[:6000])
    sn = first.get("recrutPblntSn")
    kw2 = json.loads(json.dumps({k: v for k, v in kw.items()}))
    for part in ("data", "params", "json"):
        if part in kw2:
            kw2[part] = {k: v for k, v in kw2[part].items() if k in ("X-API-AUTH-KEY", "serviceKey")}
            kw2[part]["recrutPblntSn"] = str(sn)
    if "data" not in kw2 and "params" not in kw2 and "json" not in kw2:
        kw2["data"] = {"recrutPblntSn": str(sn)}
    r2 = requests.post(f"{base}/detail.do", timeout=40, **kw2)
    print(f"\n== detail {sn}: status {r2.status_code}")
    print(mask(r2.text)[:5000])
