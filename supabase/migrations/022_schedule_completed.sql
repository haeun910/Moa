-- ============================================================
-- 일정 완료 체크: 끝낸 일정은 위쪽 일정 목록에서 빠지고, 달력에는 흐리게 남음
-- 기존 일정은 모두 "완료 안 함"
-- ============================================================
alter table public.schedules add column if not exists completed boolean not null default false;

notify pgrst, 'reload schema';
