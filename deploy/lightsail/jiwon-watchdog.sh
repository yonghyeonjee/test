#!/bin/bash
# 나라지원 지킴이. systemd 타이머(jiwon-watchdog.timer)가 1분마다 돌린다.
#
# 2026-10-08 02:00 UTC: Node 가 죽지는 않았는데 답을 안 했다. 힙이 상한(512MB)까지 자라 RSS 625MB 가 되자
# MemoryHigh(640MB) 에 걸려 커널이 되돌려 보내기(throttle)만 하고 죽이지는 않았다 — 기계는 스왑을 긁고
# 3000 포트는 15초가 지나도 응답이 없었다. Restart=always 는 "죽어야" 다시 띄우므로 이런 상태는 못 잡는다.
# 그래서 바깥에서 묻는다: 10초 안에 robots.txt(가벼운 쪽)를 못 받는 일이 연달아 두 번이면 다시 띄운다.
# 배포가 다시 띄우는 3초 사이에 한 번 실패하는 것은 한 번뿐이라 건드리지 않는다.
# 2026-10-30: 살아 있다는 것만으로는 모자란다. 10/6·8·10 에는 Node 가 답은 했는데 그 답이 Next 기본 오류 화면
# ("Application error…")을 200 으로 낸 것이었고, 구글은 그 화면을 쪽 내용으로 저장해 다른 사이트의 같은 오류 화면과
# 한 묶음(카지노 표준)으로 묶었다. 구글 쪽 설명으로는 그런 묶음에서 빠져나오기 어렵다. 그래서 첫 화면 본문에 우리 글이
# 있고 오류 문구가 없는지도 본다. 첫 화면은 ISR 캐시라 가볍다. 두 번 연속 내용이 이상하면 다시 띄운다(아래 같은 셈).
STATE=/run/jiwon-watchdog.fails
BODY=$(curl -s -m 10 -H "Host: jiwon.knowhow-it.com" http://127.0.0.1:3000/ 2>/dev/null)
if curl -sf -m 10 -o /dev/null http://127.0.0.1:3000/robots.txt    && printf '%s' "$BODY" | grep -q "K나라지원"    && ! printf '%s' "$BODY" | grep -qE "Application error|Internal Server Error|client-side exception"; then
  echo 0 > "$STATE"
  exit 0
fi
n=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$STATE"
if [ "$n" -ge 2 ]; then
  logger -t jiwon-watchdog "3000 포트가 10초 안에 답하지 않거나 첫 화면이 오류 화면 ${n}회 연속 — jiwon 다시 띄움 (메모리 $(systemctl show jiwon -p MemoryCurrent --value 2>/dev/null))"
  systemctl restart jiwon
  echo 0 > "$STATE"
fi
