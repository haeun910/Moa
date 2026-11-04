-- ============================================================
-- 반복 일정 / 반복 할 일: 같은 반복으로 만들어진 항목들을 series_id로 묶음
-- (각 회차는 여전히 독립된 행이라 개별 수정/완료가 가능하고,
--  "이후 모두" / "전체" 수정·삭제 시 이 값으로 한꺼번에 찾음)
-- ============================================================
alter table public.todos     add column if not exists series_id uuid;
alter table public.schedules add column if not exists series_id uuid;

create index if not exists idx_todos_series     on public.todos(series_id)     where series_id is not null;
create index if not exists idx_schedules_series on public.schedules(series_id) where series_id is not null;
