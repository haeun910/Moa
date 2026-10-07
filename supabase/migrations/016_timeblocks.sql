-- ============================================================
-- 타임박스(timeblocks): "언제 무엇을 하겠다"는 시간 블록 + 블록 시작 알림(웹 푸시)
--
-- 시간은 사용자의 기기 시간대 기준으로 만든 절대 시각(timestamptz)으로 저장한다.
-- 그래야 서버(알림 발송 함수)가 사용자 시간대를 몰라도 "지금 울려야 할 블록"을 바로 찾을 수 있음.
-- ============================================================
create table if not exists public.timeblocks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- 할 일과 연결된 블록이면 화면/알림 제목은 할 일 제목을 따라감. 할 일이 지워지면 연결만 끊기고 블록은 남음
  todo_id         uuid references public.todos(id) on delete set null,
  title           text not null default '',
  color           text,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  completed       boolean not null default false,
  -- 시작 몇 분 전에 알릴지 (0 = 시작 시각, null = 알림 없음)
  remind_minutes  integer default 0 check (remind_minutes is null or remind_minutes between 0 and 120),
  -- 알림을 보낸 시각. 시간을 바꾸면 앱이 다시 null로 돌려서 새 시간에 또 울리게 함
  notified_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint timeblocks_time_order check (end_at > start_at)
);

alter table public.timeblocks enable row level security;

drop policy if exists "timeblocks: own data" on public.timeblocks;
create policy "timeblocks: own data" on public.timeblocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_timeblocks_user_start on public.timeblocks(user_id, start_at);
create index if not exists idx_timeblocks_todo on public.timeblocks(todo_id);
-- 알림 발송 함수가 매분 "아직 안 보낸 알림"만 훑어보도록
create index if not exists idx_timeblocks_pending_reminder on public.timeblocks(start_at)
  where notified_at is null and remind_minutes is not null;

do $$
begin
  alter publication supabase_realtime add table public.timeblocks;
exception when duplicate_object then
  null;
end $$;

-- ============================================================
-- 웹 푸시 구독: 기기(브라우저)마다 한 줄
-- ============================================================
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  time_zone   text,          -- 알림 문구의 시각(10:00 – 11:30)을 이 기기 시간대로 적기 위함
  user_agent  text,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: own data" on public.push_subscriptions;
create policy "push_subscriptions: own data" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

-- 같은 브라우저에서 다른 계정으로 다시 로그인하면 endpoint가 같아서 일반 upsert는 RLS에 막힘.
-- 이 함수가 기존 줄을 지우고 지금 로그인한 사용자 것으로 다시 등록한다.
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

-- ============================================================
-- 지금 알려야 할 블록을 "가져가면서" 보낸 것으로 표시 (발송 함수 전용)
-- 여러 번 동시에 불려도 같은 알림이 두 번 나가지 않도록 skip locked + update ... returning 사용.
-- 10분 넘게 지난 알림은 보내지 않음 (서버가 잠깐 멈췄다 돌아왔을 때 옛 알림이 한꺼번에 쏟아지는 것 방지)
-- ============================================================
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
      left join public.todos t on t.id = b.todo_id
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
    coalesce((select t.title from public.todos t where t.id = b.todo_id), nullif(b.title, ''), '타임박스'),
    b.start_at,
    b.end_at,
    b.remind_minutes;
$$;

revoke all on function public.claim_due_timeblock_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_timeblock_reminders() to service_role;

-- 시작 화면으로 타임박스도 고를 수 있게 됨 (default_screen에 'timebox' 값 사용 - 별도 제약 없음)

-- Supabase API가 위에서 만든 함수(register_push_subscription, claim_due_timeblock_reminders)를 바로 알아보도록 새로고침.
-- 이게 없으면 알림 발송 함수가 "Could not find the function public.claim_due_timeblock_reminders"로 실패할 수 있음
notify pgrst, 'reload schema';
