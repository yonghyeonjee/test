-- 2026-10-02 적용됨 (Supabase 마이그레이션 job_posts_region_idx, search_relevance_and_counts).
--
-- 1) 시·도별 채용 목록 인덱스. (source, region) 없이 22만 건을 훑어 2초 넘게 걸렸다.
create index if not exists job_posts_source_region_reg_idx on public.job_posts (source, region, reg_date desc nulls last);

-- 2) 낱말 검색의 적중 등급. "육아"로 찾았는데 원문 깊숙이 "돌봄"이 한 번 나오는
--    노인 사업까지 섞여 나왔다. 제목·요약에 걸린 것(1등급)을 먼저 보이고,
--    원문에만 걸린 것(2등급)은 1등급이 10건이 안 될 때만 뒤에 붙인다.
--    match_welfare / match_business 본문과 count_welfare / count_business 는
--    Supabase 에 적용된 정의가 원본이다(함수 네 개, 서명은 아래).
--
--    match_welfare(p_sido, p_sigungu, p_age, p_employment, p_household, p_limit, p_min_conf, p_q)
--    match_business(p_sido, p_biz_target, p_biz_field, p_biz_years, p_industry, p_limit, p_min_conf, p_q)
--    count_welfare(p_sido, p_sigungu, p_age, p_employment, p_household, p_min_conf, p_q) returns int
--    count_business(p_sido, p_biz_target, p_biz_field, p_biz_years, p_industry, p_min_conf, p_q) returns int
--
--    핵심 식:
--      tier = case when p_q is null or text_hits(title || ' ' || coalesce(summary,''), p_q) then 1 else 2 end
--      보이는 행 = tier = 1 or (count(*) filter (where tier = 1) over ()) < 10
--      정렬 = tier 먼저, 그다음 기존 순서

-- 3) 통합 검색의 채용 낱말 찾기(ilike). 세 글자 이상이면 trigram 색인을 탄다.
create index if not exists job_posts_title_trgm on public.job_posts using gin (title gin_trgm_ops);
create index if not exists job_posts_org_trgm on public.job_posts using gin (org gin_trgm_ops);
