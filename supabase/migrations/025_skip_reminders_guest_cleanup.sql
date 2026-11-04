-- ============================================================
-- 1) 할 일 '안 하기': 지난 할 일을 하지 않기로 정리 (그 날짜에 흐리게 남고, 밀린 일·진행률에서 빠짐)
-- 2) 할 일·일정 미리 알림: 정한 시각(시간이 없으면 그날 오전 9시) 몇 분 전에 웹 푸시로 알림
-- 3) 오래 안 쓴 체험(익명) 계정 자동 정리: 30일 넘게 쓰지 않은 체험 계정과 그 데이터를 지움
--    (매일 지우는 예약은 026_guest_cleanup_cron.sql)
-- 여러 번 실행해도 안전합니다.
-- ============================================================

-- ── 1) 안 하기 ──
alter table public.todos add column if not exists skipped boolean not null default false;

-- ── 2) 미리 알림 ──
-- remind_minutes: 몇 분 전에 알릴지 (없으면 알림 없음). time_zone: 그 시각을 정한 기기의 시간대
-- remind_at: 실제로 알릴 시각 (아래 트리거가 계산), notified_at: 보낸 시각 (같은 알림을 두 번 보내지 않게)
alter table public.todos add column if not exists remind_minutes integer;
alter table public.todos add column if not exists time_zone text;
alter table public.todos add column if not exists remind_at timestamptz;
alter table public.todos add column if not exists notified_at timestamptz;
alter table public.schedules add column if not exists remind_minutes integer;
alter table public.schedules add column if not exists time_zone text;
alter table public.schedules add column if not exists remind_at timestamptz;
alter table public.schedules add column if not exists notified_at timestamptz;

do $$ begin
  alter table public.todos add constraint todos_remind_minutes_range check (remind_minutes between 0 and 10080);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.todos add constraint todos_time_zone_length check (char_length(time_zone) <= 64);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.schedules add constraint schedules_remind_minutes_range check (remind_minutes between 0 and 10080);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.schedules add constraint schedules_time_zone_length check (char_length(time_zone) <= 64);
exception when duplicate_object then null; end $$;

-- 날짜·시간·알림을 바꿀 때마다 알릴 시각을 다시 계산 (시각이 바뀌면 다시 보낼 수 있게 notified_at도 비움)
create or replace function public.set_item_remind_at()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_time time;
begin
  if new.remind_minutes is null or new.date is null then
    new.remind_at := null;
  else
    base_time := case when new.start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then new.start_time::time else time '09:00' end;
    begin
      new.remind_at := ((new.date + base_time) at time zone coalesce(nullif(new.time_zone, ''), 'Asia/Seoul'))
                       - make_interval(mins => new.remind_minutes);
    exception when invalid_parameter_value then
      -- 모르는 시간대 이름이면 한국 시간으로
      new.remind_at := ((new.date + base_time) at time zone 'Asia/Seoul') - make_interval(mins => new.remind_minutes);
    end;
  end if;
  if tg_op = 'INSERT' then
    new.notified_at := null;
  elsif new.remind_at is distinct from old.remind_at then
    new.notified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists todos_set_remind_at on public.todos;
create trigger todos_set_remind_at
  before insert or update of date, start_time, remind_minutes, time_zone on public.todos
  for each row execute function public.set_item_remind_at();

drop trigger if exists schedules_set_remind_at on public.schedules;
create trigger schedules_set_remind_at
  before insert or update of date, start_time, remind_minutes, time_zone on public.schedules
  for each row execute function public.set_item_remind_at();

create index if not exists idx_todos_pending_reminder on public.todos(remind_at)
  where remind_at is not null and notified_at is null;
create index if not exists idx_schedules_pending_reminder on public.schedules(remind_at)
  where remind_at is not null and notified_at is null;

-- 지금 알려야 할 할 일·일정을 가져가면서 "보냄"으로 표시 (알림 발송 함수 전용)
-- 끝낸 일, 안 하기로 한 일은 보내지 않음. 10분 넘게 지난 알림은 버림 (서버가 잠깐 멈췄다 돌아와도 한꺼번에 쏟아지지 않게)
create or replace function public.claim_due_item_reminders()
returns table (
  item_kind text, item_id uuid, owner_id uuid, item_title text,
  item_date date, item_start text, item_end text, item_remind integer
)
language sql
security definer
set search_path = public
as $$
  with due_todos as (
    select t.id
      from public.todos t
     where t.remind_at is not null
       and t.notified_at is null
       and t.remind_at <= now()
       and t.remind_at > now() - interval '10 minutes'
       and not t.completed
       and not t.skipped
     for update of t skip locked
  ),
  sent_todos as (
    update public.todos t
       set notified_at = now()
      from due_todos d
     where t.id = d.id
    returning 'todo'::text, t.id, t.user_id, t.title, t.date, t.start_time, t.end_time, t.remind_minutes
  ),
  due_schedules as (
    select s.id
      from public.schedules s
     where s.remind_at is not null
       and s.notified_at is null
       and s.remind_at <= now()
       and s.remind_at > now() - interval '10 minutes'
       and not s.completed
     for update of s skip locked
  ),
  sent_schedules as (
    update public.schedules s
       set notified_at = now()
      from due_schedules d
     where s.id = d.id
    returning 'schedule'::text, s.id, s.user_id, s.title, s.date, s.start_time, s.end_time, s.remind_minutes
  )
  select * from sent_todos
  union all
  select * from sent_schedules;
$$;

revoke all on function public.claim_due_item_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_item_reminders() to service_role;

-- 타임박스 알림: 연결된 할 일을 '안 하기'로 정리했으면 보내지 않음
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
       and not coalesce(t.skipped, false)
       -- 설정에서 타임박스를 끈 사람에게는 알림을 보내지 않음
       and not exists (
         select 1 from public.user_settings s
          where s.user_id = b.user_id and 'timebox' = any(s.hidden_features)
       )
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

-- ── 3) 오래 안 쓴 체험 계정 정리 ──
-- 마지막으로 쓴 때 = 가입·로그인·로그인 유지(토큰 갱신) 중 가장 최근. 앱을 열어 두기만 해도 토큰이 갱신되므로 "쓴 것"으로 봄.
-- 계정을 지우면 할 일·메모 등 그 사람 데이터도 함께 지워짐 (모든 표가 on delete cascade).
-- 정식 계정(이메일·구글 연결)은 절대 지우지 않음. 한 번에 최대 500개씩.
create or replace function public.cleanup_inactive_guests(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  if p_days is null or p_days < 7 then
    raise exception 'p_days must be 7 or more';
  end if;

  with stale as (
    select u.id
      from auth.users u
     where u.is_anonymous
       and greatest(
             u.created_at,
             u.last_sign_in_at,
             u.updated_at,
             (select max(s.updated_at) from auth.sessions s where s.user_id = u.id),
             (select max(r.updated_at) from auth.refresh_tokens r where r.user_id = u.id::text)
           ) < now() - make_interval(days => p_days)
     order by u.created_at
     limit 500
  ),
  gone as (
    delete from auth.users u
     using stale
     where u.id = stale.id
       and u.is_anonymous
    returning 1
  )
  select count(*) into removed from gone;
  return removed;
end;
$$;

revoke all on function public.cleanup_inactive_guests(integer) from public, anon, authenticated;
grant execute on function public.cleanup_inactive_guests(integer) to service_role;

notify pgrst, 'reload schema';
