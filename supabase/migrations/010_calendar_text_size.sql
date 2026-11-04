-- ============================================================
-- 홈 화면 월 달력에 뜨는 일정 글자 크기를 설정에서 고를 수 있도록 컬럼 추가
-- ============================================================
alter table public.user_settings add column if not exists calendar_text_size text not null default 'medium';
