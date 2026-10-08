-- ============================================================
-- 모아(Moa) - Supabase 전체 스키마 (새 프로젝트용)
--
-- 새 Supabase 프로젝트를 만들 때 SQL Editor에서 이 파일 하나만 실행하면
-- migrations/001 ~ 016, 018 을 모두 실행한 것과 같은 상태가 됩니다.
-- (017_timebox_push_cron.sql 은 알림 설정을 마친 뒤 따로 실행 - README 참고)
--
-- 이미 운영 중인 DB에는 이 파일을 실행하지 말고, 아직 실행하지 않은 migrations 파일만 번호 순서대로 실행하세요.
-- 이 파일과 마이그레이션 결과가 같은지는 supabase/tests/check_schema.sh 로 검사합니다.
--
-- ⚠️ 관리자 계정: 아래 '17478ff6-7e7a-419e-ba64-7bb9db8bbcea' (6곳)를 본인 계정의 auth.users.id로 바꾸세요.
--    src/lib/supabase.ts 의 ADMIN_USER_ID 와도 같아야 합니다.
-- ============================================================

-- ============================================================
-- 테이블
-- ============================================================

-- 카테고리
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default '#6366f1',
  is_default  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  description text,                          -- 저장소 화면에서만 보이는 카테고리 설명
  constraint categories_name_length        check (char_length(name) <= 100),
  constraint categories_description_length check (char_length(description) <= 20000)
);

-- 하위카테고리 (카테고리 하위의 그룹 - 예: "프로젝트" 카테고리 안의 "재가센터 관리앱")
create table if not exists public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  notes       text,                          -- 저장소 화면에서만 보이는 하위카테고리 메모
  constraint subcategories_name_length  check (char_length(name) <= 200),
  constraint subcategories_notes_length check (char_length(notes) <= 20000)
);

-- 할 일
create table if not exists public.todos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  completed      boolean not null default false,
  category_id    uuid references public.categories(id) on delete set null,
  date           date,                       -- 작업할 날짜 (없으면 저장소에만 있음)
  start_time     text,
  notes          text,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  due_date       date,                       -- 작업할 날짜(date)와는 별개인 마감일
  is_dday        boolean not null default false, -- 체크하면 홈 화면 D-Day 목록에도 자동 노출
  subcategory_id uuid references public.subcategories(id) on delete set null,
  series_id      uuid,                       -- 같은 반복으로 만들어진 할 일 묶음
  constraint todos_title_length check (char_length(title) <= 500),
  constraint todos_notes_length check (char_length(notes) <= 20000)
);

-- 메모 폴더
create table if not exists public.note_folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 메모
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  folder_id   uuid references public.note_folders(id) on delete set null, -- 폴더를 지우면 "폴더 없음"으로
  pinned      boolean not null default false,
  constraint notes_title_length   check (char_length(title) <= 500),
  constraint notes_content_length check (char_length(content) <= 200000)
);

-- 사용자 설정 (사용자당 1줄)
create table if not exists public.user_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  theme               text not null default 'system',
  default_screen      text not null default 'today',
  notifications       boolean not null default false,
  updated_at          timestamptz not null default now(),
  list_sort_by        text not null default 'manual',   -- 'manual' | 'date' | 'name'
  hide_completed      boolean not null default false,
  hidden_category_ids uuid[] not null default '{}',
  calendar_text_size  text not null default 'medium'    -- 'small' | 'medium' | 'large'
);

-- 이번 달 목표
create table if not exists public.monthly_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  month       text not null, -- YYYY-MM
  title       text not null,
  completed   boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint monthly_goals_title_length check (char_length(title) <= 500)
);

-- D-Day
create table if not exists public.ddays (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  target_date date not null,
  created_at  timestamptz not null default now(),
  constraint ddays_title_length check (char_length(title) <= 500)
);

-- 일정 (날짜/시간이 정해진 이벤트 - 할 일과 별개)
create table if not exists public.schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  date        date not null,
  start_time  text,
  notes       text,
  created_at  timestamptz not null default now(),
  series_id   uuid,                          -- 같은 반복으로 만들어진 일정 묶음
  constraint schedules_title_length check (char_length(title) <= 500),
  constraint schedules_notes_length check (char_length(notes) <= 20000)
);

-- 공지사항 (관리자만 작성, 로그인한 모두가 읽음)
create table if not exists public.notices (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint notices_title_length   check (char_length(title) <= 500),
  constraint notices_content_length check (char_length(content) <= 20000)
);

