-- 2026-10-11: has_task_access(x) ran once per ROW (a security-definer EXISTS with has_project_access
-- inside), so reading subtasks/comments/checklist/attachments/activity for one board scanned the
-- whole table calling it: 6.7 s for 4,119 subtasks, i.e. the board's subtasks call hit the 8 s
-- statement timeout on every board open. "x in (select id from public.tasks)" is planned as one
-- hashed subplan and gives the same rows (tasks_select = projects visible AND has_project_access,
-- a superset of what has_task_access checks): 0.29 s. Verified old = new row counts for the bot
-- user and an admin in a rolled-back transaction before applying.
-- Applied to production as migration 20261011132832_fast_task_access_policies.
alter policy subtasks_select on public.subtasks
  using (task_id in (select id from public.tasks));
alter policy checklist_select on public.task_checklist
  using (task_id in (select id from public.tasks));
alter policy comments_select on public.comments
  using (((entity_type = 'task') and entity_id in (select id from public.tasks))
      or ((entity_type = 'request') and has_request_access(entity_id)));
alter policy comments_soft_delete on public.comments
  using (((author_id = auth.uid()) or is_staff())
     and (((entity_type = 'task') and entity_id in (select id from public.tasks))
       or ((entity_type = 'request') and has_request_access(entity_id))));
alter policy att_select on public.attachments
  using (((entity_type = 'task') and entity_id in (select id from public.tasks))
      or ((entity_type = 'request') and has_request_access(entity_id))
      or ((entity_type = 'comment') and has_comment_access(entity_id)));
alter policy log_select on public.activity_log
  using ((company_id = my_company()) and (not is_external())
     and (((project_id is not null) and has_project_access(project_id))
       or ((entity_type = 'task') and entity_id in (select id from public.tasks))
       or ((entity_type = 'request') and has_request_access(entity_id))
       or ((entity_type not in ('task','request')) and is_staff())));
