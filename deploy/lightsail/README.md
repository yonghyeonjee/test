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
한국 거점(ICN)은 Cloudflare 상위 요금제에서만 기대할 수 있다. 앞단은 서울 거점이 있는 CloudFront 로 둔다(아래).

## 앞단: CloudFront (2026-11-16)

붙이기 전에 쟀다: 같은 KT 회선에서 CloudFront 는 서울 거점(ICN)으로 간다(사본이 있으면 0.09초).
16:47 KST 에 전환했다. 배포 `E2IUVLIZH5Q6VS`(d2n509ho841pau.cloudfront.net), 캐시 정책 `jiwon-origin-cc`
(460e044d-b5c0-428e-8076-5e9bfbabd1ad), 서버와 같은 AWS 계정(관리 계정). 전환 뒤 KT 에서 첫 화면 0.04~0.12초,
사본이 없는 쪽 0.6초 안팎. 만들 때 쓴 설정 파일은 CloudShell(us-east-1) 홈의 `dist.json`·`cp.json`.

- DNS(Cloudflare, 프록시 끔): `origin.jiwon` A → 3.34.85.98, `jiwon` CNAME → 배포의 `dxxxx.cloudfront.net`.
- 인증서: ACM(us-east-1) `jiwon.knowhow-it.com`, DNS 검증 CNAME 은 Cloudflare 에.
- 원본: `origin.jiwon.knowhow-it.com` HTTPS 만, 응답 대기 60초, 사용자 지정 헤더 `X-Edge: cf-jiwon`.
- 원본 요청 정책: AllViewerExceptHostHeader(관리형). Host 는 Caddy 가 jiwon 으로 바꿔 앱에 넘긴다.
- 캐시 정책(직접 만든 것): 원본의 Cache-Control 을 따른다(최소·기본 0초). 키 = 쿼리스트링 전부 +
  머리글 `RSC`·`Next-Router-Prefetch`·`Next-Router-State-Tree`·`Next-Router-Segment-Prefetch`·`Next-Url`. 쿠키는 키에 넣지 않는다.
  관리형 UseOriginCacheControlHeaders 를 쓰지 않는 이유: 그 키에는 RSC 머리글이 없어, 누가 `RSC: 1` 을 붙여 쪽 주소를 부르면
  RSC 조각이 HTML 자리에 5분 동안 저장된다. 쿠키를 키에 넣으면 GA 쿠키 때문에 사람마다 사본이 갈려 소용이 없다
  (s-maxage 가 붙는 쪽은 쿠키를 읽지 않는 ISR 쪽뿐이다).
- 오류 응답(403·404·429·500·502·503·504)은 저장하지 않는다(오류 캐시 최소 TTL 0). Caddy 가 수집기에게 준 403 이
  같은 주소를 연 사람·검색엔진에게 나가면 안 된다.
- 서버: Caddyfile 전역 옵션이 CloudFront 원본 대역만 믿고 X-Forwarded-For 를 오른쪽부터 읽는다. fail2ban 은 CloudFront 를
  거친 요청(host 가 origin.…)을 세지 않는다 — 방화벽에서 막을 수 있는 것은 CloudFront 주소뿐이라서다.
  봇이 몰리는 것은 CloudFront 사본과 Caddy 의 이름표 규칙(guard)이 받는다. IP 별 속도 제한이 필요해지면 AWS WAF(유료)를 본다.
- 길게 걸리는 작업(org_sites·server_probe 워크플로)은 `https://origin.jiwon.knowhow-it.com` 을 바로 부른다.
- 되돌리기: Cloudflare 에서 `jiwon` 을 A 3.34.85.98 로 되돌린다(5분). Caddy 의 jiwon 블록 인증서가 살아 있는 동안만 된다 —
  CloudFront 뒤에서는 그 인증서가 갱신되지 않는다(90일).
- 비용: CloudFront 상시 무료 한도(매달 1TB·요청 1천만 건) 안이면 0원. 첫 청구서에서 확인한다.

## 백업

Supabase 무료 요금제에는 백업이 없다. `.github/workflows/db_backup.yml` 이 매일 03:30 KST 에 `pg_dump` 로 전체를 떠서
S3 버킷의 `db/` 에 올리고, 30일 지난 것은 지운다. 필요한 secret: `SUPABASE_DB_URL`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `BACKUP_BUCKET`. 하나라도 없으면 아무 일도 하지 않는다.

복원: `pg_restore -d "$DB_URL" --clean --if-exists --no-owner --no-privileges jiwon-….dump`
