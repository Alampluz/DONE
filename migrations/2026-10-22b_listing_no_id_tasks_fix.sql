-- Listing Tracker: lt_no_id_tasks without false problems (22 Oct 2026, final review finding 5).
-- Skips archived boards, archived tickets, and tickets in any done-type status: the built-in
-- 'done', 'cancelled', and every key a board marks {done:true} in field_config.statuses
-- (the same rule as the client's isDoneK / doneKeys).
-- Applied with apply_migration name `listing_no_id_tasks_fix`.
create or replace function public.lt_no_id_tasks()
returns table(id uuid, ticket_no text, title text, due_date date, created_at timestamptz, project_id uuid)
language sql stable security definer set search_path = public as $$
  select t.id, t.ticket_no, t.title, t.due_date::date, t.created_at, t.project_id
    from tasks t
    join projects p on p.id = t.project_id
   where t.company_id = my_company()
     and p.company_id = my_company()
     and p.field_config->>'listing_tracker' = 'true'
     and coalesce(p.status,'') <> 'archived'
     and p.archived_at is null
     and t.archived_at is null
     and coalesce(t.status,'') not in ('done','cancelled')
     and not exists (
       select 1
         from jsonb_array_elements(case when jsonb_typeof(p.field_config->'statuses') = 'array'
                                        then p.field_config->'statuses' else '[]'::jsonb end) s
        where s->>'k' = t.status and lower(coalesce(s->>'done','')) = 'true')
     and (is_staff() or has_project_access(t.project_id))
     and not exists (select 1 from listing_campaigns lc where lc.task_id = t.id)
   order by coalesce(t.due_date::timestamptz, t.created_at), t.ticket_no
$$;

revoke execute on function public.lt_no_id_tasks() from public, anon;
grant execute on function public.lt_no_id_tasks() to authenticated, service_role;
