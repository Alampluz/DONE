-- Partner access narrowing — applied to sknspnorwpoayymvndaz on 10 Sep 2026.
-- Kept here as the record; both migrations are already applied. Re-running is safe
-- (every statement is create-or-replace / drop-if-exists / add-column-if-not-exists).
--
-- Why: an audit of what a partner account can actually reach found four company-wide reads
-- (the whole 143-brand roster, the whole staff directory with email addresses, the team
-- structure, and mail settings) and found that a partner added to a board could edit every
-- task on it. Board and task scoping itself was already correct, as were the write fences
-- on deleting tasks, renaming boards, columns, other people's comments, automations, and
-- self-promotion to admin (a trigger blocks that).
--
-- Nothing here changes what admin / management / internal / requester can do. That was
-- re-probed as all four real users afterwards: same boards, same tasks, same brands, same
-- directory, same activity, still able to edit tasks that are not their own.

-- ============ migration 1: partner_access_narrowing ============

create or replace function public.is_external() returns boolean
 language sql stable security definer set search_path to 'public'
as $$ select public.my_role() in ('partner','freelancer') $$;

-- People an external user shares a board with: the other members, and the board's owners
-- (the person they would actually talk to). SECURITY DEFINER so it can see membership rows
-- that project_members' own policy hides from them.
create or replace function public.shares_my_board(u uuid) returns boolean
 language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.project_members a
    where a.user_id = auth.uid()
      and ( exists (select 1 from public.project_members b
                    where b.project_id = a.project_id and b.user_id = u)
         or exists (select 1 from public.project_owners o
                    where o.project_id = a.project_id and o.user_id = u) )
  )
$$;

-- Brands that appear on a board the external user is a member of, through any brand-type
-- column. Staff short-circuit in the policy before this ever runs.
create or replace function public.brand_on_my_boards(b uuid) returns boolean
 language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.tasks t on t.project_id = pm.project_id
    join public.project_fields f on f.project_id = t.project_id and f.ftype = 'brand'
    where pm.user_id = auth.uid()
      and (t.custom ->> f.id::text) = b::text
  )
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or public.is_platform()
  or ( company_id = public.my_company()
       and ( (public.my_role() <> 'none' and not public.is_external())
             or public.shares_my_board(id) ) )
);

drop policy if exists brands_select on public.brands;
create policy brands_select on public.brands for select using (
  company_id = public.my_company()
  and ( public.my_role() in ('admin','management','internal','requester')
        or public.brand_on_my_boards(id) )
);

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select using (
  company_id = public.my_company() and not public.is_external()
);

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members for select using (
  not public.is_external()
  and exists (select 1 from public.teams t
              where t.id = team_members.team_id and t.company_id = public.my_company())
);

drop policy if exists mail_settings_select on public.mail_settings;
create policy mail_settings_select on public.mail_settings for select using (
  company_id = public.my_company() and not public.is_external()
);

-- The board's change history is internal.
drop policy if exists log_select on public.activity_log;
create policy log_select on public.activity_log for select using (
  company_id = public.my_company()
  and not public.is_external()
  and ( (project_id is not null and public.has_project_access(project_id))
     or (entity_type = 'task' and public.has_task_access(entity_id))
     or (entity_type = 'request' and public.has_request_access(entity_id))
     or (entity_type <> all (array['task','request']) and public.is_staff()) )
);

-- ============ migration 2: partner_edit_scope_per_board ============
-- What partners may edit is set per board, separately from edit_preset, which stays the rule
-- for internal staff. 'assigned' is the default: a partner may change only the tasks assigned
-- to them or that they raised. Set from Board members (partner access).

alter table public.projects
  add column if not exists partner_edit text not null default 'assigned';

alter table public.projects drop constraint if exists projects_partner_edit_chk;
alter table public.projects add constraint projects_partner_edit_chk
  check (partner_edit in ('everything','assigned','view'));

create or replace function public.partner_preset(p uuid) returns text
 language sql stable security definer set search_path to 'public'
as $$ select coalesce((select partner_edit from public.projects where id = p), 'assigned') $$;

create or replace function public.can_edit_task(p uuid, assignee uuid, creator uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.has_project_access(p) and not public.is_requester() and (
    case when public.is_external() then
      case public.partner_preset(p)
        when 'everything' then true
        when 'assigned'   then (assignee = auth.uid() or creator = auth.uid())
        else false end
    else
      public.is_admin() or public.my_role() = 'management' or public.can_manage_board(p)
      or case public.board_preset(p)
           when 'everything' then true
           when 'assigned'   then (assignee = auth.uid() or creator = auth.uid())
           else false end
    end)
$$;

create or replace function public.can_write_board(p uuid) returns boolean
 language sql stable security definer set search_path to 'public'
as $$
  select public.has_project_access(p) and not public.is_requester() and (
    case when public.is_external() then public.partner_preset(p) <> 'view'
    else
      public.is_admin() or public.my_role() = 'management' or public.can_manage_board(p)
      or public.board_preset(p) <> 'view'
    end)
$$;

-- Still open, deliberately not in this migration: internal-only columns. Hiding a column's
-- values from partners cannot be done with RLS, because the values live inside tasks.custom
-- and Postgres has no column-level row security. It needs the internal fields' values moved
-- to their own table with its own policy, which touches every field read and write.
