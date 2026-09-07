-- Applied 7 Sep 2026 (Supabase migration board_sharing).
-- Board sharing: a secret read-only public link per board, and "send this board to colleagues".
alter table projects
  add column if not exists share_token   text unique,
  add column if not exists share_enabled boolean not null default false,
  add column if not exists shared_at     timestamptz;
-- public_board(tok): SECURITY DEFINER, granted to anon + authenticated. Returns jsonb
--   {board{id,name,description,color,workspace,company,field_config}, groups[], fields[], tasks[], generated_at}
-- for a board whose share_enabled is true and share_token matches (token must be >= 20 chars), else null.
-- Deliberately excludes: emails, archived tasks, comments, attachments, mirror/link/file columns.
-- Tasks carry the assignee's display name only.
-- share_board_with(pid, uids[], note): notifies same-company active users about a board the caller
-- can access (has_project_access), one auto_notify each (which the email pipeline picks up); returns the count.
-- Full bodies are in the Supabase migration history.
