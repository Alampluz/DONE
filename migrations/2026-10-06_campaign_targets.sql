-- Campaign targets (slice 1). NOT applied to sknspnorwpoayymvndaz.
-- Apply by hand after review. Re-running is safe: create-or-replace, drop-if-exists,
-- add-column-if-not-exists.
--
-- A campaign is one record. Brand lines (brand × platform × country) are the rows
-- every later view filters. Daily numbers live on line_targets as named columns —
-- target_gmv, target_fb_spend, target_search_spend, target_ams_spend — never as
-- "column O". Approval state sits on each daily row and moves as a set per brand line:
-- draft → proposed → cat_approved → brand_aligned → locked.
--
-- Re-import of a date range deletes that range and inserts the new rows inside
-- replace_line_targets(), so a second paste cannot double-append.
--
-- comments.entity_type gains 'brand_line' for the outlier-reason comment.
-- approvals gains brand_line_id for the cat-lead step when a lead profile is known.
-- The state column on line_targets stays the source of truth: approvals.status is only
-- pending/approved/rejected, which cannot hold the five-step chain.

-- ---------------------------------------------------------------------------
-- Brand master
-- ---------------------------------------------------------------------------

alter table public.brands add column if not exists vertical text;
alter table public.brands add column if not exists country text;
alter table public.brands add column if not exists service_model text;

alter table public.brands drop constraint if exists brands_vertical_chk;
alter table public.brands add constraint brands_vertical_chk check (
  vertical is null or vertical = any (array[
    'Beauty',
    'Fashion – Mass',
    'Fashion – Premium',
    'FMCG',
    'Electronics',
    'PVH SG',
    'PVH MY'
  ])
);

create table if not exists public.brand_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  platform text not null,
  role text not null check (role = any (array['lead','kam','associate'])),
  user_id uuid references public.profiles(id) on delete set null,
  person_name text not null default '',
  created_at timestamptz not null default now(),
  unique (brand_id, platform, role)
);

create table if not exists public.brand_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  alias text not null,
  alias_norm text generated always as (lower(btrim(alias))) stored,
  source text not null default 'cusp',
  created_at timestamptz not null default now()
);

create unique index if not exists brand_aliases_company_norm
  on public.brand_aliases (company_id, alias_norm);

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status = any (array['draft','planning','briefed','exec','live','wrap','closed'])),
  playbook text not null default 'mega'
    check (playbook = any (array['mega','brandday','npd','payday'])),
  owner_id uuid references public.profiles(id) on delete set null,
  start_date date not null,
  end_date date not null,
  gmv_target numeric not null default 0 check (gmv_target >= 0),
  gmv_actual numeric not null default 0 check (gmv_actual >= 0),
  budget numeric not null default 0 check (budget >= 0),
  spent numeric not null default 0 check (spent >= 0),
  mechanics jsonb not null default '[]'::jsonb,
  countries text[] not null default array['TH']::text[],
  channels text[] not null default array[]::text[],
  baseline_campaign_id uuid references public.campaigns(id) on delete set null,
  baseline_mode text not null default 'target'
    check (baseline_mode = any (array['target','actual'])),
  locked_at timestamptz,
  locked_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists campaigns_company_start_idx
  on public.campaigns (company_id, start_date);

create table if not exists public.campaign_phases (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  kind text not null check (kind = any (array['teasing','d1','dday','rerun','after'])),
  label text not null,
  start_date date,
  end_date date,
  position integer not null default 0,
  unique (campaign_id, kind)
);

-- Free-text CUSP campaign_name values ("10.1", "10.10.", "AWO 1") map to a phase kind.
-- campaign_id null is a company-wide default; a campaign-specific row wins in the client.
create table if not exists public.campaign_phase_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  phase_kind text not null check (phase_kind = any (array['teasing','d1','dday','rerun','after'])),
  alias text not null,
  alias_norm text generated always as (lower(btrim(alias))) stored,
  created_at timestamptz not null default now()
);

create unique index if not exists campaign_phase_aliases_norm
  on public.campaign_phase_aliases (company_id, coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid), alias_norm);

create table if not exists public.brand_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete restrict,
  platform text not null check (platform = any (array['shopee','lazada','tiktok','shopify','brand','line'])),
  country text not null default 'TH',
  created_at timestamptz not null default now(),
  unique (campaign_id, brand_id, platform, country)
);

