"""금리표 파서 검증. 2026-09-29 탐침으로 받은 누리집 본문(samples/hf)으로 돈다."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from home_loan_rates import parse_bogeumjari, parse_didimdol  # noqa: E402

S = Path(__file__).parent / "samples" / "hf"
bad = 0


def check(c, msg):
    global bad
    if not c:
        bad += 1
        print("  FAIL", msg)


b = parse_bogeumjari((S / "bogeumjari.txt").read_text(encoding="utf-8"))
check(b["month"] == "2026-10", f"보금 월 {b['month']}")
check(b["notice"] == "2026-10-01", f"보금 공시일 {b['notice']}")
check(b["terms"] == ["10년", "15년", "20년", "30년", "40년", "50년"], f"만기 {b['terms']}")
names = [r["name"] for r in b["rows"]]
check(names == ["u-보금자리론", "아낌e보금자리론", "t-보금자리론"], f"상품 {names}")
check(b["rows"][0]["rates"] == [5.0, 5.1, 5.15, 5.2, 5.25, 5.3], f"u 금리 {b['rows'][0]['rates']}")
check(b["rows"][1]["rates"][0] == 4.9, "아낌e 10년 4.90")
items = {p["item"]: p["pct"] for p in b["prefs"]}
check(items.get("신혼가구") == 0.3, f"신혼 우대 {items}")
check(items.get("다자녀가구 (3자녀 이상)") == 0.7, "다자녀 3 0.7")
check(items.get("저소득청년") == 0.1, "저소득청년 0.1")
check(items.get("전세사기피해자") == 1.0, "전세사기 1.0")
check(any(e["item"].startswith("규제지역") and e["pct"] == 0.2 for e in b["extras"]), f"가산 {b['extras']}")

d = parse_didimdol((S / "didimdol.txt").read_text(encoding="utf-8"))
check(d["month"] == "2026-09", f"디딤 월 {d['month']}")
check(d["notice"] == "2026-09-01", f"디딤 공시 {d['notice']}")
g = d["general"]
check(g and g["terms"] == ["10년", "15년", "20년", "30년"], f"디딤 만기 {g and g['terms']}")
check(g and len(g["rows"]) == 4 and g["rows"][0]["band"] == "20백만원 이하" and g["rows"][0]["rates"] == [2.85, 2.95, 3.05, 3.1], f"디딤 1행 {g and g['rows'][0]}")
check(g and g["rows"][3]["rates"] == [3.9, 4.0, 4.1, 4.15], "디딤 4행")
f = d["first_newlywed"]
check(f and f["rows"][0]["rates"] == [2.55, 2.65, 2.75, 2.8] and f["rows"][3]["rates"][3] == 3.85, f"생애최초신혼 {f and f['rows'][0]}")
check(d["notes"] and "0.2%p" in d["notes"][0], f"지방 차감 {d['notes']}")
check(d["floor"] and "1.5%" in d["floor"], f"최저금리 {d['floor']}")

print("home_loan_rates 파서: " + ("모두 통과" if bad == 0 else f"{bad}건 실패"))
sys.exit(1 if bad else 0)
