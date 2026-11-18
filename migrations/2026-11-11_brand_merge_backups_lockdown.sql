-- The three backup tables made by 2026-11-03_brand_master.sql were created without row level security,
-- so the public API could read and change them (Supabase advisor: rls_disabled_in_public, 8 Nov 2026).
-- RLS on with no policy + no grants = reachable only by the database owner / service role, which is
-- all the undo script (2026-11-03_brand_master_undo.sql) needs. Applied 11 Nov 2026.
alter table public.brand_merge_backup_tasks enable row level security;
alter table public.brand_merge_backup_brands enable row level security;
alter table public.brand_merge_backup_autos enable row level security;
revoke all on public.brand_merge_backup_tasks, public.brand_merge_backup_brands, public.brand_merge_backup_autos from anon, authenticated, public;
