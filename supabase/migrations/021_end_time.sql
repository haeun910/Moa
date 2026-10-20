-- ============================================================
-- 1) 할 일·일정에 끝나는 시간 추가 (HH:MM, 없으면 시작 시간부터 1시간으로 보여줌)
-- 2) 일정에 끝나는 날짜 추가 (여행처럼 여러 날에 걸친 일정. 없으면 하루짜리)
-- 기존 데이터는 그대로 (끝 시간·끝 날짜 없음)
-- ============================================================
alter table public.todos add column if not exists end_time text;
alter table public.schedules add column if not exists end_time text;
alter table public.schedules add column if not exists end_date date;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'schedules_end_date_order' and conrelid = 'public.schedules'::regclass) then
    alter table public.schedules add constraint schedules_end_date_order check (end_date is null or end_date >= date);
  end if;
end $$;

notify pgrst, 'reload schema';
