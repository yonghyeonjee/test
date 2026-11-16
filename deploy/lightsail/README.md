# AWS Lightsail 로 옮기기

Lightsail 서버 1대(서울, 512MB, 월 $5. 실측 메모리 80MB 안팎, 모자라면 스냅샷으로 $7 에 옮긴다) + Caddy(HTTPS 자동). 빌드는 GitHub Actions 가 하고 서버는 실행만 한다.
나중에 CloudFront 를 앞에 둔다(아래 "다음 단계").

| 파일 | 하는 일 |
|---|---|
| `setup.sh` | 서버 첫 준비(스왑, Node 22, Caddy, systemd). 한 번만 |
| `jiwon.service` | Next.js 서버를 띄우고 죽으면 다시 띄운다 |
| `Caddyfile` | 443 HTTPS 인증서 자동, 3000 으로 넘김. IP 로 들어오면 검색엔진에 숨김. 접속 기록, 스캐너·막은 봇 차단 |
| `botguard.sh` | fail2ban 설치·갱신. 배포 때마다 돈다 |
| `fail2ban/` | 너무 빠른 IP(1분 90번, 10분 600번)·스캐너를 80·443 에서 막는 규칙. `test.sh` 가 배포 전에 시험 |
| `access_report.py` | 접속 기록 요약(IP·이름표·경로). server-diag 가 부른다 |
| `../../.github/workflows/deploy_aws.yml` | main 에 합치면 빌드 → 서버로 올림 → 다시 띄움 → 200 확인 |
| `../../.github/workflows/cron_jobs.yml` | 매일 09:00 KST 최신 수집(Vercel 크론 대신) |

## 순서

1. Lightsail 인스턴스: 서울(ap-northeast-2a), Linux operating system → Ubuntu 24.04 LTS, $5(512MB) 요금제, 이름 `jiwon`.
2. 고정 IP 를 만들어 인스턴스에 붙인다.
3. 네트워킹 방화벽: SSH 22, HTTP 80, HTTPS 443 열기.
4. 브라우저 SSH 로 접속해 이 저장소의 `deploy/lightsail` 을 받아 `sudo bash setup.sh`.
5. GitHub Secrets 에 `LIGHTSAIL_HOST`(고정 IP), `LIGHTSAIL_SSH_KEY`(Lightsail 기본 키 쌍 .pem 내용 전체)와
   서버 비밀값(deploy_aws.yml 머리말 목록)을 넣는다.
6. Actions → deploy-aws → Run workflow. 끝나면 `http://<고정 IP>/` 로 확인.
7. DNS: `jiwon` A 레코드를 고정 IP 로(TTL 300). Caddy 가 몇 분 안에 인증서를 받는다.
8. Vercel 크론은 vercel.json 에서 뺐고 cron-jobs 가 대신 돈다. Vercel 프로젝트의 Git 연결을 끊는다.

## 앞단: Cloudflare — DNS 만 쓴다, 프록시는 끔 (2026-11-16)

knowhow-it.com 의 네임서버는 Cloudflare(adam·cloe.ns.cloudflare.com)다. 도메인 구입처는 Porkbun, 그전 DNS 는 카페24
(카페24 쪽 기록은 지우지 않았다 — 되돌릴 때 Porkbun 네임서버를 ns1/ns2.cafe24.com·.co.kr 넷으로).
모든 기록이 '프록시 끔(DNS only)'이다. 워드프레스(카페24 183.111.183.77)·메일(MX mw-002.cafe24.com)·jiwon(3.34.85.98).

**jiwon 프록시를 켜지 말 것.** 켜 보니 한국(KT) 회선이 Cloudflare 무료 요금제에서 로스앤젤레스(LAX) 거점으로 갔다.
첫 화면이 직결 0.07초 → Cloudflare 경유 2~3초(캐시 안 된 HTML). 한국 방문자가 손님 대부분이라 곧바로 껐다.
한국 거점(ICN)은 Cloudflare 상위 요금제에서만 기대할 수 있다. 앞단이 필요하면 서울 거점이 있는 CloudFront(아래)를 본다.

서버 쪽 준비(PR #358)는 그대로 두었다. 프록시가 꺼져 있으면 아무 일도 하지 않는다:
- Caddyfile 맨 위 전역 옵션: Cloudflare 대역만 믿고 `CF-Connecting-IP` 를 client_ip 로. 앱에는 `X-Real-IP` 로 넘긴다.
- fail2ban `ignoreip` 에 Cloudflare 대역. Cloudflare 를 거친 손님의 속도 제한은 Cloudflare 규칙이 맡는다.
- Cloudflare SSL 은 Full (strict). Caddy 인증서(Let's Encrypt)는 HTTP-01 로 그대로 갱신된다.
- 대역이 바뀌면(https://www.cloudflare.com/ips-v4 · ips-v6) 두 곳을 함께 고친다.

## (보류) CloudFront

`origin.jiwon.knowhow-it.com` A 레코드 → 고정 IP, CloudFront 원본을 그 주소(HTTPS)로, 인증서는 ACM(us-east-1)에서
`jiwon.knowhow-it.com` DNS 검증, 캐시 정책은 원본 헤더 따르기(UseOriginCacheControlHeaders-QueryStrings),
원본 요청 정책은 AllViewerExceptHostHeader. 그다음 `jiwon` 을 CloudFront 주소로 CNAME.

CloudFront 를 앞에 두면 서버에 닿는 주소가 전부 CloudFront 것이 된다. 그때 할 일:
- Caddyfile 전역 옵션에 `servers { trusted_proxies static <CloudFront 대역> }` 와 `client_ip_headers CloudFront-Viewer-Address X-Forwarded-For` 를 넣어 기록의 client_ip 가 손님 주소가 되게 한다.
- fail2ban 은 방화벽에서 막으므로 CloudFront 뒤에서는 소용없다. `jiwon-flood`·`jiwon-flood-long` 을 끄고 AWS WAF 속도 규칙으로 옮긴다. 안 그러면 CloudFront 주소를 막아 사이트가 통째로 막힌다.

## 백업

Supabase 무료 요금제에는 백업이 없다. `.github/workflows/db_backup.yml` 이 매일 03:30 KST 에 `pg_dump` 로 전체를 떠서
S3 버킷의 `db/` 에 올리고, 30일 지난 것은 지운다. 필요한 secret: `SUPABASE_DB_URL`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `BACKUP_BUCKET`. 하나라도 없으면 아무 일도 하지 않는다.

복원: `pg_restore -d "$DB_URL" --clean --if-exists --no-owner --no-privileges jiwon-….dump`
