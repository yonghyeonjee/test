-- 2026-10-09 적용됨 (Supabase 마이그레이션 blog_license_sigungu).
-- 블로그 갈래 둘을 더한다. 파이프라인 pipeline/blog_daily.py 가 쓴다.
--   blog_license_candidates(p_min_takers int, p_limit int) — 3년 응시자가 많은 종목 목록 (글감 고르기)
--   blog_license_stats(p_code text) returns jsonb         — 종목: 해·단계별 응시자·합격률, 올해 일정, 같은 분야 종목, 공고
--   blog_sigungu_candidates(p_min int, p_limit int)       — 열린 사업이 많은 시·군·구 목록
--   blog_sigungu_stats(p_sido text, p_sigungu text)       — 시·군·구: 분야·가구·지원 방식, 마감 순, 도 단위 사업, 채용
-- 모두 security definer, service_role 만 실행.

create or replace function public.blog_license_candidates(p_min_takers integer default 3000, p_limit integer default 300)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'takers', takers) order by takers desc), '[]')
  from (select l.code, l.name, sum(s.takers) takers
        from license_items l join exam_stats s on s.code = l.code
        where s.takers is not null
        group by 1, 2 having sum(s.takers) >= p_min_takers
        order by 3 desc limit p_limit) t;
$$;

create or replace function public.blog_license_stats(p_code text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with l as (select * from license_items where code = p_code),
  st as (select year, stage, applicants, takers, passers, pass_rate from exam_stats where code = p_code and takers is not null),
  sc as (select * from exam_sched where code = p_code and year >= extract(year from current_date)::int),
  peers as (
    select li.code, li.name, sum(s.takers) takers, sum(s.passers) passers
    from license_items li join exam_stats s on s.code = li.code
    where s.takers is not null and li.field = (select field from l) and li.series = (select series from l)
    group by 1, 2),
  allsum as (select code, sum(takers) t from exam_stats where takers is not null group by 1),
  j as (select source_id, title, org, end_date, reg_date from job_posts
        where source = 'gojobs' and reg_date >= current_date - interval '3 years'
          and title ilike '%' || (select name from l) || '%')
  select jsonb_build_object(
    'code', p_code,
    'name', (select name from l), 'series', (select series from l), 'field', (select field from l),
    'sub_field', (select sub_field from l), 'kind', (select kind from l), 'kind_name', (select kind_name from l),
    'by_year', (select coalesce(jsonb_agg(jsonb_build_object('y', year, 'stage', stage, 'applicants', applicants, 'takers', takers, 'passers', passers, 'rate', pass_rate) order by year, stage), '[]') from st),
    'takers_3y', (select coalesce(sum(takers), 0) from st),
    'passers_3y', (select coalesce(sum(passers), 0) from st),
    'rounds', (select coalesce(jsonb_agg(jsonb_build_object(
                 'y', year, 'label', label, 'stage', stage,
                 'reg_start', reg_start, 'reg_end', reg_end, 'exam_start', exam_start, 'exam_end', exam_end, 'pass_date', pass_date,
                 'prac_reg_start', prac_reg_start, 'prac_reg_end', prac_reg_end, 'prac_exam_start', prac_exam_start, 'prac_exam_end', prac_exam_end, 'final_pass', final_pass)
                 order by year, exam_start), '[]') from sc),
    'peers', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'takers', takers, 'passers', passers) order by takers desc), '[]')
              from (select * from peers order by takers desc limit 8) x),
    'peers_n', (select count(*) from peers),
    'rank_peers', (select count(*) + 1 from peers where takers > (select coalesce(sum(takers), 0) from st)),
    'rank_all', (select count(*) + 1 from allsum where t > (select coalesce(sum(takers), 0) from st)),
    'all_n', (select count(*) from allsum),
    'jobs_3y', (select count(*) from j),
    'jobs_open_list', (select coalesce(jsonb_agg(jsonb_build_object('id', source_id, 'title', title, 'org', org, 'end', end_date) order by end_date), '[]')
                       from (select * from j where end_date >= current_date order by end_date limit 5) x)
  );
$$;

create or replace function public.blog_sigungu_candidates(p_min integer default 15, p_limit integer default 300)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('sido', sido, 'sigungu', sigungu, 'n', n) order by n desc), '[]')
  from (select sido, sigungu, count(*) n from programs_public
        where kind = 'welfare' and coalesce(norm_confidence, 0) > 0.3 and sido is not null and sigungu is not null
          and (apply_end is null or is_always_on or apply_end >= current_date)
        group by 1, 2 having count(*) >= p_min order by 3 desc limit p_limit) t;
