-- ============================================================
-- 회원 탈퇴: 로그인 계정(auth.users)까지 완전히 삭제
--
-- 예전에는 앱에서 각 테이블의 데이터만 지워서, 이메일·이름 등이 들어 있는
-- 로그인 계정(auth.users)이 그대로 남았음 (개인정보처리방침의 "탈퇴 시 지체 없이 파기"와 불일치).
-- 브라우저는 auth.users를 직접 지울 수 없으므로, 본인 계정만 지울 수 있는 함수를 둠.
--
-- 모든 사용자 테이블이 auth.users(id) on delete cascade 로 연결되어 있어서
-- 계정을 지우면 할 일·일정·메모·폴더·설정·의견 등이 함께 삭제됨.
-- ============================================================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  -- 로그인한 본인만, 본인 계정만 삭제 가능 (다른 사람 id를 넘길 방법이 없도록 인자 없음)
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = uid;
end;
$$;

-- 로그인한 사용자만 호출 가능 (익명/공개 호출 차단)
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
