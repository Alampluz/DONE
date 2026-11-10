-- Listing Tracker: match CUSP campaigns to tickets by ticket ID (10 Nov 2026).
-- 1. listing_sync_log keeps what a sync linked on its own (matched) and the CUSP campaigns it could not
--    put on any ticket (unmatched: [{id,name,seller,begin,end,state,why}], newest run wins in the UI).
-- 2. CUSP's end state is "finished" (also "finishing"), never "ended": map both to done.
-- 3. A "Monday ID" text field (same label as the other imported boards) on every listing board, so campaigns still named after the monday item
--    (13512634613 SHP …) find their DONE ticket during the changeover.
alter table public.listing_sync_log add column if not exists matched int;
alter table public.listing_sync_log add column if not exists unmatched jsonb;

alter table public.listing_campaigns alter column status set expression as (
  case cusp_state when 'approved' then 'set' when 'active' then 'live'
                  when 'ended' then 'done' when 'finished' then 'done' when 'finishing' then 'done'
                  else 'other' end);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select p.company_id, p.id, 'Monday ID', 'text', '[]'::jsonb,
       coalesce((select max(f.position) from public.project_fields f where f.project_id = p.id), 0) + 1
  from public.projects p
 where p.field_config->>'listing_tracker' = 'true'
   and not exists (select 1 from public.project_fields f where f.project_id = p.id and lower(trim(f.label)) = 'monday id');
