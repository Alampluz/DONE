-- 2026-10-26  Form → board link fixes
-- 1. Three request types (Flash Sale, Flash Sale Price, Creative Artwork Requests) had field_map stored as
--    [{...}] instead of {...}. request_board_task() calls jsonb_each_text on it, which raises
--    "cannot call jsonb_each_text on a non-object" — so EVERY submission on those public forms failed.
-- 2. The trigger now tolerates an array-wrapped or non-object map instead of failing the whole insert.
-- 3. Backfill: requests that have a type linked to a board but never got a project_id/task (the Web Form
--    test on 22 Oct landed before the Create New Listing link was set) get linked and a task created.
-- 4. request_types.default_group_id: the group a form's tasks land in, like a monday form's target group
--    (monday's Flash Sale form lands in "Ticket request", not the board's first group). NULL = first group.

alter table request_types add column if not exists default_group_id uuid references project_groups(id) on delete set null;

update request_types set field_map = field_map->0
 where jsonb_typeof(field_map) = 'array' and jsonb_typeof(field_map->0) = 'object';
update request_types set field_map = '{}'::jsonb
 where field_map is null or jsonb_typeof(field_map) <> 'object';

create or replace function public.request_board_task()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare rt record; p record; g uuid; fm jsonb; cust jsonb := '{}'::jsonb; k text; v text; lines text; who uuid; due date; req_email text;
begin
  select * into rt from request_types where id = new.request_type_id;
  if rt.default_project_id is null then return new; end if;
  select * into p from projects where id = rt.default_project_id;
  if p.id is null then return new; end if;
  -- the form's chosen group when it belongs to this board, else the first group
  select id into g from project_groups where id = rt.default_group_id and project_id = p.id;
  if g is null then select id into g from project_groups where project_id = p.id order by position limit 1; end if;
  -- field_map may have been saved as [{...}] by an importer: unwrap; anything else counts as empty
  fm := case when jsonb_typeof(rt.field_map) = 'object' then rt.field_map
             when jsonb_typeof(rt.field_map) = 'array' and jsonb_typeof(rt.field_map->0) = 'object' then rt.field_map->0
             else '{}'::jsonb end;
  for k, v in select key, value from jsonb_each_text(fm) loop
    if left(k,1) <> '_' and coalesce(new.data->>k,'') <> '' then cust := cust || jsonb_build_object(v, new.data->>k); end if;
  end loop;
  req_email := coalesce(nullif(new.guest_email,''), (select email from profiles where id = new.submitted_by));
  if fm ? '_requester_email' and req_email is not null then cust := cust || jsonb_build_object(fm->>'_requester_email', req_email); end if;
  if fm ? '_status' then cust := cust || jsonb_build_object(fm->>'_status', 'Open'); end if;
  select string_agg(f->>'label' || ': ' || (new.data->>(f->>'key')), E'\n' order by ord) into lines
    from jsonb_array_elements(coalesce(rt.fields,'[]'::jsonb)) with ordinality as t(f, ord)
    where coalesce(new.data->>(f->>'key'),'') <> '' and f->>'type' <> 'textarea';
  who := coalesce(new.submitted_by, p.created_by);
  due := coalesce(nullif(new.data->>'due_date','')::date, new.sla_due_at::date);
  insert into tasks(project_id, company_id, title, description, status, priority, created_by, group_id, due_date, request_id, custom, tags)
  values (p.id, p.company_id, new.title,
          coalesce(new.data->>'details', new.data->>'description', '') || case when lines is not null then E'\n\n' || lines else '' end
            || case when new.guest_name is not null and new.guest_name <> '' then E'\n\nRequested by: ' || new.guest_name || ' <' || coalesce(new.guest_email,'') || '>' else '' end,
          'todo', coalesce(new.priority,'normal'), who, g, due, new.id, cust, array['request']);
  return new;
end $function$;

-- Backfill orphans: open requests whose type is linked to a board but that have no task yet.
do $$
declare r record; rt record; p record; g uuid; lines text; who uuid;
begin
  for r in select q.* from requests q join request_types t on t.id=q.request_type_id
           where t.default_project_id is not null and q.status in ('submitted','in_review','in_progress')
             and not exists (select 1 from tasks k where k.request_id=q.id) loop
    select * into rt from request_types where id=r.request_type_id;
    select * into p from projects where id=rt.default_project_id;
    select id into g from project_groups where project_id=p.id order by position limit 1;
    select string_agg(f->>'label' || ': ' || (r.data->>(f->>'key')), E'\n' order by ord) into lines
      from jsonb_array_elements(coalesce(rt.fields,'[]'::jsonb)) with ordinality as t(f, ord)
      where coalesce(r.data->>(f->>'key'),'') <> '' and f->>'type' <> 'textarea';
    who := coalesce(r.submitted_by, p.created_by);
    insert into tasks(project_id, company_id, title, description, status, priority, created_by, group_id, due_date, request_id, custom, tags)
    values (p.id, p.company_id, r.title,
            coalesce(r.data->>'details', r.data->>'description', '') || case when lines is not null then E'\n\n' || lines else '' end
              || case when r.guest_name is not null and r.guest_name <> '' then E'\n\nRequested by: ' || r.guest_name || ' <' || coalesce(r.guest_email,'') || '>' else '' end,
            'todo', coalesce(r.priority,'normal'), who, g, coalesce(nullif(r.data->>'due_date','')::date, r.sla_due_at::date), r.id, '{}'::jsonb, array['request']);
    update requests set project_id = p.id, status = case when status in ('submitted','in_review') then 'in_progress' else status end where id = r.id;
  end loop;
end $$;

-- Flash Sale forms land in "Ticket request", as the monday form does.
update request_types rt set default_group_id = g.id
  from project_groups g where g.project_id = rt.default_project_id and g.name = 'Ticket request'
  and rt.default_project_id = '5e012e95-4b19-41b7-b5f2-ec094e9ecaae' and rt.default_group_id is null;
