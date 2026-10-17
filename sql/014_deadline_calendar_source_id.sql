-- 마감 달력의 채용 링크를 공고 번호(source_id)로. 2026-10-17.
--
-- 013 의 deadline_items 는 job_posts.id("gojobs:305694", "alio:a305724")를 돌려줬다. 화면은 그것을
-- /jobs/{id} 에 넣었고, 상세 쪽은 source_id("305694")로 찾으니 달력의 채용 링크가 전부
-- "내려간 공고"(200 + noindex)로 갔다. 해외채용(worldjob) 줄도 섞여 있었다 — 그쪽은 /jobs/{id} 상세가 없다.
-- 상세 쪽이 그리는 두 출처(나라일터·잡알리오)만 남기고 source_id 를 돌려준다. 날짜별 건수도 같은 기준으로 센다.
-- 함수 모양(인자·반환 칸)은 그대로라 create or replace 만 한다.
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
     and j.source in ('gojobs', 'alio')
     and (p_sido_short is null or j.region is null or j.region like '%' || p_sido_short || '%')
   group by j.end_date
$$;

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
  (select 'job', j.source_id, j.title, j.org, coalesce(j.region, '전국'), j.start_date
     from job_posts j
    where j.end_date = p_day
      and j.source in ('gojobs', 'alio')
      and (p_sido_short is null or j.region is null or j.region like '%' || p_sido_short || '%')
    order by j.region nulls last, j.org, j.title
    limit least(greatest(coalesce(p_limit, 120), 1), 300))
$$;
revoke all on function public.deadline_days(date, date, text, text, text) from public;
grant execute on function public.deadline_days(date, date, text, text, text) to anon, authenticated;
revoke all on function public.deadline_items(date, text, text, text, integer) from public;
grant execute on function public.deadline_items(date, text, text, text, integer) to anon, authenticated;
