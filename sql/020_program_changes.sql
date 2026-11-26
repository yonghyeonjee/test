-- 공고가 바뀐 기록(2026-11-27).
-- 사용자 요청: "앞으로도 동일한 공고가 있을 때 변경된 사항을 함께 올려. 본문에는 지표로, 전문은 블로그에."
-- 지금까지는 수집이 같은 공고(source_id)를 덮어써 옛 값이 남지 않았다. programs 가 고쳐질 때 달라진 항목을 한 줄씩 남긴다.
--
--  - 원문에서 온 값(제목·접수 기간·대상/선정기준/지원내용/신청방법 글·지원 형태)은 달라지면 그대로 적는다.
--    글은 띄어쓰기만 달라진 것은 적지 않는다.
--  - 우리가 글에서 뽑아낸 값(나이·소득 기준·금액)은 원문 글이나 접수 기간이 함께 바뀐 때만 적는다.
--    뽑는 규칙을 고쳤을 뿐인데 "공고가 바뀌었다"고 나오면 안 된다.
--  - 처음 들어온 공고(INSERT)는 적지 않는다. 바뀐 것만.
create table if not exists program_changes (
  id          bigint generated always as identity primary key,
  source_id   text        not null,
  changed_at  timestamptz not null default now(),
  field       text        not null,
  old_value   text,
  new_value   text
);
create index if not exists program_changes_source_idx on program_changes (source_id, changed_at desc);
create index if not exists program_changes_at_idx on program_changes (changed_at desc);
alter table program_changes enable row level security;

create or replace function log_program_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sq   constant text := '\s+';
  raw_changed boolean;
begin
  raw_changed :=
       regexp_replace(coalesce(old.raw_target, ''),   sq, '', 'g') is distinct from regexp_replace(coalesce(new.raw_target, ''),   sq, '', 'g')
    or regexp_replace(coalesce(old.raw_criteria, ''), sq, '', 'g') is distinct from regexp_replace(coalesce(new.raw_criteria, ''), sq, '', 'g')
    or regexp_replace(coalesce(old.raw_benefit, ''),  sq, '', 'g') is distinct from regexp_replace(coalesce(new.raw_benefit, ''),  sq, '', 'g')
    or old.apply_start is distinct from new.apply_start
    or old.apply_end   is distinct from new.apply_end;

  if old.title is distinct from new.title then
    insert into program_changes (source_id, field, old_value, new_value) values (new.source_id, 'title', old.title, new.title);
  end if;
  if old.apply_start is distinct from new.apply_start or old.apply_end is distinct from new.apply_end or old.is_always_on is distinct from new.is_always_on then
    insert into program_changes (source_id, field, old_value, new_value) values (new.source_id, 'period',
      case when old.is_always_on then '상시' else coalesce(old.apply_start::text, '') || ' ~ ' || coalesce(old.apply_end::text, '') end,
      case when new.is_always_on then '상시' else coalesce(new.apply_start::text, '') || ' ~ ' || coalesce(new.apply_end::text, '') end);
  end if;
  if regexp_replace(coalesce(old.raw_target, ''), sq, '', 'g') is distinct from regexp_replace(coalesce(new.raw_target, ''), sq, '', 'g') then
    insert into program_changes (source_id, field, old_value, new_value) values (new.source_id, 'target', old.raw_target, new.raw_target);
  end if;
  if regexp_replace(coalesce(old.raw_criteria, ''), sq, '', 'g') is distinct from regexp_replace(coalesce(new.raw_criteria, ''), sq, '', 'g') then
    insert into program_changes (source_id, field, old_value, new_value) values (new.source_id, 'criteria', old.raw_criteria, new.raw_criteria);
  end if;
  if regexp_replace(coalesce(old.raw_benefit, ''), sq, '', 'g') is distinct from regexp_replace(coalesce(new.raw_benefit, ''), sq, '', 'g') then
    insert into program_changes (source_id, field, old_value, new_value) values (new.source_id, 'benefit', old.raw_benefit, new.raw_benefit);
  end if;
  if regexp_replace(coalesce(old.apply_method, ''), sq, '', 'g') is distinct from regexp_replace(coalesce(new.apply_method, ''), sq, '', 'g') then
    insert into program_changes (source_id, field, old_value, new_value) values (new.source_id, 'method', old.apply_method, new.apply_method);
  end if;
  if old.support_type is distinct from new.support_type then
    insert into program_changes (source_id, field, old_value, new_value) values (new.source_id, 'support_type', old.support_type, new.support_type);
  end if;

  if raw_changed then
    if old.age_min is distinct from new.age_min or old.age_max is distinct from new.age_max then
      insert into program_changes (source_id, field, old_value, new_value) values (new.source_id, 'age',
        coalesce(old.age_min::text, '') || '~' || coalesce(old.age_max::text, ''), coalesce(new.age_min::text, '') || '~' || coalesce(new.age_max::text, ''));
    end if;
    if old.income_pct is distinct from new.income_pct then
      insert into program_changes (source_id, field, old_value, new_value) values (new.source_id, 'income_pct', old.income_pct::text, new.income_pct::text);
    end if;
    if old.amount_max is distinct from new.amount_max then
      insert into program_changes (source_id, field, old_value, new_value) values (new.source_id, 'amount_max', old.amount_max::text, new.amount_max::text);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists programs_log_changes on programs;
create trigger programs_log_changes after update on programs
  for each row execute function log_program_changes();

-- 화면이 읽는 뷰(공개 키로 읽기만). 공고 이름·지역을 붙여 준다.
create or replace view program_changes_public as
  select c.id, c.source_id, c.changed_at, c.field, c.old_value, c.new_value,
         p.title, p.sido, p.sigungu, p.org_name, p.kind
    from program_changes c join programs p on p.source_id = c.source_id;
grant select on program_changes_public to anon, authenticated;
