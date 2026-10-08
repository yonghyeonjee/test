"""사이트맵 색인을 따라가 모든 주소를 한 줄씩 찍는다. "갈래<TAB>주소<TAB>lastmod<TAB>주기<TAB>우선순위".
사용: python probe_sitemap.py [https://jiwon.knowhow-it.com/sitemap.xml]
"""
import re
import sys

import requests

UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; probe)"
root = sys.argv[1] if len(sys.argv) > 1 else "https://jiwon.knowhow-it.com/sitemap.xml"
idx = requests.get(root, timeout=40, headers={"User-Agent": UA}).text
children = re.findall(r"<loc>([^<]+)</loc>", idx)
print(f"== 색인 {root}: 갈래 {len(children)}개")
total = 0
for c in children:
    name = c.rsplit("/", 1)[-1].replace(".xml", "")
    xml = requests.get(c, timeout=60, headers={"User-Agent": UA}).text
    urls = re.findall(r"<url>(.*?)</url>", xml, flags=re.S)
    print(f"== {name}: {len(urls)}개")
    for u in urls:
        loc = re.search(r"<loc>([^<]+)</loc>", u)
        lm = re.search(r"<lastmod>([^<]+)</lastmod>", u)
        cf = re.search(r"<changefreq>([^<]+)</changefreq>", u)
        pr = re.search(r"<priority>([^<]+)</priority>", u)
        print("\t".join([name, loc.group(1) if loc else "", lm.group(1)[:10] if lm else "", cf.group(1) if cf else "", pr.group(1) if pr else ""]))
    total += len(urls)
print(f"== 전체 {total}개")
