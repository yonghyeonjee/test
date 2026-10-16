-- 첫 화면 "방금 찾아본 조건" (web/lib/recentFinds.ts). 2026-10-16 적용됨.
--
-- search_log 는 공개 키로 못 읽는다(RLS). 사람이 직접 고른 조건(form·last·chip)만, 결과가
-- 있었던 것만, 사흘 안 것만 최근순으로 돌려준다. 시·군·구와 가구 특성(저소득·장애인 등)은
-- 돌려주지 않는다 — 시·도·나이대·상태까지가 남이 봐도 되는 선이다.
create or replace function public.recent_search_rows(p_limit integer default 8)
returns table(sido text, age_band text, employment text, n_results integer, ago_min integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select s.sido, s.age_band, s.employment, s.n_results,
         greatest(0, floor(extract(epoch from (now() - s.at)) / 60))::int as ago_min
    from search_log s
   where s.kind = 'welfare'
     and coalesce(s.entry, '') in ('form', 'last', 'chip')
     and s.sido is not null
     and s.n_results > 0
     and s.at > now() - interval '3 days'
   order by s.at desc
   limit least(greatest(coalesce(p_limit, 8), 1), 30)
$$;

revoke all on function public.recent_search_rows(integer) from public;
grant execute on function public.recent_search_rows(integer) to anon, authenticated;
