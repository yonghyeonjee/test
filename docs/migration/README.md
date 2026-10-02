# AWS · Java 백엔드 이전 계획

> 작성 2026-10-02. 지금 구조를 그대로 두고 조금씩 옮겨 가기 위한 설계 문서다.
> 숫자·이름은 이 날짜 기준이며, 바뀌면 이 폴더의 문서를 같이 고친다.

| 문서 | 내용 |
|---|---|
| [inventory.md](inventory.md) | 지금 무엇이 무엇을 부르는가 — 화면별 DB 접근, API, 예약 작업, 파이프라인, 환경변수, 외부 API |
| [db-schema.md](db-schema.md) | Supabase(Postgres) 스키마 스냅샷 — 표·뷰·물질화 뷰·함수·인덱스·RLS·pg_cron |
| [api-contract.md](api-contract.md) | Java 백엔드가 내줄 REST 계약 초안과 화면 쪽 교체 순서 |
| [openapi.yaml](openapi.yaml) | 위 계약의 OpenAPI 3.1 초안 |
| [notifications.md](notifications.md) | 메일·문자 알림 설계와 수신 동의 규칙(정보통신망법·개인정보 보호법) |

## 1. 지금 구조 (2026-10)

```
브라우저 ──▶ Vercel (Next.js 14, icn1)
              ├─ 서버 컴포넌트·ISR ──▶ Supabase PostgREST (anon 키, 공개 뷰·RPC)
              ├─ 서버 액션(계정·관리자) ──▶ Supabase (service_role 키, 서버 전용)
              ├─ /api/map/*, /api/cron/jobs ──▶ 같은 DB + 공공 API
              └─ 브라우저 일부 ──▶ PostgREST RPC 직접(saved_*, recovery_*)

GitHub Actions (예약) ──▶ pipeline/*.py ──▶ 공공 API·누리집 ──▶ Supabase (service_role)
Supabase pg_cron ──▶ refresh_site_stats() 30분마다 (물질화 뷰 갱신)
Vercel Cron ──▶ /api/cron/jobs 매일 09:00 KST
```

- 화면 코드가 DB 를 직접 안다. `web/lib/db.ts`(supabase-js), `web/lib/rest.ts`(브라우저 fetch),
  각 기능 모듈(`pubJobs.ts`, `search.ts`, `mapData.ts` …)이 표·뷰 이름과 컬럼을 직접 쓴다.
- 업무 규칙의 상당수가 Postgres 함수 안에 있다(`match_welfare`, `count_business`, `home_bundle` …).
  이전의 핵심은 **이 함수들을 Java 서비스로 옮기는 일**이다.
- 정규화(조건 뽑기)는 파이썬 규칙 기반(`pipeline/normalize.py`), 일부 글쓰기에 Gemini 를 쓴다.

## 2. 목표 구조 (AWS)

```
Route 53 ─▶ CloudFront ─┬─▶ 웹(Next.js) : Amplify Hosting 또는 ECS Fargate(OpenNext/standalone)
                        └─▶ /api/* : ALB ─▶ ECS Fargate — Spring Boot 3 (Java 21)
                                                    │
                     ┌──────────────────────────────┼──────────────────────────────┐
                     ▼                              ▼                              ▼
             Aurora PostgreSQL           ElastiCache(Redis, 선택)          SQS (알림 큐) ─▶ 워커
             (pg_trgm, 읽기 복제)        홈 묶음·많이 찾는 말 캐시            ├─ SES (메일)
                                                                             └─ 국내 문자 중계사 / 알림톡
EventBridge Scheduler ─▶ ECS 작업(수집·정규화·글쓰기·통계 갱신)
Secrets Manager / SSM Parameter Store ─▶ 모든 키
CloudWatch Logs·Alarms, X-Ray(선택), S3(원본 보관·백업)
```

결정 기준:

- **DB 는 Postgres 를 유지한다.** 스키마·트라이그램 검색(`pg_trgm`)·배열 컬럼(GIN)을 그대로 쓰려면
  Aurora PostgreSQL 이 가장 덜 바뀐다. MySQL 로 가면 배열·트라이그램을 다시 짜야 한다.
- **Java 는 Spring Boot 3 + Java 21.** 데이터 접근은 jOOQ 또는 Spring Data JDBC 를 권한다 —
  지금 SQL 함수가 많아 JPA 엔티티 매핑보다 SQL 을 그대로 옮기기 쉽다. 마이그레이션은 Flyway.
- **웹은 Next.js 를 유지한다.** 화면·SEO(ISR, 사이트맵, 구조화 자료)는 그대로 두고, 데이터만
  Java API 로 받는다. 호스팅은 Vercel 에 남겨도 되고 Amplify/ECS 로 옮겨도 된다(3단계).
- **검색은 1차로 Postgres(trgm + 동의어 확장)를 그대로 옮긴다.** 자료가 수십만 건을 넘거나
  형태소 검색이 필요해지면 OpenSearch(nori 분석기)를 붙인다(선택).
- **예약 작업은 EventBridge Scheduler + ECS 작업.** GitHub Actions 의 파이썬 수집기는 컨테이너로
  감싸 그대로 돌리다가, 필요한 것만 Java(Spring Batch)로 다시 쓴다.

## 3. 옮기는 순서 (조금씩 바꾸기 — strangler)

한 번에 갈아엎지 않는다. 각 단계는 따로 배포하고 되돌릴 수 있어야 한다.

