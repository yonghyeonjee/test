-- 2026-10-06 적용됨 (Supabase 마이그레이션 home_bundle_cache).
--
-- 첫 화면 home_bundle() 은 호출마다 programs 7천 건을 훑어 status='closing' 을
-- 셌다(closing_count). 메모리에 올라 있으면 0.1초지만, Nano(0.5GB) 에서는
-- job_posts(183MB) 가 programs 를 밀어내 디스크에서 다시 읽느라 2~3초가 걸렸고,
-- 익명 접속의 3초 제한을 넘기면 첫 화면이 "0건" 으로 나왔다(하루 80번쯤).
--
-- 미리 계산해 한 줄짜리 표에 넣어 두고 15분마다 갈아 끼운다. home_bundle() 은
-- 그 줄을 읽기만 한다(어떤 상태에서도 수 ms). 표가 비었거나 2시간 넘게 묵었으면
-- 예전 방식(home_bundle_live)으로 직접 계산한다.
--
-- housing_counts() 도 호출마다 7천 건 본문을 정규식으로 훑었다(0.6~1.2초).
-- 물리화 뷰로 바꾸고 refresh_site_stats() 에서 함께 갱신한다(3시간마다).
-- 주거 화면은 6시간 캐시라 충분하다.

-- ── 1. 첫 화면 묶음 캐시 ────────────────────────────────
create table if not exists public.home_bundle_cache (
  id           boolean primary key default true check (id),  -- 한 줄만
  bundle       jsonb not null,
  refreshed_at timestamptz not null default now()
);
alter table public.home_bundle_cache enable row level security;  -- 함수(security definer)로만 읽는다
revoke all on public.home_bundle_cache from anon, authenticated;

-- 예전 home_bundle() 본문을 그대로 home_bundle_live() 로 옮긴다.
create or replace function public.home_bundle_live()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with closing as (
    select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) as v
    from (select * from feed_closing('welfare', 6)) c
  ),
  ending as (
    select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) as v
    from (select * from feed_ending('welfare', 6)) e
  )
  select jsonb_build_object(
    'coverage', (select jsonb_object_agg(kind, usable) from coverage),
    'settings', (select jsonb_object_agg(key, value) from site_settings),
    'areas', (select coalesce(jsonb_agg(to_jsonb(a) order by a.n desc), '[]') from area_summary a),
    'stat_age', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from stat_age s),
    'stat_employment', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from stat_employment s),
    'stat_household', (select coalesce(jsonb_agg(to_jsonb(s)), '[]')
                       from (select * from stat_household limit 8) s),
    'regions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from regions_available r),
    'closing_count', (select count(*) from programs_public where status = 'closing'),
    -- 기준일 안에 걸리는 게 있으면 그것을, 없으면 마감일 가까운 순으로.
    'closing', case when (select jsonb_array_length(v) from closing) > 0
                    then (select v from closing) else (select v from ending) end,
    'closing_fallback', (select jsonb_array_length(v) from closing) = 0,
    'fresh', (select coalesce(jsonb_agg(to_jsonb(f)), '[]')
              from (select * from feed_new('welfare', 6)) f)
  );
$function$;
revoke execute on function public.home_bundle_live() from public, anon, authenticated;

create or replace function public.refresh_home_bundle()
 returns void
 language sql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  insert into public.home_bundle_cache (id, bundle, refreshed_at)
  values (true, public.home_bundle_live(), now())
  on conflict (id) do update
    set bundle = excluded.bundle, refreshed_at = excluded.refreshed_at;
$function$;
revoke execute on function public.refresh_home_bundle() from public, anon, authenticated;

-- 첫 줄을 바로 채운다.
select public.refresh_home_bundle();

-- 웹이 부르는 이름은 그대로. coalesce 는 앞 값이 있으면 뒤를 계산하지 않는다.
create or replace function public.home_bundle()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (select bundle from public.home_bundle_cache
      where refreshed_at > now() - interval '2 hours'),
    public.home_bundle_live());
$function$;

-- 15분마다. 통계 갱신(7 */3 * * *)과 겹치지 않게 분을 비켜 둔다.
select cron.schedule('refresh-home-bundle', '3,18,33,48 * * * *',
                     $$select public.refresh_home_bundle()$$);

-- ── 2. 주거 건수 물리화 ──────────────────────────────────
create materialized view public.housing_counts_mv as
  with live as (
    select p.sido, p.search_text from programs p
    where p.kind = 'welfare' and p.norm_at is not null and coalesce(p.norm_confidence, 0) > 0.3
      and (p.apply_end is null or p.is_always_on or p.apply_end >= current_date)),
  f as (
    select sido,
      search_text ~* '(신혼|신혼부부|예비신혼|신혼가구|예비부부)' as w_new,
      search_text ~* '(청년)' as w_youth,
      search_text ~* '(무주택)' as w_no,
      search_text ~* '(전세|전월세|임차|보증금|전세자금|전세대출)' as k_j,
      search_text ~* '(월세|임대료|임차료|주거비)' as k_w,
      search_text ~* '(매매|주택구입|구입자금|디딤돌|내집마련|주택 구입|생애최초|주택매입|주택 매입)' as k_b
    from live)
  select w.who, k.kind, f.sido, count(*)::bigint as n
  from f
  cross join lateral (values ('newlywed', f.w_new), ('youth', f.w_youth), ('nohouse', f.w_no)) as w(who, ok)
  cross join lateral (values ('jeonse', f.k_j), ('wolse', f.k_w), ('buy', f.k_b)) as k(kind, ok)
  where w.ok and k.ok
  group by 1, 2, 3;
create unique index housing_counts_mv_uq on public.housing_counts_mv (who, kind, sido) nulls not distinct;
revoke all on public.housing_counts_mv from anon, authenticated;

create or replace function public.housing_counts()
 returns table(who text, kind text, sido text, n bigint)
 language sql
 stable parallel safe security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select who, kind, sido, n from public.housing_counts_mv;
$function$;

create or replace function public.refresh_site_stats()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  refresh materialized view concurrently public.coverage_mv;
  refresh materialized view concurrently public.area_summary_mv;
  refresh materialized view concurrently public.regions_available_mv;
  refresh materialized view concurrently public.stat_age_mv;
  refresh materialized view concurrently public.stat_employment_mv;
  refresh materialized view concurrently public.stat_household_mv;
  refresh materialized view concurrently public.job_org_stats_mv;
  refresh materialized view concurrently public.job_overview_mv;
  refresh materialized view concurrently public.job_org_years_mv;
  refresh materialized view concurrently public.job_months_mv;
  refresh materialized view concurrently public.job_org_recent_mv;
  refresh materialized view concurrently public.housing_counts_mv;
  -- 통계가 바뀌었으니 첫 화면 묶음도 바로 다시 만든다.
  perform public.refresh_home_bundle();
end $function$;
