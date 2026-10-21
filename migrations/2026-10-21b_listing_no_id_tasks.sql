-- Listing Tracker: open tickets on listing boards that have no CUSP campaign logged yet (21 Oct 2026, Task 7 review).
-- Server-side so the client never sends hundreds of task ids in a URL, and so a failure surfaces as an rpc error.
-- Applied with apply_migration name `listing_no_id_tasks`.
create or replace function public.lt_no_id_tasks()
returns table(id uuid, ticket_no text, title text, due_date date, created_at timestamptz, project_id uuid)
language sql stable security definer set search_path = public as $$
  select t.id, t.ticket_no, t.title, t.due_date::date, t.created_at, t.project_id
    from tasks t
    join projects p on p.id = t.project_id
   where t.company_id = my_company()
     and p.company_id = my_company()
     and p.field_config->>'listing_tracker' = 'true'
     and t.status <> 'done'
     and t.archived_at is null
     and (is_staff() or has_project_access(t.project_id))
     and not exists (select 1 from listing_campaigns lc where lc.task_id = t.id)
   order by coalesce(t.due_date::timestamptz, t.created_at), t.ticket_no
$$;

revoke execute on function public.lt_no_id_tasks() from public, anon;
grant execute on function public.lt_no_id_tasks() to authenticated, service_role;
