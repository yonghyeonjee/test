# 의존성 목록 (2026-10-02)

이전할 때 빠뜨리지 않으려고, 지금 코드가 부르는 것을 전부 적는다. 다시 뽑을 때는 맨 아래의
명령을 쓴다.

## 1. 웹 → DB

### 1.1 공개 읽기 (anon 키, 서버 컴포넌트·ISR)

| DB 객체 | 종류 | 쓰는 파일 | 하는 일 |
|---|---|---|---|
| `programs_public` | 뷰 | `lib/db.ts`, `lib/mapData.ts`, `lib/hotBanner.ts` | 지원사업 목록·지도 점·마감 띠 |
| `program_detail` | 뷰 | `lib/db.ts` | 지원사업 상세 |
| `job_posts` | 표 | `lib/pubJobs.ts`, `lib/search.ts`, `lib/mapData.ts`, `lib/hotBanner.ts`, `lib/worldjob.ts` (읽기) / `lib/jobsIngest.ts`, `lib/gojobsSite.ts` (쓰기, service) | 채용 목록·상세·검색·지도 |
| `job_overview`, `job_org_stats` | 뷰(물질화 뷰 위) | `lib/pubJobs.ts` | 채용 요약·기관별 통계 |
| `regions_available`, `area_summary`, `coverage`, `stat_age`, `stat_employment`, `stat_household` | 뷰(물질화 뷰 위) | `lib/db.ts` | 지역 색인·지역 요약·건수·통계표 |
| `settings_public` | 뷰 | `lib/settings.ts`, `lib/homeLoanRates.ts`, `lib/db.ts` | 광고·SEO·공지·금리표 설정 |
| `blog_public` | 뷰 | `lib/stories.ts` | 블로그 글 |
| `license_items` | 표 | `lib/qnet.ts` | 국가자격 종목 |
| `exam_rounds` | 표 | `lib/qnetExam.ts` | 시험 일정 |
| `agency_items` | 표 | `lib/agencyStore.ts` | 공공기관 사업·행사·시설 |
| `rate_rows` | 표 | `lib/collectors.ts` | 전세대출 금리(쓰기) |

### 1.2 RPC (Postgres 함수)

| 함수 | 부르는 곳 | 키 | 하는 일 |
|---|---|---|---|
| `home_bundle()` | `lib/db.ts` | anon | 첫 화면 묶음(건수·지역·마감·신규·통계) |
| `match_welfare(...)`, `count_welfare(...)` | `lib/db.ts` | anon | 복지 조건 검색·건수 |
| `match_business(...)`, `count_business(...)` | `lib/db.ts` | anon | 기업 조건 검색·건수 |
| `feed_closing(kind, limit)`, `feed_new(kind, limit)` | `lib/db.ts` | anon | 마감 임박·새 공고 |
| `housing_counts()` | `lib/housing.ts` | anon | 주거 지원 건수 |
| `hot_term_rows(days)` | `lib/hotTerms.ts` | anon | 많이 찾는 말 집계(묶음·건수만) |
| `log_search(...)` | `lib/db.ts` | anon | 조건 검색 기록(개인 식별 정보 없음) |
| `log_visit(...)` | `components/VisitTracker.tsx` (브라우저 fetch) | anon | 유입 기록 |
| `saved_add/list/open/remove` | `lib/saved.ts` (브라우저) | anon + 기기 열쇠 | 조건 저장 |
| `recovery_issue/claim` | `lib/saved.ts` (브라우저) | anon + 기기 열쇠/코드 | 저장 조건 옮기기 |
| `account_create/probe/mark/taken/update_contact` | `app/account/actions.ts` (서버 액션) | service | 선택 계정 |
| `schema_health(...)` | `lib/schemaHealth.ts` (관리자) | service | 배포 후 스키마 점검 |
| `refresh_site_stats()` | pg_cron | DB 내부 | 물질화 뷰 갱신 |
| `blog_*_stats(...)` | `pipeline/blog_daily.py` | service | 블로그 글감 통계 |

### 1.3 관리자 (service 키, `app/admin/*`)

`site_settings`(읽기·쓰기), `programs`(숨김 등 쓰기), `coverage`, `visit_log`, `search_log`,
`saved_condition`, `save_account`(건수·목록 보기).

