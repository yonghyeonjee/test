# DB 스키마 스냅샷 (Supabase Postgres, 2026-10-02)

Supabase 운영 DB 의 `public` 스키마를 읽어 정리했다. 행 수는 통계 추정치(`reltuples`)다.
정의의 원본은 `sql/000_init.sql` ~ `sql/005_*.sql` 과 운영 DB 이며, 이 문서는 이전 설계용 요약이다.

## 1. 표

| 표 | 대략 행 수 / 크기 | 주요 컬럼 | 비고 |
|---|---|---|---|
| `programs` | 8,782 / 55MB | `id`, `kind`(welfare·business·event), `source`, `source_id`, `title`, `summary`, `detail_url`, `org_name`, `dept_name`, `sido`, `sigungu`, `age_min/max`, `income_pct`, `employment[]`, `household[]`, `life_cycle[]`, `topics[]`, `biz_target[]`, `biz_field[]`, `biz_years_min/max`, `industry[]`, `apply_start/end`, `is_always_on`, `online_apply`, `support_type`, `contact`, `apply_method`, `raw_target/criteria/benefit`, `norm_*`, `amount_max`, `revenue_max`, `search_text`, `attach`(jsonb), `first_seen_at`, `fetched_at`, `updated_at` | 핵심 표. `(source, source_id)` 유일. 원문과 정규화 결과를 같이 둔다 |
| `raw_items` | 8,783 / 19MB | `source`, `source_id`, `payload`(jsonb), `fetched_at`, `updated_at` | 수집 원본. S3 로 옮겨도 된다 |
| `job_posts` | 230,615 / 170MB | `id`, `source`(gojobs·worldjob…), `source_id`, `title`, `org`, `region`, `hire`, `recruit`, `sectors`, `headcount`, `start_date`, `end_date`, `reg_date`, `url`, `nation`, `lang`, `visa`, `career`, `industry`, `raw`(jsonb), `area_code`, `type01/02`, `first_seen_at`, `fetched_at` | 가장 큰 표. 2008년부터의 공고 |
| `agency_items` | 1,991 / 4MB | `id`, `kind`(business·event·facility), `title`, `org`, `cate`, `target`, `descr`, `address`, `start/end_date`, `url`, `tags[]`, `sido`, `raw` | 알리오플러스 |
| `license_items` | 613 | `code`, `name`, `kind`, `kind_name`, `series`, `field`, `sub_field` | 큐넷 종목 |
| `exam_rounds` | 38 | `id`, `grade`, `round`, 필기·실기 접수/시험/발표 날짜들 | 큐넷 시험 일정 |
| `rate_rows` | 13 | `bank`, `ratio`, `base`, `extra`, `rate`, `ymd_from/to` | 전세대출 금리 |
| `blog_posts` | 수십 | `slug`, `kind`, `subject`, `title`, `summary`, `keywords[]`, `body`(jsonb), `stats`, `published_at` | 자동 블로그 |
| `site_settings` | 18 | `key`, `value`(jsonb), `updated_at` | 광고·SEO·공지·수집 커서·금리표 |
| `ingest_runs` | 112 | `source`, `started_at`, `finished_at`, `fetched/inserted/updated`, `status`, `message` | 수집 기록 |
| `region_alias` | 50 | `alias`, `sido` | 옛 시·도 이름 → 지금 이름 |
| `search_log` | 1,852 | `at`, `kind`, `sido`, `sigungu`, `age_band`, `employment`, `household[]`, `biz_target`, `biz_field[]`, `n_results`, `entry` | 조건 검색 기록(식별 정보 없음) |
| `visit_log` | 2,325 | `at`, `channel`, `ref_host`, `term`, `landing`, `utm_*` | 유입 기록 |
| `saved_condition` | 소수 | `device_key`(uuid), `cond_key`, `kind`, `query`, `label[]`, `created_at`, `opened_at`, `open_count` | 익명 기기 열쇠로 저장한 조건. 90일 안 열면 지운다 |
| `device_recovery` | 소수 | `code`, `device_key`, `used_at`, `fail_count`, `disabled` | 저장 조건 옮기기 코드 |
| `save_account` | 0 | `username`, `username_key`, `pass_hash`(scrypt), `device_key`, `display_name`, `phone_tail`(휴대폰 뒤 8자리), `email`, `notify_consent`, `consent_at`, `last_login_at`, `fail_count`, `locked_until` | 선택 계정. **개인정보** |
| `saved_searches` | 0 | `name`, `phone`, `phone_tail`, `email`, `biz_no`, `consented_at`, `query` | 옛 저장 방식. 비어 있다 — 이전 때 버린다 |
| `_setup_check` | — | — | 설치 점검용 |

