-- 2026-10-13  Real service templates from "Decathlon - Onboarding preparation.xlsx" (9 Oct 2026, Anchisa P.)
-- Two services on TikTok Shop: Store Operation (32 activities, phases 1–9) and Livestreaming (16, phases 1–5).
-- Offsets are the sheet's "Days vs Go-Live" — CALENDAR days rolled back to a working day
-- (the sheet's WORKDAY($golive+n+1,-1)); negative = after go-live. Durations default to 1 and
-- are April's to refine in Onboarding → Service catalogue.
-- Requires 2026-10-13_onboarding_registry.sql. Idempotent per company (skips if the type code exists).

begin;
do $$
declare c record; t_bd uuid; t_ob uuid; t_kam uuid; t_gfx uuid; t_tech uuid; t_cs uuid; t_mkt uuid; t_live uuid;
        st_ops uuid; st_live uuid; tpl uuid;
begin
  for c in select id from companies loop
    if exists (select 1 from service_types where company_id = c.id and code = 'STOREOPS_TT') then continue; end if;
    select id into t_bd   from teams where company_id=c.id and name ilike 'Business Dev%' limit 1;
    select id into t_ob   from teams where company_id=c.id and name ilike 'Onboarding%' limit 1;
    select id into t_kam  from teams where company_id=c.id and name ilike 'Commercial%' limit 1;
    select id into t_gfx  from teams where company_id=c.id and name ilike 'Creative%' limit 1;
    select id into t_tech from teams where company_id=c.id and name ilike 'Tech%' limit 1;
    select id into t_cs   from teams where company_id=c.id and name ilike 'Customer Service%' limit 1;
    select id into t_mkt  from teams where company_id=c.id and name ilike 'Marketing%' limit 1;
    select id into t_live from teams where company_id=c.id and name ilike 'Livestream%' limit 1;

    insert into service_types (company_id, code, name, category, channels, scope_level, team_id, position)
      values (c.id,'STOREOPS_TT','Store Operation — TikTok Shop','Operations','{TikTok Shop}','store',t_ob,10) returning id into st_ops;
    insert into service_types (company_id, code, name, category, channels, scope_level, team_id, position)
      values (c.id,'LIVE_TT','Livestreaming — TikTok LIVE','Live commerce','{TikTok Shop}','store',t_live,11) returning id into st_live;

    -- ── Store Operation | TikTok Shop ──
    insert into service_templates (company_id, service_type_id, version, name, status, offset_unit, source, published_at)
      values (c.id, st_ops, 1, 'Store Operation — TikTok Shop v1', 'published', 'calendar', 'Decathlon - Onboarding preparation.xlsx (9 Oct 2026)', now()) returning id into tpl;
    insert into template_tasks (company_id, template_id, code, title, phase, scope_level, duration_wd, offset_wd, team_id, responsibility, evidence_rule, required_input, gate, input_wait, position) values
      (c.id,tpl,'S1','Contract signing','1. Project Alignment & Kick-off','brand',1,70,t_bd,'Brand x CREA','Contract & scope of work (Store Operation + Livestreaming)','Signed contract, PO details',false,false,1),
      (c.id,tpl,'S2','Kick-off meeting','1. Project Alignment & Kick-off','brand',1,63,t_ob,'Brand x CREA','Onboarding timeline, roles & responsibilities, contact list, this tracker','Key contacts, business goals, target launch date',false,false,2),
      (c.id,tpl,'S3','SKU list with price structure','2. Brand Preparation','store',1,56,t_kam,'Brand','SKU master template; listing-readiness review','Full SKU list: barcode, RSP, size/colour, weight & dimensions, hero SKUs',false,true,3),
      (c.id,tpl,'S4','Basic Info & tool-access emails','2. Brand Preparation','brand',1,56,t_ob,'Brand','Basic Info template; follow-up on missing items','Completed Basic Info sheet; emails for CUSP & Cage access',false,true,4),
      (c.id,tpl,'S5','Image & brand assets','2. Brand Preparation','brand',1,49,t_ob,'Brand','Asset checklist and quality check (resolution, background)','Brand CI, logos, fonts, packshots, lifestyle images, videos',false,true,5),
      (c.id,tpl,'S6','TikTok Shop account setup & partner authorization','3. Shop & Tool Setup','store',1,49,t_ob,'Brand x CREA','Seller Center setup: shop settings, warehouse & return address, partner authorization','Account-owner approval / verification codes',false,false,6),
      (c.id,tpl,'S7','Data dashboard (CUSP)','3. Shop & Tool Setup','brand',1,42,t_ob,'CREA','CUSP dashboard with sales & traffic KPIs; user accounts','Names of users who need access',false,false,7),
      (c.id,tpl,'S8','Image drop portal (CUSP)','3. Shop & Tool Setup','brand',1,49,t_ob,'CREA','Folder structure & upload guide','Upload image assets',false,false,8),
      (c.id,tpl,'S9','Artwork approval portal (Cage)','3. Shop & Tool Setup','brand',1,49,t_ob,'CREA','Cage project setup & approver flow','Name the approvers',false,false,9),
      (c.id,tpl,'S10','API / OMS integration','4. Tech Setup','store',1,42,t_tech,'Brand x CREA','API connection between TikTok Shop and CREA','API credentials',false,false,10),
      (c.id,tpl,'S11','Product & stock sync','4. Tech Setup','store',1,35,t_tech,'Brand x CREA','SKU mapping and stock sync test','Confirm stock source & safety stock',false,false,11),
      (c.id,tpl,'S12','Order management sync','4. Tech Setup','store',1,35,t_tech,'Brand x CREA','Order, cancellation & return flow test','Confirm fulfilment SLA & courier',false,false,12),
      (c.id,tpl,'S13','End-to-end test order','4. Tech Setup','store',1,21,t_tech,'Brand x CREA','Test order placed, shipped & returned; issue log','Fulfil the test order',true,false,13),
      (c.id,tpl,'S14','Product listing creation','5. Listing & Content','store',1,28,t_ob,'CREA','SEO titles, attributes, descriptions, variations & pricing for every SKU','Approve product claims & descriptions',false,false,14),
      (c.id,tpl,'S15','Image production','5. Listing & Content','store',1,28,t_gfx,'CREA','Retouching, resizing to TikTok specs, main/secondary images, size charts','Feedback via Cage',false,false,15),
      (c.id,tpl,'S16','Listing QA & approval','5. Listing & Content','store',1,21,t_ob,'Brand x CREA','Listing QA checklist; submit for approval in Cage','Approve listings in Cage',true,false,16),
      (c.id,tpl,'S17','Shop decoration layout','6. Store Design','store',1,35,t_gfx,'Brand x CREA','Store layout draft + up to 2 revision rounds','Feedback & approval',false,false,17),
      (c.id,tpl,'S18','Promotional banner artwork','6. Store Design','store',1,28,t_gfx,'Brand x CREA','Homepage & campaign banner designs','Campaign messages & approval',false,false,18),
      (c.id,tpl,'S19','PDP & campaign frame artwork','6. Store Design','store',1,28,t_gfx,'Brand x CREA','PDP templates & campaign frames','Approval in Cage',false,false,19),
      (c.id,tpl,'S20','Store build','6. Store Design','store',1,14,t_ob,'CREA','Shop decoration built & published in Seller Center','-',true,false,20),
      (c.id,tpl,'S21','Product information & FAQ','7. Customer Service','brand',1,28,t_cs,'Brand x CREA','CS knowledge base & FAQ draft','Product brand book, FAQ, warranty & return policy',false,false,21),
      (c.id,tpl,'S22','Agent training','7. Customer Service','brand',1,14,t_cs,'Brand x CREA','Training session for chat agents + product quiz','Product expert for training session',false,false,22),
      (c.id,tpl,'S23','Chat setup','7. Customer Service','store',1,14,t_cs,'CREA','Auto-replies, quick replies, response-time SLA, escalation flow','Escalation contact',true,false,23),
      (c.id,tpl,'S24','Commercial plan','8. Commercial & Marketing Plan','brand',1,42,t_kam,'Brand x CREA','Sales targets, pricing & promotion calendar draft','Targets, margin guardrails, promo budget',false,false,24),
      (c.id,tpl,'S25','Commercial plan meeting','8. Commercial & Marketing Plan','brand',1,35,t_kam,'Brand x CREA','Meeting deck & sign-off','Sign-off',false,false,25),
      (c.id,tpl,'S26','Marketing plan (budget > simulation > daily media plan)','8. Commercial & Marketing Plan','brand',1,28,t_kam,'Brand x CREA','Budget simulation & daily media plan','Marketing budget & approval',false,false,26),
      (c.id,tpl,'S27','Marketing plan meeting','8. Commercial & Marketing Plan','brand',1,21,t_kam,'Brand x CREA','Meeting deck & sign-off','Sign-off',false,false,27),
      (c.id,tpl,'S28','TikTok Ads & Business Center access','8. Commercial & Marketing Plan','store',1,21,t_mkt,'Brand x CREA','Ads Manager / GMV Max setup, pixel & catalogue link','Grant Business Center access',false,false,28),
      (c.id,tpl,'S29','Affiliate & creator plan','8. Commercial & Marketing Plan','store',1,14,t_mkt,'Brand x CREA','Creator shortlist, commission plan, sample seeding plan','Samples & approval',false,false,29),
      (c.id,tpl,'S30','Pre-launch QA','9. Go-Live','store',1,3,t_ob,'Brand x CREA','Go-live checklist: listings, prices, stock, vouchers, CS, store design','Final approval',true,false,30),
      (c.id,tpl,'S31','Shop Live','9. Go-Live','store',1,0,t_ob,'Brand x CREA','Shop launched on TikTok','-',false,false,31),
      (c.id,tpl,'S32','Week-1 hypercare & review','9. Go-Live','store',1,-7,t_ob,'CREA','Daily monitoring, issue fixes, week-1 performance report','Attend review meeting',false,false,32);

    -- ── Livestreaming | TikTok LIVE ──
    insert into service_templates (company_id, service_type_id, version, name, status, offset_unit, source, published_at)
      values (c.id, st_live, 1, 'Livestreaming — TikTok LIVE v1', 'published', 'calendar', 'Decathlon - Onboarding preparation.xlsx (9 Oct 2026)', now()) returning id into tpl;
    insert into template_tasks (company_id, template_id, code, title, phase, scope_level, duration_wd, offset_wd, team_id, responsibility, evidence_rule, required_input, gate, input_wait, position) values
      (c.id,tpl,'L1','LIVE objectives, KPIs & schedule','1. LIVE Strategy & Plan','service',1,28,t_kam,'Brand x CREA','LIVE strategy, KPI targets (GMV, viewers, conversion) and slot schedule','Business goals, preferred time slots',false,false,1),
      (c.id,tpl,'L2','Hero SKU & LIVE offer selection','1. LIVE Strategy & Plan','service',1,21,t_kam,'Brand x CREA','LIVE product line-up & LIVE-exclusive deal proposal','Approve SKUs, prices & offers',false,false,2),
      (c.id,tpl,'L3','LIVE ads budget plan','1. LIVE Strategy & Plan','service',1,14,t_mkt,'Brand x CREA','LIVE GMV Max / ads plan per session','Approve budget',false,false,3),
      (c.id,tpl,'L4','LIVE access & permissions','2. Account & Access','service',1,21,t_live,'CREA','LIVE permission, host sub-accounts, LIVE Manager / LIVE Studio setup','Approve account access',false,false,4),
      (c.id,tpl,'L5','LIVE vouchers & product showcase','2. Account & Access','service',1,7,t_ob,'CREA','Vouchers, flash deals, showcase product links','Approve vouchers',false,false,5),
      (c.id,tpl,'L6','Studio set design','3. Studio & Production','service',1,21,t_gfx,'Brand x CREA','Background & set design in brand CI','Approve set design',false,false,6),
      (c.id,tpl,'L7','LIVE overlays & graphics','3. Studio & Production','service',1,14,t_gfx,'Brand x CREA','Overlays, price tags, countdowns, banners','Approve via Cage',false,false,7),
      (c.id,tpl,'L8','Product samples to studio','3. Studio & Production','service',1,10,t_live,'Brand','Sample receiving & storage log','Deliver samples & props',false,true,8),
      (c.id,tpl,'L9','Equipment & tech test','3. Studio & Production','service',1,7,t_live,'CREA','Camera, lighting, audio, internet & streaming software test','-',false,false,9),
      (c.id,tpl,'L10','Host casting','4. Host & Content','service',1,21,t_live,'Brand x CREA','Host shortlist matched to product categories','Select host',false,false,10),
      (c.id,tpl,'L11','Host product training','4. Host & Content','service',1,10,t_live,'Brand x CREA','Product knowledge training & brand do''s / don''ts','Product trainer / brand book',false,false,11),
      (c.id,tpl,'L12','LIVE script & run-of-show','4. Host & Content','service',1,7,t_live,'Brand x CREA','Script, segment flow, calls-to-action per session','Approve claims & script',false,false,12),
      (c.id,tpl,'L13','Pre-LIVE teaser content','4. Host & Content','service',1,3,t_live,'Brand x CREA','Short videos & posts announcing the LIVE','Approve content',false,false,13),
      (c.id,tpl,'L14','Rehearsal (dry run)','5. Rehearsal & First LIVE','service',1,3,t_live,'CREA','Full run-through on a test stream; issue log','Attend (optional)',true,false,14),
      (c.id,tpl,'L15','First LIVE session','5. Rehearsal & First LIVE','service',1,-3,t_live,'CREA','LIVE hosted & moderated (comments, pinned products)','-',false,false,15),
      (c.id,tpl,'L16','Post-LIVE report & optimization','5. Rehearsal & First LIVE','service',1,-4,t_live,'Brand x CREA','Report: GMV, viewers, avg watch time, CTR, conversion + next-session actions','Attend review meeting',false,false,16);
  end loop;
end $$;
commit;
