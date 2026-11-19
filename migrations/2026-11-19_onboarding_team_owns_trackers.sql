-- Onboarding trackers belong to the Onboarding team (19 Nov 2026, April). Applied to the live database.
-- The Onboarding team (teams.name = 'Onboarding') looks after every tracker: its members can change the
-- timeline, team and PIC, like the tracker's lead / creator / workspace owner / admin / management.
-- Everyone else who is invited (other staff) may only change an activity's status (with its done date)
-- and its remark.
create or replace function public.ob_can_customise(p_onboarding uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or is_super()
    or exists (select 1 from team_members m join teams t on t.id = m.team_id
                where m.user_id = auth.uid() and t.company_id = my_company() and lower(btrim(t.name)) = 'onboarding')
    or exists (
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
        new.responsibility, new.offset_days, new.offset_unit, new.deadline, new.position, new.onboarding_id,
        new.team_id, new.assignee_id)
       is not distinct from
       (old.title, old.code, old.phase, old.service_name, old.service_type_id, old.crea_delivers, old.brand_provides,
        old.responsibility, old.offset_days, old.offset_unit, old.deadline, old.position, old.onboarding_id,
        old.team_id, old.assignee_id) then
      return new;                                   -- status, done date, remark: anyone invited
    end if;
    if not ob_can_customise(old.onboarding_id) then
      raise exception 'Only the Onboarding team can change this; you can update the status and the remark';
    end if;
    return new;
  end if;
  if not ob_can_customise(case when tg_op = 'DELETE' then old.onboarding_id else new.onboarding_id end) then
    raise exception 'Only the Onboarding team can change this tracker''s timeline';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.ob_guard_activity() from public, anon, authenticated;
