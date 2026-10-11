-- 2026-10-11: whole-account bot keys (bot-api v5).
-- all_boards = true lets a key read and write every board its DONE user can see under RLS,
-- instead of the explicit project_ids / read_project_ids allowlist.
alter table public.bot_keys add column if not exists all_boards boolean not null default false;
comment on column public.bot_keys.all_boards is 'When true, project_ids/read_project_ids are ignored and the key may use every board visible to its bot user.';
