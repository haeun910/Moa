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
