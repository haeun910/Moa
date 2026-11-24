-- ============================================================
-- DB 보안·데이터 동작 테스트 (check_schema.sh 가 로컬 테스트 DB에서 실행)
-- 실패하면 예외가 나서 스크립트가 멈춥니다.
-- ============================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- 테스트 사용자 두 명 (가입 트리거가 기본 카테고리·설정을 만들어 줌)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

do $$ begin
  assert (select count(*) from public.categories where user_id = '00000000-0000-0000-0000-00000000000a') = 4, '가입 시 기본 카테고리 4개';
  assert (select count(*) from public.user_settings where user_id = '00000000-0000-0000-0000-00000000000a') = 1, '가입 시 설정 1줄';
end $$;

-- B의 데이터 (관리자 권한으로 미리 넣어 둠)
insert into public.todos (id, user_id, title, sort_order) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'B의 비밀 할 일', 0),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000b', 'B 할 일 2', 1);
insert into public.note_folders (id, user_id, name) values
  ('00000000-0000-0000-0000-0000000000bf', '00000000-0000-0000-0000-00000000000b', 'B 폴더');

-- ── 여기부터 A로 로그인한 상태 ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

-- 1) RLS: 남의 데이터는 안 보이고 못 고침
do $$ begin
  assert (select count(*) from public.todos) = 0, 'A에게 B의 할 일이 보이면 안 됨';
  update public.todos set title = 'hacked' where id = '00000000-0000-0000-0000-0000000000b1';
  assert not found, 'A가 B의 할 일을 고칠 수 있으면 안 됨';
end $$;

-- 2) 남의 카테고리 / 할 일 / 폴더에 연결 금지
do $$
declare
  b_category uuid;
  ok boolean;
begin
  reset role;
  select id into b_category from public.categories where user_id = '00000000-0000-0000-0000-00000000000b' limit 1;
  set role authenticated;

  ok := false;
  begin
    insert into public.todos (user_id, title, category_id) values ('00000000-0000-0000-0000-00000000000a', 'x', b_category);
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, '남의 카테고리에 할 일을 연결할 수 있으면 안 됨';

  ok := false;
  begin
    insert into public.timeblocks (user_id, todo_id, start_at, end_at)
    values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000b1', now(), now() + interval '1 hour');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, '남의 할 일에 타임박스를 연결할 수 있으면 안 됨 (알림으로 제목이 새어 나감)';

  ok := false;
  begin
    insert into public.notes (user_id, title, folder_id) values ('00000000-0000-0000-0000-00000000000a', 'x', '00000000-0000-0000-0000-0000000000bf');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, '남의 폴더에 메모를 넣을 수 있으면 안 됨';

  reset role;
  insert into public.ddays (id, user_id, title, target_date)
  values ('00000000-0000-0000-0000-0000000000bd', '00000000-0000-0000-0000-00000000000b', 'B 시험', current_date + 30);
  set role authenticated;
  ok := false;
  begin
    insert into public.todos (user_id, title, dday_id) values ('00000000-0000-0000-0000-00000000000a', 'x', '00000000-0000-0000-0000-0000000000bd');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, '남의 D-Day에 할 일을 연결할 수 있으면 안 됨';
end $$;

-- 3) 내 것끼리는 정상 연결
do $$
declare
  my_category uuid;
  my_todo uuid;
begin
  select id into my_category from public.categories order by sort_order limit 1;
  insert into public.todos (user_id, title, category_id, sort_order)
  values ('00000000-0000-0000-0000-00000000000a', '내 할 일 1', my_category, 0) returning id into my_todo;
  insert into public.timeblocks (user_id, todo_id, start_at, end_at)
  values ('00000000-0000-0000-0000-00000000000a', my_todo, now(), now() + interval '1 hour');
  insert into public.todos (user_id, title, sort_order) values
    ('00000000-0000-0000-0000-00000000000a', '내 할 일 2', 1),
    ('00000000-0000-0000-0000-00000000000a', '내 할 일 3', 2);
end $$;

-- 3-1) 준비 계획: 내 D-Day에 할 일을 연결하고, D-Day를 지우면 연결만 끊기고 할 일은 남음
do $$
declare
  my_dday uuid;
  my_todo uuid;