create index if not exists brand_lines_campaign_idx on public.brand_lines (campaign_id);
create index if not exists brand_lines_brand_idx on public.brand_lines (brand_id);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  kind text not null default 'daily_targets'
    check (kind = any (array['daily_targets','daily_actuals','hourly_gmv','hourly_visitors'])),
  source_file text not null default '',
  imported_by uuid references public.profiles(id) on delete set null,
  row_count integer not null default 0,
  rows_replaced integer not null default 0,
  rows_skipped integer not null default 0,
  data_as_of timestamptz not null default now(),
  scope_start date,
  scope_end date,
  created_at timestamptz not null default now()
);

create index if not exists imports_campaign_idx on public.imports (campaign_id, created_at desc);

create table if not exists public.line_targets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  brand_line_id uuid not null references public.brand_lines(id) on delete cascade,
  target_date date not null,
  phase_kind text check (phase_kind is null or phase_kind = any (array['teasing','d1','dday','rerun','after'])),
  target_gmv numeric check (target_gmv is null or target_gmv >= 0),
  target_visitors numeric check (target_visitors is null or target_visitors >= 0),
  target_buyers numeric check (target_buyers is null or target_buyers >= 0),
  target_orders numeric check (target_orders is null or target_orders >= 0),
  target_aov numeric check (target_aov is null or target_aov >= 0),
  target_cr numeric check (target_cr is null or target_cr >= 0),
  target_ads_spend numeric check (target_ads_spend is null or target_ads_spend >= 0),
  target_fb_spend numeric check (target_fb_spend is null or target_fb_spend >= 0),
  target_search_spend numeric check (target_search_spend is null or target_search_spend >= 0),
  target_ams_spend numeric check (target_ams_spend is null or target_ams_spend >= 0),
  budget_gmv numeric check (budget_gmv is null or budget_gmv >= 0),
  actual_gmv numeric check (actual_gmv is null or actual_gmv >= 0),
  approval_state text not null default 'draft'
    check (approval_state = any (array['draft','proposed','cat_approved','brand_aligned','locked'])),
  outlier_reason text not null default '',
  import_id uuid references public.imports(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (brand_line_id, target_date)
);

create index if not exists line_targets_line_idx on public.line_targets (brand_line_id, target_date);

-- ---------------------------------------------------------------------------
-- Company fill + updated_at (same helpers the rest of the schema uses)
-- ---------------------------------------------------------------------------

drop trigger if exists br_asg_fill_company on public.brand_assignments;
create trigger br_asg_fill_company before insert on public.brand_assignments
  for each row execute function public.fill_company();

drop trigger if exists br_alias_fill_company on public.brand_aliases;
create trigger br_alias_fill_company before insert on public.brand_aliases
  for each row execute function public.fill_company();

drop trigger if exists camp_fill_company on public.campaigns;
create trigger camp_fill_company before insert on public.campaigns
  for each row execute function public.fill_company();

drop trigger if exists camp_touch on public.campaigns;
create trigger camp_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();

drop trigger if exists cpa_fill_company on public.campaign_phase_aliases;
create trigger cpa_fill_company before insert on public.campaign_phase_aliases
  for each row execute function public.fill_company();

drop trigger if exists bl_fill_company on public.brand_lines;
create trigger bl_fill_company before insert on public.brand_lines
  for each row execute function public.fill_company();

drop trigger if exists imp_fill_company on public.imports;
create trigger imp_fill_company before insert on public.imports
  for each row execute function public.fill_company();

drop trigger if exists lt_fill_company on public.line_targets;
create trigger lt_fill_company before insert on public.line_targets
  for each row execute function public.fill_company();

drop trigger if exists lt_touch on public.line_targets;
create trigger lt_touch before update on public.line_targets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers (security definer, so policies do not recurse through RLS)
-- ---------------------------------------------------------------------------

create or replace function public.partner_sees_campaign(c uuid) returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.brand_lines bl
    where bl.campaign_id = c
      and public.brand_on_my_boards(bl.brand_id)
  )
$$;

create or replace function public.can_see_brand_line(line uuid) returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1
    from public.brand_lines bl
    join public.campaigns c on c.id = bl.campaign_id
    where bl.id = line
      and c.company_id = public.my_company()
      and (
        public.my_role() in ('admin','management','internal','requester')
        or public.brand_on_my_boards(bl.brand_id)
      )
  )
