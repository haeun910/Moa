-- ============================================================
-- 1) 의견 보내기(feedback): 사용자는 자기 의견을 보내기만 하고,
--    읽기/삭제는 관리자만 가능
--    아래 UUID는 003_notices.sql / 004_admin_stats.sql과 같은 본인(관리자) 계정의
--    auth.users.id 여야 합니다. (src/lib/supabase.ts의 ADMIN_USER_ID와 동일)
-- ============================================================
create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 2000),
  app_version  text,
  created_at   timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback: insert own" on public.feedback;
create policy "feedback: insert own" on public.feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists "feedback: admin can read" on public.feedback;
create policy "feedback: admin can read" on public.feedback
  for select using (auth.uid() = '17478ff6-7e7a-419e-ba64-7bb9db8bbcea');

drop policy if exists "feedback: admin can delete" on public.feedback;
create policy "feedback: admin can delete" on public.feedback
  for delete using (auth.uid() = '17478ff6-7e7a-419e-ba64-7bb9db8bbcea');

create index if not exists idx_feedback_created on public.feedback(created_at desc);

-- ============================================================
-- 2) 여러 기기 동기화: 설정(user_settings)도 실시간으로 반영되도록 추가
--    (할 일/카테고리/메모/목표/D-Day/일정은 이전 마이그레이션에서 이미 추가됨)
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.user_settings;
exception when duplicate_object then
  null;
end $$;
