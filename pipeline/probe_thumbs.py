"""
probe_thumbs.py — 티스토리 블로그 글 목록 카드의 썸네일이 무엇을 가리키는지 본다(로그인 없이 공개 쪽만).
probe.yml 로만 돈다:  script=probe_thumbs.py  arg=<블로그 주소>[,<글 번호>…]
"""

import re
import sys

import requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
blog, *ids = sys.argv[1].split(",")
for url in [blog, blog.rstrip("/") + "/?page=3"]:
    html = requests.get(url, headers={"User-Agent": UA}, timeout=30).text
    print(f"===== {url} ({len(html)}자)")
    for m in re.finditer(r"<(?:img|div|span|a)\b[^>]*(?:thumb|thumbnail|img_)[^>]*>", html, re.I):
        print("  ", m.group(0)[:300])
    for m in re.finditer(r"background-image\s*:\s*url\([^)]*\)", html):
        print("   bg:", m.group(0)[:300])
for i in ids:
    html = requests.get(f"{blog.rstrip('/')}/{i}", headers={"User-Agent": UA}, timeout=30).text
    og = re.findall(r'<meta[^>]+property="og:image"[^>]*>', html)
    imgs = re.findall(r"<img\b[^>]*>", html)
    print(f"===== 글 {i}: og:image={og[:1]}")
    for t in re.findall(r"<meta[^>]+(?:image|thumbnail)[^>]*>", html, re.I):
        print("   meta:", t[:400])
    for t in re.findall(r'"(?:image|thumbnail)[^"]*"\s*:\s*"[^"]{0,300}"', html):
        print("   json:", t[:400])
    for t in imgs[:3]:
        print("   img:", t[:300])