$$;

-- Lock/unlock is management-only. Everyone else can still edit an unlocked campaign.
create or replace function public.campaigns_guard() returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    if new.company_id is null then new.company_id := public.my_company(); end if;
    if new.company_id is distinct from public.my_company() then
      raise exception 'campaign is outside your company';
    end if;
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if new.locked_at is not null and not public.is_super() then
      raise exception 'only management can lock a campaign';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'company_id is fixed';
    end if;
    if new.locked_at is distinct from old.locked_at and not public.is_super() then
      raise exception 'only management can lock or unlock a campaign';
    end if;
    if new.locked_at is not null and old.locked_at is null then
      new.locked_by := auth.uid();
    end if;
    if new.locked_at is null then new.locked_by := null; end if;
  end if;
  return new;
end
$$;

drop trigger if exists campaigns_guard_trg on public.campaigns;
create trigger campaigns_guard_trg before insert or update on public.campaigns
  for each row execute function public.campaigns_guard();

-- Daily rows share one approval state per brand line. The client updates them together;
-- this trigger stops a partner from editing the numbers and stops a skip of the chain.
create or replace function public.line_targets_guard() returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  replacing boolean := current_setting('done.replacing_targets', true) = '1';
  brand uuid;
begin
  if replacing then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.approval_state = 'locked' and not public.is_super() then
      raise exception 'locked targets cannot be removed';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.approval_state is distinct from 'draft' and not public.is_super() then
      raise exception 'new targets start as draft';
    end if;
    return new;
  end if;

  if old.approval_state = 'locked' and not public.is_super() then
    raise exception 'locked targets can only be changed by management';
  end if;

  if public.is_external() and (
       new.target_gmv is distinct from old.target_gmv
    or new.target_visitors is distinct from old.target_visitors
    or new.target_buyers is distinct from old.target_buyers
    or new.target_orders is distinct from old.target_orders
    or new.target_aov is distinct from old.target_aov
    or new.target_cr is distinct from old.target_cr
    or new.target_ads_spend is distinct from old.target_ads_spend
    or new.target_fb_spend is distinct from old.target_fb_spend
    or new.target_search_spend is distinct from old.target_search_spend
    or new.target_ams_spend is distinct from old.target_ams_spend
    or new.budget_gmv is distinct from old.budget_gmv
    or new.actual_gmv is distinct from old.actual_gmv
  ) then
    raise exception 'partners can align a target, not edit the numbers';
  end if;

  if new.approval_state is distinct from old.approval_state then
    if not (
         (old.approval_state = 'draft'         and new.approval_state = 'proposed')
      or (old.approval_state = 'proposed'      and new.approval_state in ('draft','cat_approved'))
      or (old.approval_state = 'cat_approved'  and new.approval_state in ('proposed','brand_aligned'))
      or (old.approval_state = 'brand_aligned' and new.approval_state in ('cat_approved','locked'))
      or (old.approval_state = 'locked'        and new.approval_state = 'brand_aligned')
    ) then
      raise exception 'that approval step is not allowed from %', old.approval_state;
    end if;

    if new.approval_state = 'cat_approved' and not (
      public.is_super() or exists (
        select 1 from public.brand_lines bl
        join public.brand_assignments a
          on a.brand_id = bl.brand_id and a.platform = bl.platform and a.role = 'lead'
        where bl.id = new.brand_line_id and a.user_id = auth.uid()
      )
    ) then
      raise exception 'only a category lead or management can approve targets';
    end if;

    if new.approval_state = 'brand_aligned' and public.is_external() then
      select bl.brand_id into brand from public.brand_lines bl where bl.id = new.brand_line_id;
      if not public.brand_on_my_boards(brand) then
        raise exception 'this brand is not on a board you can access';
      end if;
    end if;

    if new.approval_state = 'locked' and not public.is_super() then
      raise exception 'only management can lock targets';
    end if;

    if new.approval_state in ('draft','proposed') and public.is_external() then
      raise exception 'partners cannot propose or reopen a target';
    end if;
  end if;

  if new.approval_state is distinct from 'draft'
     and old.approval_state is distinct from 'draft'
     and not public.is_super()
     and (
          new.target_gmv is distinct from old.target_gmv
       or new.target_visitors is distinct from old.target_visitors
       or new.target_buyers is distinct from old.target_buyers
       or new.target_orders is distinct from old.target_orders
       or new.target_aov is distinct from old.target_aov
       or new.target_cr is distinct from old.target_cr
       or new.target_ads_spend is distinct from old.target_ads_spend
       or new.target_fb_spend is distinct from old.target_fb_spend
       or new.target_search_spend is distinct from old.target_search_spend
       or new.target_ams_spend is distinct from old.target_ams_spend
       or new.budget_gmv is distinct from old.budget_gmv
     ) then
    raise exception 'send the line back to draft before changing the numbers';
  end if;

  return new;
