-- ============================================================
-- 관리자 통계 v2 - 회원/체험 계정 구분, 한국 시간 기준 날짜, 최근 14일 추이,
-- 기능별 사용자 수, 재방문율, 의견·푸시 알림 숫자를 추가.
-- 예전 키(totalUsers 등)도 그대로 남겨서 앱이 먼저 배포돼도 깨지지 않음.
--
-- 개인정보(이메일, 할 일 내용 등)는 절대 반환하지 않고 집계 숫자만 반환.
-- SECURITY DEFINER라 함수 안의 관리자 확인이 유일한 방어선 (UUID는 004와 같음).
-- ============================================================
create or replace function public.get_admin_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is null or auth.uid() <> '17478ff6-7e7a-419e-ba64-7bb9db8bbcea' then
    raise exception 'not authorized';
  end if;

  with
  -- 계정: 체험(익명) 여부, 가입일(한국 날짜), 구글 연결 여부
  u as (
    select id,
           coalesce(is_anonymous, false) as guest,
           (created_at at time zone 'Asia/Seoul')::date as joined,
           coalesce(raw_app_meta_data -> 'providers' ? 'google', false) as google
    from auth.users
  ),
  -- 최근 31일 동안 기록을 만들거나 고친 흔적 (어느 기능인지 + 한국 날짜).
  -- 할 일·메모는 만든 날과 마지막으로 고친 날을 둘 다 셈 (고칠 때마다 updated_at이 덮어써져서
  -- 고친 날만 세면 예전 날의 사용자가 빠짐). 그 사이에 고친 날은 기록이 없어 세지 못함
  act as (
    select user_id, src, (ts at time zone 'Asia/Seoul')::date as day
    from (
      select user_id, 'todos' as src, created_at as ts from public.todos
      union all select user_id, 'todos', updated_at from public.todos
      union all select user_id, 'notes', created_at from public.notes
      union all select user_id, 'notes', updated_at from public.notes
      union all select user_id, 'schedules', created_at from public.schedules
      union all select user_id, 'timeblocks', created_at from public.timeblocks
      union all select user_id, 'ddays', created_at from public.ddays
      union all select user_id, 'goals', created_at from public.monthly_goals
    ) a
    where ts >= now() - interval '31 days'
  ),
  -- 최근 14일 (오늘 포함)
  days as (
    select today - 13 + i as day from generate_series(0, 13) i
  ),
  -- 지난주(8~14일 전)에 가입한 회원
  cohort as (
    select id from u where not guest and joined between today - 13 and today - 7
  )
  select json_build_object(
    'version',            2,
    -- 예전 키 (v1 화면용)
    'totalUsers',         (select count(*) from u),
    'newUsersToday',      (select count(*) from u where not guest and joined = today),
    'newUsersThisWeek',   (select count(*) from u where not guest and joined > today - 7),
    'activeUsers7d',      (select count(distinct user_id) from act where day > today - 7),
    'activeUsers30d',     (select count(distinct user_id) from act where day > today - 30),
    'totalTodos',         (select count(*) from public.todos),
    'completedTodos',     (select count(*) from public.todos where completed),
    'totalNotes',         (select count(*) from public.notes),
    'totalCategories',    (select count(*) from public.categories),
    -- 계정
    'registeredUsers',    (select count(*) from u where not guest),
    'guestUsers',         (select count(*) from u where guest),
    'googleUsers',        (select count(*) from u where not guest and google),
    'newUsers30d',        (select count(*) from u where not guest and joined > today - 30),
    'newGuestsToday',     (select count(*) from u where guest and joined = today),
    'newGuests7d',        (select count(*) from u where guest and joined > today - 7),
    -- 사용
    'activeUsersToday',   (select count(distinct user_id) from act where day = today),
    'cohortSize',         (select count(*) from cohort),
    'cohortRetained',     (select count(distinct a.user_id) from act a join cohort c on c.id = a.user_id where a.day > today - 7),
    'features',           (
      select json_build_object(
        'todos',      count(distinct user_id) filter (where src = 'todos'),
        'schedules',  count(distinct user_id) filter (where src = 'schedules'),
        'timeblocks', count(distinct user_id) filter (where src = 'timeblocks'),
        'notes',      count(distinct user_id) filter (where src = 'notes'),
        'ddays',      count(distinct user_id) filter (where src = 'ddays'),
        'goals',      count(distinct user_id) filter (where src = 'goals')
      ) from act where day > today - 30
    ),
    'daily',              (
      select json_agg(json_build_object(
        'day',     to_char(d.day, 'YYYY-MM-DD'),
        'signups', (select count(*) from u where not guest and joined = d.day),
        'guests',  (select count(*) from u where guest and joined = d.day),
        'active',  (select count(distinct user_id) from act where act.day = d.day)
      ) order by d.day) from days d
    ),
    -- 누적 기록
    'totalSchedules',     (select count(*) from public.schedules),
    'totalTimeblocks',    (select count(*) from public.timeblocks),
    'totalDdays',         (select count(*) from public.ddays),
    -- 기타
    'feedbackTotal',      (select count(*) from public.feedback),
    'feedback7d',         (select count(*) from public.feedback where created_at >= now() - interval '7 days'),
    'pushUsers',          (select count(distinct user_id) from public.push_subscriptions),
    'hiddenFeatures',     (
      select json_build_object(
        'timebox', count(*) filter (where 'timebox' = any(hidden_features)),
        'all',     count(*) filter (where 'all' = any(hidden_features)),
        'notes',   count(*) filter (where 'notes' = any(hidden_features))
      ) from public.user_settings
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_admin_stats() to authenticated;

notify pgrst, 'reload schema';