### 1.4 브라우저에서 바로 부르는 것

공개 키로 PostgREST RPC 를 `fetch` 하는 곳이 두 군데 있다(번들 크기 때문에 supabase-js 를 안 씀).

- `lib/rest.ts` → `lib/saved.ts`: `saved_*`, `recovery_*`
- `components/VisitTracker.tsx`: `log_visit`

**이전 0단계에서 둘 다 Next 서버 경로(`/api/saved/*`, `/api/visit`)로 감싼다**(README §3). 그러면
브라우저는 우리 주소만 알고, 뒤의 백엔드가 바뀌어도 브라우저 코드는 그대로다.

## 2. 웹의 서버 경로

| 경로 | 하는 일 | 캐시 |
|---|---|---|
| `GET /api/map/items?kind&key` | 지도 점 하나의 요약 6건 | s-maxage 3600 |
| `GET /api/map/list?kind&region&lat&lng&r&status&sort&offset&limit&home` | 지도 왼쪽 공고 카드 목록 | s-maxage 600 |
| `GET /api/map/dongs?kind&bbox` · `?sido&sgg` | 지도 동네 단계의 읍·면·동 행정복지센터·청사(정적 자리표 `lib/dongData.ts`) | s-maxage 3600 |
| `GET /api/map/where?lat&lng` | 가까운 동·행정복지센터(좌표 약 100m 로 줄임, 저장 안 함) | private 600 |
| `GET /api/cron/jobs[?source=]` | 수집(채용·자격·시험·공공기관·금리). `Authorization: Bearer CRON_SECRET` 또는 관리자 세션 | 없음 |
| 서버 액션 `app/account/actions.ts` | 계정 만들기·불러오기·연락처 수정(캡차 검사) | — |
| 서버 액션 `app/admin/actions.ts` | 관리자 설정·수집 실행·글 관리 | — |

`web/middleware.ts` 는 `/jobs` 주소를 정본으로 308/404 처리만 한다(DB 안 씀).

## 3. 예약 작업

| 어디서 | 이름 | 언제(KST) | 무엇 |
|---|---|---|---|
| Vercel Cron | `/api/cron/jobs` | 매일 09:00 | 수집 9종을 나란히(최신분) |
| GitHub Actions | `collect.yml` | 매일 03:00 | `pipeline/collect.py` 복지로(지자체·중앙)·기업마당 → `raw_items`, `programs` |
| GitHub Actions | `collect_past.yml` | 하루 다섯 번(10·15·20·01·06시) | `/api/cron/jobs?source=` 로 과거 채용 이어 받기 |
| GitHub Actions | `korea_attach.yml` | 매일 11:00 | 정책브리핑 채용 첨부 → `job_posts` |
| GitHub Actions | `home_loan_rates.yml` | 매일 07:00 | 주택금융공사 금리표 → `site_settings` |
| GitHub Actions | `blog_daily.yml` | 매일 09:30 | 블로그 글 한 편 → `blog_posts` |
| GitHub Actions | `normalize.yml` | 손으로 | 조건 정규화 다시 돌리기 |
| GitHub Actions | `explore*.yml`, `probe.yml` | 손으로 | API·화면 탐침(운영 확인용) |
| Supabase pg_cron | `refresh-site-stats` | 30분마다 | `refresh_site_stats()` |

## 4. 파이프라인 (`pipeline/`)

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `collect.py` + `sources.py` | 공공 API 원본 수집과 공통 형태 변환 | `raw_items`, `programs`, `ingest_runs` |
| `normalize.py` (+ `revenue.py`) | 원문에서 나이·지역·가구·업종·매출 상한 등 조건 뽑기(규칙 기반) | `programs` |
| `sbiz24.py` | 소상공인24 지원사업(화면 내부 호출 흉내) | `programs` |
| `korea_attach.py` | 정책브리핑 채용 첨부파일 | `job_posts.raw` |
| `home_loan_rates.py` | 보금자리론·디딤돌 금리표 | `site_settings` |
| `blog_daily.py` | 통계 기반 블로그 글 | `blog_posts` |
| `probe_*.py`, `explore_*.py`, `check_setup.py` | 탐침·점검 | — |

## 5. 환경변수 (이름만 — 값은 Vercel·GitHub 비밀 설정에만 있다)

