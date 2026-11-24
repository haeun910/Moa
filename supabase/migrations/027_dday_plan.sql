-- ============================================================
-- 027 프로젝트 로드맵(D-Day 준비 계획)
-- D-Day까지 해야 할 일을 날짜별로 나눠 두고, 어떤 D-Day를 위한 할 일인지 연결
--  · todos.dday_id : 준비 계획으로 만든 할 일이면 그 D-Day (D-Day를 지우면 연결만 끊기고 할 일은 남음)
--  · ddays.plan    : 나눌 때 고른 설정 (카테고리·하위 카테고리·쉬는 요일·하루 최대 개수) → "남은 일 다시 나누기"에 다시 씀
--  · 남의 D-Day에 내 할 일을 연결하지 못하게 소유 확인(018)에 dday_id 추가
-- 여러 번 실행해도 안전함
-- ============================================================
alter table public.todos add column if not exists dday_id uuid;
do $$ begin
  alter table public.todos add constraint todos_dday_id_fkey foreign key (dday_id) references public.ddays(id) on delete set null;
exception when duplicate_object then null;
end $$;
create index if not exists idx_todos_dday on public.todos(dday_id) where dday_id is not null;

alter table public.ddays add column if not exists plan jsonb;
do $$ begin
  alter table public.ddays add constraint ddays_plan_size check (octet_length(plan::text) <= 2000);
exception when duplicate_object then null;
end $$;

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
    if new.dday_id is not null
       and (tg_op = 'INSERT' or new.dday_id is distinct from old.dday_id)
       and not exists (select 1 from public.ddays d where d.id = new.dday_id and d.user_id = new.user_id) then
      raise exception 'dday does not belong to this user' using errcode = '42501';
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
  before insert or update of category_id, subcategory_id, dday_id, user_id on public.todos
  for each row execute function public.check_owned_references();

notify pgrst, 'reload schema';
