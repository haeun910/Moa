-- 하위카테고리 도입(008) 직전의 schema.sql (2026-09-12, bed4567) 그대로. check_schema.sh 가 "운영 DB가 거쳐온 길"을 재현할 때만 씀. 직접 실행하지 마세요.
-- ============================================================
-- All Planner - Supabase Schema
-- Supabase SQL Editor에서 이 전체 내용을 실행하세요.
-- ============================================================

-- 1. categories
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default '#6366f1',
  description text,                          -- 저장소 화면에서만 보이는 카테고리 설명
  is_default  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 2. todos
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  completed   boolean not null default false,
  category_id uuid references public.categories(id) on delete set null,
  date        date,
  due_date    date,                          -- 작업할 날짜(date)와는 별개인 마감일
  is_dday     boolean not null default false, -- 체크하면 홈 화면 D-Day 목록에도 자동 노출
  start_time  text,
  notes       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. subtasks
create table if not exists public.subtasks (
  id          uuid primary key default gen_random_uuid(),
  todo_id     uuid not null references public.todos(id) on delete cascade,
  title       text not null,
  completed   boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 4. notes
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 5. user_settings (1 row per user)
create table if not exists public.user_settings (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  theme           text not null default 'system',
  default_screen  text not null default 'today',
  notifications   boolean not null default false,
  list_sort_by    text not null default 'manual',   -- 'manual' | 'date' | 'name'
  hide_completed  boolean not null default false,
  hidden_category_ids uuid[] not null default '{}',
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- updated_at 자동 갱신 트리거
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

-- ============================================================
-- 신규 유저 가입 시 기본 카테고리 + 설정 자동 생성
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 기본 설정
  insert into public.user_settings (user_id) values (new.id);

  -- 기본 카테고리
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
-- Row Level Security (RLS) - 본인 데이터만 접근 가능
-- ============================================================
alter table public.categories    enable row level security;
alter table public.todos         enable row level security;
alter table public.subtasks      enable row level security;
alter table public.notes         enable row level security;
alter table public.user_settings enable row level security;

-- categories
create policy "categories: own data" on public.categories
  for all using (auth.uid() = user_id);

-- todos
create policy "todos: own data" on public.todos
  for all using (auth.uid() = user_id);

-- subtasks (todo 소유자만)
create policy "subtasks: own data" on public.subtasks
  for all using (
    exists (
      select 1 from public.todos
      where todos.id = subtasks.todo_id
        and todos.user_id = auth.uid()
    )
  );

-- notes
create policy "notes: own data" on public.notes
  for all using (auth.uid() = user_id);

-- user_settings
create policy "user_settings: own data" on public.user_settings
  for all using (auth.uid() = user_id);

-- ============================================================
-- 인덱스 (성능)
-- ============================================================
create index if not exists idx_todos_user_date       on public.todos(user_id, date);
create index if not exists idx_todos_user_category   on public.todos(user_id, category_id);
create index if not exists idx_subtasks_todo         on public.subtasks(todo_id);
create index if not exists idx_notes_user            on public.notes(user_id, updated_at desc);
create index if not exists idx_categories_user       on public.categories(user_id, sort_order);

-- ============================================================
-- Realtime 활성화
-- ============================================================
alter publication supabase_realtime add table public.todos;
alter publication supabase_realtime add table public.subtasks;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.notes;
