-- ============================================================
-- 설정에서 고를 수 있는 표시 옵션
--  1) show_holidays: 달력·홈에 한국 공휴일(빨간 날) 표시 (기본 켬)
--  2) hidden_features: 메뉴에서 숨길 기능 ('timebox' | 'all' | 'notes'). 데이터는 지우지 않고 화면만 숨김
--  3) 타임박스를 끈 사람에게는 타임박스 시작 알림도 보내지 않음
-- ============================================================
alter table public.user_settings add column if not exists show_holidays boolean not null default true;
alter table public.user_settings add column if not exists hidden_features text[] not null default '{}';

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

notify pgrst, 'reload schema';
