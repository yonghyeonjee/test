#!/usr/bin/env bash
# 봇 막기 설치·갱신(2026-10-14). deploy_aws.yml 이 배포마다 부르고(바뀐 것만 반영), setup.sh 도 부른다.
#   sudo bash botguard.sh <배포 폴더>   — 그 안의 fail2ban/ 을 /etc/fail2ban 에 올린다.
#
# Caddy 가 /var/log/caddy/access.log 에 접속 기록을 남기고(Caddyfile 의 access),
# fail2ban 이 그것을 읽어 너무 빠른 IP·스캐너를 80·443 에서 막는다(fail2ban/jail.d/jiwon.local).
# 실패해도 사이트는 그대로 돈다. 배포 쪽에서 경고만 남긴다.
set -euo pipefail
SRC="${1:?배포 폴더}/fail2ban"

# 1) 기록 폴더와 빈 파일. 파일이 없으면 fail2ban 감옥이 뜨지 않는다.
# root 가 만든 파일이 섞이면 caddy 가 못 연다(2026-10-14 첫 배포). 늘 caddy 것으로 맞춘다.
install -d -o caddy -g caddy -m 755 /var/log/caddy
[ -f /var/log/caddy/access.log ] || install -o caddy -g caddy -m 640 /dev/null /var/log/caddy/access.log
chown -R caddy:caddy /var/log/caddy

# 2) fail2ban 설치(처음 한 번). 자동 업데이트가 apt 를 잡고 있으면 2분까지 기다린다.
if ! command -v fail2ban-client >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y -q -o DPkg::Lock::Timeout=120 fail2ban \
    || { apt-get update -q -o DPkg::Lock::Timeout=120 && apt-get install -y -q -o DPkg::Lock::Timeout=120 fail2ban; }
fi

# 3) 규칙·감옥. 바뀐 것만 올리고, 바뀌었거나 꺼져 있으면 검사 뒤 다시 띄운다.
changed=0
for f in filter.d/jiwon-flood.conf filter.d/jiwon-scan.conf jail.d/jiwon.local; do
  if ! cmp -s "$SRC/$f" "/etc/fail2ban/$f"; then
    install -m 644 "$SRC/$f" "/etc/fail2ban/$f"
    changed=1
  fi
done
systemctl enable -q fail2ban
if [ "$changed" = 1 ] || ! systemctl is-active -q fail2ban; then
  fail2ban-client -t >/dev/null
  systemctl restart fail2ban
  sleep 2
fi
fail2ban-client status | sed -n 's/.*Jail list:\s*/감옥: /p'
