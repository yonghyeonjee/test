"""
우리가 이미 부르는 API 응답에 첨부파일·서식·관련 링크가 들어 있는지 본다.
손으로만 돌린다(probe 워크플로). 인증키는 찍지 않는다.

  bokjiro 상세(중앙·지자체) — xml_detail 이 반복 태그를 첫 값만 남기므로
                             원래 구조(목록 태그)를 그대로 본다.
  bizinfo 지원사업           — 한 건의 키 전부. 파일 경로 비슷한 키가 있나.
  sbiz24 상세                — 키 전부. 첨부 목록 키가 있나.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
KEY = os.environ.get("DATA_GO_KR_KEY", "")
EP = json.load(open(Path(__file__).parent / "endpoints.json", encoding="utf-8"))
S = requests.Session()
S.headers["User-Agent"] = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com)"


def mask(t: str) -> str:
    return t.replace(KEY, "***") if KEY else t


def fill(raw, page=1, rows=2):
    return {k: str(v).replace("__SERVICE_KEY__", KEY).replace("__ROWS__", str(rows)).replace("__PAGE__", str(page))
            for k, v in raw.items()}


def get(url, params, fmt):
    for u in (url, url.replace("https://", "http://", 1)):
        try:
            r = S.get(u, params=params, timeout=40)
            if r.ok:
                return r.json() if fmt == "json" else r.text
            print(f"  !! {mask(u)} → {r.status_code} {mask(r.text[:200])}")
        except Exception as e:  # noqa: BLE001
            print(f"  !! {mask(u)} → {mask(str(e))}")
    return None


def tree(xml_text: str):
    """태그 경로마다 값(앞 80자). 같은 경로가 되풀이되면 몇 번인지와 앞 둘만."""
    root = ET.fromstring(xml_text)
    seen: dict[str, list[str]] = {}
    def walk(el, path):
        p = f"{path}/{el.tag}"
        kids = list(el)
        if not kids:
            seen.setdefault(p, []).append((el.text or "").strip().replace("\n", " ")[:80])
        for c in kids:
            walk(c, p)
    walk(root, "")
    for p, vals in seen.items():
        n = len(vals)
        print(f"   {p}  ×{n}  " + " | ".join(v for v in vals[:2] if v))


def bokjiro(name, serv_id):
    c = EP[name]
    print(f"\n== {name} 상세 {serv_id}")
    params = fill(c["detail_params"]); params[c["detail_key"]] = serv_id
    t = get(c["detail_url"], params, "xml")
    if t:
        print(f"  {len(t)}자 · 반복/목록 태그와 링크 후보:")
        tree(t)
        for m in re.findall(r"https?://[^<\s\"]{10,160}", t)[:12]:
            print("   url:", mask(m))


def bizinfo():
    c = EP["bizinfo_support"]
    print("\n== bizinfo_support 1건의 키 전부")
    j = get(c["url"], fill(c["params"], 1, 2), "json")
    if not j:
        return
    try:
        items = j["jsonArray"] if "jsonArray" in j else j["response"]["body"]["items"]["item"]
    except Exception:  # noqa: BLE001
        print("  모양을 모름:", mask(json.dumps(j, ensure_ascii=False)[:600])); return
    it = items[0] if isinstance(items, list) else items
    for k, v in it.items():
        print(f"   {k}: {str(v)[:110]!r}")


def sbiz():
    import sbiz24 as z
    print("\n== sbiz24 상세")
    s = z.make_session()
    for path in ["/api/pbanc/844", "/api/pbanc/419"]:
        try:
            d = z.post(s, path, {})
        except Exception as e:  # noqa: BLE001
            print(f"  !! {path}: {e}"); continue
        print(f"  {path} 키:")
        for k, v in d.items():
            tag = ""
            if isinstance(v, list):
                tag = f"list×{len(v)}" + (f" 첫 항목 키 {list(v[0].keys())[:12]}" if v and isinstance(v[0], dict) else "")
                v = json.dumps(v, ensure_ascii=False)
            print(f"   {k}: {tag} {str(v)[:120]!r}")


if __name__ == "__main__":
    bokjiro("bokjiro_central", "WLF00000033")
    bokjiro("bokjiro_local", "WLF00006783")
    bizinfo()
    sbiz()
