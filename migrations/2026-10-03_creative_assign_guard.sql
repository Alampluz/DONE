-- Applied as Supabase migrations `creative_assign_guard` and `creative_assign_guard_engine`.
-- Creative Queue assign rules already live in custom_automations (created 21 Sep 2026)
-- in this order: brand routes, then Brand + Artwork Type = Livestreaming Frame, then
-- "Creative route: Em ← Brand" (B2B Shopee). run_custom_task_autos walks that created_at
-- order and every match assigns, so a later rule with no brand filter replaces the
-- designer. The three July 2026 Monday workflows (board 5617471353, ids 7920993413,
-- 7920993415, 7920993465) are that shape: Livestreaming Frame, no brand, assign
-- Sorrakrai / Pongsathon / Alisa. They are not inserted here.
-- Interpharma (Monday brand label 486) is on Alisa's Monday livestream list and is
-- intentionally not added. No designer is named for it. It stays unassigned.
--
-- Guard: once a brand-filtered assign rule has matched in this pass, a later assign
-- rule whose conditions do not filter a brand column is skipped. Brand-filtered rules
-- are unchanged, so livestream overrides still replace the brand route, and Em ← B2B
-- Shopee still runs last.
--
-- Verify: select * from creative_route_winner('Nestle', 'Livestreaming Frame');
--         select * from creative_route_winner('Interpharma', 'Livestreaming Frame');
--         node tests/test_creativeroute.cjs

create or replace function public.ca_has_brand_filter(conds jsonb)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(conds, '[]'::jsonb)) as c(elem)
    join public.project_fields f
      on f.id::text = substr(c.elem->>'k', 7)
    where coalesce(c.elem->>'k', '') like 'field:%'
      and coalesce(c.elem->>'op', 'is') in ('is', 'in')
      and f.ftype = 'brand'
  );
$$;

create or replace function public.ca_rule_assigns(ca public.custom_automations)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select coalesce(ca.action_key, '') in ('assign_person', 'assign_creator')
      or exists (
        select 1
        from jsonb_array_elements(coalesce(ca.actions, '[]'::jsonb)) as a(elem)
        where a.elem->>'key' in ('assign_person', 'assign_creator')
      );
$$;

-- True when this rule must not replace an assignee a brand-filtered rule already set.
create or replace function public.ca_assign_blocked(brand_routed boolean, conds jsonb)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select coalesce(brand_routed, false) and not public.ca_has_brand_filter(conds);
$$;

