-- 관리자 통계 탐색기(2026-10-29 적용됨). 유입(visit_log)·검색(search_log)을 기간·단위·차원으로 집계한다.
-- 전에는 일·주·월 그래프가 채널 하나로 고정이었고, 순위는 최근 1,000건 표본이었다. 이 함수는 전부를 센다.
--   admin_stat_bucket(at, unit)  한국 시각 기준 구간 이름. hour 'YYYY-MM-DD HH24' · day 'YYYY-MM-DD' · week 월요일 날짜 · month 'YYYY-MM' · year 'YYYY'
--   admin_stat_series(src, from, to, unit, dim, top)  returns (b 구간, k 값, n 건수)
--     src  'visit' | 'search'
--     dim  visit: channel 채널 · site 리퍼러 사이트 · category 도착 화면 갈래 · landing 도착 화면 · term 검색어 · campaign utm_campaign
--          search: entry 조회 방식 · kind 갈래 · sido 지역 · age_band 나이대 · employment 취업상태 · zero 결과 0건 여부
--     top  값이 많은 차원(도착 화면 6,000여 개)은 상위 top 개만 두고 나머지는 '(기타)'로 묶는다.
-- 함수 본문은 Supabase 에 적용된 정의가 원본. service_role 만 실행. web/app/admin/stats/route.ts 가 쓴다.

create or replace function public.admin_stat_bucket(p_at timestamptz, p_unit text)
returns text language sql immutable as $$
  select case p_unit
    when 'hour'  then to_char(p_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24')
    when 'week'  then to_char(date_trunc('week', p_at at time zone 'Asia/Seoul'), 'YYYY-MM-DD')
    when 'month' then to_char(p_at at time zone 'Asia/Seoul', 'YYYY-MM')
    when 'year'  then to_char(p_at at time zone 'Asia/Seoul', 'YYYY')
    else to_char(p_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') end
$$;

create or replace function public.admin_stat_series(
  p_src text, p_from timestamptz, p_to timestamptz, p_unit text default 'day', p_dim text default 'channel', p_top integer default 12)
returns table(b text, k text, n integer)
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_unit text := coalesce(p_unit, 'day');
  v_dim  text := coalesce(p_dim, 'channel');
  v_top  integer := greatest(coalesce(p_top, 12), 1);
begin
  if p_src = 'search' then
    return query
    with r as (
      select s.at,
             case v_dim
               when 'entry'      then coalesce(s.entry, '(없음)')
               when 'kind'       then case s.kind when 'welfare' then '복지' when 'business' then '기업' else coalesce(s.kind, '(없음)') end
               when 'sido'       then coalesce(s.sido, '(전국)')
               when 'age_band'   then coalesce(s.age_band, '(없음)')
               when 'employment' then coalesce(s.employment, '(없음)')
               when 'zero'       then case when s.n_results = 0 then '결과 0건' else '결과 있음' end
               else '전체' end as k
        from search_log s
       where s.at >= p_from and s.at < p_to
    ), t as (
      select r.k from r group by r.k order by count(*) desc limit v_top
    )
    select admin_stat_bucket(r.at, v_unit), case when t.k is null then '(기타)' else r.k end, count(*)::int
      from r left join t on t.k = r.k
     group by 1, 2 order by 1, 2;
  else
    return query
    with r as (
      select v.at,
             case v_dim
               when 'site'     then coalesce(v.ref_host, case when v.channel = '직접 유입' then '(직접)' else v.channel end)
               when 'category' then case
                 when v.landing ~ '^/jobs/org'            then '채용·기관'
                 when v.landing ~ '^/jobs/region'         then '채용·지역'
                 when v.landing ~ '^/jobs/a?[0-9]'        then '채용·공고'
                 when v.landing ~ '^/jobs'                then '채용·목록'
                 when v.landing ~ '^/p/'                  then '지원사업·상세'
                 when v.landing ~ '^/(area|topic|policies|find|business)' then '지원사업·목록'
                 when v.landing ~ '^/license'             then '자격증'
                 when v.landing ~ '^/housing'             then '주거'
                 when v.landing ~ '^/(blog|story)'        then '글'
                 when v.landing ~ '^/(agency|orgs|map)'   then '공공기관·지도'
                 when v.landing is null or v.landing in ('', '/') then '첫 화면'
                 else '기타' end
               when 'landing'  then coalesce(v.landing, '/')
               when 'term'     then coalesce(v.term, '(없음)')
               when 'campaign' then coalesce(v.utm_campaign, '(없음)')
               else coalesce(v.channel, '(없음)') end as k
        from visit_log v
       where v.at >= p_from and v.at < p_to
    ), t as (
      select r.k from r group by r.k order by count(*) desc limit v_top
    )
    select admin_stat_bucket(r.at, v_unit), case when t.k is null then '(기타)' else r.k end, count(*)::int
      from r left join t on t.k = r.k
     group by 1, 2 order by 1, 2;
  end if;
end $$;

revoke all on function public.admin_stat_series(text, timestamptz, timestamptz, text, text, integer) from public, anon, authenticated;
grant execute on function public.admin_stat_series(text, timestamptz, timestamptz, text, text, integer) to service_role;
