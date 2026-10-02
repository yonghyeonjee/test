#!/usr/bin/env bash
# Lightsail 서버(Ubuntu 24.04, 서울) 첫 준비. 한 번만 돌린다:
#   sudo bash setup.sh
# 하는 일: 스왑 1GB, Node 22, Caddy(HTTPS), jiwon 사용자·폴더, systemd 서비스.
# 앱 파일은 GitHub Actions(deploy_aws.yml)가 /srv/jiwon/releases/<커밋> 에 올리고 current 로 잇는다.
set -euo pipefail

# 512MB 메모리라 갑자기 몰릴 때를 대비해 스왑 2GB 를 둔다(빌드는 서버에서 하지 않는다).
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 메모리를 아끼려고 이 서버에서 안 쓰는 snapd 는 끈다.
systemctl disable --now snapd.service snapd.socket 2>/dev/null || true
sysctl -w vm.swappiness=20 >/dev/null && echo 'vm.swappiness=20' > /etc/sysctl.d/99-jiwon.conf

apt-get update -y
apt-get install -y ca-certificates curl gnupg debian-keyring debian-archive-keyring apt-transport-https

# Node 22 (NodeSource)
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Caddy (공식 저장소)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

id jiwon >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin jiwon
mkdir -p /srv/jiwon/releases /srv/jiwon/shared
touch /srv/jiwon/shared/.env && chmod 600 /srv/jiwon/shared/.env
# 배포 사용자(ubuntu)가 올리고, 서비스(jiwon)가 읽는다.
chown -R ubuntu:jiwon /srv/jiwon && chmod -R g+rX /srv/jiwon
# releases 아래 새 파일은 그룹 jiwon 을 물려받는다(setgid). 서비스가 .next/cache 에 ISR 캐시를 써야 한다.
chmod 2775 /srv/jiwon/releases
chown ubuntu:jiwon /srv/jiwon/shared/.env && chmod 640 /srv/jiwon/shared/.env

HERE="$(cd "$(dirname "$0")" && pwd)"
install -m 644 "$HERE/jiwon.service" /etc/systemd/system/jiwon.service
install -m 644 "$HERE/Caddyfile" /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable jiwon caddy
systemctl restart caddy

# 배포 스크립트가 sudo 없이 서비스만 다시 띄울 수 있게.
echo 'ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart jiwon, /usr/bin/systemctl status jiwon, /usr/bin/journalctl -u jiwon *' > /etc/sudoers.d/jiwon-deploy
chmod 440 /etc/sudoers.d/jiwon-deploy

echo "준비 끝. 이제 GitHub Actions 의 deploy-aws 를 돌리면 앱이 올라갑니다."
