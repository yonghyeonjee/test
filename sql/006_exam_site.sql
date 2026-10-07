-- 큐넷 종목별 시험 일정·수험자 동향 (2026-10-06)
--
-- 공공데이터 API(InquiryTestInformationNTQSVC)는 등급별 올해 회차만 준다. 종목마다 어느 회차를
-- 치르는지, 지난해 몇 명이 봐서 몇 명이 붙었는지는 큐넷 누리집의 종목 안내(crf005.do)에만 있다.
-- 서울 서버가 일주일에 한 번 읽어(lib/qnetSite.ts) 여기 쌓는다. 해가 바뀌어도 지우지 않는다 —
-- 쌓인 해가 많아질수록 "보통 몇 월에 치르나" 추정이 좋아진다.

-- 종목별 시험 일정. 한 줄이 큐넷 표의 한 줄(한 회차, 전문자격은 회차의 한 단계).
create table if not exists public.exam_sched (
  id            text primary key,          -- code|year|label
  code          text not null,             -- license_items.code
  year          int  not null,
  label         text not null,             -- "정기 기사 1회", "25회 필기"
  stage         text,                      -- 전문자격 표의 단계(필기·실기·면접). 기술자격 표는 null(필기·실기가 한 줄)
  reg_start     date, reg_end date,        -- (필기)원서접수
  exam_start    date, exam_end date,       -- (필기)시험
  pass_date     date,                      -- (필기)합격 발표 또는 합격자발표기간 시작
  prac_reg_start date, prac_reg_end date,  -- 실기원서접수(기술자격 표)
  prac_exam_start date, prac_exam_end date,-- 실기시험(기술자격 표)
  final_pass    date,                      -- 최종합격자 발표(기술자격 표)
  fetched_at    timestamptz not null default now()
);
create index if not exists exam_sched_code_idx on public.exam_sched (code, year);

-- 종목별 수험자 동향. 한 줄이 (종목, 해, 단계). 숫자가 전부 null 이면 "큐넷에 집계가 없다"고 확인한 것.
create table if not exists public.exam_stats (
  id          text primary key,            -- code|year|stage
  code        text not null,
  year        int  not null,
  stage       text not null,               -- 필기 | 실기
  applicants  int,                         -- 접수자
  takers      int,                         -- 응시자
  passers     int,                         -- 합격자
  pass_rate   numeric(5,1),                -- 합격자/응시자 ×100
  fetched_at  timestamptz not null default now()
);
create index if not exists exam_stats_code_idx on public.exam_stats (code, year);

-- 수집 진행 상태(서버만). 종목마다 일정·통계를 마지막으로 읽은 때.
create table if not exists public.exam_site_state (
  code        text primary key,
  sched_at    timestamptz,
  stats_at    timestamptz,
  fails       int not null default 0,
  last_error  text
);

alter table public.exam_sched      enable row level security;
alter table public.exam_stats      enable row level security;
alter table public.exam_site_state enable row level security;

drop policy if exists exam_sched_read on public.exam_sched;
create policy exam_sched_read on public.exam_sched for select to anon, authenticated using (true);
drop policy if exists exam_stats_read on public.exam_stats;
create policy exam_stats_read on public.exam_stats for select to anon, authenticated using (true);
-- exam_site_state 는 정책 없음 = service_role 만. 기본 권한(anon·authenticated 에 전부)도 거둔다 —
-- 관리자 점검이 "anon 이 부를 수 있다" 고 알린다. save_account·saved_condition 도 같은 날 거뒀다.
revoke all on table public.exam_site_state from anon, authenticated;
revoke all on table public.save_account, public.saved_condition from anon, authenticated;
