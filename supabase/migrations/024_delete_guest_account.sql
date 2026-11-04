-- ============================================================
-- 체험(익명) 계정만 지우는 함수.
-- 체험 중 "기존 계정으로 로그인"·"체험 끝내기"에서 씀. delete_my_account는 "지금 로그인한 계정"을
-- 지우므로, 다른 창에서 이미 회원 계정으로 바뀐 뒤에 불리면 회원 계정이 지워질 수 있었음.
-- 이 함수는 지금 로그인한 계정이 넘겨받은 체험 계정 id와 같고, 실제로 익명 계정일 때만 지움.
-- ============================================================
create or replace function public.delete_guest_account(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_guest_id then
    raise exception 'not this guest account';
  end if;

  delete from auth.users where id = p_guest_id and is_anonymous;
  if not found then
    raise exception 'not a guest account';
  end if;
end;
$$;

revoke all on function public.delete_guest_account(uuid) from public;
revoke all on function public.delete_guest_account(uuid) from anon;
grant execute on function public.delete_guest_account(uuid) to authenticated;

notify pgrst, 'reload schema';
