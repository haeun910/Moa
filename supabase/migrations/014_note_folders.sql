-- ============================================================
-- 메모 폴더 + 메모 고정
-- - note_folders: 사용자별 메모 폴더
-- - notes.folder_id: 폴더를 지우면 메모는 지워지지 않고 "폴더 없음"으로 이동 (on delete set null)
-- - notes.pinned: 목록 맨 위에 고정
-- ============================================================
create table if not exists public.note_folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.note_folders enable row level security;

drop policy if exists "note_folders: own data" on public.note_folders;
create policy "note_folders: own data" on public.note_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_note_folders_user on public.note_folders(user_id, sort_order);

alter table public.notes add column if not exists folder_id uuid references public.note_folders(id) on delete set null;
alter table public.notes add column if not exists pinned boolean not null default false;

create index if not exists idx_notes_folder on public.notes(folder_id) where folder_id is not null;

-- 여러 기기 실시간 동기화
do $$
begin
  alter publication supabase_realtime add table public.note_folders;
exception when duplicate_object then
  null;
end $$;
