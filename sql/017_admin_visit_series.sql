-- 관리자 유입 그래프용 일별·채널별 집계(2026-10-22 적용됨). 전에는 visit_log 표본 1,000건으로 30일 막대를 그려
-- 크롤러가 하루 500건씩 찍던 때는 이틀치만 보였다. 함수 본문은 Supabase 에 적용된 정의가 원본. service_role 만 실행.
create or replace function public.admin_visit_series(p_days integer default 365)
returns table(d date, channel text, n integer)
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select (v.at at time zone 'Asia/Seoul')::date as d, coalesce(v.channel, '(없음)') as channel, count(*)::int as n
    from visit_log v
   where v.at >= (now() - make_interval(days => greatest(coalesce(p_days, 365), 1)))
   group by 1, 2
   order by 1, 2
$$;
revoke all on function public.admin_visit_series(integer) from public, anon, authenticated;
grant execute on function public.admin_visit_series(integer) to service_role;
