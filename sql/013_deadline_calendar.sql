-- 마감 달력(/calendar, web/lib/calendar.ts). 2026-10-16 적용됨.
--
-- 지원사업(programs_public.apply_end)과 채용(job_posts.end_date)의 마감을 날짜별로 센다.
-- 시·도를 주면 그 시·도(와 시·군·구) 것과 전국(지역 없음) 것만. 채용 지역은 자유 글이라
-- 짧은 이름(p_sido_short, 예: 경기)이 들어 있는지로 거른다. 시험 일정은 화면 쪽(exam_rounds)에서 센다.
create or replace function public.deadline_days(p_from date, p_to date, p_sido text default null, p_sido_short text default null, p_sigungu text default null)
returns table(d date, kind text, n integer)
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select p.apply_end as d, 'p'::text as kind, count(*)::int as n
    from programs_public p
   where p.apply_end between p_from and p_to
     and not coalesce(p.is_always_on, false)
     and (p_sido is null or p.sido is null or p.sido = p_sido)
     and (p_sigungu is null or p.sigungu is null or p.sigungu = p_sigungu)
   group by p.apply_end
  union all
  select j.end_date, 'job', count(*)::int
    from job_posts j
   where j.end_date between p_from and p_to
     and (p_sido_short is null or j.region is null or j.region like '%' || p_sido_short || '%')
   group by j.end_date
$$;
revoke all on function public.deadline_days(date, date, text, text, text) from public;
grant execute on function public.deadline_days(date, date, text, text, text) to anon, authenticated;

-- 그날 마감 목록. 갈래마다 p_limit 건까지.
create or replace function public.deadline_items(p_day date, p_sido text default null, p_sido_short text default null, p_sigungu text default null, p_limit integer default 120)
returns table(kind text, id text, title text, org text, place text, start_date date)
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  (select 'p'::text, p.source_id, p.title, p.org_name, coalesce(nullif(concat_ws(' ', p.sido, p.sigungu), ''), '전국'), p.apply_start
     from programs_public p
    where p.apply_end = p_day and not coalesce(p.is_always_on, false)
      and (p_sido is null or p.sido is null or p.sido = p_sido)
      and (p_sigungu is null or p.sigungu is null or p.sigungu = p_sigungu)
    order by p.sido nulls last, p.title
    limit least(greatest(coalesce(p_limit, 120), 1), 300))
  union all
  (select 'job', j.id, j.title, j.org, coalesce(j.region, '전국'), j.start_date
     from job_posts j
    where j.end_date = p_day
      and (p_sido_short is null or j.region is null or j.region like '%' || p_sido_short || '%')
    order by j.region nulls last, j.org, j.title
    limit least(greatest(coalesce(p_limit, 120), 1), 300))
$$;
revoke all on function public.deadline_items(date, text, text, text, integer) from public;
grant execute on function public.deadline_items(date, text, text, text, integer) to anon, authenticated;
