# Java 백엔드 REST 계약 초안

화면(Next.js)이 지금 DB 에서 직접 가져오는 것을 Java 서비스가 대신 내준다. 계약의 기준은
**지금 TypeScript 타입**이다(`Program`, `Job`, `SearchResult`, `MapPointLite`/`ItemRow` …). 화면 코드를
덜 바꾸려고 필드 이름과 모양을 그대로 둔다. 기계가 읽는 정의는 [openapi.yaml](openapi.yaml).

## 공통

- 기본 주소: `https://api.jiwon.knowhow-it.com/v1` (CloudFront 뒤 ALB). 화면 서버는 `API_BASE` 환경변수로 받는다.
- 형식: JSON, UTF-8. 날짜는 `YYYY-MM-DD`(한국 날짜), 시각은 ISO 8601(UTC, `Z`).
- 오류: `{"error": {"code": "BAD_REQUEST", "message": "사람이 읽는 한국어 설명"}}` + HTTP 상태.
- 쪽 나누기: `offset`·`limit`(최대 60). 응답에 `total`(정확히 셀 수 없으면 `null`).
- 캐시: 공개 읽기는 `Cache-Control: public, s-maxage=…, stale-while-revalidate=…`. 화면의 ISR 주기와 맞춘다
  (홈 900초, 지도 3600초, 많이 찾는 말 86400초).
- 인증:
  - 공개 읽기: 없음(속도 제한만 — WAF rate-based rule).
  - 저장 조건: `X-Device-Key: <uuid>` 머리글(지금의 익명 기기 열쇠). 본문·주소창에 넣지 않는다.
  - 계정: 로그인하면 HttpOnly·Secure·SameSite=Lax 쿠키(세션). 비밀번호 해시는 scrypt 를 그대로 검증한다
    (저장 형태 `scrypt$N$r$p$salt$hash` — `web/lib/password.ts`).
  - 관리자·배치: 내부 망(보안 그룹) + 서비스 토큰. 바깥에 열지 않는다.
- 기록: 검색·방문 기록은 비동기(SQS 또는 Kinesis Firehose)로 쌓는다. 응답을 늦추지 않는다.

## 엔드포인트

### 첫 화면·목록

| 메서드·경로 | 지금 하는 곳 | 응답 |
|---|---|---|
| `GET /home` | `home_bundle()` | 건수·지역·지역 요약·통계·마감·신규·설정 |
| `GET /feeds/closing?kind&limit` | `feed_closing` | `Program[]` |
| `GET /feeds/new?kind&limit` | `feed_new` | `Program[]` |
| `GET /hot-terms` | `hot_term_rows` + `lib/hotRank.ts` | `{welfare: string[], business: string[], days, from}` |
| `GET /hot-slides` | `lib/hotBanner.ts` | 마감 띠 `Slide[]` |

### 지원사업

| 메서드·경로 | 지금 하는 곳 | 응답 |
|---|---|---|
| `GET /programs/welfare?sido&sigungu&age&emp&hh[]&q&limit` | `match_welfare` + `count_welfare` | `{items: Program[], total}` |
| `GET /programs/business?sido&target&field[]&years&ind[]&q&limit` | `match_business` + `count_business` | `{items: Program[], total}` |
| `GET /programs/{sourceId}` | `program_detail` | `ProgramDetail` |
| `GET /programs/{sourceId}/related` | `getRelated` | `Program[]` |
| `GET /areas`, `GET /areas/{sido}` | `area_summary`, `listByArea` | 지역 요약·목록 |
| `GET /topics/{key}` | `listByTopic` | `Program[]` |
| `GET /housing/counts` | `housing_counts` | 집계 |

### 통합 검색

| 메서드·경로 | 지금 하는 곳 | 응답 |
|---|---|---|
| `GET /search?q&scope=all|business` | `lib/search.ts` `unifiedSearch` | `SearchResult` (복지·기업·채용·자격·공공기관·안내 글, 연관어·확장어) |

동의어 사전(`lib/thesaurus.ts`)과 조건 파서(`lib/parse.ts`)는 1단계에서는 화면 쪽에 그대로 두고
결과만 Java 가 낸다. 2단계에서 Java 로 옮기고, 화면은 자동완성 목록만 받는다(`GET /suggest?q`).

### 채용

| 메서드·경로 | 지금 하는 곳 | 응답 |
|---|---|---|
| `GET /jobs?region&hire&status&q&page` | `lib/pubJobs.ts` `getJobs` | `{jobs: Job[], total}` |
| `GET /jobs/{id}` | `getJob`, `getJobAttach` | `Job` + 첨부 |
| `GET /jobs/overview`, `GET /jobs/orgs/{org}` | `job_overview`, `job_org_stats` | 요약·기관 통계 |
| `GET /jobs/overseas?nation` | `lib/worldjob.ts` | 해외취업 |