begin
  insert into public.ddays (user_id, title, target_date, plan)
  values ('00000000-0000-0000-0000-00000000000a', '토익 시험', current_date + 20,
          '{"categoryId": null, "subcategoryId": null, "restDays": [0], "maxPerDay": 2}'::jsonb)
  returning id into my_dday;
  insert into public.todos (user_id, title, date, dday_id, sort_order)
  values ('00000000-0000-0000-0000-00000000000a', 'LC 파트 1', current_date + 1, my_dday, 10) returning id into my_todo;
  assert (select dday_id from public.todos where id = my_todo) = my_dday, '내 D-Day에는 연결돼야 함';
  delete from public.ddays where id = my_dday;
  assert (select dday_id from public.todos where id = my_todo) is null, 'D-Day를 지우면 연결만 끊겨야 함';
  assert exists (select 1 from public.todos where id = my_todo), 'D-Day를 지워도 할 일은 남아야 함';
  delete from public.todos where id = my_todo;
end $$;

-- 4) 순서 바꾸기: 한 번에 저장되고, 남의 id가 섞여 있어도 남의 것은 안 바뀜
do $$
declare
  ids uuid[];
begin
  select array_agg(id order by sort_order desc) into ids from public.todos;   -- 거꾸로
  ids := ids || '00000000-0000-0000-0000-0000000000b1'::uuid;
  perform public.reorder_items('todos', ids);
  assert (select string_agg(title, ',' order by sort_order) from public.todos) = '내 할 일 3,내 할 일 2,내 할 일 1', '순서가 반대로 저장돼야 함';

  reset role;
  assert (select sort_order from public.todos where id = '00000000-0000-0000-0000-0000000000b1') = 0, 'B의 할 일 순서는 그대로여야 함';
  set role authenticated;

  begin
    perform public.reorder_items('feedback', ids);
    assert false, '허용되지 않은 테이블은 거절해야 함';
  exception when raise_exception then null;
  end;
end $$;

-- 5) 글자 수 상한
do $$
declare
  ok boolean := false;
begin
  begin
    insert into public.todos (user_id, title) values ('00000000-0000-0000-0000-00000000000a', repeat('가', 501));
  exception when check_violation then ok := true;
  end;
  assert ok, '501자 제목은 거절해야 함';
  insert into public.todos (user_id, title) values ('00000000-0000-0000-0000-00000000000a', repeat('가', 500));
end $$;

-- 6) 알림 발송 함수는 사용자가 직접 부를 수 없음
do $$
declare
  ok boolean := false;
begin
  begin
    perform public.claim_due_timeblock_reminders();
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, '사용자가 알림 대상 목록을 가져갈 수 있으면 안 됨';
end $$;

-- 7) 관리자 통계는 관리자만
do $$
declare
  ok boolean := false;
begin
  begin
    perform public.get_admin_stats();
  exception when raise_exception then ok := true;
  end;
  assert ok, '관리자가 아니면 통계를 볼 수 없어야 함';
end $$;

-- 7-1) 관리자는 통계를 받음 (숫자만, 회원/체험 구분, 14일 추이)
select set_config('request.jwt.claim.sub', '17478ff6-7e7a-419e-ba64-7bb9db8bbcea', false);
do $$
declare
  s json := public.get_admin_stats();
begin
  assert (s->>'version')::int = 2, '통계 버전 2';
  assert (s->>'registeredUsers')::int = 2, '회원 2명 (A, B)';
  assert (s->>'guestUsers')::int = 0, '체험 계정 0명';
  assert json_array_length(s->'daily') = 14, '최근 14일 추이';
  assert (s->'daily'->13->>'signups')::int = 2, '오늘 가입 2명';
  assert (s->'features'->>'todos')::int >= 1, '할 일 쓴 사용자 수';
  assert s::text not like '%@test.local%', '이메일이 통계에 섞이면 안 됨';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

-- 7-2) 체험 계정 지우기는 "지금 로그인한 체험 계정"만: 회원 계정은 절대 지워지지 않음
do $$
declare
  ok boolean := false;
begin
  begin
    perform public.delete_guest_account('00000000-0000-0000-0000-00000000000a');
  exception when raise_exception then ok := true;
  end;
  assert ok, '회원 계정은 체험 계정 지우기로 지워지면 안 됨';
end $$;
reset role;
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-0000000000c1', true);
do $$ begin
  assert exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000a'), '회원 A가 남아 있어야 함';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$
declare
  ok boolean := false;
begin
  begin
    perform public.delete_guest_account('00000000-0000-0000-0000-00000000000a');
  exception when raise_exception then ok := true;
  end;
  assert ok, '다른 계정 id로는 지울 수 없어야 함';
