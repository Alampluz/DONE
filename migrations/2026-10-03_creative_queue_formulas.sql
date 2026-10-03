-- Applied on the DONE project (CREA WorkOS), Creative Queue only.
-- Not applied to any other Supabase project.
-- Monday board 5617471353 formula columns, plus the inputs those formulas read
-- that Creative Queue did not already have (Deadline, Priority status, PDP
-- Complexity, and the seven artwork-count columns). Key Visual Type, Request
-- Date, Brand and AW Total were already on the board.
-- Interpharma is not in Monday's brand-weight list, so its weight is 0.
-- Re-running inserts nothing when the label is already on this board.

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', 'Deadline', 'date', '[]'::jsonb, 14
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = 'Deadline'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', 'Priority status', 'select', '["P2 Medium","🔥 🔥 🔥","P3 Low","Normal","P1 High"]'::jsonb, 15
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = 'Priority status'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', 'PDP Complexity', 'select', '["White Background","Complicated SKU","Value Set"]'::jsonb, 16
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = 'PDP Complexity'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', '#SIS AW', 'number', '[]'::jsonb, 17
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = '#SIS AW'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', '#PDP AW', 'number', '[]'::jsonb, 18
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = '#PDP AW'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', '#Frame PDP AW', 'number', '[]'::jsonb, 19
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = '#Frame PDP AW'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', '#Visibility AW', 'number', '[]'::jsonb, 20
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = '#Visibility AW'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', '#Live Frame', 'number', '[]'::jsonb, 21
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = '#Live Frame'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', '#MKT AW', 'number', '[]'::jsonb, 22
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = '#MKT AW'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', '# non cats', 'number', '[]'::jsonb, 23
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = '# non cats'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', 'Request to Deadline', 'formula', '{"expr":"WORKDAYS({Deadline}, {Request Date})"}'::jsonb, 24
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = 'Request to Deadline'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', 'Priority (auto)', 'formula', '{"expr":"SWITCH({Priority status}, \"P2 Medium\", 1, \"🔥 🔥 🔥\", 3, \"P3 Low\", 1, \"Normal\", 1, \"P1 High\", 2, 0)"}'::jsonb, 25
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = 'Priority (auto)'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', 'KV Complexity Weight', 'formula', '{"expr":"IF({Key Visual Type}=\"Platform KV\", IF({#SIS AW}=\"\",0,{#SIS AW})*2, IF({Key Visual Type}=\"Brand Image KV\", IF({#SIS AW}=\"\",0,{#SIS AW})*2, IF({Key Visual Type}=\"Adapt from Brief\", IF({#SIS AW}=\"\",0,{#SIS AW})*2, IF({Key Visual Type}=\"New Create\", IF({#SIS AW}=\"\",0,{#SIS AW})*3, IF({Key Visual Type}=\"Regional Asset\", IF({#SIS AW}=\"\",0,{#SIS AW})*5, 0)))))"}'::jsonb, 26
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = 'KV Complexity Weight'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', 'PDP Complexity Weight', 'formula', '{"expr":"IF({PDP Complexity}=\"White Background\", IF({#PDP AW}=\"\",0,{#PDP AW})*0.5, IF({PDP Complexity}=\"Complicated SKU\", IF({#PDP AW}=\"\",0,{#PDP AW})*1, IF({PDP Complexity}=\"Value Set\", IF({#PDP AW}=\"\",0,{#PDP AW})*3, 0)))"}'::jsonb, 27
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = 'PDP Complexity Weight'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', 'Complexity Effort', 'formula', '{"expr":"{KV Complexity Weight} + {PDP Complexity Weight}"}'::jsonb, 28
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = 'Complexity Effort'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', '#AW Formula', 'formula', '{"expr":"SUM(IF({#SIS AW}=\"\",0,{#SIS AW}), IF({#PDP AW}=\"\",0,{#PDP AW}), IF({#Frame PDP AW}=\"\",0,{#Frame PDP AW}), IF({#Visibility AW}=\"\",0,{#Visibility AW}), IF({#Live Frame}=\"\",0,{#Live Frame}), IF({#MKT AW}=\"\",0,{#MKT AW}), IF({# non cats}=\"\",0,{# non cats}))"}'::jsonb, 29
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = '#AW Formula'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', 'Complexity weight by Brand ( Creativity, Revision)', 'formula', '{"expr":"SWITCH({Brand}, \"111Skin\", 3, \"Acne-Aid and Spectraban (iNova)\", 2, \"Aestura\", 3, \"Armani Exchange\", 2, \"Banila Co\", 3, \"Calvin Klein\", 3, \"Casio\", 1, \"Clarins\", 3, \"CREA\", 2, \"Crocs\", 2, \"Dyson\", 1, \"Enfagrow\", 1, \"Fila\", 2, \"Fit Flop\", 2, \"G2000\", 1, \"Goodone\", 1, \"Guess\", 1, \"Heydude\", 1, \"Hills'' Pet\", 2, \"Hush Puppies\", 1, \"JDE World Of Coffee\", 1, \"Jockey\", 1, \"Jungsaemmool (JSM)\", 3, \"Kiko Milano\", 3, \"Lee\", 1, \"Malin + Goetz (MG)\", 1, \"Mars\", 3, \"Mille\", 1, \"Mizumi\", 1, \"MLB\", 2, \"Nescafe Dolce Gusto (NDG)\", 3, \"Nestle\", 2, \"Paul Smith\", 1, \"Polo Ralph Lauren\", 1, \"Ponds\", 3, \"PVH Calvin Klein\", 2, \"PVH Tommy Hilfiger\", 2, \"RB Dettol & Hygiene\", 3, \"RB Durex\", 1, \"Sabina\", 1, \"Smart Travel\", 1, \"The North Face (TNF)\", 1, \"Three\", 3, \"Tommy Hilfiger\", 2, \"Unilever Beauty HotPro\", 3, \"Unilever Home Care\", 3, \"Unilever Profession Solutions\", 1, \"Wrangler\", 1, \"doicha\", 1, \"Oxe''secure\", 1, \"SOS\", 1, \"Snail White\", 1, \"Tinder\", 1, 0)"}'::jsonb, 30
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = 'Complexity weight by Brand ( Creativity, Revision)'
);

insert into public.project_fields (company_id, project_id, label, ftype, options, position)
select '60117c82-7fe1-4190-95b1-0e4a96f0305e', 'b8a268ab-0140-457a-8653-32c93dbe8c98', 'Report', 'formula', '{"expr":"{AW Total}"}'::jsonb, 31
where not exists (
  select 1 from public.project_fields
  where project_id = 'b8a268ab-0140-457a-8653-32c93dbe8c98' and label = 'Report'
);