create or replace function public.run_custom_task_autos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare ws uuid; co uuid; ca custom_automations; fires boolean; tc jsonb; fid text; oldv text; newv text;
        brand_routed boolean := false;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  select p.workspace_id, p.company_id into ws, co from projects p where p.id = new.project_id;
  if co is null then return null; end if;

  for ca in
    select * from custom_automations c
    where c.enabled and c.company_id = co
      and (c.project_id is null or c.project_id = new.project_id)
      and (c.workspace_id is null or c.workspace_id = ws)
    order by c.created_at
  loop
    tc := case when coalesce(ca.trigger_config,'{}'::jsonb) <> '{}'::jsonb then ca.trigger_config else coalesce(ca.condition,'{}'::jsonb) end;
    fires := false;
    if ca.trigger_key = 'task_created' then
      fires := (tg_op = 'INSERT');
    elsif ca.trigger_key = 'task_assigned' then
      fires := ((tg_op='INSERT' and new.assignee_id is not null)
             or (tg_op='UPDATE' and new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null))
             and (nullif(tc->>'user_id','') is null or (tc->>'user_id')::uuid = new.assignee_id);
    elsif ca.trigger_key = 'task_unassigned' then
      fires := tg_op='UPDATE' and old.assignee_id is not null and new.assignee_id is null;
    elsif ca.trigger_key = 'status_changed' then
      fires := tg_op='UPDATE' and new.status is distinct from old.status
               and (nullif(tc->>'to','')   is null or (tc->>'to')   = new.status)
               and (nullif(tc->>'from','') is null or (tc->>'from') = old.status);
    elsif ca.trigger_key = 'priority_changed' then
      fires := tg_op='UPDATE' and new.priority is distinct from old.priority
               and (nullif(tc->>'to','')   is null or (tc->>'to')   = new.priority)
               and (nullif(tc->>'from','') is null or (tc->>'from') = old.priority);
    elsif ca.trigger_key = 'moved_to_group' then
      fires := tg_op='UPDATE' and new.group_id is distinct from old.group_id and new.group_id is not null
               and (nullif(tc->>'group_id','') is null or (tc->>'group_id') = new.group_id::text);
    elsif ca.trigger_key = 'field_changed' then
      fid := tc->>'field_id';
      if fid is not null then
        newv := new.custom->>fid;
        oldv := case when tg_op='UPDATE' then old.custom->>fid else null end;
        fires := (newv is distinct from oldv) and newv is not null
                 and (nullif(tc->>'to','') is null or (tc->>'to') = newv);
      end if;
    elsif ca.trigger_key = 'due_date_changed' then
      fires := tg_op='UPDATE' and new.due_date is distinct from old.due_date and new.due_date is not null;
    end if;
    if fires and ca_conditions_met(ca.conditions, new) then
      -- No-brand assign (the July Livestreaming Frame workflows) loses to a brand route
      -- that already matched. Brand + Livestreaming Frame rules have a brand filter, so
      -- they still replace the brand route. Em ← B2B Shopee is brand-filtered and last.
      if ca_assign_blocked(brand_routed, ca.conditions) and ca_rule_assigns(ca) then
        insert into automation_runs (company_id, rule_key, entity_type, entity_id, workspace_id, status, detail)
        values (co, 'custom', 'task', new.id, ws, 'ok',
                jsonb_build_object('automation_id', ca.id, 'name', ca.name, 'action', 'assign_person',
                                   'steps', jsonb_build_array(jsonb_build_object(
                                     'action', 'assign_person', 'result', 'skipped',
                                     'reason', 'kept brand-specific assignee')),
                                   'task_title', new.title));
      else
        perform apply_custom_action(ca, new.id);
      end if;
      if ca_rule_assigns(ca) and ca_has_brand_filter(ca.conditions) then
        brand_routed := true;
      end if;
    end if;
  end loop;
  return null;
end $$;

-- Who the live Creative Queue rules would assign, ignoring which column just changed.
-- Brand-filtered rules only. Does not insert the no-brand Monday workflows.
create or replace function public.creative_route_winner(brand text, artwork text)
returns table(rule_name text, assignee text, user_id uuid)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  pid uuid;
  ca custom_automations;
  t tasks;
  brand_routed boolean := false;
  winner_name text;
  winner_user uuid;
  brand_field text := '7c907d0e-10c9-47d1-8d96-54859a761678';
  art_field text := '217a99a9-b454-4879-8420-9bcb11ed1535';
begin
  select p.id into pid from projects p where p.name = 'Creative Queue' order by p.created_at limit 1;
  if pid is null then return; end if;
  t.project_id := pid;
  t.status := 'todo';
  t.priority := 'normal';
  t.custom := jsonb_strip_nulls(jsonb_build_object(brand_field, brand, art_field, artwork));
  for ca in
    select * from custom_automations c
    where c.enabled and c.project_id = pid and c.name like 'Creative route:%'
    order by c.created_at
  loop
    if ca_conditions_met(ca.conditions, t) and ca_rule_assigns(ca) then
      if not ca_assign_blocked(brand_routed, ca.conditions) then
        winner_name := ca.name;
        winner_user := nullif(coalesce(ca.actions->0->'cfg'->>'user_id', ca.action_config->>'user_id'), '')::uuid;
      end if;
      if ca_has_brand_filter(ca.conditions) then
        brand_routed := true;
      end if;
    end if;
  end loop;
  return query
    select winner_name,
           (select pr.full_name from profiles pr where pr.id = winner_user),
           winner_user;
end $$;

revoke all on function public.ca_has_brand_filter(jsonb) from public, anon, authenticated;
revoke all on function public.ca_rule_assigns(public.custom_automations) from public, anon, authenticated;
revoke all on function public.ca_assign_blocked(boolean, jsonb) from public, anon, authenticated;
revoke all on function public.creative_route_winner(text, text) from public, anon, authenticated;