-- 의견 보내기 (사용자는 보내기만, 읽기/삭제는 관리자만)
create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 2000),
  app_version  text,
  created_at   timestamptz not null default now()
);

-- 타임박스 ("언제 무엇을 하겠다"는 시간 블록)
-- 시간은 사용자 기기 시간대 기준 절대 시각(timestamptz)으로 저장해서, 알림 함수가 시간대를 몰라도 됨
create table if not exists public.timeblocks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  todo_id         uuid references public.todos(id) on delete set null, -- 연결된 할 일 (지워지면 연결만 끊김)
  title           text not null default '',
  color           text,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  completed       boolean not null default false,
  remind_minutes  integer default 0 check (remind_minutes is null or remind_minutes between 0 and 120), -- null = 알림 없음
  notified_at     timestamptz,               -- 알림을 보낸 시각 (시간을 바꾸면 앱이 null로 돌림)
  created_at      timestamptz not null default now(),
  constraint timeblocks_time_order check (end_at > start_at),
  constraint timeblocks_title_length check (char_length(title) <= 500)
);

-- 웹 푸시 구독 (기기/브라우저마다 한 줄)
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  time_zone   text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 인덱스
-- ============================================================
create index if not exists idx_categories_user            on public.categories(user_id, sort_order);
create index if not exists idx_subcategories_category     on public.subcategories(category_id, sort_order);
create index if not exists idx_todos_user_date            on public.todos(user_id, date);
create index if not exists idx_todos_user_category        on public.todos(user_id, category_id);
create index if not exists idx_todos_subcategory          on public.todos(subcategory_id);
create index if not exists idx_todos_series               on public.todos(series_id) where series_id is not null;
create index if not exists idx_notes_user                 on public.notes(user_id, updated_at desc);
create index if not exists idx_notes_folder               on public.notes(folder_id) where folder_id is not null;
create index if not exists idx_note_folders_user          on public.note_folders(user_id, sort_order);
create index if not exists idx_monthly_goals_user_month   on public.monthly_goals(user_id, month);
create index if not exists idx_ddays_user                 on public.ddays(user_id, target_date);
create index if not exists idx_schedules_user_date        on public.schedules(user_id, date);
create index if not exists idx_schedules_series           on public.schedules(series_id) where series_id is not null;
create index if not exists idx_feedback_created           on public.feedback(created_at desc);
create index if not exists idx_timeblocks_user_start      on public.timeblocks(user_id, start_at);
create index if not exists idx_timeblocks_todo            on public.timeblocks(todo_id);
create index if not exists idx_timeblocks_pending_reminder on public.timeblocks(start_at)
  where notified_at is null and remind_minutes is not null;
create index if not exists idx_push_subscriptions_user    on public.push_subscriptions(user_id);

-- ============================================================
-- updated_at 자동 갱신
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger todos_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

create or replace trigger notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

create or replace trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

create or replace trigger notices_updated_at
  before update on public.notices
  for each row execute function public.set_updated_at();

