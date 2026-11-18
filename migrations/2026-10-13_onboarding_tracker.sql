-- 2026-10-13  Onboarding tracker v2 — "the Excel tracker, but live"
-- One tracker per brand (onboardings) holding its own activity rows (onboarding_activities),
-- copied from the service checklists (service_types / service_templates / template_tasks)
-- when the tracker is created. Activities live here, not on division boards.
-- Replaces the project/plan/approve flow of 2026-10-13_onboarding_registry.sql; those tables
-- stay in place (unused by the UI) until April decides to remove them.

create table if not exists public.onboardings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,                        -- "Decathlon — TikTok Shop"
  platform text,                             -- Shopee | Lazada | TikTok Shop | …
  go_live date,                              -- the Shop Live date every deadline hangs from
  status text not null default 'active' check (status in ('active','live','on_hold','cancelled')),
  lead_id uuid references public.profiles(id),
  share_token text unique,                   -- read-only brand link (#/t/<token>); null = not shared
  notes text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists onboardings_brand_idx on public.onboardings (brand_id);

create table if not exists public.onboarding_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id) on delete cascade,
  onboarding_id uuid not null references public.onboardings(id) on delete cascade,
  service_type_id uuid references public.service_types(id) on delete set null,
  service_name text not null,                -- section band: "Store Operation — TikTok Shop"
  code text,                                 -- S1, L4 …
  phase text,
  title text not null,
  crea_delivers text,
  brand_provides text,
  responsibility text,                       -- CREA | Brand | Brand x CREA
  team_id uuid references public.teams(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,   -- PIC; shows on their My Work
  offset_days int,                           -- days vs go-live (positive = before, negative = after); null = manual deadline
  offset_unit text not null default 'calendar' check (offset_unit in ('working','calendar')),
  deadline date,                             -- computed from go_live + offset by the app; manual when offset is null
  done_date date,
  status text not null default 'not_started' check (status in ('not_started','in_progress','waiting_brand','done','na')),
  remark text,
  position int not null default 0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
create index if not exists onboarding_activities_onb_idx on public.onboarding_activities (onboarding_id, position);
create index if not exists onboarding_activities_assignee_idx on public.onboarding_activities (assignee_id) where status not in ('done','na');

create or replace function public.ob2_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); if to_jsonb(new) ? 'updated_by' then new.updated_by = auth.uid(); end if; return new; end $$;
create trigger onboardings_touch before update on public.onboardings for each row execute function public.ob2_touch();
create trigger onboarding_activities_touch before update on public.onboarding_activities for each row execute function public.ob2_touch();

alter table public.onboardings enable row level security;
alter table public.onboarding_activities enable row level security;
create policy onboardings_select on public.onboardings for select using (is_staff() and company_id = my_company());
create policy onboardings_write  on public.onboardings for all using (is_staff() and company_id = my_company()) with check (is_staff() and company_id = my_company());
create policy onboarding_activities_select on public.onboarding_activities for select using (is_staff() and company_id = my_company());
create policy onboarding_activities_write  on public.onboarding_activities for all using (is_staff() and company_id = my_company()) with check (is_staff() and company_id = my_company());

-- Read-only brand view. Anonymous callers pass the share token; internal remarks, PICs and
-- team names are not returned. Returns null for an unknown or revoked token.
create or replace function public.ob_public_tracker(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when o.id is null then null else jsonb_build_object(
    'id', o.id, 'name', o.name, 'brand', b.name, 'platform', o.platform, 'go_live', o.go_live, 'status', o.status,
    'company', c.name,
    'activities', (select coalesce(jsonb_agg(jsonb_build_object(
        'service', a.service_name, 'code', a.code, 'phase', a.phase, 'title', a.title,
        'crea_delivers', a.crea_delivers, 'brand_provides', a.brand_provides, 'responsibility', a.responsibility,
        'deadline', a.deadline, 'done_date', a.done_date, 'status', a.status) order by a.position), '[]'::jsonb)
      from onboarding_activities a where a.onboarding_id = o.id))
  end
  from (select * from onboardings where share_token = p_token and length(p_token) >= 20 limit 1) o
  left join brands b on b.id = o.brand_id
  left join companies c on c.id = o.company_id;
$$;
revoke all on function public.ob_public_tracker(text) from public;
grant execute on function public.ob_public_tracker(text) to anon, authenticated;

-- A checklist row may name a default PIC; it is copied into new trackers next to the team.
alter table public.template_tasks add column if not exists default_assignee_id uuid references public.profiles(id) on delete set null;

-- Trackers live inside a workspace (the existing "Onboarding" workspace by default), listed on
-- its page next to the boards — there is no separate top-level menu item.
alter table public.onboardings add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

-- An onboarding can span several platforms (ticked in the New onboarding form).
alter table public.onboardings add column if not exists platforms text[] not null default '{}';