end $$;
select public.delete_guest_account('00000000-0000-0000-0000-0000000000c1');
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000c1'), '체험 계정은 지워져야 함';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

-- 8) 회원 탈퇴: 계정과 데이터가 모두 지워지고, B는 그대로
select public.delete_my_account();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000a'), '탈퇴 후 계정이 남아 있으면 안 됨';
  assert not exists (select 1 from public.todos where user_id = '00000000-0000-0000-0000-00000000000a'), '탈퇴 후 할 일이 남아 있으면 안 됨';
  assert not exists (select 1 from public.timeblocks where user_id = '00000000-0000-0000-0000-00000000000a'), '탈퇴 후 타임박스가 남아 있으면 안 됨';
  assert not exists (select 1 from public.categories where user_id = '00000000-0000-0000-0000-00000000000a'), '탈퇴 후 카테고리가 남아 있으면 안 됨';
  assert (select count(*) from public.todos where user_id = '00000000-0000-0000-0000-00000000000b') = 2, 'B의 데이터는 그대로여야 함';
end $$;

-- 9) 로그인하지 않은 사용자는 탈퇴 함수를 부를 수 없음
set role anon;
do $$
declare
  ok boolean := false;
begin
  begin
    perform public.delete_my_account();
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, '비로그인 사용자가 탈퇴 함수를 부를 수 있으면 안 됨';
end $$;
reset role;

-- 10) 설정에서 타임박스를 끈 사람에게는 시작 알림을 보내지 않음 (다시 켜면 보냄)
insert into public.timeblocks (id, user_id, title, start_at, end_at, remind_minutes) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', '알림 블록', now() + interval '1 minute', now() + interval '1 hour', 5);
update public.user_settings set hidden_features = '{timebox}' where user_id = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert not exists (select 1 from public.claim_due_timeblock_reminders() where block_id = '00000000-0000-0000-0000-0000000000c1'), '타임박스를 끈 사람에게 알림을 보내면 안 됨';
end $$;
update public.user_settings set hidden_features = '{}' where user_id = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert exists (select 1 from public.claim_due_timeblock_reminders() where block_id = '00000000-0000-0000-0000-0000000000c1'), '타임박스를 켠 사람에게는 알림을 보내야 함';
end $$;

-- 11) '안 하기'로 정리한 할 일에 연결된 타임박스는 알림을 보내지 않음
insert into public.todos (id, user_id, title, sort_order, skipped) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b', '안 하기로 한 일', 5, true);
insert into public.timeblocks (id, user_id, todo_id, start_at, end_at, remind_minutes) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', now() + interval '1 minute', now() + interval '1 hour', 5);
do $$ begin
  assert not exists (select 1 from public.claim_due_timeblock_reminders() where block_id = '00000000-0000-0000-0000-0000000000c2'), '안 하기로 한 할 일의 타임박스 알림을 보내면 안 됨';
end $$;

-- 12) 할 일·일정 미리 알림: 알릴 시각 계산 → 때가 되면 한 번만 보냄 → 시각을 바꾸면 다시 보낼 수 있음
do $$
declare
  -- 자정 직전에 돌려도 날짜가 어긋나지 않게 "5분 뒤" 시각에서 날짜와 시간을 함께 뽑음
  soon_at timestamp := (now() at time zone 'Asia/Seoul') + interval '5 minutes';
  today date := soon_at::date;
  soon text := to_char(soon_at, 'HH24:MI');
  r record;