-- ============================================================
-- 신규 가입 시 기본 카테고리 + 설정 자동 생성
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_settings (user_id) values (new.id);

  insert into public.categories (user_id, name, color, is_default, sort_order) values
    (new.id, '개인',   '#7B7FE0', true, 0),
    (new.id, '업무',   '#C99A3A', true, 1),
    (new.id, '건강',   '#5FB98A', true, 2),
    (new.id, '쇼핑',   '#DB7FAE', true, 3);

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 연결 대상이 같은 사용자 것인지 확인 (018)
-- 외래키 검사는 RLS를 거치지 않아서, 이게 없으면 남의 id를 내 데이터에 연결할 수 있음
-- ============================================================
create or replace function public.check_owned_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'todos' then
    if new.category_id is not null
       and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
       and not exists (select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id) then
      raise exception 'category does not belong to this user' using errcode = '42501';
    end if;
    if new.subcategory_id is not null
       and (tg_op = 'INSERT' or new.subcategory_id is distinct from old.subcategory_id)
       and not exists (select 1 from public.subcategories s where s.id = new.subcategory_id and s.user_id = new.user_id) then
      raise exception 'subcategory does not belong to this user' using errcode = '42501';
    end if;

  elsif tg_table_name = 'subcategories' then
    if (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
       and not exists (select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id) then
      raise exception 'category does not belong to this user' using errcode = '42501';
    end if;

  elsif tg_table_name = 'timeblocks' then
    if new.todo_id is not null
       and (tg_op = 'INSERT' or new.todo_id is distinct from old.todo_id)
       and not exists (select 1 from public.todos t where t.id = new.todo_id and t.user_id = new.user_id) then
      raise exception 'todo does not belong to this user' using errcode = '42501';
    end if;

  elsif tg_table_name = 'notes' then
    if new.folder_id is not null
       and (tg_op = 'INSERT' or new.folder_id is distinct from old.folder_id)
       and not exists (select 1 from public.note_folders f where f.id = new.folder_id and f.user_id = new.user_id) then
      raise exception 'folder does not belong to this user' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists todos_check_owned_references on public.todos;
create trigger todos_check_owned_references
  before insert or update of category_id, subcategory_id, user_id on public.todos
  for each row execute function public.check_owned_references();

drop trigger if exists subcategories_check_owned_references on public.subcategories;
create trigger subcategories_check_owned_references
  before insert or update of category_id, user_id on public.subcategories
  for each row execute function public.check_owned_references();

drop trigger if exists timeblocks_check_owned_references on public.timeblocks;
create trigger timeblocks_check_owned_references
  before insert or update of todo_id, user_id on public.timeblocks
  for each row execute function public.check_owned_references();

drop trigger if exists notes_check_owned_references on public.notes;
create trigger notes_check_owned_references
  before insert or update of folder_id, user_id on public.notes
  for each row execute function public.check_owned_references();

-- ============================================================
-- Row Level Security - 본인 데이터만 접근 가능
-- ============================================================
alter table public.categories         enable row level security;
alter table public.subcategories      enable row level security;
alter table public.todos              enable row level security;
alter table public.note_folders       enable row level security;
alter table public.notes              enable row level security;
alter table public.user_settings      enable row level security;
alter table public.monthly_goals      enable row level security;
alter table public.ddays              enable row level security;
alter table public.schedules          enable row level security;
alter table public.notices            enable row level security;
alter table public.feedback           enable row level security;
alter table public.timeblocks         enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "categories: own data" on public.categories;
create policy "categories: own data" on public.categories
  for all using (auth.uid() = user_id);

drop policy if exists "subcategories: own data" on public.subcategories;
create policy "subcategories: own data" on public.subcategories
  for all using (auth.uid() = user_id);

drop policy if exists "todos: own data" on public.todos;
create policy "todos: own data" on public.todos
  for all using (auth.uid() = user_id);

drop policy if exists "note_folders: own data" on public.note_folders;
create policy "note_folders: own data" on public.note_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notes: own data" on public.notes;
create policy "notes: own data" on public.notes
  for all using (auth.uid() = user_id);

drop policy if exists "user_settings: own data" on public.user_settings;
create policy "user_settings: own data" on public.user_settings
  for all using (auth.uid() = user_id);

drop policy if exists "monthly_goals: own data" on public.monthly_goals;
create policy "monthly_goals: own data" on public.monthly_goals
  for all using (auth.uid() = user_id);

drop policy if exists "ddays: own data" on public.ddays;
create policy "ddays: own data" on public.ddays
  for all using (auth.uid() = user_id);

drop policy if exists "schedules: own data" on public.schedules;
create policy "schedules: own data" on public.schedules
  for all using (auth.uid() = user_id);

drop policy if exists "timeblocks: own data" on public.timeblocks;
create policy "timeblocks: own data" on public.timeblocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions: own data" on public.push_subscriptions;
create policy "push_subscriptions: own data" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 공지사항: 로그인한 모두가 읽고, 관리자만 작성/수정/삭제
drop policy if exists "notices: everyone can read" on public.notices;
create policy "notices: everyone can read" on public.notices
  for select using (auth.uid() is not null);

drop policy if exists "notices: admin can write" on public.notices;
create policy "notices: admin can write" on public.notices
  for insert with check (auth.uid() = '17478ff6-7e7a-419e-ba64-7bb9db8bbcea');

drop policy if exists "notices: admin can update" on public.notices;
create policy "notices: admin can update" on public.notices
  for update using (auth.uid() = '17478ff6-7e7a-419e-ba64-7bb9db8bbcea');

drop policy if exists "notices: admin can delete" on public.notices;
create policy "notices: admin can delete" on public.notices
  for delete using (auth.uid() = '17478ff6-7e7a-419e-ba64-7bb9db8bbcea');

-- 의견: 본인 것 보내기만, 읽기/삭제는 관리자만
drop policy if exists "feedback: insert own" on public.feedback;
create policy "feedback: insert own" on public.feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists "feedback: admin can read" on public.feedback;
create policy "feedback: admin can read" on public.feedback
  for select using (auth.uid() = '17478ff6-7e7a-419e-ba64-7bb9db8bbcea');

drop policy if exists "feedback: admin can delete" on public.feedback;
create policy "feedback: admin can delete" on public.feedback
  for delete using (auth.uid() = '17478ff6-7e7a-419e-ba64-7bb9db8bbcea');

-- ============================================================
-- 함수 (앱에서 rpc로 호출)
-- ============================================================

-- 관리자 통계: 집계 숫자만 반환. SECURITY DEFINER라 함수 안의 관리자 확인이 유일한 방어선
create or replace function public.get_admin_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if auth.uid() is null or auth.uid() <> '17478ff6-7e7a-419e-ba64-7bb9db8bbcea' then
    raise exception 'not authorized';
  end if;

  select json_build_object(
    'totalUsers',       (select count(*) from auth.users),
    'newUsersToday',    (select count(*) from auth.users where created_at >= date_trunc('day', now())),
    'newUsersThisWeek', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'activeUsers7d',    (
      select count(distinct user_id) from (
        select user_id, updated_at as ts from public.todos
        union all
        select user_id, updated_at as ts from public.notes
      ) a where a.ts >= now() - interval '7 days'
    ),
    'activeUsers30d',   (
      select count(distinct user_id) from (
        select user_id, updated_at as ts from public.todos
        union all
        select user_id, updated_at as ts from public.notes
      ) a where a.ts >= now() - interval '30 days'
    ),
    'totalTodos',       (select count(*) from public.todos),
    'completedTodos',   (select count(*) from public.todos where completed),
    'totalNotes',       (select count(*) from public.notes),
    'totalCategories',  (select count(*) from public.categories)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_admin_stats() to authenticated;

-- 회원 탈퇴: 로그인 계정(auth.users)까지 삭제. 모든 테이블이 on delete cascade라 데이터도 함께 삭제됨
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- 웹 푸시 구독 등록: 같은 브라우저에서 다른 계정으로 로그인하면 기존 줄을 지우고 새로 등록
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_time_zone text, p_user_agent text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, time_zone, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_time_zone, p_user_agent);
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text, text) to authenticated;

