-- 검색창 아래 "많이 찾는 말" 집계용 (web/lib/hotTerms.ts).
--
-- visit_log 는 공개 키로 읽을 수 없게 막혀 있다(RLS, 정책 없음). 그래서 화면이 기록을
-- 못 읽고 늘 기본 목록으로 떨어졌다. 원문 한 줄을 열어 주는 대신, 묶음과 건수만
-- 돌려주는 함수를 둔다.
--
--  - 유입 검색어(term)와 첫 쪽(landing)은 둘 이상 들어온 것만 — 드물게 이름이나
--    전화번호를 치고 들어오는 사람이 있다. 관리자 쪽(/admin)은 뺀다.
--  - 조건 선택(search_log)은 정해진 값(가구·기업 분야)뿐이라 그대로 센다. 정책 전체
--    쪽의 링크 클릭(entry=policies)은 둘러보기라 뺀다.
--  - 기간은 1~60일로 묶는다.
create or replace function public.hot_term_rows(p_days integer default 7)
returns table(src text, term text, landing text, kind text, household text[], biz_field text[], biz_target text, n integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with w as (select now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 60)) as since)
  select 'term', v.term, null::text, null::text, null::text[], null::text[], null::text, count(*)::int
    from visit_log v, w
   where v.at > w.since and v.term is not null
   group by v.term having count(*) >= 2
  union all
  select 'landing', null, v.landing, null, null, null, null, count(*)::int
    from visit_log v, w
   where v.at > w.since and v.landing is not null and v.landing !~ '^/admin'
   group by v.landing having count(*) >= 2
  union all
  select 'search', null, null, s.kind, s.household, s.biz_field, s.biz_target, count(*)::int
    from search_log s, w
   where s.at > w.since and coalesce(s.entry, '') <> 'policies'
   group by s.kind, s.household, s.biz_field, s.biz_target
$$;

revoke all on function public.hot_term_rows(integer) from public;
grant execute on function public.hot_term_rows(integer) to anon, authenticated;
