# Listing Tracker (Frame / PDP campaigns) — design spec

Date: 21 Oct 2026 · Owner: April · Module of DONE (Product Listing workspace)
Mockup approved as direction: "Listing Tracker in DONE" artifact, version 3 (month-report style).

## 1. Why

The Product Listing team logs every Frame / PDP campaign they set in CUSP into the Excel
"Listing Tracker Updated 2026" (SharePoint). It exists to make sure campaigns for the same
brand do not overlap on the same SKUs, and to give a monthly overview of what ran, by brand,
with the ticket and the PIC. Today ~4,000 rows a year are typed by hand; overlap is found by
eye on a per-month sheet; status (Set / Live / Done) is typed, so it drifts from reality.

DONE already has the ticket half: the `Request: Campaign Frames` board
(`ec8f2549-16db-4fee-b21d-f10930a18b52`) and the `Campaign Frames` request type
(brand, platform multiselect, country, campaign level, start, end). CUSP already has the
campaign half: `catalog_campaign` (id, name, begin, end, state, seller) and
`catalog_assetgroup` (campaign_id → shop_listing_id, i.e. the SKUs it frames).
The tracker is the piece that joins them and reports on them.

## 2. Goals and non-goals

Goals
- The PIC logs a setup by pasting the CUSP campaign ID (or link) on the ticket. Nothing else is typed.
- DONE flags when two campaigns on the same CUSP seller share at least one SKU in overlapping hours. It warns; it never blocks (campaigns are sometimes chained on purpose).
- A month report any manager can read without training: a paragraph, six numbers, one card per brand with a 31-day strip per platform, who set what, and a dated activity log.
- Status comes from CUSP (approved = Set, active = Live, ended = Done), refreshed nightly and on demand.
- Excel export in the exact layout of the old "10.10 2026" sheet, so nobody loses the familiar file.
- Replace the Excel tracker fully, with this year's history imported.

Non-goals
- Creating or editing campaigns in CUSP. CUSP stays the system of record for the campaign itself; DONE only reads.
- Replacing the Creative or Store Ops tickets a campaign depends on (they stay linked work).
- Any change to the generic task / board engine.

## 3. Decisions taken (April) and defaults taken by Claude

Decided by April (21 Oct)
- Overlap means the same SKU, not merely the same brand and type. Several Frames or PDPs may run at once if they cover different SKUs.
- Month overview in both forms: a timeline-style view and the Excel-style slot grid (the latter is now the Excel export; the report page uses per-brand strips, which April preferred over a dense grid).
- Auto-fill from CUSP by campaign ID.
- Report-tracking look: plain language first, numbers second, controls last.

Defaults taken by Claude — please confirm or change in review
- D1 Overlap scope = one CUSP seller (e.g. "Ultima II [TH]"), any platform. Shop listings are platform-specific, so a Shopee and a Lazada campaign can never share a listing id; the per-seller scope is therefore safe and simpler than per shop.
- D2 PIC = whoever logs the row, stamped automatically; the ticket's assignee is the PIC of the ticket overall. An admin can reassign a row.
- D3 The CUSP bridge is a Supabase edge function with a read-only CUSP DB user supplied by CREA IT. Until that user exists, Claude runs the same sync through the CUSP MCP from Cowork once a day and the page says "last synced <time>". Nothing in the UI changes when the edge function takes over.
- D4 Naming convention in CUSP stays `<ticket no> <platform> <dates> (<type>)`, with the DONE ticket number (e.g. `CFR-0412`) replacing the monday item id from the go-live date. Type (Frame / PDP / PDP+Frame) is parsed from the bracketed suffix; platform from the SHP / LZD / TT token, falling back to `catalog_campaign_shops`.

## 4. User experience

4.1 Ticket (board `Request: Campaign Frames`)
- A new section "Campaign setups" under the ticket's fields.
- Top of the section: "＋ Log a setup" — one input (CUSP ID or link) and a Look up button.
  Look-up returns name, platform, type, start, end, SKU count, CUSP state and the overlap result;
  Save writes the row and stamps logged_by / logged_at.
