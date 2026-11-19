-- Onboarding tracker: the timeline belongs to its owner (18 Nov 2026).
-- Owner of a tracker = its lead (onboardings.lead_id), whoever created it, an owner of its workspace, or
-- admin / management. Everyone else on staff still updates progress (status, done date, remark, team, PIC).
-- Only the owner may change the timeline: add / remove / reorder activities, edit their text, phase,
-- section, D- offset, unit or deadline, move the Shop Live date, rename the tracker, hand ownership on.
-- Enforced here, not only in the UI. Calls without a signed-in user (service role, SQL) pass.
create or replace function public.ob_can_customise(p_onboarding uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or is_super() or exists (
    select 1 from onboardings o
     where o.id = p_onboarding and o.company_id = my_company()
       and (o.lead_id = auth.uid() or o.created_by = auth.uid()
            or (o.workspace_id is not null and can_manage_ws(o.workspace_id))))
$$;

create or replace function public.ob_guard_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if (new.title, new.code, new.phase, new.service_name, new.service_type_id, new.crea_delivers, new.brand_provides,
        new.responsibility, new.offset_days, new.offset_unit, new.deadline, new.position, new.onboarding_id)
       is not distinct from
       (old.title, old.code, old.phase, old.service_name, old.service_type_id, old.crea_delivers, old.brand_provides,
        old.responsibility, old.offset_days, old.offset_unit, old.deadline, old.position, old.onboarding_id) then
      return new;                                   -- progress only: any staff
    end if;
    if not ob_can_customise(old.onboarding_id) then raise exception 'Only the owner of this tracker can change its timeline'; end if;
    return new;
  end if;
  if not ob_can_customise(case when tg_op = 'DELETE' then old.onboarding_id else new.onboarding_id end) then
    raise exception 'Only the owner of this tracker can change its timeline';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function public.ob_guard_onboarding()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.go_live, new.lead_id, new.name) is distinct from (old.go_live, old.lead_id, old.name)
     and not ob_can_customise(old.id) then
    raise exception 'Only the owner of this tracker can change its Shop Live date, name or owner';
  end if;
  return new;
end $$;

drop trigger if exists onboarding_activities_guard on public.onboarding_activities;
create trigger onboarding_activities_guard before insert or update or delete on public.onboarding_activities
  for each row execute function public.ob_guard_activity();
drop trigger if exists onboardings_guard on public.onboardings;
create trigger onboardings_guard before update on public.onboardings for each row execute function public.ob_guard_onboarding();

-- One call puts a tracker's activities in the given order (positions 1..n).
create or replace function public.ob_reorder(p_onboarding uuid, p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_staff() or not ob_can_customise(p_onboarding) then raise exception 'Only the owner of this tracker can change its timeline'; end if;
  update onboarding_activities a set position = x.ord
    from unnest(p_ids) with ordinality x(id, ord)
   where a.id = x.id and a.onboarding_id = p_onboarding and a.company_id = my_company() and a.position is distinct from x.ord;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.ob_can_customise(uuid), public.ob_reorder(uuid, uuid[]) from public, anon;
grant execute on function public.ob_can_customise(uuid), public.ob_reorder(uuid, uuid[]) to authenticated, service_role;
revoke all on function public.ob_guard_activity(), public.ob_guard_onboarding() from public, anon, authenticated;
