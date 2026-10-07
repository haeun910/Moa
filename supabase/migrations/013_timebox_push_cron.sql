-- ============================================================
-- 타임박스 알림: 1분마다 알림 발송 함수(send-timebox-push)를 호출하는 스케줄
--
-- ⚠️ 이 파일은 README의 "타임박스 알림(웹 푸시) 설정" 순서대로
--    Edge Function을 배포하고 아래 두 비밀값을 Vault에 넣은 "다음에" 실행하세요.
--
--   select vault.create_secret('https://<프로젝트ID>.supabase.co', 'project_url');
--   select vault.create_secret('<함수에 넣은 CRON_SECRET과 같은 값>', 'timebox_cron_secret');
--
-- 비밀값은 이 파일(=git)에 적지 않고 Vault에서 꺼내 씁니다.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 다시 실행해도 중복으로 등록되지 않게 기존 작업을 먼저 지움
select cron.unschedule(jobid) from cron.job where jobname = 'timebox-push';

select cron.schedule(
  'timebox-push',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-timebox-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'timebox_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
