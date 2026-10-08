-- public 스키마의 구조를 비교하기 쉬운 한 줄씩으로 출력 (check_schema.sh 에서 사용)
-- 함수 본문은 주석과 공백을 지운 뒤 비교
-- 예전 subtasks 테이블(운영 DB에만 남아 있음)은 비교에서 뺌 (not valid 표시는 check_schema.sh 에서 지움)
\pset format unaligned
\pset tuples_only on
select 'column ' || table_name || '.' || column_name || ' ' || data_type || ' null=' || is_nullable || ' default=' || coalesce(column_default, '-')
  from information_schema.columns
 where table_schema = 'public' and table_name <> 'subtasks'
union all
select 'constraint ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
  from pg_constraint
 where connamespace = 'public'::regnamespace and conrelid::regclass::text <> 'subtasks'
union all
select 'index ' || indexdef
  from pg_indexes
 where schemaname = 'public' and tablename <> 'subtasks'
union all
select 'policy ' || tablename || ' "' || policyname || '" ' || cmd || ' using=' || coalesce(qual, '-') || ' check=' || coalesce(with_check, '-')
  from pg_policies
 where schemaname = 'public' and tablename <> 'subtasks'
union all
select 'rls ' || relname || ' ' || relrowsecurity
  from pg_class
 where relnamespace = 'public'::regnamespace and relkind = 'r' and relname <> 'subtasks'
union all
select 'trigger ' || pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where not t.tgisinternal and (c.relnamespace = 'public'::regnamespace or c.oid = 'auth.users'::regclass)
union all
select 'function ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') definer=' || p.prosecdef
       || ' config=' || coalesce(array_to_string(p.proconfig, ','), '-') || ' body=' || md5(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', '', 'g'))
       || ' acl=' || coalesce(array_to_string(array(select unnest(p.proacl)::text order by 1), ','), '-')
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
union all
select 'realtime ' || tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime' and tablename <> 'subtasks'
order by 1;