## 2. 물질화 뷰 (3시간마다 `refresh_site_stats()`)

`area_summary_mv`, `coverage_mv`, `job_org_stats_mv`(13,735행), `job_overview_mv`, `regions_available_mv`,
`stat_age_mv`, `stat_employment_mv`, `stat_household_mv`, `housing_counts_mv`(2026-10-06). 모두 `programs` 또는 `job_posts` 의 집계다.
첫 화면 묶음은 `home_bundle_cache`(한 줄, jsonb)에 미리 계산해 두고 `refresh_home_bundle()` 이 15분마다 갈아 끼운다(2026-10-06).
공개 쪽은 같은 이름에서 `_mv` 를 뗀 **뷰**(`area_summary`, `coverage` …)로 읽는다.

Java 이전 때: 같은 집계를 배치(EventBridge, 30분)로 돌려 표에 쓰거나, 서비스에서 계산해 Redis 에 둔다.

## 3. 공개 뷰

| 뷰 | 바탕 | 비고 |
|---|---|---|
| `programs_public` | `programs` | 원문 컬럼을 빼고 `tidy()` 로 다듬은 요약, `program_status()` 로 상태·남은 날 계산 |
| `program_detail` | `programs` | 상세(대상·기준·혜택 원문 다듬음) |
| `blog_public` | `blog_posts` | 발행일이 지난 것만 |
| `settings_public` | `site_settings` | 화면이 읽는 설정 |
| `saved_popular` | `saved_condition` | 많이 저장된 조건(관리자) |
| `area_summary`, `coverage`, `job_org_stats`, `job_overview`, `regions_available`, `stat_*` | 물질화 뷰 | 위 §2 |

## 4. 함수 (업무 규칙이 들어 있는 것)

| 함수 | 돌려주는 것 | 옮길 곳 |
|---|---|---|
| `match_welfare(p_sido, p_sigungu, p_age, p_employment, p_household[], p_limit, p_min_conf, p_q[])` | `programs_public` 행들 | `WelfareSearchService` |
| `count_welfare(...)` | 건수 | 같은 서비스 |
| `match_business(p_sido, p_biz_target, p_biz_field[], p_biz_years, p_industry[], p_limit, p_min_conf, p_q[])` | `programs_public` 행들 | `BusinessSearchService` |
| `count_business(...)` | 건수 | 같은 서비스 |
| `feed_closing(p_kind, p_limit)`, `feed_new(...)`, `feed_ending(...)` | 마감 임박·새 공고 | `FeedService` |
| `home_bundle()` | jsonb(건수·지역·지역 요약·통계·마감·신규·설정). `home_bundle_cache` 를 읽고, 2시간 넘게 묵었으면 `home_bundle_live()` 로 직접 계산 | `HomeService` + 캐시 |
| `housing_counts()` | (who, kind, sido, n) — `housing_counts_mv` 를 읽는다 | `HousingService` |
| `hot_term_rows(p_days)` | 검색어·첫 쪽·조건 묶음별 건수(2건 이상만) | `HotTermService` |
| `log_search(...)`, `log_visit(...)` | 없음(기록) | `LogService`(비동기) |
| `saved_add/list/open/remove`, `recovery_issue/claim`, `purge_stale_saved()` | 저장 조건 | `SavedConditionService` |
| `account_create/probe/mark/taken/update_contact` | 계정 | `AccountService` |
| `blog_*_stats(...)`, `blog_org_candidates(...)` | jsonb 통계 | 글쓰기 배치 |
| `program_status(end, always)`, `tidy(text)`, `text_hits(text, q[])` | 보조 | 서비스 내부 유틸 |
| `refresh_site_stats()` | 물질화 뷰 갱신 뒤 `refresh_home_bundle()` | 배치 |
| `refresh_home_bundle()`, `home_bundle_live()` | 첫 화면 묶음 다시 계산 (anon 은 못 부름) | 배치 |
| `schema_health(fns[], rels[])` | 점검 | 배포 후 점검 작업 |

