-- Partner access is a board grant, never a workspace one.
-- Applied to sknspnorwpoayymvndaz on 11 Sep 2026. Re-running is safe.
--
-- Why: partner and freelancer accounts could be ticked into a workspace, and four
-- reads took the workspace arm without checking the role. Probed as the two real
-- partner-role accounts before the change: Prim V (an owner of the Customer Service
-- workspace) could list 2 boards and read 16 workspace dashboard widgets; Pae Anchisa
-- (3 workspaces) could read 12 widgets, the 3 workspaces and 4 workspace-owner rows.
-- has_project_access already refused externals the workspace arm, so no task ever
-- leaked -- but the board list, the workspace list, its owners and its dashboards did.
--
-- After this, an external account reaches exactly one thing: a board with
-- visibility = 'shareable' that it has a project_members row for. Board ownership is
-- untouched -- an external may still own a board someone hands them.
--
-- Nothing here changes admin / management / internal / requester. Re-probed as all
-- four afterwards: same workspaces, same boards, same widgets, same tasks.

-- 1 -- is some OTHER profile external? is_external() only answers for the caller.
create or replace function public.is_external_user(u uuid) returns boolean
 language sql stable security definer set search_path to 'public'
as $$ select coalesce((select p.role in ('partner','freelancer')
                       from public.profiles p where p.id = u), false) $$;

-- 2 -- the three workspace helpers stop answering yes for an external caller.
create or replace function public.is_ws_member(ws uuid) returns boolean
 language sql stable security definer set search_path to 'public'
as $$
  select not public.is_external()
     and exists (select 1 from public.workspace_members m
                 where m.workspace_id = ws and m.user_id = auth.uid())
$$;

create or replace function public.in_team(ws uuid) returns boolean
 language sql stable security definer set search_path to 'public'
as $$ select public.is_super() or public.is_ws_member(ws) $$;

-- A workspace owner manages every board under it, so an external must never be one.
create or replace function public.is_ws_owner(w uuid) returns boolean
 language sql stable security definer set search_path to 'public'
as $$
  select public.my_role() not in ('requester','partner','freelancer')
     and exists (select 1 from public.workspace_owners o
                 where o.workspace_id = w and o.user_id = auth.uid())
$$;

-- 3 -- two reads inlined the membership subquery instead of calling the helper, which
-- is how they missed the role check. Point them at is_ws_member so it can't happen again.
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces for select using (
  company_id = public.my_company() and (
    public.is_super()
    or public.is_ws_member(id)
    -- an external still sees the workspace a board they are on lives in
    or exists (select 1 from public.projects p
               join public.project_members pm on pm.project_id = p.id
               where p.workspace_id = workspaces.id and pm.user_id = auth.uid())
  ));

drop policy if exists dw_select on public.dashboard_widgets;
create policy dw_select on public.dashboard_widgets for select using (
  (workspace_id is null and project_id is null and user_id = auth.uid())
  or (workspace_id is not null and exists (
        select 1 from public.workspaces w
        where w.id = dashboard_widgets.workspace_id
          and w.company_id = public.my_company()
          and (public.is_super() or public.is_ws_member(w.id))))
  or (project_id is not null and public.has_project_access(project_id)));

-- 4 -- and the rows can no longer be written in the first place.
drop policy if exists wm_insert on public.workspace_members;
create policy wm_insert on public.workspace_members for insert
  with check (public.can_manage_ws(workspace_id) and not public.is_external_user(user_id));

drop policy if exists workspace_owners_insert on public.workspace_owners;
create policy workspace_owners_insert on public.workspace_owners for insert
  with check (public.can_manage_ws(workspace_id) and not public.is_external_user(user_id));

-- 5 -- the other direction: someone already in workspaces who is later made a partner
-- loses those rows on the spot, rather than keeping a grant the UI can no longer show.
create or replace function public.external_clears_workspaces() returns trigger
 language plpgsql security definer set search_path to 'public' as $$
begin
  if new.role in ('partner','freelancer')
     and coalesce(old.role,'') not in ('partner','freelancer') then
    delete from public.workspace_members where user_id = new.id;
    delete from public.workspace_owners where user_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists external_clears_workspaces on public.profiles;
create trigger external_clears_workspaces after update of role on public.profiles
  for each row execute function public.external_clears_workspaces();

-- 6 -- the two accounts this found. Both are @crea.asia staff carrying the partner role.
-- Prim V leads Customer Service and is an owner of that workspace: she is internal, and
-- keeps everything. Pae Anchisa stays a partner and gives up her three workspace rows --
-- she had no project_members row, so she was seeing workspace shells with no boards in them.
update public.profiles set role = 'internal'
 where id = 'b21fb8ba-0a3d-4678-b8ab-c169f8f00d3d' and role = 'partner';

delete from public.workspace_members
 where user_id = '3ec88c5e-a732-4018-b656-d1385d5c9acd';