### 자격·공공기관·금융·글

`GET /licenses`, `GET /licenses/{code}`, `GET /exams/upcoming`, `GET /agency?kind&life&cate&sido`,
`GET /rates/jeonse`, `GET /rates/home-loan`, `GET /stories`, `GET /stories/{slug}`, `GET /settings/public`.

### 정책지도

| 메서드·경로 | 지금 하는 곳 | 응답 |
|---|---|---|
| `GET /map?kind` | `getMapData` → `liteOf` | 점 목록(`PinRow` 튜플) |
| `GET /map/items?kind&key` | `/api/map/items` | 점 하나의 요약 6건 |
| `GET /map/list?kind&region&lat&lng&r&status&sort&offset&limit&home` | `/api/map/list` | 왼쪽 카드 목록(`ItemRow` 튜플). `home`(시·도\|시·군·구)은 반경과 상관없이 맨 앞 |
| `GET /map/dongs?kind&bbox=s,w,n,e` 또는 `?sido&sgg` | `/api/map/dongs` | 읍·면·동 행정복지센터·청사(`DongRow` 튜플: 열쇠·시·도·시·군·구·구·동·위도·경도·센터 이름·청사 여부·동 이름이 적힌 공고 수) |
| `GET /map/where?lat&lng` | `/api/map/where` | 가까운 동과 행정복지센터. 좌표는 소수 셋째 자리로 줄여 받고 저장하지 않는다 |

튜플(배열) 모양은 HTML 무게 때문에 고른 것이다(쪽 HTML 467KB → 178KB). 그대로 둔다.

읍·면·동 자리표(`web/lib/dongData.ts`, 약 300KB)는 DB 가 아니라 코드에 든 정적 자료다
(OpenStreetMap, ODbL — 출처 표기를 지켜야 한다). 자바로 옮길 때는 같은 파일을 JSON 으로 내보내 서버
메모리에 올리거나 표 하나(`dong_place`)로 넣는다. 만드는 법은 `pipeline/osm_dong.py` → `pipeline/build_dong_data.py`.

### 저장 조건·계정 (쓰기)

| 메서드·경로 | 지금 하는 곳 | 비고 |
|---|---|---|
| `GET /me/saved` | `saved_list` | `X-Device-Key` |
| `PUT /me/saved/{condKey}` | `saved_add` | 본문 `{kind, query, label[]}` |
| `POST /me/saved/{condKey}/open` | `saved_open` | 연 횟수 |
| `DELETE /me/saved/{condKey}` | `saved_remove` | |
| `POST /me/recovery` / `POST /me/recovery/claim` | `recovery_issue` / `recovery_claim` | 8자리 코드 |
| `POST /accounts` / `POST /sessions` | `account_create` / `account_probe`+`account_mark` | 캡차 토큰 필수, 5회 실패 15분 잠금 |
| `PUT /me/contact` | `account_update_contact` | 연락처·동의 — 알림 설계(notifications.md)로 대체 |

### 알림 (새로 — notifications.md)

`GET /me/alerts`, `PUT /me/alerts/{condKey}`(채널·빈도), `DELETE /me/alerts/{condKey}`,
`POST /me/consents`(채널별·야간 동의, 근거 문구 버전), `POST /unsubscribe/{token}`(로그인 없이 한 번에 거부),
`POST /me/phone/verify`(휴대폰 본인 확인 코드).

### 기록

`POST /events/search`, `POST /events/visit` — 204, 비동기 적재. 지금의 `log_search`·`log_visit` 과 같은 필드.

## 화면 쪽 교체 순서

1. `web/lib/backend/` 어댑터에 위 엔드포인트와 1:1 인 함수를 만든다. 지금 구현은 Supabase 를 그대로 부른다.
2. 화면이 어댑터만 부르도록 바꾼다(기능 변화 없음, 한 번에 한 묶음씩).
3. 묶음마다 `BACKEND_<묶음>=java` 깃발을 켜서 Java 로 넘긴다. 그림자 호출로 응답을 비교한다.
4. 마지막에 Supabase 구현과 `NEXT_PUBLIC_SUPABASE_*` 를 지운다.

묶음 순서(위험이 낮은 것부터): 자격·공공기관·금리·글 → 채용 → 지도 → 지원사업·검색·홈 → 저장 조건 → 계정·알림.