이전 때 바로잡을 것:

- `program_status(end, always)` 는 `IMMUTABLE` 로 선언돼 있지만 `current_date` 를 쓴다(실제로는 `STABLE`).
  또 `current_date` 는 DB 시간대 기준이라 한국 시각 00~09시에는 하루 어긋날 수 있다. Java 에서는
  "오늘"을 `Asia/Seoul` 로 계산한다(웹은 이미 `lib/consts.ts` 의 `todayKST()` 로 그렇게 한다).

대부분 `SECURITY DEFINER` + `search_path` 고정이다. 이전 전에 **모든 함수의 실행 권한(EXECUTE)을
공개용과 서버 전용으로 나눠 다시 점검**한다. Java 가 DB 앞에 서면 공개 실행 권한은 하나도 필요 없다.

## 5. 인덱스 (요점)

- `programs`: `(source, source_id)` 유일, `(kind, sido, sigungu)`, `(age_min, age_max)`, `apply_end`(부분),
  `first_seen_at DESC`, 배열 GIN(`employment`, `household`, `topics`, `life_cycle`, `biz_target`, `biz_field`, `industry`),
  `search_text` 트라이그램 GIN, 정규화 상태 부분 인덱스.
- `job_posts`: `id` 유일, `source_id`, `(source, end_date)`, `(source, reg_date DESC, end_date DESC)`,
  `(source, region, reg_date DESC)`, gojobs 기관별 부분 인덱스, `title`·`org` 트라이그램 GIN.
- `saved_condition`: `(device_key, cond_key)` 유일, `(device_key, created_at DESC)`.
- `save_account`: `username_key` 유일, `device_key`.
- 로그: `search_log(at DESC)`, `visit_log(at DESC)`.

Aurora 로 옮길 때 그대로 만든다(`pg_trgm` 지원).

## 6. 행 단위 보안(RLS)

모든 표에 RLS 가 켜져 있고, 공개 읽기 정책은 `agency_items`, `exam_rounds`, `job_posts`, `license_items`,
`rate_rows` 다섯 표뿐이다. 나머지는 정책 없음(= 공개 키로 직접 못 읽음)이고 뷰·함수로만 연다.
Java 이전 뒤에는 RLS 대신 DB 계정을 나눈다: `app_read`(SELECT), `app_write`(정해진 표 쓰기),
`batch`(수집·정규화), `admin`.

## 7. 확장·예약

- 확장: `pg_trgm 1.6`, `pgcrypto 1.3`, `uuid-ossp 1.1`, `pg_cron 1.6.4`, `pg_stat_statements 1.11`, `supabase_vault 0.3.1`
- pg_cron: `refresh-site-stats` — `7 */3 * * *` — `select public.refresh_site_stats()` (2026-10-06 장애 뒤 30분→3시간)
- pg_cron: `refresh-home-bundle` — `3,18,33,48 * * * *` — `select public.refresh_home_bundle()`
- 트리거: `programs`, `raw_items` 의 `BEFORE UPDATE` → `touch_updated_at()`

## 다시 뽑는 SQL

```sql
-- 표·뷰 목록과 크기
select c.relname, c.relkind, c.reltuples::bigint, pg_size_pretty(pg_total_relation_size(c.oid))
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','v','m') order by 2, 1;

-- 함수와 실행 권한
select p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' order by 1;
```
