# AWS Lightsail 로 옮기기

Lightsail 서버 1대(서울, 512MB, 월 $5. 실측 메모리 80MB 안팎, 모자라면 스냅샷으로 $7 에 옮긴다) + Caddy(HTTPS 자동). 빌드는 GitHub Actions 가 하고 서버는 실행만 한다.
나중에 CloudFront 를 앞에 둔다(아래 "다음 단계").

| 파일 | 하는 일 |
|---|---|
| `setup.sh` | 서버 첫 준비(스왑, Node 22, Caddy, systemd). 한 번만 |
| `jiwon.service` | Next.js 서버를 띄우고 죽으면 다시 띄운다 |
| `Caddyfile` | 443 HTTPS 인증서 자동, 3000 으로 넘김. IP 로 들어오면 검색엔진에 숨김 |
| `../../.github/workflows/deploy_aws.yml` | main 에 합치면 빌드 → 서버로 올림 → 다시 띄움 → 200 확인 |
| `../../.github/workflows/cron_jobs.yml` | 매일 09:00 KST 최신 수집(Vercel 크론 대신). 저장소 변수 `HOSTING=aws` 일 때만 |

## 순서

1. Lightsail 인스턴스: 서울(ap-northeast-2a), Linux operating system → Ubuntu 24.04 LTS, $5(512MB) 요금제, 이름 `jiwon`.
2. 고정 IP 를 만들어 인스턴스에 붙인다.
3. 네트워킹 방화벽: SSH 22, HTTP 80, HTTPS 443 열기.
4. 브라우저 SSH 로 접속해 이 저장소의 `deploy/lightsail` 을 받아 `sudo bash setup.sh`.
5. GitHub Secrets 에 `LIGHTSAIL_HOST`(고정 IP), `LIGHTSAIL_SSH_KEY`(Lightsail 기본 키 쌍 .pem 내용 전체)와
   서버 비밀값(deploy_aws.yml 머리말 목록)을 넣는다.
6. Actions → deploy-aws → Run workflow. 끝나면 `http://<고정 IP>/` 로 확인.
7. DNS: `jiwon` A 레코드를 고정 IP 로(TTL 300). Caddy 가 몇 분 안에 인증서를 받는다.
8. 저장소 변수 `HOSTING=aws` → Vercel 크론 대신 cron-jobs 가 돈다. Vercel 프로젝트의 Git 연결을 끊는다.

## 다음 단계: CloudFront

`origin.jiwon.knowhow-it.com` A 레코드 → 고정 IP, CloudFront 원본을 그 주소(HTTPS)로, 인증서는 ACM(us-east-1)에서
`jiwon.knowhow-it.com` DNS 검증, 캐시 정책은 원본 헤더 따르기(UseOriginCacheControlHeaders-QueryStrings),
원본 요청 정책은 AllViewerExceptHostHeader. 그다음 `jiwon` 을 CloudFront 주소로 CNAME.