| 단계 | 하는 일 | 끝났다는 기준 | 되돌리기 |
|---|---|---|---|
| 0. 준비 | 이 문서 정리, 함수·권한 전수 점검, `web/lib` 에 데이터 접근 경계(어댑터) 만들기 | 화면 코드가 표 이름을 직접 쓰지 않고 어댑터 함수만 부른다 | 코드 되돌리기 |
| 1. 읽기 API | Spring Boot 로 공개 읽기 API(검색·목록·상세·지도·홈 묶음)를 같은 Supabase DB 위에 띄운다 | 어댑터가 기능 깃발(환경변수)로 Supabase/Java 를 고른다. 두 응답을 비교하는 그림자 호출로 차이 0 | 깃발을 Supabase 로 |
| 2. 쓰기·계정 | 조건 저장·되찾기·계정·검색 기록을 Java 로. 브라우저의 PostgREST 직접 호출을 없앤다 | anon 키로 부르는 RPC 가 0 개 | 깃발 |
| 3. DB 이전 | Aurora 로 옮긴다(pg_dump/restore 또는 AWS DMS). 한동안 Supabase → Aurora 복제 | 읽기·쓰기 모두 Aurora. 행 수·검사합 일치 | DNS/연결 문자열을 Supabase 로 |
| 4. 예약 작업 | 수집·정규화·통계 갱신을 EventBridge + ECS 로 | GitHub Actions 예약 끔, pg_cron 끔 | 예약을 다시 켬 |
| 5. 알림 | 메일·문자 알림(notifications.md) | 동의 기록·수신거부·발송 기록이 갖춰짐 | 발송 중지 깃발 |
| 6. 웹 호스팅(선택) | Next.js 를 Amplify 또는 ECS 로 | CloudFront 뒤에서 모든 쪽 200, Core Web Vitals 유지 | DNS 를 Vercel 로 |

### 0단계에서 할 일 (지금 저장소에서 바로 시작할 수 있는 것)

1. `web/lib/backend/` 를 만들고 화면이 쓰는 데이터 함수를 여기로 모은다. 예:
   `getHomeBundle`, `matchWelfare`, `searchAll`, `listJobs`, `getProgram`, `getMapData`, `listSaved` …
   지금 이 함수들은 `db.ts`·`pubJobs.ts`·`search.ts`·`saved.ts` 등에 흩어져 있다(목록: inventory.md).
2. 어댑터는 `BACKEND=supabase|java` 환경변수 하나로 구현을 고른다. Java 구현은 `fetch(API_BASE + 경로)`.
3. 응답 타입은 지금 TypeScript 타입(`Program`, `JobPost` …)을 그대로 계약으로 삼는다 — openapi.yaml 의
   스키마가 그 타입을 옮긴 것이다.
4. 브라우저에서 PostgREST 를 직접 부르는 곳(`lib/rest.ts` 를 쓰는 `saved.ts`)을 Next 의 서버 경로
   (`/api/saved/*`)로 감싼다. 그러면 2단계에서 브라우저 코드는 그대로 두고 서버 쪽만 바꾼다.

## 4. 데이터 이전 메모

- 큰 표: `job_posts`(약 23만 행, 170MB), `programs`(약 8.8천 행, 55MB, 원문 포함), `raw_items`(19MB).
  나머지는 작다. pg_dump 로 충분한 크기다.
- 물질화 뷰 8개는 `refresh_site_stats()` 가 30분마다 갱신한다(pg_cron). Aurora 에서는 pg_cron 대신
  EventBridge 로 같은 SQL 을 부르거나, Java 쪽에서 캐시(Redis)로 대신한다.
- 확장: `pg_trgm`, `pgcrypto`, `uuid-ossp`, `pg_cron`, `pg_stat_statements`, `supabase_vault`.
  Aurora 는 앞의 셋과 `pg_stat_statements` 를 지원한다. `supabase_vault` 는 Secrets Manager 로 대신한다.
- RLS 는 PostgREST 를 위한 장치다. Java 가 DB 앞에 서면 공개 접근이 없어지므로 RLS 대신
  **DB 계정 분리**(읽기 전용 / 쓰기 / 관리)로 바꾼다.
- 개인정보가 든 표: `save_account`(아이디·비밀번호 해시·이름·휴대폰 뒤 8자리·이메일·동의),
  `saved_searches`(옛 표, 이름·전화·이메일), `saved_condition`(익명 기기 열쇠 + 조건 — 저소득·장애인 같은
  민감할 수 있는 조건이 들어간다). 이전 시 암호화 저장(KMS)·접근 기록·보유 기간을 다시 정한다.

## 5. 끊김 없이 넘기기 (컷오버) 점검표

- [ ] 그림자 호출 1주: 같은 요청을 두 백엔드에 보내 응답 차이를 기록, 차이 0 확인
- [ ] 쓰기 이전 전날: 쓰기 기능(조건 저장·계정) 잠깐 읽기 전용 안내
- [ ] DB 최종 동기화 → 연결 전환 → 행 수·최근 시각 확인
- [ ] 예약 작업 이중 실행 방지: 한쪽을 끈 뒤 다른 쪽을 켠다
- [ ] 되돌리기 연습: 깃발을 되돌려 5분 안에 원상복구 되는지 한 번 해 본다
- [ ] 사이트맵·robots·정본 주소 변화 없음(검색 노출 유지)

## 6. 아직 정할 것

- 웹 호스팅을 Vercel 에 남길지(가장 쉬움) AWS 로 옮길지
- 문자 발송 경로: 국내 문자 중계사 API vs AWS End User Messaging SMS (notifications.md §4)
- 정규화의 LLM 사용 범위와 모델(지금 `GEMINI_MODEL` 환경변수) — Bedrock 으로 옮길지
- 관리자 인증: 지금은 환경변수 아이디·비밀번호 + 서명 쿠키. Cognito 또는 SSO 로 바꿀지
- 계정 체계: 지금은 "익명 기기 열쇠 + 선택 계정". 알림을 붙이면 본인 확인(휴대폰 인증) 필요 여부
