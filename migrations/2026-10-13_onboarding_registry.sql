-- 2026-10-13  BD → Onboarding registry + scheduler (Blueprint stages 1–2)
-- Source: Done_BD_Onboarding_Campaign_Blueprint (12 Oct 2026 discussion).
--
-- One brand master (public.brands, unchanged). Stores and service subscriptions are
-- separate rows. BD confirmation gates every service before Onboarding sees it.
-- Onboarding projects compose published service templates into one plan, back-schedule
-- it from the go-live date in WORKING days (sla_holidays + sla_settings.work_days), and
-- on approval create REAL tasks on the team boards, linked through onboarding_task_links
-- so a re-run only re-dates open tasks and never duplicates work.
--
-- Standalone: does not depend on the unapplied 2026-09-18 campaign migration.
-- Probe before applying (see bottom): run inside a transaction that raises at the end.

begin;

-- ───────────────────────── 1. Stores ─────────────────────────
create table if not exists public.brand_stores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  platform text not null,                  -- Shopee | Lazada | TikTok Shop | Brand.com | …
  platform_store_id text,                  -- the platform's own id; stable when the name changes
  launch_state text not null default 'planned' check (launch_state in ('planned','onboarding','live','closed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id, brand_id, platform, name)
);
create unique index if not exists brand_stores_platform_id_uq
  on public.brand_stores (company_id, platform, platform_store_id) where platform_store_id is not null;
create index if not exists brand_stores_brand_idx on public.brand_stores (brand_id);

-- ───────────────────────── 2. Service catalogue ─────────────────────────
create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  code text not null,                       -- RETAIL, LIVE, LIST, ART, CAMPAIGN-OPS …
  name text not null,
  category text,
  channels text[] not null default '{}',    -- eligible platforms; empty = any
  scope_level text not null default 'store' check (scope_level in ('brand','store')),
  team_id uuid references public.teams(id) on delete set null,   -- default owning team
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

-- A subscription = brand (+ store) × service. Adding a service adds a row, never a brand.
create table if not exists public.brand_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  store_id uuid references public.brand_stores(id) on delete cascade,    -- null = brand-level service
  service_type_id uuid not null references public.service_types(id),
  status text not null default 'proposed'
    check (status in ('proposed','confirmed','onboarding','live','paused','ended')),
  effective_from date,
  effective_to date,
  version int not null default 1,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists brand_services_live_uq
  on public.brand_services (company_id, brand_id, coalesce(store_id,'00000000-0000-0000-0000-000000000000'::uuid), service_type_id)
  where status in ('proposed','confirmed','onboarding','live','paused');
create index if not exists brand_services_brand_idx on public.brand_services (brand_id);

-- The commercial gate. No onboarding work without one of these on the subscription.
create table if not exists public.bd_confirmations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  brand_service_id uuid not null references public.brand_services(id) on delete cascade,
  kind text not null default 'new' check (kind in ('new','expansion','change')),
  agreed_go_live date,                      -- the commercial promise, kept separately from the plan
  evidence text,                            -- link / reference to the signed scope
  note text,
  confirmed_by uuid not null default auth.uid() references public.profiles(id),
  confirmed_at timestamptz not null default now()
);
create index if not exists bd_confirmations_bs_idx on public.bd_confirmations (brand_service_id);

-- ───────────────────────── 3. Templates ─────────────────────────
-- A published template version is immutable; running projects keep the version they used.
create table if not exists public.service_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  service_type_id uuid references public.service_types(id) on delete cascade,  -- null = base template for every service
  version int not null default 1,
  name text not null,
  status text not null default 'draft' check (status in ('draft','published','retired')),
  offset_unit text not null default 'working' check (offset_unit in ('working','calendar')),  -- how offset_wd counts: working days, or calendar days rolled back to a working day (the Excel WORKDAY(golive+n+1,-1) rule)
  source text,                              -- e.g. the checklist file this version was imported from
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id, service_type_id, version)
);
create unique index if not exists service_templates_base_uq
  on public.service_templates (company_id, version) where service_type_id is null;

