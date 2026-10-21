-- 마감 달력에 내 조건(나이·고용·가구)을 건다. 2026-10-21 적용됨.
--
-- 지원사업은 첫 화면의 match_welfare 와 같은 조건(age_min/age_max, employment, household)으로 거른다.
-- 조건이 없으면(모두 null) 예전과 같다. 채용은 조건과 상관없이 지역만 본다.
-- 인자가 늘어 모양이 달라진다. 옛 함수를 지우는 문장이 DB 에서 시간 초과로 밀려 _v2 이름으로 새로 만들었다.
-- 옛 deadline_days/deadline_items 는 그대로 있다(쓰는 곳 없음). 나중에 한가할 때 지워도 된다.

create or replace function public.deadline_days_v2(
  p_from date, p_to date, p_sido text default null, p_sido_short text default null, p_sigungu text default null,
  p_age integer default null, p_employment text default null, p_household text[] default null)
returns table(d date, kind text, n integer)
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select p.apply_end as d, 'p'::text as kind, count(*)::int as n
    from programs_public p
   where p.apply_end between p_from and p_to
     and not coalesce(p.is_always_on, false)
     and (p_sido is null or p.sido is null or p.sido = p_sido)
     and (p_sigungu is null or p.sigungu is null or p.sigungu = p_sigungu)
     and (p_age is null or p.age_min is null or p.age_min <= p_age)
     and (p_age is null or p.age_max is null or p.age_max >= p_age)
     and (p_employment is null or p.employment is null or p.employment && array[p_employment])
     and (p_household is null or p.household is null or p.household && p_household)
   group by p.apply_end
  union all
  select j.end_date, 'job', count(*)::int
    from job_posts j
   where j.end_date between p_from and p_to
     and j.source in ('gojobs', 'alio')
     and (p_sido_short is null or j.region is null or j.region like '%' || p_sido_short || '%')
   group by j.end_date
$$;
revoke all on function public.deadline_days_v2(date, date, text, text, text, integer, text, text[]) from public;
grant execute on function public.deadline_days_v2(date, date, text, text, text, integer, text, text[]) to anon, authenticated;

create or replace function public.deadline_items_v2(
  p_day date, p_sido text default null, p_sido_short text default null, p_sigungu text default null, p_limit integer default 120,
  p_age integer default null, p_employment text default null, p_household text[] default null)
returns table(kind text, id text, title text, org text, place text, start_date date)
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  (select 'p'::text, p.source_id, p.title, p.org_name, coalesce(nullif(concat_ws(' ', p.sido, p.sigungu), ''), '전국'), p.apply_start
     from programs_public p
    where p.apply_end = p_day and not coalesce(p.is_always_on, false)
      and (p_sido is null or p.sido is null or p.sido = p_sido)
      and (p_sigungu is null or p.sigungu is null or p.sigungu = p_sigungu)
      and (p_age is null or p.age_min is null or p.age_min <= p_age)
      and (p_age is null or p.age_max is null or p.age_max >= p_age)
      and (p_employment is null or p.employment is null or p.employment && array[p_employment])
      and (p_household is null or p.household is null or p.household && p_household)
    order by p.sido nulls last, p.title
    limit least(greatest(coalesce(p_limit, 120), 1), 300))
  union all
  (select 'job', j.source_id, j.title, j.org, coalesce(j.region, '전국'), j.start_date
     from job_posts j
    where j.end_date = p_day
      and j.source in ('gojobs', 'alio')
      and (p_sido_short is null or j.region is null or j.region like '%' || p_sido_short || '%')
    order by j.region nulls last, j.org, j.title
    limit least(greatest(coalesce(p_limit, 120), 1), 300))
$$;
revoke all on function public.deadline_items_v2(date, text, text, text, integer, integer, text, text[]) from public;
grant execute on function public.deadline_items_v2(date, text, text, text, integer, integer, text, text[]) to anon, authenticated;
