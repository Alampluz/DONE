-- Applied 7 Sep 2026 (Supabase migration projects_field_config).
-- Per-board labels/visibility for the four standard task fields (status, priority, assignee, due_date).
-- Shape: {"due_date":{"label":"Live date"},"priority":{"hidden":true}}. Missing key = default label, shown.
-- Status can be relabelled but never hidden. Read via coreLabel(pid,k) / coreHidden(pid,k) in part2.
alter table projects add column if not exists field_config jsonb not null default '{}'::jsonb;
