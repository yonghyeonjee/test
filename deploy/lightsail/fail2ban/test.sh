#!/usr/bin/env bash
# fail2ban 규칙 시험. 배포 전에 deploy_aws.yml 이 돌린다. 로컬: sudo apt-get install fail2ban && bash deploy/lightsail/fail2ban/test.sh
#
# sample-access.log 는 이 Caddyfile 로 실제로 띄운 Caddy 가 남긴 31줄(IP 만 문서용 주소로 바꿈).
#  쪽·API 요청 14줄은 센다(스캐너·막힌 봇·이름표 없음 포함), 검색엔진 5줄은 뺀다(Googlebot·Yeti),
#  정적 파일·미리 받기(?_rsc=)·robots·sitemap 12줄은 세지 않는다. 스캐너 규칙은 /wp-login.php·/.env 2줄만.
set -euo pipefail
cd "$(dirname "$0")"
want() {  # 필터 기대한_결과
  out=$(fail2ban-regex "$PWD/sample-access.log" "$PWD/filter.d/$1.conf" 2>&1 || true)
  got=$(printf '%s\n' "$out" | grep -oE '^Lines: .*' || true)
  dates=$(printf '%s\n' "$out" | grep -oE '\[[0-9]+\] "ts"' | grep -oE '[0-9]+' || echo 0)
  echo "$1: $got (날짜 읽힘 $dates)"
  [ "$got" = "$2" ] || { echo "::error::$1 기대: $2"; exit 1; }
  [ "$dates" = "31" ] || { echo "::error::$1 날짜를 다 못 읽음"; exit 1; }
}
want jiwon-flood "Lines: 31 lines, 5 ignored, 14 matched, 12 missed"
want jiwon-scan  "Lines: 31 lines, 0 ignored, 2 matched, 29 missed"

# 감옥 설정이 읽히는지(설치된 기본 설정 위에 얹어 본다)
T=$(mktemp -d)
cp -r /etc/fail2ban/. "$T/"
cp filter.d/*.conf "$T/filter.d/"
sed "s#/var/log/caddy/access.log#$PWD/sample-access.log#" jail.d/jiwon.local > "$T/jail.d/jiwon.local"
fail2ban-client -c "$T" -t
jails=$(fail2ban-client -c "$T" -d 2>/dev/null | grep -oE "^\['add', '[a-z-]+'" | grep -oE "'[a-z-]+'$" | tr -d "'" | sort | tr '\n' ' ')
echo "감옥: $jails"
[ "$jails" = "jiwon-flood jiwon-flood-long jiwon-scan " ] || { echo "::error::감옥 목록이 다름(sshd 가 켜졌거나 빠진 감옥이 있음)"; exit 1; }
rm -rf "$T"
echo "fail2ban 규칙 시험 통과"
