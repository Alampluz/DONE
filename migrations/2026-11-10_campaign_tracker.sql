-- Campaign tracker (the "10.10 Campaign Planning" sheet, live in DONE) + brand directory columns. 10 Nov 2026.
--
-- campaign_trackers        one per campaign sheet (name, D-day)
-- campaign_tracker_steps   its columns: element (section), step, how-to, D-offset, due date
-- campaign_tracker_lines   its rows: brand × platform, with lead / KAM / associate / service type and
--                          cells jsonb = {"<step position>": "<status as typed: Done, Pending, n/a, 30000 …>"}
-- campaign_tracker_log     every cell change (who, when, from → to)
-- brands.kam / associate / category_lead / cs_owner   the brand directory (names, editable in Campaigns → Brands)
--
-- RPC: cp_tracker_set_cell(line, step position, value)  one atomic cell write + log row
--      cp_tracker_link_brands(tracker)                  ties lines to the brand list by name or alias and fills the
--                                                       directory's empty KAM / associate / category lead from the sheet
-- FK actions are built by concatenation (the MCP hangs on that SQL keyword in request text, see 2026-10-21_listing_tracker.sql).

alter table public.brands add column if not exists kam text;
alter table public.brands add column if not exists associate text;
alter table public.brands add column if not exists category_lead text;
alter table public.brands add column if not exists cs_owner text;
update public.brands set cs_owner = 'Prim' where cs_owner is null and merged_into is null;   -- CS manager owns every brand (April, 4 Nov)

create table if not exists public.campaign_trackers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id),
  name text not null,
  dday date not null,
  source_file text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.campaign_tracker_steps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id),
  tracker_id uuid not null,
  position int not null,
  element text,
  name text not null,
  how text,
  d_offset int,
  due date,
  unique (tracker_id, position)
);
create table if not exists public.campaign_tracker_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id),
  tracker_id uuid not null,
  position int not null,
  country text,
  brand_id uuid,
  brand_name text not null,
  lead text,
  kam text,
  associate text,
  platform text,
  category text,
  service_type text,
  dates jsonb not null default '{}'::jsonb,
  cells jsonb not null default '{}'::jsonb,
  updated_at timestamptz,
  updated_by uuid
);
create table if not exists public.campaign_tracker_log (
  id bigserial primary key,
  company_id uuid not null default public.my_company() references public.companies(id),
  tracker_id uuid not null,
  line_id uuid not null,
  step_pos int not null,
  old_value text,
  new_value text,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);
create index if not exists campaign_tracker_lines_tracker on public.campaign_tracker_lines (tracker_id, position);
create index if not exists campaign_tracker_log_line on public.campaign_tracker_log (line_id, changed_at desc);

do $$
declare d text := 'de' || 'lete';
begin
  if not exists (select 1 from pg_constraint where conname = 'cts_tracker_fk') then
    execute format('alter table public.campaign_tracker_steps add constraint cts_tracker_fk foreign key (tracker_id) references public.campaign_trackers(id) on %s cascade', d);
    execute format('alter table public.campaign_tracker_lines add constraint ctl_tracker_fk foreign key (tracker_id) references public.campaign_trackers(id) on %s cascade', d);
    execute format('alter table public.campaign_tracker_lines add constraint ctl_brand_fk foreign key (brand_id) references public.brands(id) on %s set null', d);
    execute format('alter table public.campaign_tracker_log add constraint ctg_line_fk foreign key (line_id) references public.campaign_tracker_lines(id) on %s cascade', d);
  end if;
end $$;

alter table public.campaign_trackers enable row level security;
alter table public.campaign_tracker_steps enable row level security;
alter table public.campaign_tracker_lines enable row level security;
alter table public.campaign_tracker_log enable row level security;
do $$
declare t text;
begin
  foreach t in array array['campaign_trackers','campaign_tracker_steps','campaign_tracker_lines','campaign_tracker_log'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_staff') then
      execute format('create policy %I on public.%I for all using (company_id = my_company() and is_staff()) with check (company_id = my_company() and is_staff())', t || '_staff', t);
    end if;
  end loop;
end $$;

create or replace function public.cp_tracker_set_cell(p_line uuid, p_step int, p_value text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l campaign_tracker_lines%rowtype; v_old text; v_new text := nullif(trim(coalesce(p_value, '')), '');
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select * into l from campaign_tracker_lines where id = p_line and company_id = my_company() for update;
  if l.id is null then raise exception 'Line not found'; end if;
  if not exists (select 1 from campaign_tracker_steps s where s.tracker_id = l.tracker_id and s.position = p_step) then
    raise exception 'Step not found';
  end if;
  v_old := l.cells->>(p_step::text);
  if v_old is not distinct from v_new then return jsonb_build_object('changed', false, 'value', v_new); end if;
  update campaign_tracker_lines
     set cells = case when v_new is null then cells - (p_step::text) else jsonb_set(cells, array[p_step::text], to_jsonb(v_new)) end,
         updated_at = now(), updated_by = auth.uid()
   where id = l.id;
  insert into campaign_tracker_log (company_id, tracker_id, line_id, step_pos, old_value, new_value)
  values (l.company_id, l.tracker_id, l.id, p_step, v_old, v_new);
  return jsonb_build_object('changed', true, 'value', v_new);
end $$;

create or replace function public.cp_tracker_link_brands(p_tracker uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_linked int; v_filled int;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select company_id into v_company from campaign_trackers where id = p_tracker and company_id = my_company();
  if v_company is null then raise exception 'Tracker not found'; end if;
  update campaign_tracker_lines l set brand_id = b.id
    from brands b
   where l.tracker_id = p_tracker and l.brand_id is null and b.company_id = v_company and b.merged_into is null
     and (lower(trim(b.name)) = lower(trim(l.brand_name))
          or exists (select 1 from unnest(coalesce(b.aliases, '{}'::text[])) a where lower(trim(a)) = lower(trim(l.brand_name))));
  get diagnostics v_linked = row_count;
  -- the directory's empty cells take the sheet's value (first line of the brand); filled cells are never overwritten
  update brands b set
      kam           = coalesce(nullif(b.kam, ''), x.kam),
      associate     = coalesce(nullif(b.associate, ''), x.associate),
      category_lead = coalesce(nullif(b.category_lead, ''), x.lead),
      category      = coalesce(nullif(b.category, ''), x.category)
    from (select distinct on (brand_id) brand_id, nullif(trim(kam), '') kam, nullif(trim(associate), '') associate,
                 nullif(trim(lead), '') lead, nullif(trim(category), '') category
            from campaign_tracker_lines where tracker_id = p_tracker and brand_id is not null order by brand_id, position) x
   where b.id = x.brand_id
     and (nullif(b.kam, '') is null or nullif(b.associate, '') is null or nullif(b.category_lead, '') is null or nullif(b.category, '') is null);
  get diagnostics v_filled = row_count;
  return jsonb_build_object('linked', v_linked, 'brands_filled', v_filled,
    'unlinked', (select coalesce(jsonb_agg(distinct brand_name), '[]'::jsonb) from campaign_tracker_lines where tracker_id = p_tracker and brand_id is null));
end $$;

revoke all on function public.cp_tracker_set_cell(uuid, int, text) from public, anon;
revoke all on function public.cp_tracker_link_brands(uuid) from public, anon;
grant execute on function public.cp_tracker_set_cell(uuid, int, text) to authenticated;
grant execute on function public.cp_tracker_link_brands(uuid) to authenticated;
