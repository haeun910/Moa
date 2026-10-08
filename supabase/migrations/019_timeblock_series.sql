-- ============================================================
-- 타임박스 반복 (매주 고정 일정: 기상, 운동 등)
-- 할 일·일정의 반복과 같은 방식: 각 회차는 독립된 블록 행이고 series_id로 묶임
-- (알림 함수는 블록 행을 그대로 보므로 반복 블록도 회차마다 알림이 감)
-- 다시 실행해도 안전함. 018_hardening.sql 다음에 실행하세요.
-- ============================================================
alter table public.timeblocks add column if not exists series_id uuid;

create index if not exists idx_timeblocks_series on public.timeblocks(series_id, start_at) where series_id is not null;

notify pgrst, 'reload schema';