- Rows: Platform · Type · Dates (with CUSP id under) · SKUs · Status pill · Logged by + time · Check (✓ no overlap / red "n SKUs overlap" with a "see ›" link).
- Planned-but-not-logged platforms (from the request's platform multiselect minus logged rows) appear greyed with a "log ›" link, so the PIC sees what is still missing.
- Overlap row expands into: the clashing campaign id, ticket and PIC, the overlap window, the SKU list, and two actions: Notify <PIC> (DONE notification + comment on both tickets) and Mark as intended (clears the badge for that pair; logged in activity).
- "↻ Re-check CUSP" on the section re-syncs every row of this ticket.

4.2 Listing Tracker page (`#/listing-tracker`, Product Listing workspace; also "Listing Tracker" entry in the workspace page like the Onboarding trackers hook)
- Header: month picker, "⇩ Excel", "＋ Log a setup" (opens the ticket picker).
- Summary block: a generated paragraph in plain words (counts by type, live now, set for the next big date, problems to fix, tickets without a CUSP ID) and six numbers: campaigns this month, live now, set and starting soon, SKU overlaps to resolve, tickets without a CUSP ID, % logged within SLA.
- Legend line incl. the LZD content-freeze windows for the month (admin-editable list).
- Filters: find a brand/ticket; All · Needs attention · Live now · Starting soon. Sort: problems first, then A→Z.
- Brand cards: name, campaign count, PIC, category, country, status chip (Needs attention / n live / Nothing live today). One row per platform with a 31-day strip (weekend shading, today line) and segments per campaign (colour = type; dashed = set, solid = live, faded = done; red ring = overlap). Under each strip, the same campaigns in words with status and ticket link. A red footer explains any overlap in one sentence with the two actions; an amber footer lists tickets in this brand still without a CUSP ID.
- Clicking a segment opens a small popover: dates, status (with the CUSP state in brackets), SKUs, PIC + logged time, overlap detail, Open ticket / Open in CUSP / Re-check.
- "Who set what": per PIC, count and type mix for the month, last log time.
- "What happened, latest first": the activity log — setups logged, CUSP state changes (went live / ended), overlap found / cleared, nightly check summary.
- Excel export: workbook with sheet "<month>" in the slot-grid layout (Category · Brand · Country · Platform · PIC · Note · Campaign 1..n blocks of Start · Status · End · Campaign ID · Ticket No.) and sheet "Log" with one row per setup (the old AWO columns).

4.3 My Work
- "My listing setups" block: rows I logged that go live in the next 48 h, and any overlap on my rows.

4.4 Notifications
- Overlap found on save → in-app notification to both PICs. Nightly check finding a new overlap → same. Campaign went live / ended → activity log only (no notification).

## 5. Data model (Supabase, new)

```sql
create table listing_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  task_id uuid not null references tasks(id) on delete cascade,     -- the DONE ticket
  cusp_campaign_id integer not null,
  cusp_name text, cusp_seller_id integer, cusp_seller text,
  brand_id uuid references brands(id),
  platform text check (platform in ('Shopee','Lazada','TikTok','Other')),
  ctype text check (ctype in ('frame','pdp','both','other')),
  begin_at timestamptz, end_at timestamptz,
  cusp_state text,                      -- raw: approved / active / ended / …
  status text generated always as (case cusp_state when 'approved' then 'set' when 'active' then 'live' when 'ended' then 'done' else 'other' end) stored,
  sku_count integer,
  logged_by uuid references profiles(id), logged_at timestamptz default now(),
  overlap jsonb default '[]',           -- [{campaign_id, task_id, pic, from, to, skus:[{sku,name}]}]
  overlap_ack jsonb default '{}',       -- {"<campaign_id>": {by, at, reason}}
  last_synced timestamptz,
  unique (company_id, cusp_campaign_id)
);
create table listing_campaign_skus (    -- cache of catalog_assetgroup for overlap checks
  cusp_campaign_id integer not null, shop_listing_id integer not null, sku text, product_name text,
  primary key (cusp_campaign_id, shop_listing_id)
);
create table listing_freeze_windows (id uuid pk, company_id, platform, starts_at timestamptz, ends_at timestamptz, note text);
create table listing_sync_log (id bigserial pk, ran_at timestamptz, scope text, campaigns int, overlaps int, errors text);
```
RLS: staff of the company read/write `listing_campaigns`; partner/board-only roles read rows of boards they can see (same predicate as tasks). `listing_campaign_skus` readable by staff only. Activity entries go to the existing task activity table of the ticket.

Overlap rule (SQL, run per saved/synced row A, scope = same `cusp_seller_id`):
B overlaps A when `B.id <> A.id and tstzrange(B.begin_at,B.end_at) && tstzrange(A.begin_at,A.end_at) and B.cusp_state in ('approved','active')` and `exists (select 1 from listing_campaign_skus sa join listing_campaign_skus sb using (shop_listing_id) where sa.cusp_campaign_id=A.id and sb.cusp_campaign_id=B.id)`. The shared listings are stored in `overlap` on both rows. An entry in `overlap_ack` for that pair hides the badge but keeps the data.

## 6. CUSP bridge

Edge function `cusp-campaign` (Deno, service role, CUSP read-only Postgres user from IT), three actions:
- `lookup(id)` → `catalog_campaign` + seller name + listing count; parses type/platform from the name; falls back to `catalog_campaign_shops` → `catalog_shop` for platform.
- `skus(id)` → `catalog_assetgroup` joined to `catalog_shoplisting` / `catalog_variant` for sku + product name (limit none; campaigns are ≤ a few hundred listings).
- `sync(scope)` → for every `listing_campaigns` row with `end_at >= now() - 7 days`: refresh state/begin/end/sku cache, recompute overlaps, write `listing_sync_log`, raise notifications for new overlaps.
Scheduling: `pg_cron` nightly 06:00 Bangkok calls `sync('open')` via `pg_net` (same pattern as the SLA engine). Until the CUSP user exists (D3), Claude runs the equivalent through the CUSP MCP from Cowork and loads results with the same `sync` RPC.
Secrets: CUSP connection string in Supabase secrets, never in the client.

## 7. Migration of the 2026 Excel

- Source: sheet `AWO` (one row per setup; columns Brand+platform, Ticket Name, LZD/SHP/TT ticks, Campaign Name (in CUSP), Campaign ID, type, start date/time, end date/time, PIC, set status, monday Ticket Number).
- Each distinct monday Ticket Number → one task on `Request: Campaign Frames` (title = Ticket Name, status done, `custom.monday_id`, created_at = earliest row's start). Brand from the first token, matched to `brands` (unmatched → report, not guessed).
- Each row → one `listing_campaigns` row keyed by Campaign ID; begin/end/state/SKUs then refreshed from CUSP (sheet times win only when CUSP has no row). PIC initials mapped to profiles by a small table April confirms (AOD, Dear, May, P'Aod, …).
- Dry run first with counts and a mismatch list; load follows the "bulk load without notification storms" rule (triggers paused only for the load).

## 8. Phases

Phase 1 — log and check (team can stop using Excel after this)
  schema + RLS · edge function lookup/skus/sync (or MCP stand-in) · ticket section with Log a setup, rows, overlap detail, Notify / Mark as intended · AWO import · My Work block.
Phase 2 — month report
  `#/listing-tracker` page with summary paragraph, numbers, brand cards and strips, popover, who-set-what, activity log · freeze windows admin · Excel export (slot grid + log).
Phase 3 — keep it true
  pg_cron nightly sync · state-change entries (went live / ended) · "tickets without a CUSP ID" from the planned-platform gap · dashboard widgets (overlaps per month, setups per PIC) through the existing widget RPCs.

## 9. Testing

- Unit (cjs suites like the other modules): name parser (type/platform from CUSP names incl. "PDP+Frame", "PD", lowercase), status mapping, overlap SQL on fixtures (shared SKU vs disjoint SKU, touching ranges 23:43/23:52, acknowledged pair), paragraph generator, Excel export columns equal the old sheet header row.
- Integration: lookup of the four real ids checked today (72731, 72736, 72737, 72955) returns the expected seller/dates/listing counts; sync on a rolled-back transaction.
- UI lints already in the repo: navrace guard, dark-mode greyscale allowlist, paging lint — the page follows the part8 onboarding pattern (hook lines, not wrapped renderers).
- Manual: AOD logs one real Payday setup on staging; overlap appears on a deliberately chained pair; export opens in Excel with the old layout.

## 10. Open items for April

- Confirm D1–D4.
- PIC initials → DONE accounts mapping for the import.
- Ask CREA IT for a read-only CUSP DB user for the edge function (or confirm the MCP stand-in is acceptable for launch).
- Go-live date for "DONE is the tracker, Excel is read-only" (suggest 1 Nov 2026, the start of a month, after the 25–31 Oct Payday set is logged in both for one week).