-- 지금 알려야 할 타임박스를 가져가면서 "보냄"으로 표시 (알림 발송 함수 전용)
create or replace function public.claim_due_timeblock_reminders()
returns table (
  block_id uuid, owner_id uuid, block_title text,
  block_start timestamptz, block_end timestamptz, block_remind integer
)
language sql
security definer
set search_path = public
as $$
  with due as (
    select b.id
      from public.timeblocks b
      left join public.todos t on t.id = b.todo_id and t.user_id = b.user_id
     where b.remind_minutes is not null
       and b.notified_at is null
       and not b.completed
       and not coalesce(t.completed, false)
       and b.start_at - make_interval(mins => b.remind_minutes) <= now()
       and b.start_at - make_interval(mins => b.remind_minutes) > now() - interval '10 minutes'
     for update of b skip locked
  )
  update public.timeblocks b
     set notified_at = now()
    from due
   where b.id = due.id
  returning
    b.id,
    b.user_id,
    coalesce((select t.title from public.todos t where t.id = b.todo_id and t.user_id = b.user_id), nullif(b.title, ''), '타임박스'),
    b.start_at,
    b.end_at,
    b.remind_minutes;
$$;

revoke all on function public.claim_due_timeblock_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_timeblock_reminders() to service_role;

-- 순서 바꾸기를 요청 한 번으로 저장 (RLS 그대로 적용 → 본인 행만 바뀜)
create or replace function public.reorder_items(p_table text, p_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_table not in ('todos', 'categories', 'subcategories') then
    raise exception 'unsupported table: %', p_table;
  end if;

  execute format(
    'update public.%I t
        set sort_order = o.ord - 1
       from unnest($1) with ordinality as o(id, ord)
      where t.id = o.id
        and t.user_id = auth.uid()
        and t.sort_order is distinct from o.ord - 1',
    p_table
  ) using p_ids;
end;
$$;

revoke all on function public.reorder_items(text, uuid[]) from public, anon;
grant execute on function public.reorder_items(text, uuid[]) to authenticated;

-- ============================================================
-- 실시간 동기화 (여러 기기)
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['todos', 'categories', 'subcategories', 'notes', 'note_folders', 'user_settings',
                           'monthly_goals', 'ddays', 'schedules', 'notices', 'timeblocks']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
