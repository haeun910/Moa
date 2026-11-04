-- ============================================================
-- 일정(schedules) 도입: 날짜/시간이 정해진 이벤트를 "할 일"과 별개로 관리
-- ============================================================
create table if not exists public.schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  date        date not null,
  start_time  text,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table public.schedules enable row level security;

drop policy if exists "schedules: own data" on public.schedules;
create policy "schedules: own data" on public.schedules
  for all using (auth.uid() = user_id);

create index if not exists idx_schedules_user_date on public.schedules(user_id, date);

do $$
begin
  alter publication supabase_realtime add table public.schedules;
exception when duplicate_object then
  null;
end $$;