begin
  -- 시간 있는 할 일: 시작 10분 전 (= 지금쯤) 알림
  insert into public.todos (id, user_id, title, sort_order, date, start_time, remind_minutes, time_zone) values
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000b', '곧 할 일', 6, today, soon, 10, 'Asia/Seoul');
  select remind_at, notified_at into r from public.todos where id = '00000000-0000-0000-0000-0000000000e1';
  assert r.remind_at = ((today + soon::time) at time zone 'Asia/Seoul') - interval '10 minutes', '알릴 시각 = 시작 - 10분';
  assert exists (select 1 from public.claim_due_item_reminders() where item_id = '00000000-0000-0000-0000-0000000000e1' and item_kind = 'todo'), '때가 된 할 일 알림을 보내야 함';
  assert not exists (select 1 from public.claim_due_item_reminders() where item_id = '00000000-0000-0000-0000-0000000000e1'), '같은 알림을 두 번 보내면 안 됨';
  -- 시간을 바꾸면 다시 보낼 수 있게 됨
  update public.todos set start_time = to_char((now() at time zone 'Asia/Seoul') + interval '6 minutes', 'HH24:MI') where id = '00000000-0000-0000-0000-0000000000e1';
  assert (select notified_at from public.todos where id = '00000000-0000-0000-0000-0000000000e1') is null, '시각을 바꾸면 보냄 표시가 지워져야 함';
  -- 끝낸 일은 보내지 않음
  update public.todos set completed = true where id = '00000000-0000-0000-0000-0000000000e1';
  assert not exists (select 1 from public.claim_due_item_reminders() where item_id = '00000000-0000-0000-0000-0000000000e1'), '끝낸 할 일 알림을 보내면 안 됨';

  -- 시간 없는 일정: 그날 오전 9시 기준, 시간대가 이상하면 한국 시간으로
  insert into public.schedules (id, user_id, title, date, remind_minutes, time_zone) values
    ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000b', '종일 일정', today + 1, 1440, 'Not/AZone');
  assert (select remind_at from public.schedules where id = '00000000-0000-0000-0000-0000000000e2')
       = (((today + 1) + time '09:00') at time zone 'Asia/Seoul') - interval '1 day', '시간 없는 일정은 전날 오전 9시';
  -- 날짜·알림이 없으면 알릴 시각도 없음, 이상한 시간 글자는 오전 9시로
  insert into public.todos (id, user_id, title, sort_order, date, start_time, remind_minutes) values
    ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-00000000000b', '저장소 일', 7, null, null, 0),
    ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-00000000000b', '이상한 시간', 8, today, '25:99', 0);
  assert (select remind_at from public.todos where id = '00000000-0000-0000-0000-0000000000e3') is null, '날짜 없는 할 일은 알림 없음';
  assert (select remind_at from public.todos where id = '00000000-0000-0000-0000-0000000000e4') = (today + time '09:00') at time zone 'Asia/Seoul', '이상한 시간은 오전 9시로';
end $$;

-- 13) 미리 알림·체험 정리 함수는 로그인한 사용자가 부를 수 없음 (발송 서버·예약 작업 전용)
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$
declare
  ok boolean;
begin
  ok := false;
  begin perform public.claim_due_item_reminders(); exception when insufficient_privilege then ok := true; end;
  assert ok, '사용자가 알림 가져가기 함수를 부를 수 있으면 안 됨';
  ok := false;
  begin perform public.cleanup_inactive_guests(30); exception when insufficient_privilege then ok := true; end;
  assert ok, '사용자가 체험 계정 정리 함수를 부를 수 있으면 안 됨';
end $$;
reset role;

-- 14) 30일 넘게 안 쓴 체험 계정만 지움 (최근에 로그인 유지된 체험 계정, 정식 계정은 그대로)
insert into auth.users (id, email, is_anonymous, created_at, last_sign_in_at) values
  ('00000000-0000-0000-0000-0000000000f1', null, true,  now() - interval '90 days', now() - interval '40 days'),
  ('00000000-0000-0000-0000-0000000000f2', null, true,  now() - interval '90 days', now() - interval '40 days'),
  ('00000000-0000-0000-0000-0000000000f3', 'old@test.local', false, now() - interval '400 days', now() - interval '300 days'),
  ('00000000-0000-0000-0000-0000000000f4', null, true,  now() - interval '3 days', null);
-- f2는 어제까지 앱을 열어 두어 토큰이 갱신됨
insert into auth.refresh_tokens (user_id, created_at, updated_at) values ('00000000-0000-0000-0000-0000000000f2', now() - interval '1 day', now() - interval '1 day');
insert into public.todos (user_id, title, sort_order) values ('00000000-0000-0000-0000-0000000000f1', '버려진 체험 할 일', 0);
do $$
declare
  ok boolean := false;
begin
  begin perform public.cleanup_inactive_guests(1); exception when others then ok := true; end;
  assert ok, '7일보다 짧은 기간으로는 지울 수 없어야 함';
  assert public.cleanup_inactive_guests(30) = 1, '오래 안 쓴 체험 계정 하나만 지워야 함';
  assert not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000f1'), '오래 안 쓴 체험 계정은 지워야 함';
  assert not exists (select 1 from public.todos where user_id = '00000000-0000-0000-0000-0000000000f1'), '지운 체험 계정의 데이터도 지워져야 함';
  assert exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000f2'), '최근에 쓴 체험 계정은 남아야 함';
  assert exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000f3'), '정식 계정은 오래돼도 지우면 안 됨';
  assert exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000f4'), '새 체험 계정은 남아야 함';
end $$;
