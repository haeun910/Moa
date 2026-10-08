-- ============================================================
-- 하위카테고리 도입: 카테고리 → 하위카테고리 → 할 일 구조로 전환
-- ============================================================
begin;

-- 1) 하위카테고리 테이블
create table if not exists public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.subcategories enable row level security;

drop policy if exists "subcategories: own data" on public.subcategories;
create policy "subcategories: own data" on public.subcategories
  for all using (auth.uid() = user_id);

create index if not exists idx_subcategories_category on public.subcategories(category_id, sort_order);

-- 2) todos에 하위카테고리 연결 컬럼 추가
alter table public.todos add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null;
create index if not exists idx_todos_subcategory on public.todos(subcategory_id);

-- 3) 데이터 마이그레이션
--    하위 항목(subtasks)이 있던 할 일 = 지금까지 "큰 제목"으로 써온 컨테이너.
--    이런 할 일을 하위카테고리로 바꾸고, 그 안의 하위 항목들을 진짜 할 일로 승격시킴.
--    (하위 항목이 하나도 없던 할 일은 원래부터 단순 할 일이었으므로 그대로 둠)
do $$
declare
  container record;
  new_subcat_id uuid;
begin
  -- 새로 만든 DB(최신 schema.sql)에는 예전 subtasks 테이블이 없으므로 옮길 것도 없음
  if to_regclass('public.subtasks') is null then
    return;
  end if;

  for container in
    select distinct t.user_id, t.category_id, t.title
    from public.todos t
    where exists (select 1 from public.subtasks s where s.todo_id = t.id)
  loop
    -- 같은 사용자 + 같은 카테고리 + 같은 제목의 컨테이너는 하위카테고리 하나로 합침
    insert into public.subcategories (user_id, category_id, name)
    values (container.user_id, container.category_id, container.title)
    returning id into new_subcat_id;

    -- 하위 항목 → 진짜 할 일로 승격 (컨테이너의 날짜/마감일/시간을 물려받음)
    insert into public.todos (user_id, title, completed, category_id, subcategory_id, date, due_date, start_time, sort_order)
    select t.user_id, s.title, s.completed, t.category_id, new_subcat_id, t.date, t.due_date, t.start_time, s.sort_order
    from public.todos t
    join public.subtasks s on s.todo_id = t.id
    where t.user_id = container.user_id
      and coalesce(t.category_id::text, '') = coalesce(container.category_id::text, '')
      and t.title = container.title;

    -- 원본 컨테이너 삭제 (하위 항목들은 FK cascade로 함께 정리됨)
    delete from public.todos t
    where t.user_id = container.user_id
      and coalesce(t.category_id::text, '') = coalesce(container.category_id::text, '')
      and t.title = container.title
      and exists (select 1 from public.subtasks s where s.todo_id = t.id);
  end loop;
end $$;

commit;

-- 참고: 기존 subtasks 테이블은 안전을 위해 삭제하지 않고 그대로 남겨둡니다(더 이상 앱에서 쓰지 않음).
-- 마이그레이션 결과를 확인한 뒤 필요하면 나중에 직접 `drop table public.subtasks;`로 정리하세요.

-- 4) 실시간 반영
-- Supabase 프로젝트에 따라 새 테이블이 자동으로 publication에 포함되기도 해서,
-- 이미 등록돼 있으면 에러 없이 넘어가도록 예외 처리
do $$
begin
  alter publication supabase_realtime add table public.subcategories;
exception when duplicate_object then
  null;
end $$;