$$;

create or replace function public.blog_sigungu_stats(p_sido text, p_sigungu text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with v as (select * from programs_public where kind = 'welfare' and coalesce(norm_confidence, 0) > 0.3 and sido = p_sido and sigungu = p_sigungu),
  o as (select * from v where apply_end is null or is_always_on or apply_end >= current_date),
  d as (select * from programs_public where kind = 'welfare' and coalesce(norm_confidence, 0) > 0.3 and sido = p_sido and sigungu is null
        and (apply_end is null or is_always_on or apply_end >= current_date)),
  j as (select source_id, title, org, end_date, reg_date from job_posts
        where source = 'gojobs' and reg_date >= current_date - interval '3 years'
          and org ilike '%' || p_sigungu || '%' and (region = p_sido or org like p_sido || '%'))
  select jsonb_build_object(
    'sido', p_sido, 'sigungu', p_sigungu,
    'total', (select count(*) from v),
    'open_n', (select count(*) from o),
    'always_n', (select count(*) from o where is_always_on or apply_end is null),
    'closing30', (select count(*) from o where apply_end is not null and apply_end between current_date and current_date + 30),
    'new30', (select count(*) from v where first_seen_at >= now() - interval '30 days'),
    'sido_open_n', (select count(*) from d),
    'topics', (select coalesce(jsonb_agg(jsonb_build_object('k', t, 'n', n) order by n desc), '[]') from (select t, count(*) n from o, unnest(topics) t group by 1 order by 2 desc limit 8) x),
    'household', (select coalesce(jsonb_agg(jsonb_build_object('k', h, 'n', n) order by n desc), '[]') from (select h, count(*) n from o, unnest(household) h group by 1 order by 2 desc limit 6) x),
    'support', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]') from (select split_part(coalesce(support_type, '기타'), ',', 1) k, count(*) n from o group by 1 order by 2 desc limit 6) x),
    'youth_n', (select count(*) from o where age_max is not null and age_max <= 45),
    'senior_n', (select count(*) from o where age_min is not null and age_min >= 60),
    'closing_list', (select coalesce(jsonb_agg(jsonb_build_object('id', source_id, 'title', title, 'end', apply_end) order by apply_end), '[]')
                     from (select source_id, title, apply_end from o where apply_end is not null and apply_end >= current_date order by apply_end limit 8) x),
    'sample', (select coalesce(jsonb_agg(jsonb_build_object('id', source_id, 'title', title, 'end', apply_end, 'always', is_always_on)), '[]')
               from (select source_id, title, apply_end, is_always_on from o order by norm_confidence desc, apply_end nulls last limit 8) x),
    'sido_sample', (select coalesce(jsonb_agg(jsonb_build_object('id', source_id, 'title', title, 'end', apply_end, 'always', is_always_on)), '[]')
                    from (select source_id, title, apply_end, is_always_on from d order by norm_confidence desc, apply_end nulls last limit 5) x),
    'jobs_3y', (select count(*) from j),
    'jobs_open', (select count(*) from j where end_date >= current_date),
    'jobs_orgs', (select coalesce(jsonb_agg(jsonb_build_object('org', org, 'n', n) order by n desc), '[]') from (select org, count(*) n from j where org is not null group by 1 order by 2 desc limit 5) x),
    'jobs_open_list', (select coalesce(jsonb_agg(jsonb_build_object('id', source_id, 'title', title, 'org', org, 'end', end_date) order by end_date), '[]')
                       from (select source_id, title, org, end_date from j where end_date >= current_date order by end_date limit 6) x),
    'jobs_by_month', (select coalesce(jsonb_agg(jsonb_build_object('m', m, 'n', n) order by m), '[]') from (select extract(month from reg_date)::int m, count(*) n from j group by 1) x)
  );
$$;

revoke all on function public.blog_license_candidates(integer, integer) from public, anon, authenticated;
revoke all on function public.blog_license_stats(text) from public, anon, authenticated;
revoke all on function public.blog_sigungu_candidates(integer, integer) from public, anon, authenticated;
revoke all on function public.blog_sigungu_stats(text, text) from public, anon, authenticated;