| 이름 | 공개? | 쓰는 곳 | AWS 에서 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 | 웹 | 3단계 뒤 없어짐(`API_BASE` 로 대체) |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GTM_ID` | 공개 | 웹 | 그대로 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY`, `NEXT_PUBLIC_NAVER_MAP_KEY`, `NEXT_PUBLIC_VWORLD_KEY` | 공개(도메인 제한 키) | 지도 | 그대로 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | 공개 / 비밀 | 캡차 | Secrets Manager |
| `NEXT_PUBLIC_LOGIN_VIDEO`, `NEXT_PUBLIC_LOGIN_CREDIT`, `NEXT_PUBLIC_LOGIN_CREDIT_URL` | 공개 | 관리자 로그인 화면 | 그대로 |
| `SUPABASE_SERVICE_KEY` (+ 파이프라인 `SUPABASE_URL`) | 비밀 | 서버 액션·관리자·수집 | DB 계정(Secrets Manager) |
| `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_SECRET` | 비밀 | 관리자 | Cognito 또는 Secrets Manager |
| `CRON_SECRET` | 비밀 | 수집 경로 | EventBridge → 내부 호출로 대체 |
| `GH_DISPATCH_TOKEN` | 비밀 | 관리자에서 Actions 실행 | 없어짐 |
| `DATA_GO_KR_KEY` | 비밀 | 공공데이터포털 API | Secrets Manager |
| `ALIOPLUS_API_KEY`, `ALIOPLUS_KEY_BUSINESS/EVENT/FACILITY/APBA` | 비밀 | 알리오플러스 | Secrets Manager |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 비밀 / 설정 | 파이프라인 | Secrets Manager(또는 Bedrock) |
| `OPENAPI_TIMEOUT_MS`, `ALIO_TIMEOUT_MS`, `MAX_CALLS_LOCAL`, `MAX_CALLS_CENTRAL` | 설정 | 수집 | SSM Parameter Store |

규칙(지금과 같다): 비밀은 코드·저장소·PR 본문·로그에 남기지 않는다. `NEXT_PUBLIC_` 이 붙은 것만
브라우저로 간다.

## 6. 바깥 API·누리집

| 곳 | 무엇 | 방식 |
|---|---|---|
| 공공데이터포털 `apis.data.go.kr`, `api.odcloud.kr` | 복지로·기업마당·나라일터·월드잡·자격 등 | REST(인증키) |
| 큐넷 `openapi.q-net.or.kr` | 종목·시험 일정 | REST(인증키) |
| 알리오플러스 `openapi.alioplus.go.kr` | 공공기관 사업·행사·시설 | REST(인증키) |
| 나라일터 `www.gojobs.go.kr` | 공고 목록 보충 | 화면 읽기(robots 준수) |
| 소상공인24 `www.sbiz24.kr` | 지원사업 | 화면 내부 호출 |
| 정책브리핑 `www.korea.kr` | 채용 첨부 | 화면 읽기 |
| 주택금융공사 `www.hf.go.kr` | 금리표 | 화면 읽기 |
| 마이홈 `www.myhome.go.kr` | 주거 안내 링크 | 링크만 |
| Cloudflare Turnstile | 캡차 | 위젯 + 서버 검증 |
| Google Tag Manager, AdSense | 측정·광고 | 스크립트 |
| 지도: OpenStreetMap 타일 / 카카오·네이버·브이월드(키가 있으면) | 정책지도 | 스크립트·타일 |
| Google Calendar | 일정 담기 링크 | 링크만 |

수집기의 User-Agent 는 `NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com)` 이고 robots.txt 를 따른다.
AWS 로 옮겨도 같은 UA 와 요청 간격을 지킨다(나가는 IP 가 바뀌므로 차단 여부를 처음에 확인).

## 다시 뽑는 명령

```bash
cd web
grep -rhoE '\.from\("[a-z_]+"\)' app components lib | sort | uniq -c | sort -rn   # 표·뷰
grep -rnoE 'rpc\("[a-z_]+"' app components lib                                 # 함수
grep -rhoE 'process\.env\.[A-Z0-9_]+' app components lib | sort -u               # 환경변수
grep -rhoE 'secrets\.[A-Z0-9_]+' ../.github/workflows | sort -u                   # Actions 비밀
```
