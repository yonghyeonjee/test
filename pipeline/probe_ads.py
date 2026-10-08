"""쪽마다 광고 자리를 센다. 애드센스(ins.adsbygoogle·data-ad-slot), 구글 GPT(googletag·div-gpt-ad), 카카오 애드핏(kakao_ad_area),
네이버(nas·ssp), 쿠팡(coupang), 자동 광고(enable_page_level_ads·data-ad-client 만) 를 세고, 본문 글자 수 대비로 본다.
사용: python probe_ads.py "https://a,https://b"
"""
import re
import sys

import requests

UA = "Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0 Mobile Safari/537.36"
PATS = {
    "adsense_ins": r'<ins[^>]+adsbygoogle',
    "adsense_slot": r'data-ad-slot=',
    "adsense_auto": r'enable_page_level_ads|data-ad-format="?autorelaxed|adsbygoogle\.js\?client',
    "gpt": r'div-gpt-ad|googletag\.defineSlot',
    "adfit": r'kakao_ad_area|t1\.daumcdn\.net/kas',
    "naver": r'ssp\.adnetwork\.naver|nas\.naver|siape\.veta',
    "coupang": r'coupang\.com/(?:np|g)|ads-partners\.coupang|link\.coupang',
    "taboola_dable": r'taboola|dable\.io|mobon',
}
for u in [x.strip() for x in (sys.argv[1] if len(sys.argv) > 1 else "").split(",") if x.strip()]:
    try:
        r = requests.get(u, timeout=30, headers={"User-Agent": UA, "Accept-Language": "ko-KR"})
    except Exception as e:  # noqa: BLE001
        print(f"\n== {u}\n   실패: {e}")
        continue
    r.encoding = r.apparent_encoding if not r.encoding or r.encoding.lower() == "iso-8859-1" else r.encoding
    t = r.text
    body = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>|\s+", " ", body)
    m = re.search(r"<title[^>]*>(.*?)</title>", t, re.S | re.I)
    counts = {k: len(re.findall(p, t, re.I)) for k, p in PATS.items()}
    print(f"\n== {u}\n   status {r.status_code}  title {(m.group(1).strip() if m else '')[:60]!r}  글자 {len(text):,}")
    print("   " + "  ".join(f"{k}={v}" for k, v in counts.items()))
    # 첫 애드센스 자리가 본문 몇 % 지점에 있나(대략)
    pos = [mm.start() / max(len(t), 1) for mm in re.finditer(PATS["adsense_ins"] + "|" + PATS["adfit"] + "|" + PATS["gpt"], t, re.I)]
    if pos:
        print("   광고 위치(문서 앞에서 %): " + ", ".join(f"{p*100:.0f}" for p in pos[:12]))
