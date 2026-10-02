-- 2026-10-02 적용됨. 사업·복지 공고의 첨부파일·관련 누리집.
-- pipeline/sources.py 가 복지로 상세(basfrmList·inqplHmpgReldList)와
-- 기업마당 목록(printFlpthNm 등)에서 [{"name","url","kind","ext"}] 로 채운다.
alter table public.programs add column if not exists attach jsonb;

-- 두 공개 뷰 끝에 attach 를 붙인다 (CREATE OR REPLACE 는 끝에 더하는 것만 허용).
create or replace view public.programs_public as
 SELECT id, kind, source, source_id, title, tidy(summary) AS summary, detail_url, org_name, dept_name, sido, sigungu,
    age_min, age_max, income_pct, employment, household, life_cycle, topics, biz_target, biz_field, biz_years_min, biz_years_max, industry,
    apply_start, apply_end, is_always_on, program_status(apply_end, is_always_on) AS status,
    CASE WHEN apply_end IS NULL OR is_always_on THEN NULL::integer ELSE apply_end - CURRENT_DATE END AS days_left,
    online_apply, support_type, support_cycle, contact, apply_method, norm_confidence, first_seen_at, updated_at, attach
   FROM programs
  WHERE norm_at IS NOT NULL AND norm_confidence > 0.3;

create or replace view public.program_detail as
 SELECT id, kind, source, source_id, title, tidy(summary) AS summary, tidy(raw_target) AS target_text, tidy(raw_criteria) AS criteria_text, tidy(raw_benefit) AS benefit_text,
    detail_url, org_name, dept_name, sido, sigungu, age_min, age_max, income_pct, employment, household, life_cycle, topics, biz_target, biz_field, biz_years_min, biz_years_max, industry,
    apply_start, apply_end, is_always_on, program_status(apply_end, is_always_on) AS status,
    CASE WHEN apply_end IS NULL OR is_always_on THEN NULL::integer ELSE apply_end - CURRENT_DATE END AS days_left,
    online_apply, support_type, support_cycle, contact, apply_method, norm_confidence, updated_at, attach
   FROM programs p
  WHERE norm_at IS NOT NULL AND norm_confidence > 0.3;
