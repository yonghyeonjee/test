"""public_orgs.py 의 순수 함수 시험. 네트워크·DB 없이 돈다."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import public_orgs as p  # noqa: E402

fails = 0


def ok(cond, name):
    global fails
    if not cond:
        fails += 1
        print("실패:", name)


LIST = """
<li><a href="javascript:fnDetail('C0847');">
  <div class="tit">(사)남북교류협력지원협회</div>
  <p>통일부&nbsp;&nbsp;|&nbsp;&nbsp;기타공공기관</p>
  <div class="site" onClick="window.open('http://www.sonosa.or.kr')">http://www.sonosa.or.kr</div>
</a></li>
<li><a href="javascript:fnDetail('C0352');">
  <div class="tit">(재)우체국금융개발원</div>
  <p>과학기술정보통신부&nbsp;&nbsp;|&nbsp;&nbsp;준정부기관(위탁집행형)</p>
</a></li>
<a href="#" onclick="goPage(2);return false;">2</a><a href="#" onclick="goPage(35); return false;" class="btn"></a>
"""
items = p.parse_list(LIST)
ok(len(items) == 2 and items[0]["id"] == "C0847" and items[0]["ministry"] == "통일부" and items[0]["kind"] == "기타공공기관", "목록")
ok(items[0]["homepage"] == "http://www.sonosa.or.kr" and items[1]["homepage"] is None, "홈페이지")
ok(items[1]["kind"] == "준정부기관(위탁집행형)", "유형")
ok(p.last_page(LIST) == 35, "마지막 쪽")

DETAIL = """
<tr><th scope="row">기관명</th><td>(사)남북교류협력지원협회</td></tr>
<tr><th scope="row">기관소개</th><td><p>정부 위탁업무 수행</p><p>홈페이지연결 : <a href="http://www.sonosa.or.kr" target="_blank">http://www.sonosa.or.kr</a></p></td></tr>
<tr><th scope="row">주무기관</th><td>통일부</td></tr>
<tr><th scope="row">주요기능 및 역할</th><td>o 위탁 사업<br />o 대책 건의</td></tr>
<tr><th scope="row">소재지</th><td>중구 퇴계로 97, 601호</td></tr>
"""
d = p.parse_detail(DETAIL)
ok(d["intro"] == "정부 위탁업무 수행" and d["homepage_detail"] == "http://www.sonosa.or.kr", "소개·홈페이지")
ok(d["roles"] == "o 위탁 사업\no 대책 건의" and d["address"] == "중구 퇴계로 97, 601호", "역할·소재지")
ok(p.addr_query("중구 퇴계로 97, 601호") == "중구 퇴계로 97", "지오코더 주소")
ok(p.addr_query("종로구 율곡로 283 (연건동) 3층") == "종로구 율곡로 283", "괄호·층 떼기")
ok(p.addr_query("종로구 대학로57(연건동) 홍익대학교 대학로캠퍼스 교육동 3층, 12층") == "종로구 대학로 57", "붙은 번지·건물 이름 떼기")
ok(p.addr_query("서구 둔산대로 117번길 95 제6층 제E동-601호(만년동, 리더스타운)") == "서구 둔산대로 117번길 95", "번길")
ok(p.addr_query("용인시 기흥구 석성로521번길 169") == "용인시 기흥구 석성로 521번길 169", "붙은 번길")
ok(p.addr_query("서천군 마서면 금강로 1210 국립생태원") == "서천군 마서면 금강로 1210", "뒤의 기관 이름")
ok(p.sido_of("97, 퇴계로, 명동, 중구, 서울특별시, 04634, 대한민국") == "서울특별시", "시·도")
ok(p.sgg_of("97, 퇴계로, 명동, 중구, 서울특별시, 04634, 대한민국", "서울특별시") == "중구", "광역시의 구")
ok(p.sgg_of("23, 창룡대로, 매향동, 팔달구, 수원시, 경기도, 16255, 대한민국", "경기도") == "수원시", "도의 시")
ok(p.sido_of("1, 군청길, 양양읍, 양양군, 강원특별자치도, 대한민국") == "강원특별자치도", "강원")
print("public_orgs: 모두 통과" if not fails else f"public_orgs: {fails}건 실패")
raise SystemExit(1 if fails else 0)
