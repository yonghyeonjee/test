-- 사업 상세 쪽의 "이 사이트만의 숫자"(2026-10-26). 복지로 원문에는 없는, 우리 자료를 모아야 나오는 사실 셋을 한 번에 센다.
--   same_area_n       같은 시·군·구(없으면 시·도)에서 지금 접수 중인 다른 사업 수
--   same_sido_topic_n 같은 시·도에서 같은 주제(topics 겹침)로 접수 중인 다른 사업 수
--   sidos_with_title  같은 이름으로 접수 중인 사업이 있는 시·도 수(이 사업 포함). 2 이상이면 여러 지자체가 같은 사업을 한다는 뜻
-- programs_public 만 읽는다(anon 이 읽는 뷰). 상세 쪽마다 한 번, ISR 사흘 캐시.
create or replace function public.program_facts(p_source_id text)
returns table (same_area_n int, same_sido_topic_n int, sidos_with_title int)
language sql stable security invoker as $$
  with me as (select source_id, title, sido, sigungu, topics from public.programs_public where source_id = p_source_id limit 1)
  select
    (select count(*)::int from public.programs_public q, me
      where q.status <> 'closed' and q.source_id <> me.source_id
        and q.sido is not distinct from me.sido
        and (me.sigungu is null or q.sigungu is not distinct from me.sigungu)),
    (select count(*)::int from public.programs_public q, me
      where q.status <> 'closed' and q.source_id <> me.source_id
        and me.topics is not null and q.sido is not distinct from me.sido and q.topics && me.topics),
    (select count(distinct coalesce(q.sido, '전국'))::int from public.programs_public q, me
      where q.status <> 'closed' and q.title = me.title)
  from me;
$$;
grant execute on function public.program_facts(text) to anon, authenticated, service_role;
