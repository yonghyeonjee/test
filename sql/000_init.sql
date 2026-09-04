-- ─────────────────────────────────────────────────────────────
-- 000_init.sql
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run
--
-- 지금 단계에서는 "원본 적재" 테이블만 만듭니다.
-- 정규화 컬럼(age_min, sido_code 등)은 API 응답 샘플을 확인한 뒤
-- 001_schema.sql 로 추가합니다. 먼저 만들면 두 번 만들게 됩니다.
-- ─────────────────────────────────────────────────────────────

-- 연결 확인용 더미 테이블 (check_setup.py 가 사용)
create table if not exists _setup_check (
  id  int primary key default 1,
  ok  boolean default true
);
insert into _setup_check (id) values (1) on conflict do nothing;


-- ── 원본 적재 테이블 ──────────────────────────────────────────
-- API 응답을 가공 없이 그대로 넣습니다.
-- 정규화 로직이 바뀌어도 여기서 다시 돌릴 수 있게 하는 것이 목적입니다.

create table if not exists raw_items (
  id          bigserial primary key,

  source      text not null,   -- bokjiro_local / bokjiro_central / bizinfo_support / bizinfo_event
  source_id   text not null,   -- API가 주는 고유 ID
  payload     jsonb not null,  -- 응답 레코드 전체

  fetched_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (source, source_id)
);

create index if not exists idx_raw_source   on raw_items (source);
create index if not exists idx_raw_fetched  on raw_items (fetched_at desc);


-- ── 수집 이력 ────────────────────────────────────────────────
-- 배치가 언제 몇 건을 가져왔는지. 장애 추적용.

create table if not exists ingest_runs (
  id          bigserial primary key,
  source      text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  fetched     int default 0,
  inserted    int default 0,
  updated     int default 0,
  status      text default 'running',   -- running / ok / error
  message     text
);


-- ── updated_at 자동 갱신 ─────────────────────────────────────

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_raw_items_touch on raw_items;
create trigger trg_raw_items_touch
  before update on raw_items
  for each row execute function touch_updated_at();


-- ── RLS ──────────────────────────────────────────────────────
-- 이 테이블들은 배치 전용(service_role)이므로 RLS를 켜고
-- 정책을 만들지 않습니다. service_role 은 RLS를 우회하므로
-- 배치는 정상 동작하고, anon 키로는 접근이 차단됩니다.

alter table raw_items   enable row level security;
alter table ingest_runs enable row level security;