end
$$;

drop trigger if exists line_targets_guard_trg on public.line_targets;
create trigger line_targets_guard_trg before insert or update or delete on public.line_targets
  for each row execute function public.line_targets_guard();

-- Same campaign, same date range: delete then insert. Never append a second copy.
create or replace function public.replace_line_targets(
  p_campaign uuid,
  p_rows jsonb,
  p_meta jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  camp public.campaigns%rowtype;
  meta jsonb := coalesce(p_meta, '{}'::jsonb);
  lo date;
  hi date;
  deleted_n integer := 0;
  inserted_n integer := 0;
  line_n integer := 0;
  imp_id uuid;
  rec jsonb;
  bid uuid;
  plat text;
  ctry text;
  line_id uuid;
  d date;
begin
  if not public.is_staff() then
    raise exception 'only staff can import targets';
  end if;

  select * into camp from public.campaigns where id = p_campaign;
  if camp.id is null or camp.company_id is distinct from public.my_company() then
    raise exception 'campaign not found';
  end if;
  if camp.locked_at is not null and not public.is_super() then
    raise exception 'this campaign is locked';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'nothing to import';
  end if;

  select min((r->>'target_date')::date), max((r->>'target_date')::date)
    into lo, hi
  from jsonb_array_elements(p_rows) r;

  if lo is null or hi is null then
    raise exception 'every row needs a date';
  end if;

  perform set_config('done.replacing_targets', '1', true);

  insert into public.imports (
    company_id, campaign_id, kind, source_file, imported_by,
    row_count, data_as_of, scope_start, scope_end
  ) values (
    camp.company_id, camp.id,
    coalesce(meta->>'kind', 'daily_targets'),
    left(coalesce(meta->>'source_file', ''), 300),
    auth.uid(),
    jsonb_array_length(p_rows),
    coalesce((meta->>'data_as_of')::timestamptz, now()),
    lo, hi
  ) returning id into imp_id;

  delete from public.line_targets lt
  using public.brand_lines bl
  where lt.brand_line_id = bl.id
    and bl.campaign_id = camp.id
    and lt.target_date between lo and hi;
  get diagnostics deleted_n = row_count;

  for rec in select value from jsonb_array_elements(p_rows) loop
    bid := (rec->>'brand_id')::uuid;
    plat := rec->>'platform';
    ctry := coalesce(nullif(rec->>'country', ''), 'TH');
    d := (rec->>'target_date')::date;
    if bid is null or plat is null or d is null then
      raise exception 'a row is missing brand, platform or date';
    end if;
    if not exists (
      select 1 from public.brands b
      where b.id = bid and b.company_id = camp.company_id
    ) then
      raise exception 'unknown brand on this company';
    end if;

    insert into public.brand_lines (company_id, campaign_id, brand_id, platform, country)
    values (camp.company_id, camp.id, bid, plat, ctry)
    on conflict (campaign_id, brand_id, platform, country) do nothing;

    select id into line_id from public.brand_lines
    where campaign_id = camp.id and brand_id = bid and platform = plat and country = ctry;

    insert into public.line_targets (
      company_id, brand_line_id, target_date, phase_kind,
      target_gmv, target_visitors, target_buyers, target_orders, target_aov, target_cr,
      target_ads_spend, target_fb_spend, target_search_spend, target_ams_spend,
      budget_gmv, actual_gmv, approval_state, import_id
    ) values (
      camp.company_id, line_id, d, nullif(rec->>'phase_kind', ''),
      nullif(rec->>'target_gmv', '')::numeric,
      nullif(rec->>'target_visitors', '')::numeric,
      nullif(rec->>'target_buyers', '')::numeric,
      nullif(rec->>'target_orders', '')::numeric,
      nullif(rec->>'target_aov', '')::numeric,
      nullif(rec->>'target_cr', '')::numeric,
      nullif(rec->>'target_ads_spend', '')::numeric,
      nullif(rec->>'target_fb_spend', '')::numeric,
      nullif(rec->>'target_search_spend', '')::numeric,
      nullif(rec->>'target_ams_spend', '')::numeric,
      nullif(rec->>'budget_gmv', '')::numeric,
      nullif(rec->>'actual_gmv', '')::numeric,
      'draft', imp_id
    );
    inserted_n := inserted_n + 1;
  end loop;

  select count(*) into line_n from public.brand_lines where campaign_id = camp.id;

  update public.imports
     set rows_replaced = deleted_n,
         rows_skipped = coalesce((meta->>'rows_skipped')::integer, 0)
   where id = imp_id;

  return jsonb_build_object(
    'import_id', imp_id,
    'inserted', inserted_n,
    'deleted', deleted_n,
    'lines', line_n,
    'scope_start', lo,
    'scope_end', hi
  );
end
$$;

revoke all on function public.replace_line_targets(uuid, jsonb, jsonb) from public;
grant execute on function public.replace_line_targets(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- comments + approvals: reuse, widened just enough for a brand line
-- ---------------------------------------------------------------------------

alter table public.comments drop constraint if exists comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type = any (array['task','request','brand_line']));

alter table public.approvals add column if not exists brand_line_id uuid
  references public.brand_lines(id) on delete cascade;

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (
  ((entity_type = 'task'::text) and public.has_task_access(entity_id))
  or ((entity_type = 'request'::text) and public.has_request_access(entity_id))
  or ((entity_type = 'brand_line'::text) and public.can_see_brand_line(entity_id))
);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert with check (
  (author_id = auth.uid()) and (
    ((entity_type = 'task'::text) and public.has_task_access(entity_id))
    or ((entity_type = 'request'::text) and public.has_request_access(entity_id))
    or ((entity_type = 'brand_line'::text) and public.can_see_brand_line(entity_id))
  )
);

drop policy if exists comments_soft_delete on public.comments;
create policy comments_soft_delete on public.comments for update using (
  ((author_id = auth.uid()) or public.is_staff()) and (
    ((entity_type = 'task'::text) and public.has_task_access(entity_id))
    or ((entity_type = 'request'::text) and public.has_request_access(entity_id))
    or ((entity_type = 'brand_line'::text) and public.can_see_brand_line(entity_id))
  )
) with check (author_id = author_id);

drop policy if exists appr_select on public.approvals;
create policy appr_select on public.approvals for select using (
  public.is_super()
  or (approver_id = auth.uid())
  or (requested_by = auth.uid())
  or ((request_id is not null) and public.has_request_access(request_id))
  or ((brand_line_id is not null) and public.can_see_brand_line(brand_line_id))
);

drop policy if exists appr_insert on public.approvals;
create policy appr_insert on public.approvals for insert with check (
  public.is_staff()
  and ((request_id is null) or public.has_request_access(request_id))
  and ((task_id is null) or public.has_task_access(task_id))
  and ((brand_line_id is null) or public.can_see_brand_line(brand_line_id))
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.brand_assignments enable row level security;
alter table public.brand_aliases enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_phases enable row level security;
alter table public.campaign_phase_aliases enable row level security;
alter table public.brand_lines enable row level security;
alter table public.imports enable row level security;
alter table public.line_targets enable row level security;

drop policy if exists brand_assignments_select on public.brand_assignments;
create policy brand_assignments_select on public.brand_assignments for select using (
  company_id = public.my_company()
  and (
    public.my_role() in ('admin','management','internal','requester')
    or public.brand_on_my_boards(brand_id)
  )
);

drop policy if exists brand_assignments_write on public.brand_assignments;
create policy brand_assignments_write on public.brand_assignments for all using (
  company_id = public.my_company() and public.is_staff()
) with check (
  (company_id is null or company_id = public.my_company()) and public.is_staff()
);

drop policy if exists brand_aliases_select on public.brand_aliases;
create policy brand_aliases_select on public.brand_aliases for select using (
  company_id = public.my_company()
  and (
    public.my_role() in ('admin','management','internal','requester')
    or public.brand_on_my_boards(brand_id)
  )
);

drop policy if exists brand_aliases_write on public.brand_aliases;
create policy brand_aliases_write on public.brand_aliases for all using (
  company_id = public.my_company() and public.is_staff()
) with check (
  (company_id is null or company_id = public.my_company()) and public.is_staff()
);

drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns for select using (
  company_id = public.my_company()
  and (
    public.my_role() in ('admin','management','internal','requester')
    or (public.is_external() and public.partner_sees_campaign(id))
  )
);

drop policy if exists campaigns_write on public.campaigns;
create policy campaigns_write on public.campaigns for all using (
  company_id = public.my_company() and public.is_staff()
) with check (
  (company_id is null or company_id = public.my_company()) and public.is_staff()
);

drop policy if exists campaign_phases_select on public.campaign_phases;
create policy campaign_phases_select on public.campaign_phases for select using (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_phases.campaign_id
      and c.company_id = public.my_company()
      and (
        public.my_role() in ('admin','management','internal','requester')
        or (public.is_external() and public.partner_sees_campaign(c.id))
      )
  )
);

drop policy if exists campaign_phases_write on public.campaign_phases;
create policy campaign_phases_write on public.campaign_phases for all using (
  public.is_staff() and exists (
    select 1 from public.campaigns c
    where c.id = campaign_phases.campaign_id and c.company_id = public.my_company()
  )
) with check (
  public.is_staff() and exists (
    select 1 from public.campaigns c
    where c.id = campaign_phases.campaign_id and c.company_id = public.my_company()
  )
);

drop policy if exists campaign_phase_aliases_select on public.campaign_phase_aliases;
create policy campaign_phase_aliases_select on public.campaign_phase_aliases for select using (
  company_id = public.my_company()
  and (
    public.my_role() in ('admin','management','internal','requester')
    or (campaign_id is not null and public.is_external() and public.partner_sees_campaign(campaign_id))
  )
);

drop policy if exists campaign_phase_aliases_write on public.campaign_phase_aliases;
create policy campaign_phase_aliases_write on public.campaign_phase_aliases for all using (
  company_id = public.my_company() and public.is_staff()
) with check (
  (company_id is null or company_id = public.my_company()) and public.is_staff()
);

drop policy if exists brand_lines_select on public.brand_lines;
create policy brand_lines_select on public.brand_lines for select using (
  public.can_see_brand_line(id)
);

drop policy if exists brand_lines_write on public.brand_lines;
create policy brand_lines_write on public.brand_lines for all using (
  public.is_staff() and company_id = public.my_company()
) with check (
  public.is_staff() and (company_id is null or company_id = public.my_company())
);

drop policy if exists imports_select on public.imports;
create policy imports_select on public.imports for select using (
  company_id = public.my_company()
  and (
    public.my_role() in ('admin','management','internal','requester')
    or (public.is_external() and public.partner_sees_campaign(campaign_id))
  )
);

drop policy if exists imports_write on public.imports;
create policy imports_write on public.imports for all using (
  company_id = public.my_company() and public.is_staff()
) with check (
  (company_id is null or company_id = public.my_company()) and public.is_staff()
);

drop policy if exists line_targets_select on public.line_targets;
create policy line_targets_select on public.line_targets for select using (
  public.can_see_brand_line(brand_line_id)
);

drop policy if exists line_targets_write on public.line_targets;
create policy line_targets_write on public.line_targets for all using (
  public.can_see_brand_line(brand_line_id)
  and (public.is_staff() or public.is_external())
) with check (
  public.can_see_brand_line(brand_line_id)
  and (public.is_staff() or public.is_external())
);

grant select, insert, update, delete on public.brand_assignments to anon, authenticated, service_role;
grant select, insert, update, delete on public.brand_aliases to anon, authenticated, service_role;
grant select, insert, update, delete on public.campaigns to anon, authenticated, service_role;
grant select, insert, update, delete on public.campaign_phases to anon, authenticated, service_role;
grant select, insert, update, delete on public.campaign_phase_aliases to anon, authenticated, service_role;
grant select, insert, update, delete on public.brand_lines to anon, authenticated, service_role;
grant select, insert, update, delete on public.imports to anon, authenticated, service_role;
grant select, insert, update, delete on public.line_targets to anon, authenticated, service_role;
