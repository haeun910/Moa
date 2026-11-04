-- ============================================================
-- 안정성 보강
--  1) 순서 바꾸기를 요청 한 번으로 저장하는 함수 (reorder_items)
--  2) 다른 사람의 카테고리/하위카테고리/할 일/폴더를 내 데이터에 연결하지 못하게 막기
--     (외래키 검사는 RLS를 거치지 않아서, 남의 id를 알면 연결 자체는 가능했음.
--      특히 타임박스 알림 함수는 관리자 권한으로 돌기 때문에 연결된 남의 할 일 제목을 알림으로 보낼 수 있었음)
--  3) 글자 수 상한 (한 사람이 메모 하나에 수 MB를 넣는 것 방지)
--
-- 다시 실행해도 안전하게 작성함. 016_timeblocks.sql 다음에 실행하세요.
-- ============================================================

-- ------------------------------------------------------------
-- 1) 순서 바꾸기
--    security invoker(기본값)라 RLS가 그대로 적용됨 → 본인 행만 바뀜
-- ------------------------------------------------------------
create or replace function public.reorder_items(p_table text, p_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_table not in ('todos', 'categories', 'subcategories') then
    raise exception 'unsupported table: %', p_table;
  end if;

  execute format(
    'update public.%I t
        set sort_order = o.ord - 1
       from unnest($1) with ordinality as o(id, ord)
      where t.id = o.id
        and t.user_id = auth.uid()
        and t.sort_order is distinct from o.ord - 1',
    p_table
  ) using p_ids;
end;
$$;

revoke all on function public.reorder_items(text, uuid[]) from public, anon;
grant execute on function public.reorder_items(text, uuid[]) to authenticated;

-- ------------------------------------------------------------
-- 2) 연결 대상이 같은 사용자 것인지 확인
--    새로 넣거나 연결 대상이 바뀔 때만 검사 (기존 행을 다른 이유로 고칠 때는 막지 않음)
-- ------------------------------------------------------------
create or replace function public.check_owned_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'todos' then
    if new.category_id is not null
       and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
       and not exists (select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id) then
      raise exception 'category does not belong to this user' using errcode = '42501';
    end if;
    if new.subcategory_id is not null
       and (tg_op = 'INSERT' or new.subcategory_id is distinct from old.subcategory_id)
       and not exists (select 1 from public.subcategories s where s.id = new.subcategory_id and s.user_id = new.user_id) then
      raise exception 'subcategory does not belong to this user' using errcode = '42501';
    end if;

  elsif tg_table_name = 'subcategories' then
    if (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
       and not exists (select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id) then
      raise exception 'category does not belong to this user' using errcode = '42501';
    end if;

  elsif tg_table_name = 'timeblocks' then
    if new.todo_id is not null
       and (tg_op = 'INSERT' or new.todo_id is distinct from old.todo_id)
       and not exists (select 1 from public.todos t where t.id = new.todo_id and t.user_id = new.user_id) then
      raise exception 'todo does not belong to this user' using errcode = '42501';
    end if;

  elsif tg_table_name = 'notes' then
    if new.folder_id is not null
       and (tg_op = 'INSERT' or new.folder_id is distinct from old.folder_id)
       and not exists (select 1 from public.note_folders f where f.id = new.folder_id and f.user_id = new.user_id) then
      raise exception 'folder does not belong to this user' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists todos_check_owned_references on public.todos;
create trigger todos_check_owned_references
  before insert or update of category_id, subcategory_id, user_id on public.todos
  for each row execute function public.check_owned_references();

drop trigger if exists subcategories_check_owned_references on public.subcategories;
create trigger subcategories_check_owned_references
  before insert or update of category_id, user_id on public.subcategories
  for each row execute function public.check_owned_references();

drop trigger if exists timeblocks_check_owned_references on public.timeblocks;
create trigger timeblocks_check_owned_references
  before insert or update of todo_id, user_id on public.timeblocks
  for each row execute function public.check_owned_references();

drop trigger if exists notes_check_owned_references on public.notes;
create trigger notes_check_owned_references
  before insert or update of folder_id, user_id on public.notes
  for each row execute function public.check_owned_references();

-- 알림 함수도 한 번 더 막음: 연결된 할 일이 같은 사용자 것일 때만 그 제목/완료 여부를 씀
create or replace function public.claim_due_timeblock_reminders()
returns table (
  block_id uuid, owner_id uuid, block_title text,
  block_start timestamptz, block_end timestamptz, block_remind integer
)
language sql
security definer
set search_path = public
as $$
  with due as (
    select b.id
      from public.timeblocks b
      left join public.todos t on t.id = b.todo_id and t.user_id = b.user_id
     where b.remind_minutes is not null
       and b.notified_at is null
       and not b.completed
       and not coalesce(t.completed, false)
       and b.start_at - make_interval(mins => b.remind_minutes) <= now()
       and b.start_at - make_interval(mins => b.remind_minutes) > now() - interval '10 minutes'
     for update of b skip locked
  )
  update public.timeblocks b
     set notified_at = now()
    from due
   where b.id = due.id
  returning
    b.id,
    b.user_id,
    coalesce((select t.title from public.todos t where t.id = b.todo_id and t.user_id = b.user_id), nullif(b.title, ''), '타임박스'),
    b.start_at,
    b.end_at,
    b.remind_minutes;
$$;

revoke all on function public.claim_due_timeblock_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_timeblock_reminders() to service_role;

-- ------------------------------------------------------------
-- 3) 글자 수 상한
--    not valid: 이미 저장된 행은 검사하지 않고, 앞으로 넣거나 고치는 행부터 적용
--    (앱 입력칸의 maxLength와 같은 값 - src/lib/limits.ts)
--    주의: 이미 상한을 넘은 행은 다른 칸(완료 체크 등)을 고칠 때도 거절됨. 실행 전에 아래로 확인해서 0이면 안전:
--      select count(*) from public.todos where char_length(title) > 500 or char_length(notes) > 20000;
--      select count(*) from public.notes where char_length(title) > 500 or char_length(content) > 200000;
-- ------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('todos',         'title',       500),
      ('todos',         'notes',       20000),
      ('categories',    'name',        100),
      ('categories',    'description', 20000),
      ('subcategories', 'name',        200),
      ('subcategories', 'notes',       20000),
      ('notes',         'title',       500),
      ('notes',         'content',     200000),
      ('schedules',     'title',       500),
      ('schedules',     'notes',       20000),
      ('monthly_goals', 'title',       500),
      ('ddays',         'title',       500),
      ('timeblocks',    'title',       500),
      ('notices',       'title',       500),
      ('notices',       'content',     20000)
    ) as v(tbl, col, max_len)
  loop
    if not exists (
      select 1 from pg_constraint
       where conname = format('%s_%s_length', c.tbl, c.col)
         and conrelid = format('public.%I', c.tbl)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (char_length(%I) <= %s) not valid',
        c.tbl, format('%s_%s_length', c.tbl, c.col), c.col, c.max_len
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
