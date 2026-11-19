-- 10.10 Campaign Planning loaded into the live tracker for April (18 Nov 2026), from
-- Campaign_planing_10.10_AIM.xlsx, parsed with the app's own cptParseSheet:
--   1 campaign_trackers row, 89 campaign_tracker_steps, 161 campaign_tracker_lines (13,815 filled cells),
--   then cp_tracker_link_brands: 155 lines tied to the brand list (Isntree, John Henry and SMIB are not in
--   it), and the empty KAM / associate / category lead cells of the brand directory filled (68 brands).
-- The rows were inserted through the Supabase MCP with the data inlined; this file records what was done.
-- The same result comes from Campaigns → Tracker → Import tracker (.xlsx) with that file.
select 1;
