-- Campaign tracker ↔ the teams' ticket boards (19 Nov 2026).
-- cp_tracker_tickets(tracker): every ticket, on any board of the company, that could belong to this
-- campaign: its brand is one of the tracker's brands and its period touches D-day ± 3 days.
-- A board takes part when it has a Brand field and a start date; fields are found by type / label:
--   brand = type brand, or a field called "Brand"            platform  = "Platform" / "Platfrom"
--   kind  = "Request For" / "Artwork Type" / "Campaign Requests"
--   start = "Start Date" / "Live Date" / "Campaign Start Date"   end = "End Date" / "Campaign End Date"
--   team status = "Monday Status" / "Production Status" / "JOIN status"
-- Read-only; staff only; a private board the caller cannot open is left out (has_project_access).
create or replace function public.cp_tracker_tickets(p_tracker uuid)
returns table (task_id uuid, ticket_no text, title text, project_id uuid, board_key text, board_name text,
               brand text, platform text, kind text, status text, team_status text, start_date date, end_date date)
language sql stable security definer set search_path = public as $$
  with tr as (select id, company_id, dday from campaign_trackers where id = p_tracker and company_id = my_company() and is_staff()),
  names as (select distinct lower(btrim(b.name)) n from campaign_tracker_lines l join tr on tr.id = l.tracker_id join brands b on b.id = l.brand_id
            union select distinct lower(btrim(l.brand_name)) from campaign_tracker_lines l join tr on tr.id = l.tracker_id),
  bf0 as materialized (
    select p.id, p.key, p.name,
      (select f.id::text from project_fields f where f.project_id = p.id and (f.ftype = 'brand' or lower(btrim(f.label)) = 'brand') order by (f.ftype = 'brand') desc limit 1) f_brand,
      (select f.id::text from project_fields f where f.project_id = p.id and lower(btrim(f.label)) in ('platform','platfrom') limit 1) f_plat,
      (select f.id::text from project_fields f where f.project_id = p.id and lower(btrim(f.label)) in ('request for','artwork type','campaign requests') limit 1) f_kind,
      (select f.id::text from project_fields f where f.project_id = p.id and lower(btrim(f.label)) in ('start date','live date','campaign start date') limit 1) f_start,
      (select f.id::text from project_fields f where f.project_id = p.id and lower(btrim(f.label)) in ('end date','campaign end date') limit 1) f_end,
      (select f.id::text from project_fields f where f.project_id = p.id and lower(btrim(f.label)) in ('monday status','production status','join status') limit 1) f_ts
    from projects p join tr on tr.company_id = p.company_id where coalesce(p.status,'') <> 'archived'),
  -- access is decided once per board, not once per ticket
  bf as materialized (select * from bf0 where f_brand is not null and f_start is not null and has_project_access(id)),
  x as (
    select t.id, t.ticket_no, t.title, bf.id pid, bf.key, bf.name, t.status,
           t.custom->>bf.f_brand brand, t.custom->>bf.f_plat platform, t.custom->>bf.f_kind kind, t.custom->>bf.f_ts team_status,
           case when t.custom->>bf.f_start ~ '^\d{4}-\d{2}-\d{2}' then left(t.custom->>bf.f_start, 10)::date end sd,
           case when t.custom->>bf.f_end   ~ '^\d{4}-\d{2}-\d{2}' then left(t.custom->>bf.f_end, 10)::date end ed
      from bf join tasks t on t.project_id = bf.id
     where t.archived_at is null)
  select x.id, x.ticket_no, x.title, x.pid, x.key, x.name, x.brand, x.platform, x.kind, x.status, x.team_status, x.sd, coalesce(x.ed, x.sd)
    from x cross join tr
   where x.sd is not null and x.sd <= tr.dday + 3 and coalesce(x.ed, x.sd) >= tr.dday - 3
     and lower(btrim(x.brand)) in (select n from names)
   order by x.key, x.ticket_no
$$;
revoke all on function public.cp_tracker_tickets(uuid) from public, anon;
grant execute on function public.cp_tracker_tickets(uuid) to authenticated, service_role;
