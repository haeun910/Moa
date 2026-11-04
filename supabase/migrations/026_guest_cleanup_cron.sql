-- ============================================================
-- 매일 새벽(한국 시간 03:30) 30일 넘게 쓰지 않은 체험(익명) 계정을 지우는 예약
-- 025_skip_reminders_guest_cleanup.sql 을 먼저 실행한 뒤에 실행하세요.
-- (pg_cron은 Supabase 전용이라 로컬 테스트(check_schema.sh)에서는 이 파일을 건너뜀)
-- ============================================================
create extension if not exists pg_cron;

-- 다시 실행해도 중복으로 등록되지 않게 기존 작업을 먼저 지움
select cron.unschedule(jobid) from cron.job where jobname = 'cleanup-inactive-guests';

-- pg_cron 시간은 UTC 기준: 18:30 UTC = 한국 시간 새벽 3:30
select cron.schedule(
  'cleanup-inactive-guests',
  '30 18 * * *',
  $$ select public.cleanup_inactive_guests(30); $$
);