create table if not exists public.template_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  template_id uuid not null references public.service_templates(id) on delete cascade,
  code text not null,                       -- TPL-LIST-01 … unique within the template
  title text not null,
  scope_level text not null default 'service' check (scope_level in ('brand','store','service')),
  duration_wd int not null default 1 check (duration_wd >= 1),
  offset_wd int,                            -- anchored: due = go-live minus N days (unit per template); NEGATIVE = after go-live (hypercare, first LIVE); null = sits before its successor
  phase text,                               -- checklist phase, e.g. '3. Shop & Tool Setup'
  responsibility text,                      -- Brand | CREA | Brand x CREA
  depends_on_code text,                     -- predecessor code in the same template (or a shared dedup key)
  dedup_key text,                           -- tasks sharing this key + scope merge into one task across templates
  team_id uuid references public.teams(id) on delete set null,
  board_project_id uuid references public.projects(id) on delete set null,   -- where the real task lands
  required_input text,
  evidence_rule text,
  gate boolean not null default false,      -- mandatory before go-live readiness
  input_wait boolean not null default false,-- "waiting on brand" type task
  position int not null default 0,
  unique (template_id, code)
);

-- ───────────────────────── 4. Onboarding projects ─────────────────────────
create table if not exists public.onboarding_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft','review','approved','in_progress','live','cancelled')),
  target_go_live date,                      -- BD's promise
  baseline_go_live date,                    -- approved operational date (change-controlled)
  feasibility text check (feasibility in ('feasible','at_risk','infeasible')),
  owner_id uuid references public.profiles(id),
  plan jsonb not null default '[]'::jsonb,  -- last computed schedule (for display + audit)
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists onboarding_projects_brand_idx on public.onboarding_projects (brand_id);

create table if not exists public.onboarding_project_services (
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  brand_service_id uuid not null references public.brand_services(id) on delete cascade,
  template_id uuid references public.service_templates(id),   -- the version this plan used
  primary key (project_id, brand_service_id)
);

-- One row per generated task: the idempotency key for re-runs.
create table if not exists public.onboarding_task_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  plan_key text not null,                   -- <template_task code or dedup_key>@<scope_key>
  template_task_id uuid references public.template_tasks(id) on delete set null,
  scope_key text not null,                  -- brand | store:<id> | service:<id>
  task_id uuid not null references public.tasks(id) on delete cascade,
  planned_start date,
  planned_due date,
  gate boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, plan_key)
);
create index if not exists onboarding_task_links_task_idx on public.onboarding_task_links (task_id);

create table if not exists public.go_live_changes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  old_date date,
  new_date date not null,
  reason text,
  impact text,                              -- Onboarding's operational impact review
  brand_agreed boolean not null default false,
  bd_confirmed_by uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid not null default auth.uid() references public.profiles(id),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- touch updated_at
create or replace function public.ob_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger brand_services_touch before update on public.brand_services for each row execute function public.ob_touch();
create trigger onboarding_projects_touch before update on public.onboarding_projects for each row execute function public.ob_touch();

-- The commercial gate, enforced in the database: a subscription cannot leave 'proposed'
-- without a BD confirmation row, and a project cannot be approved while any of its
-- services is still unconfirmed.
create or replace function public.ob_guard_service_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- only the commercial transitions need the gate; a proposed service may still be removed (ended)
  if old.status = 'proposed' and new.status in ('confirmed','onboarding','live')
     and not exists (select 1 from bd_confirmations c where c.brand_service_id = new.id) then
    raise exception 'BD confirmation required before this service can move past Proposed.';
  end if;
  return new;
end $$;
create trigger brand_services_gate before update of status on public.brand_services
  for each row execute function public.ob_guard_service_status();

-- ───────────────────────── 5. RLS ─────────────────────────
-- Staff read everything in their company. Writes: BD-side rows (stores, subscriptions,
-- confirmations) by staff; templates and catalogue by admin/management; projects by staff.
do $$
declare t text;
begin
  foreach t in array array['brand_stores','service_types','brand_services','bd_confirmations',
                           'service_templates','template_tasks','onboarding_projects',
                           'onboarding_task_links','go_live_changes']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_select on public.%I for select using (is_staff() and company_id = my_company())', t, t);
    if t in ('service_types','service_templates','template_tasks') then
      execute format('create policy %I_write on public.%I for all using (is_super() and company_id = my_company()) with check (is_super() and company_id = my_company())', t, t);
    else
      execute format('create policy %I_write on public.%I for all using (is_staff() and company_id = my_company()) with check (is_staff() and company_id = my_company())', t, t);
    end if;
  end loop;
end $$;
alter table public.onboarding_project_services enable row level security;
create policy ops_select on public.onboarding_project_services for select
  using (exists (select 1 from public.onboarding_projects p where p.id = project_id and p.company_id = my_company()) and is_staff());
