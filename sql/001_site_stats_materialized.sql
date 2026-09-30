-- 2026-09-30 적용됨 (Supabase 마이그레이션 site_stats_materialized).
--
-- 통계 뷰 8개는 요청마다 programs/job_posts 전체를 다시 세었다.
-- job_overview 하나가 10초를 넘고, 이것들이 익명 접속의 3초 제한을 넘기며
-- DB 전체를 굶겼다(첫 화면 "개인 복지 0건"). 한 번 세어 둔 것을 30분마다
-- 갈아 끼우는 물리화 뷰로 바꾸고, 웹이 쓰는 뷰 이름은 그대로 둔다.

create extension if not exists pg_cron;

-- ── 채용 ─────────────────────────────────────────────
create materialized view public.job_overview_mv as
 SELECT count(*)::integer AS total,
    count(*) FILTER (WHERE end_date >= CURRENT_DATE)::integer AS open_n,
    count(DISTINCT org)::integer AS orgs,
    count(*) FILTER (WHERE reg_date >= (CURRENT_DATE - 365))::integer AS last_year,
    min(reg_date) AS first_reg,
    max(reg_date) AS last_reg,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY ((end_date - reg_date)::double precision))
      FILTER (WHERE reg_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= reg_date AND (end_date - reg_date) <= 120)::integer AS med_days
   FROM job_posts
  WHERE source = 'gojobs';
create unique index job_overview_mv_uq on public.job_overview_mv (total);

create materialized view public.job_org_stats_mv as
 SELECT org,
    count(*)::integer AS n,
    count(*) FILTER (WHERE end_date >= CURRENT_DATE)::integer AS open_n,
    min(reg_date) AS first_reg,
    max(reg_date) AS last_reg,
    round(avg(end_date - reg_date) FILTER (WHERE reg_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= reg_date AND (end_date - reg_date) <= 120))::integer AS avg_days,
    ARRAY[count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 1)::integer, count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 2)::integer,
          count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 3)::integer, count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 4)::integer,
          count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 5)::integer, count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 6)::integer,
          count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 7)::integer, count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 8)::integer,
          count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 9)::integer, count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 10)::integer,
          count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 11)::integer, count(*) FILTER (WHERE EXTRACT(month FROM reg_date) = 12)::integer] AS months
   FROM job_posts
  WHERE source = 'gojobs' AND org IS NOT NULL AND btrim(org) <> ''
  GROUP BY org;
create unique index job_org_stats_mv_uq on public.job_org_stats_mv (org);
create index job_org_stats_mv_n on public.job_org_stats_mv (n desc);

-- ── 복지·기업 프로그램 ───────────────────────────────
create materialized view public.coverage_mv as
 SELECT kind,
    count(*) AS total,
    count(*) FILTER (WHERE raw_target IS NOT NULL) AS has_detail,
    count(*) FILTER (WHERE norm_at IS NOT NULL) AS normalized,
    count(*) FILTER (WHERE norm_at IS NOT NULL AND norm_confidence > 0.3) AS usable
   FROM programs
  GROUP BY kind;
create unique index coverage_mv_uq on public.coverage_mv (kind);

create materialized view public.area_summary_mv as
 SELECT sido,
    count(*) AS n,
    count(*) FILTER (WHERE age_max IS NOT NULL AND age_max <= 39) AS youth,
    count(*) FILTER (WHERE age_min IS NOT NULL AND age_min >= 60) AS senior,
    count(*) FILTER (WHERE household && ARRAY['저소득']) AS low_income,
    count(*) FILTER (WHERE household && ARRAY['장애인']) AS disabled,
    count(*) FILTER (WHERE household && ARRAY['임산부', '다자녀']) AS family
   FROM programs
  WHERE kind = 'welfare' AND norm_at IS NOT NULL AND norm_confidence > 0.3 AND sido IS NOT NULL
  GROUP BY sido;
create unique index area_summary_mv_uq on public.area_summary_mv (sido);

create materialized view public.regions_available_mv as
 SELECT sido, sigungu, count(*) AS n
   FROM programs
  WHERE kind = 'welfare' AND norm_at IS NOT NULL AND norm_confidence > 0.3 AND sido IS NOT NULL
  GROUP BY sido, sigungu;
create unique index regions_available_mv_uq on public.regions_available_mv (sido, sigungu) nulls not distinct;

