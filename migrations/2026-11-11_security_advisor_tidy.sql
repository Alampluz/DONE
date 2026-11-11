-- Supabase security advisor tidy (11 Nov 2026). No behaviour change for signed-in users.
-- 1. function_search_path_mutable: pin the search path of the 11 functions that had none.
-- 2. anon_security_definer_function_executable: SECURITY DEFINER functions were callable without signing
--    in (27 are trigger functions, which the API cannot call anyway; the rest check the caller or return
--    nothing useful to a stranger). Signed-in users and the service role keep EXECUTE explicitly, then
--    PUBLIC and anon lose it. ob_public_tracker stays public on purpose: it is the brand's share link,
--    keyed by an unguessable token.
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proconfig is null
              and p.proname in ('email_subject','email_html','email_esc','widget_sql_value','widget_sql_date','widget_sql_where',
                                'ca_resolve_value','tasks_sync_assignees','ob_touch','ob2_touch') loop
    execute format('alter function %s set search_path = public', f);
  end loop;
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
              and p.proname <> 'ob_public_tracker' loop
    execute format('grant execute on function %s to authenticated, service_role', f);
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