create policy ops_write on public.onboarding_project_services for all
  using (exists (select 1 from public.onboarding_projects p where p.id = project_id and p.company_id = my_company()) and is_staff())
  with check (exists (select 1 from public.onboarding_projects p where p.id = project_id and p.company_id = my_company()) and is_staff());

-- ───────────────────────── 6. Generate / re-date tasks ─────────────────────────
-- Called with the plan the client computed (working-day backward schedule).
-- Each item: {key, template_task_id, scope_key, title, description, board_id, team_id,
--             assignee_id, start, due, gate, deps:[key…]}
-- Idempotent: a key already linked only has its dates refreshed, and only while the task
-- is still open (never touches done / in_progress). New keys insert. Dependencies are
-- added as task_deps rows (existing ones kept). Returns counts.
create or replace function public.ob_generate_tasks(p_project uuid, p_plan jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  it jsonb; k text; tid uuid; existing record;
  ins int := 0; upd int := 0; skipped int := 0; deps int := 0;
  pr onboarding_projects%rowtype;
  ids jsonb := '{}'::jsonb;   -- key -> task id
  d text; dep_id uuid; pos float := 0;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select * into pr from onboarding_projects where id = p_project and company_id = my_company();
  if pr.id is null then raise exception 'Project not found'; end if;
  if exists (select 1 from onboarding_project_services s join brand_services b on b.id = s.brand_service_id
             where s.project_id = p_project and b.status = 'proposed') then
    raise exception 'Every service in this project needs BD confirmation before tasks are generated.';
  end if;

  -- pass 1: tasks
  for it in select * from jsonb_array_elements(p_plan) loop
    k := it->>'key';
    if k is null or (it->>'board_id') is null then
      raise exception 'Plan item % has no board', coalesce(it->>'title', k);
    end if;
    if not has_project_access((it->>'board_id')::uuid) then
      raise exception 'No access to the board for “%”', it->>'title';
    end if;
    select l.*, t.status as task_status into existing
      from onboarding_task_links l join tasks t on t.id = l.task_id
     where l.project_id = p_project and l.plan_key = k;
    if existing.id is not null then
      if existing.task_status = 'todo' or existing.task_status = 'blocked' then
        update tasks set start_date = (it->>'start')::date, due_date = (it->>'due')::date,
               updated_at = now()
         where id = existing.task_id
           and (start_date is distinct from (it->>'start')::date or due_date is distinct from (it->>'due')::date);
        if found then upd := upd + 1; else skipped := skipped + 1; end if;
      else
        skipped := skipped + 1;
      end if;
      update onboarding_task_links set planned_start = (it->>'start')::date, planned_due = (it->>'due')::date
       where id = existing.id;
      tid := existing.task_id;
    else
      select coalesce(max(position),0) into pos from tasks where project_id = (it->>'board_id')::uuid;
      insert into tasks (project_id, title, description, status, priority, assignee_id,
                         start_date, due_date, created_by, position, tags, custom)
      values ((it->>'board_id')::uuid, it->>'title', coalesce(it->>'description',''), 'todo',   -- tasks.description is NOT NULL
              case when coalesce((it->>'gate')::boolean,false) then 'high' else 'normal' end,
              nullif(it->>'assignee_id','')::uuid,
              (it->>'start')::date, (it->>'due')::date, auth.uid(), pos + 1,
              array['onboarding', pr.name], jsonb_build_object('onboarding_project', p_project, 'scope', it->>'scope_key'))
      returning id into tid;
      insert into onboarding_task_links (project_id, plan_key, template_task_id, scope_key, task_id, planned_start, planned_due, gate)
      values (p_project, k, nullif(it->>'template_task_id','')::uuid, coalesce(it->>'scope_key','brand'), tid,
              (it->>'start')::date, (it->>'due')::date, coalesce((it->>'gate')::boolean,false));
      ins := ins + 1;
    end if;
    ids := ids || jsonb_build_object(k, tid::text);
  end loop;

  -- pass 2: dependencies (predecessor must be done before the successor may start)
  for it in select * from jsonb_array_elements(p_plan) loop
    k := it->>'key';
    tid := (ids->>k)::uuid;
    for d in select jsonb_array_elements_text(coalesce(it->'deps','[]'::jsonb)) loop
      dep_id := (ids->>d)::uuid;
      if dep_id is null or dep_id = tid then continue; end if;
      insert into task_deps (task_id, depends_on, created_by)
      values (tid, dep_id, auth.uid())
      on conflict do nothing;
      if found then deps := deps + 1; end if;
    end loop;
  end loop;

  update onboarding_projects set plan = p_plan,
         status = case when status in ('draft','review','approved') then 'in_progress' else status end
   where id = p_project;
  return jsonb_build_object('inserted', ins, 'redated', upd, 'unchanged', skipped, 'deps', deps);
end $$;
revoke all on function public.ob_generate_tasks(uuid, jsonb) from public;
grant execute on function public.ob_generate_tasks(uuid, jsonb) to authenticated;

-- Readiness: every gate task done → the project's services may go live.
create or replace function public.ob_readiness(p_project uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'gates', count(*) filter (where l.gate),
    'gates_done', count(*) filter (where l.gate and t.status = 'done'),
    'open', count(*) filter (where t.status <> 'done'),
    'blocked', count(*) filter (where t.status = 'blocked'),
    'overdue', count(*) filter (where t.status <> 'done' and t.due_date < current_date),
    'total', count(*))
  from onboarding_task_links l join tasks t on t.id = l.task_id
  where l.project_id = p_project and t.archived_at is null
    and exists (select 1 from onboarding_projects p where p.id = p_project and p.company_id = my_company())
    and is_staff();
$$;
grant execute on function public.ob_readiness(uuid) to authenticated;

-- Go-live: flips the project's services to live (gates must be done unless an exception note is given).
create or replace function public.ob_go_live(p_project uuid, p_exception text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  r := ob_readiness(p_project);
  if (r->>'gates')::int > (r->>'gates_done')::int and coalesce(p_exception,'') = '' then
    raise exception '% readiness gate(s) still open — finish them or record an authorised exception.',
      (r->>'gates')::int - (r->>'gates_done')::int;
  end if;
  update brand_services b set status = 'live', effective_from = coalesce(b.effective_from, current_date)
   where b.id in (select brand_service_id from onboarding_project_services where project_id = p_project)
     and b.status in ('confirmed','onboarding');
  update brand_stores s set launch_state = 'live'
   where s.id in (select store_id from brand_services b join onboarding_project_services o on o.brand_service_id = b.id
                  where o.project_id = p_project and b.store_id is not null);
  update onboarding_projects set status = 'live' where id = p_project;
  insert into activity_log (actor_id, entity_type, entity_id, action, detail)
  values (auth.uid(), 'onboarding_project', p_project, 'go_live',
          jsonb_build_object('readiness', r, 'exception', p_exception));
end $$;
grant execute on function public.ob_go_live(uuid, text) to authenticated;

-- ───────────────────────── 7. Seed catalogue + illustrative templates ─────────────────────────
-- Durations here are the Blueprint's ILLUSTRATIVE numbers — replace from the approved Excel
-- templates (decision D-01). Only seeded for companies that have no catalogue yet.
do $$
declare c record; st record; base uuid; tpl uuid;
        t_ops uuid; t_list uuid; t_art uuid; t_live uuid; t_onb uuid;
begin
  for c in select id from companies loop
    if exists (select 1 from service_types where company_id = c.id) then continue; end if;
    select id into t_ops  from teams where company_id = c.id and name ilike 'Store Operation%' limit 1;
    select id into t_list from teams where company_id = c.id and name ilike 'Store Operation%' limit 1;
    select id into t_art  from teams where company_id = c.id and name ilike 'Creative%' limit 1;
    select id into t_live from teams where company_id = c.id and name ilike 'Livestream%' limit 1;
    select id into t_onb  from teams where company_id = c.id and name ilike 'Onboarding%' limit 1;

    insert into service_types (company_id, code, name, category, channels, scope_level, team_id, position) values
      (c.id,'RETAIL','Retail store operation','Operations','{Shopee,Lazada,TikTok Shop}','store',t_ops,1),
      (c.id,'LISTING','Product listing','Operations','{Shopee,Lazada,TikTok Shop}','store',t_list,2),
      (c.id,'CREATIVE','Creative & artwork','Creative','{}','brand',t_art,3),
      (c.id,'LIVE','Livestreaming','Live commerce','{Shopee,Lazada,TikTok Shop}','store',t_live,4),
      (c.id,'CAMPAIGN','Campaign operations','Operations','{Shopee,Lazada,TikTok Shop}','store',t_ops,5);

    -- base template (every confirmed service)
    insert into service_templates (company_id, service_type_id, version, name, status, published_at)
      values (c.id, null, 1, 'Base — every confirmed service', 'published', now()) returning id into base;
    insert into template_tasks (company_id, template_id, code, title, scope_level, duration_wd, offset_wd, depends_on_code, dedup_key, team_id, required_input, evidence_rule, gate, position) values
      (c.id, base, 'BASE-01','Verify scope and stores','brand',1,null,null,'BASE-01',t_onb,'BD confirmation + service scope','Evidence of approved commercial scope',false,1),
      (c.id, base, 'BASE-02','Platform access readiness','store',2,7,'BASE-01','BASE-02',t_ops,'Platform credentials and authorisations','Access test successful',false,2),
      (c.id, base, 'QA-01','Go-live readiness / QA','brand',1,1,null,'QA-01',t_onb,'All mandatory tasks evidenced','Gate across mandatory services',true,9);

    for st in select id, code from service_types where company_id = c.id loop
      insert into service_templates (company_id, service_type_id, version, name, status, published_at)
        values (c.id, st.id, 1, st.code || ' v1 (illustrative)', 'published', now()) returning id into tpl;
      if st.code = 'RETAIL' then
        insert into template_tasks (company_id, template_id, code, title, scope_level, duration_wd, offset_wd, depends_on_code, dedup_key, team_id, required_input, evidence_rule, gate, position) values
          (c.id,tpl,'RETAIL-01','Retail operation setup','service',3,null,'BASE-02',null,t_ops,'Confirmed retail scope and operational prerequisites','Setup and QA evidenced',true,1),
          (c.id,tpl,'RETAIL-02','Team training','service',2,3,null,null,t_ops,'Training brief and assigned staff','Training completed',false,2);
      elsif st.code = 'LISTING' then
        insert into template_tasks (company_id, template_id, code, title, scope_level, duration_wd, offset_wd, depends_on_code, dedup_key, team_id, required_input, evidence_rule, gate, input_wait, position) values
          (c.id,tpl,'LIST-01','Product data accepted','service',2,null,null,null,t_list,'SKU list, attributes, item images, prices','Product data accepted, not merely submitted',false,true,1),
          (c.id,tpl,'LIST-02','Create product listings','service',5,null,'LIST-01',null,t_list,'Approved SKU data','Listings created + platform QA',true,false,2);
      elsif st.code = 'CREATIVE' then
        insert into template_tasks (company_id, template_id, code, title, scope_level, duration_wd, offset_wd, depends_on_code, dedup_key, team_id, required_input, evidence_rule, gate, input_wait, position) values
          (c.id,tpl,'ART-01','Brand assets accepted','brand',1,null,null,null,t_art,'Approved photos, logos, copy, guidelines','Asset pack verified as complete',false,true,1),
          (c.id,tpl,'ART-02','Artwork production','brand',4,null,'ART-01',null,t_art,'Approved creative brief and assets','Artwork delivered and approved',true,false,2);
      elsif st.code = 'LIVE' then
        insert into template_tasks (company_id, template_id, code, title, scope_level, duration_wd, offset_wd, depends_on_code, dedup_key, team_id, required_input, evidence_rule, gate, position) values
          (c.id,tpl,'LIVE-01','Livestream technical setup','service',3,null,'BASE-02',null,t_live,'Platform permissions, event brief','Platform setup completed',false,1),
          (c.id,tpl,'LIVE-02','Presenter / team training','service',2,3,null,null,t_live,'Training material / schedule','Training attendance and signoff',false,2),
          (c.id,tpl,'LIVE-03','Rehearsal / go-live check','service',1,null,'LIVE-01',null,t_live,'Approved script, access, approved creative','Rehearsal and QA approved',true,3);
      elsif st.code = 'CAMPAIGN' then
        insert into template_tasks (company_id, template_id, code, title, scope_level, duration_wd, offset_wd, depends_on_code, dedup_key, team_id, required_input, evidence_rule, gate, input_wait, position) values
          (c.id,tpl,'CAM-01','Promotion request readiness','service',2,null,null,null,t_ops,'Price master, promo mechanics, dates','Pricing/brief complete and approved',false,true,1),
          (c.id,tpl,'CAM-02','Promotion setup and verification','service',2,null,'CAM-01',null,t_ops,'Approved promotion inputs','Promotion setup and QA recorded',true,false,2);
      end if;
    end loop;
  end loop;
end $$;

commit;

-- ───────────────────────── PROBE (run separately, never commits) ─────────────────────────
-- begin;  … paste everything above without the begin/commit …
-- set local role authenticated; set local request.jwt.claims = '{"sub":"<april uuid>","role":"authenticated"}';
-- insert a brand_store / brand_service / bd_confirmation with literal ids, call ob_generate_tasks
-- with a two-item plan, assert the tasks + task_deps rows read back, then
-- raise exception 'PROBE_OK';
