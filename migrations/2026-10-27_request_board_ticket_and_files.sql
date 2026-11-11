-- Applied 27 Oct 2026 as Supabase migration `request_board_ticket_and_files`.
--
-- Two faults April hit on a "Create New Listing" form submission (request WO-1013 → task CNL-261022-001):
--   1. The request kept its own WO-<n> number while the task created on the board got the board's
--      ticket number. The request now carries `board_ticket_no` = the task's ticket_no, and the UI
--      shows that in place of WO-<n> whenever it exists ("the ticket follows the workspace board").
--   2. The form uploads its attachments AFTER the request insert, i.e. after request_board_task has
--      already created the task, so the files only ever hung off the request. Files attached to a
--      request are now mirrored onto every task created from it (same storage object, a second
--      attachments row), both when the task is created and when a file arrives later.
--
-- Probe (rolled back): inserting a request with a default_project_id type → task created →
-- requests.board_ticket_no = task.ticket_no; inserting an attachment on the request → one task
-- attachment with the same storage_path; inserting it again → no duplicate. Backfill below fixed
-- WO-1013 (board_ticket_no CNL-261022-001, 1 file copied).

alter table public.requests add column if not exists board_ticket_no text;

-- 1) A task created from a request: write its number back, and copy the request's files.
create or replace function public.task_from_request_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.request_id is null then return new; end if;
  update public.requests r set board_ticket_no = new.ticket_no
   where r.id = new.request_id and new.ticket_no is not null
     and (r.board_ticket_no is null or r.board_ticket_no = '');
  insert into public.attachments(entity_type, entity_id, file_name, storage_path, size_bytes, uploaded_by)
  select 'task', new.id, a.file_name, a.storage_path, a.size_bytes, a.uploaded_by
    from public.attachments a
   where a.entity_type = 'request' and a.entity_id = new.request_id
     and not exists (select 1 from public.attachments b
                      where b.entity_type = 'task' and b.entity_id = new.id and b.storage_path = a.storage_path);
  return new;
end $$;

create or replace trigger task_from_request_link_trg
  after insert on public.tasks for each row execute function public.task_from_request_link();

-- 2) A file attached to a request after its task(s) exist: mirror it onto those tasks.
create or replace function public.request_file_to_tasks()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.entity_type <> 'request' then return new; end if;
  insert into public.attachments(entity_type, entity_id, file_name, storage_path, size_bytes, uploaded_by)
  select 'task', t.id, new.file_name, new.storage_path, new.size_bytes, new.uploaded_by
    from public.tasks t
   where t.request_id = new.entity_id
     and not exists (select 1 from public.attachments b
                      where b.entity_type = 'task' and b.entity_id = t.id and b.storage_path = new.storage_path);
  return new;
end $$;

create or replace trigger request_file_to_tasks_trg
  after insert on public.attachments for each row execute function public.request_file_to_tasks();

-- 3) Backfill: existing requests that already have a task, and their files.
update public.requests r set board_ticket_no = t.ticket_no
  from public.tasks t
 where t.request_id = r.id and t.ticket_no is not null and (r.board_ticket_no is null or r.board_ticket_no = '');

insert into public.attachments(entity_type, entity_id, file_name, storage_path, size_bytes, uploaded_by)
select 'task', t.id, a.file_name, a.storage_path, a.size_bytes, a.uploaded_by
  from public.attachments a
  join public.tasks t on t.request_id = a.entity_id
 where a.entity_type = 'request'
   and not exists (select 1 from public.attachments b
                    where b.entity_type = 'task' and b.entity_id = t.id and b.storage_path = a.storage_path);