create materialized view public.stat_age_mv as
 SELECT b.band, b.label, c.n, b.ord
   FROM ( VALUES ('teen','청소년 (~18세)',1), ('youth','청년 (19~39세)',2), ('middle','중장년 (40~64세)',3), ('senior','어르신 (65세~)',4)) b(band, label, ord)
     CROSS JOIN LATERAL ( SELECT count(*) AS n
           FROM programs
          WHERE programs.kind = 'welfare' AND programs.norm_at IS NOT NULL AND programs.norm_confidence > 0.3 AND
                CASE b.band
                    WHEN 'teen'   THEN COALESCE(programs.age_max, 200) <= 18
                    WHEN 'youth'  THEN COALESCE(programs.age_min, 0) <= 39 AND COALESCE(programs.age_max, 200) >= 19 AND COALESCE(programs.age_max, 200) <= 45
                    WHEN 'middle' THEN COALESCE(programs.age_min, 0) <= 64 AND COALESCE(programs.age_max, 200) >= 40
                    WHEN 'senior' THEN COALESCE(programs.age_min, 0) >= 60
                    ELSE NULL::boolean
                END) c;
create unique index stat_age_mv_uq on public.stat_age_mv (band);

create materialized view public.stat_employment_mv as
 SELECT e.e AS label, count(*) AS n
   FROM programs, LATERAL unnest(programs.employment) e(e)
  WHERE programs.kind = 'welfare' AND programs.norm_at IS NOT NULL AND programs.norm_confidence > 0.3
  GROUP BY e.e;
create unique index stat_employment_mv_uq on public.stat_employment_mv (label);

create materialized view public.stat_household_mv as
 SELECT h.h AS label, count(*) AS n
   FROM programs, LATERAL unnest(programs.household) h(h)
  WHERE programs.kind = 'welfare' AND programs.norm_at IS NOT NULL AND programs.norm_confidence > 0.3
  GROUP BY h.h;
create unique index stat_household_mv_uq on public.stat_household_mv (label);

-- ── 웹이 읽는 이름은 그대로, 속만 물리화 뷰로 ─────────
create or replace view public.job_overview     as select total, open_n, orgs, last_year, first_reg, last_reg, med_days from public.job_overview_mv;
create or replace view public.job_org_stats    as select org, n, open_n, first_reg, last_reg, avg_days, months from public.job_org_stats_mv;
create or replace view public.coverage         as select kind, total, has_detail, normalized, usable from public.coverage_mv;
create or replace view public.area_summary     as select sido, n, youth, senior, low_income, disabled, family from public.area_summary_mv;
create or replace view public.regions_available as select sido, sigungu, n from public.regions_available_mv;
create or replace view public.stat_age         as select band, label, n from public.stat_age_mv order by ord;
create or replace view public.stat_employment  as select label, n from public.stat_employment_mv order by n desc;
create or replace view public.stat_household   as select label, n from public.stat_household_mv order by n desc;

-- 물리화 뷰 자체는 API 로 노출하지 않는다(뷰를 거쳐서만).
revoke all on public.job_overview_mv, public.job_org_stats_mv, public.coverage_mv, public.area_summary_mv,
  public.regions_available_mv, public.stat_age_mv, public.stat_employment_mv, public.stat_household_mv
  from anon, authenticated;

-- ── 갈아 끼우기: pg_cron 30분마다 + 정규화 끝에 한 번(service_role) ──
create or replace function public.refresh_site_stats() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  refresh materialized view concurrently public.coverage_mv;
  refresh materialized view concurrently public.area_summary_mv;
  refresh materialized view concurrently public.regions_available_mv;
  refresh materialized view concurrently public.stat_age_mv;
  refresh materialized view concurrently public.stat_employment_mv;
  refresh materialized view concurrently public.stat_household_mv;
  refresh materialized view concurrently public.job_org_stats_mv;
  refresh materialized view concurrently public.job_overview_mv;
end $$;
revoke all on function public.refresh_site_stats() from public, anon, authenticated;
grant execute on function public.refresh_site_stats() to service_role;

select cron.schedule('refresh-site-stats', '*/30 * * * *', 'select public.refresh_site_stats()');

-- 내려간 공고를 찾는 조회(source_id 만으로)가 1초 넘게 걸렸다.
create index if not exists job_posts_source_id_idx on public.job_posts (source_id);
