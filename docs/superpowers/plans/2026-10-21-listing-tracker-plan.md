# Listing Tracker (Frame / PDP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Product Listing team's Excel "Listing Tracker" with a DONE module where a PIC logs a CUSP campaign ID on a ticket, DONE flags same-SKU overlaps, and a month report page shows every brand's Frame/PDP campaigns with ticket, PIC and timestamp.

**Architecture:** A new client part `src/part9_listing.html` (same pattern as part8_onboarding: own `<style>` + `<script>`, `LT` state object, `db.from` reads, hook lines in part2/3/4), four new Supabase tables behind SQL RPCs that compute overlaps server-side, and an edge function `cusp-campaign` (postgres.js, like `bot-api`) that reads CUSP's `catalog_campaign` / `catalog_assetgroup`. CUSP stays read-only and is the source of status and SKUs.

**Tech Stack:** Vanilla JS single-page app built by `build.sh` (parts concatenated), Supabase Postgres + RLS + edge functions (Deno), jsdom `.cjs` suites run by CI (Node 20 / jsdom 29), GitHub Pages via `ci.yml` (main) and `staging.yml` (branch `staging`).

**Spec:** `C:\Users\April\WorkOS\docs\superpowers\specs\2026-10-21-listing-tracker-design.md`

## Global Constraints

- Source of truth and ship route: the clone `C:\Users\April\OneDrive - Crea Co. Ltd\Documents\GitHub\DONE-live` (mounted `$HOME/mnt/DONE-live`). Files are copied in **as CRLF**, verified by `tr -d '\r' | md5sum`; April commits and pushes in GitHub Desktop. Never run plain `git` there from the VM; read-only git only with `GIT_OPTIONAL_LOCKS=0 git -c safe.directory=*`. Never touch root `index.html` or `staging/index.html`.
- Work goes to branch **`staging`** (lowercase — `staging.yml` triggers on `branches: [staging]`; the clone currently sits on `Staging`, see Task 0), previewed at `alampluz.github.io/DONE/staging/`, then a pull request to main.
- Build locally with `./build.sh` in a copy under `$HOME/ltbuild` (never in the mounted clone); the build must print all script blocks OK. Suites: `NODE_PATH=$HOME/js20mods/node_modules npx -y node@20 tests/<suite>.cjs` from `$HOME/js20run` (one suite per call; 180 s cap).
- Repo lints the new part must pass: `const _nav = S.nav;` spelled exactly in every async renderer; no greyscale hex outside the dark-mode allowlist (use tokens); hook lines, never wrapping `renderHome` / `renderWorkspace`; `<select>` is replaced by `.sel-pick` — size that class.
- Database: inspect before DDL; apply with `apply_migration`; probe writes inside a rolled-back transaction first; never send request text containing `drop …` / `delete from …` through the Supabase MCP (it hangs 180 s). Bulk loads pause triggers only for the load.
- Naming: the product is **DONE**; a task status is "Done"; campaign type values are `frame | pdp | both`; status values `set | live | done`.
- Fixture emails stay on `@example.test` (public repo).
- Copy follows the mockup (artifact "Listing Tracker in DONE", version 3): "Log a setup", "Look up in CUSP", "No SKU overlap", "n SKUs overlap", "Mark as intended", "Notify <name>", "This month in one paragraph", "Who set what", "What happened, latest first".

## Review Focus

1. A CUSP name without the bracketed type or platform token (e.g. `Payday frames Oct`) — `ltParseName` returns `{ctype:'other', platform:null}`; the row saves with platform from `catalog_campaign_shops`, never throws. Test in Task 3.
2. Two campaigns that touch but do not intersect (A ends 23:43, B begins 23:52 the same day) — no overlap. `tstzrange` is half-open `[)`; test in Task 1.
3. The same CUSP ID logged twice (two PICs on the same ticket, or on two tickets) — the unique key makes the second save an update of the first row, and the UI says "Already logged on <ticket> by <PIC>". Test in Task 1 (RPC) and Task 4 (UI).
4. CUSP unreachable (edge function 5xx or timeout) — "Look up" shows "CUSP did not answer, try again" and does not create a row; the month page still renders from cached rows and shows "last synced <time>". Test in Task 4 and Task 8.
5. Month boundary: a campaign 28 Oct → 3 Nov appears on both October and November strips, clipped to the month, and counts once in each month's "campaigns this month". Test in Task 8.

---

### Task 0: Branch housekeeping (April, GitHub Desktop) and a build scratch copy

**Files:** none in the repo.

- [ ] **Step 1: April** — in GitHub Desktop (Alampluz → DONE-live): Current branch → New branch `staging` from `main` (lowercase), publish it. The old `Staging` branch can be deleted afterwards.
- [ ] **Step 2: Verify from the VM**: `GIT_OPTIONAL_LOCKS=0 git -c safe.directory=* -C $HOME/mnt/DONE-live branch --show-current` prints `staging`, and `log --oneline -1 main` equals the API's main sha.
- [ ] **Step 3: Scratch build copy**: `rsync -a --exclude .git $HOME/mnt/DONE-live/ $HOME/ltbuild/` then `cd $HOME/ltbuild && ./build.sh` → prints the script-block count OK. Expected: 8 parts today; after Task 3, 9.

### Task 1: Schema, RLS and RPCs

**Files:**
- Create: `migrations/2026-10-21_listing_tracker.sql`
- Test: SQL probe in a rolled-back transaction (recorded in the migration header comment as the test transcript)

**Interfaces — Produces:**
- Tables: `listing_campaigns`, `listing_campaign_skus`, `listing_freeze_windows`, `listing_sync_log` exactly as spec §5 (plus `company_id` on all four, defaulting from `current_company()` the way other tables do).
- `lt_upsert_campaign(p jsonb) returns jsonb` — input `{task_id, cusp_campaign_id, cusp_name, cusp_seller_id, cusp_seller, platform, ctype, begin_at, end_at, cusp_state, skus:[{shop_listing_id, sku, product_name}]}`; upserts the row and its SKU cache, recomputes `overlap` for this row **and every row it overlaps with**, writes `activity_log` (`entity_type='task'`, `action='listing_setup_logged'` / `'listing_overlap_found'`), inserts `notifications` for both PICs on a new overlap; returns `{id, status, overlap, already:{task_id, ticket_no, logged_by}|null}`.
- `lt_ack_overlap(p_id uuid, p_other int, p_reason text)` — stores `overlap_ack[p_other] = {by, at, reason}` on both rows.
- `lt_month(p_year int, p_month int) returns setof listing_month_row` — one row per `listing_campaigns` row whose `[begin_at,end_at)` intersects the month (Asia/Bangkok), joined with `tasks.ticket_no`, `tasks.title`, brand name, PIC name; this is the only read the report page needs.
- `lt_sync_apply(p jsonb)` — same body as `lt_upsert_campaign` but without `logged_by`/`logged_at` changes and with `last_synced = now()`; used by the sync (Task 2) and the import (Task 6).
- `projects.field_config` gains `"listing_tracker": true` on board `ec8f2549-16db-4fee-b21d-f10930a18b52` (data update inside this migration).

- [ ] **Step 1: Inspect** `tasks`, `brands`, `profiles`, `notifications`, `activity_log` columns and the RLS helper functions other migrations use (`current_company()`, `is_staff()` or equivalents) with `list_tables` / `execute_sql`; copy their names into the migration.
- [ ] **Step 2: Write the migration** per spec §5 with: `overlap_pairs(a int)` SQL function implementing the rule in spec §5 (`tstzrange(begin_at,end_at,'[)') && …`, same `cusp_seller_id`, `cusp_state in ('approved','active')`, shared `shop_listing_id`), the four RPCs above as `security definer` with `search_path=public`, RLS: staff full access; partner/board-only roles select rows whose `task_id` passes the existing task select policy.
- [ ] **Step 3: Probe in a rolled-back transaction**: `begin; <migration body>; select lt_upsert_campaign(A); select lt_upsert_campaign(B); select overlap from listing_campaigns; rollback;` with fixtures: A = 72698-like (`begin 2026-10-20 23:50+07`, `end 2026-10-27 23:40+07`, skus 1,2,3,4), B = 72735-like (`25 Oct 23:52` → `31 Oct 23:44`, skus 3,4,9) → both rows' `overlap` lists the other with 2 shared skus; C = touching (`begin = A.end`) with sku 1 → no overlap; D = same `cusp_campaign_id` as B from another task → returns `already` with B's task; a seller mismatch with shared sku ids → no overlap.
- [ ] **Step 4: Apply** with `apply_migration` (name `listing_tracker`), then re-run the four selects without rollback on a throwaway task and clean up with `update … set archived_at` (not delete, see constraints) or leave the probe rows on a task titled `__lt_probe` that Task 6 removes with the import.
- [ ] **Step 5: Copy** the migration into `DONE-live/migrations/` (CRLF) and record the probe transcript in its header comment.

### Task 2: Edge function `cusp-campaign`

**Files:**
- Create: `supabase/functions/cusp-campaign/index.ts`
- Secrets: `CUSP_DB_URL` (read-only user from IT; until then unset → the function returns `503 {code:'cusp_unavailable'}`)

**Interfaces — Produces:** POST with the caller's Supabase JWT (verified like bot-api v6 user mode; staff only).
- `{action:'lookup', id}` → `{id, name, begin, end, state, seller_id, seller, positions, shops:[{shop_id, name, platform}], sku_count}` or `404 {code:'not_found'}`.
- `{action:'skus', id}` → `{skus:[{shop_listing_id, sku, product_name}]}` (join `catalog_assetgroup` → `catalog_shoplisting` → `catalog_variant` / `catalog_product`; inspect those two tables' columns first with `list_cusp_tables`).
- `{action:'sync'}` → for every `listing_campaigns` row with `end_at >= now() - interval '7 days'`: fresh lookup + skus, then `lt_sync_apply`; returns `{campaigns, overlaps, errors:[…]}` and writes `listing_sync_log`.

- [ ] **Step 1: Inspect** `catalog_shoplisting`, `catalog_shop`, `catalog_variant`, `catalog_product` columns (`list_cusp_tables … detailed`) and confirm the join path from `shop_listing_id` to a human SKU code and name on campaign 72731.
- [ ] **Step 2: Write the function** modelled on `bot-api/index.ts` (postgres.js with `max:2`, `prepare:false`; JWT check copied from v6 user mode; CUSP queries are `select` only with a `limit 5000` on skus).
- [ ] **Step 3: Deploy** with `deploy_edge_function`; call `lookup` for 72731, 72736, 72737, 72955 through `curl` with April's session JWT (from the app's local storage in Chrome) → sellers `Innisfree [TH]`, `Ultima II [TH]` ×2, `Aestura [TH]`; `sku_count` 142 / 111 / 7 / n.
- [ ] **Step 4: Stand-in until `CUSP_DB_URL` exists** — `tools/listing_sync/sync_via_mcp.md`: the exact `query_cusp` statements that produce the `lt_sync_apply` payloads, so a Cowork session can run the nightly sync by hand. One line in HANDOFF.md points at it.

### Task 3: Client part skeleton, name parser, status mapping

**Files:**
- Create: `src/part9_listing.html`
- Modify: `build.sh` (append part9 to the `cat` list), `.github/workflows/ci.yml` and `staging.yml` only if they list parts explicitly (check; `build.sh` is the usual single place)
- Test: `tests/test_listing.cjs` (new; copy the harness header from `tests/test_onboarding.cjs`)

**Interfaces — Produces (all global functions in part9):**
- `ltParseName(name:string) → {ticket:string|null, platform:'Shopee'|'Lazada'|'TikTok'|null, ctype:'frame'|'pdp'|'both'|'other', dates:string|null}`
- `ltStatus(cuspState:string) → 'set'|'live'|'done'|'other'`
- `ltMonthClip(row, year, month) → {s:int, e:int}|null` (day-of-month span, 1-based, Asia/Bangkok, null when outside)
- `const LT = {rows:[], month:{y,m}, loaded:false, lastSynced:null}`

- [ ] **Step 1: Failing tests** in `tests/test_listing.cjs` (driver style of test_onboarding): `ltParseName('13333214952 LZD 25-31 OCT 26 (PDP+Frame)')` → `{ticket:'13333214952', platform:'Lazada', ctype:'both', dates:'25-31 OCT 26'}`; `'CFR-0412 SHP 25-31 Oct 2026 (Frame)'` → ticket `CFR-0412`, Shopee, frame; `'13334182389 TT 22-23 OCT 2026 (Pack6)'` → TikTok, `other`; `'Payday frames Oct'` → platform null, `other`; `ltStatus('approved')==='set'`, `'active'→'live'`, `'ended'→'done'`, `'draft'→'other'`; `ltMonthClip({begin_at:'2026-10-28T16:52:00Z', end_at:'2026-11-03T16:40:00Z'},2026,10)` → `{s:28,e:31}` and `(…,2026,11)` → `{s:1,e:3}`, `(…,2026,9)` → null.
- [ ] **Step 2: Run** the suite → FAIL "ltParseName is not defined".
- [ ] **Step 3: Implement** part9 with the `<style>` header comment, the `LT` object and the three pure functions (platform tokens `SHP|SHOPEE`, `LZD|LAZADA`, `TT|TIKTOK`, case-insensitive; type from the last `(...)` group: `pdp+frame`/`pdp + frame` → both, `frame` → frame, `pdp`|`pd` → pdp, else other). Add part9 to `build.sh`.
- [ ] **Step 4: Build + run** → PASS; also run `tests/test_navrace.cjs` and the dark-mode lint suite (names: `ls tests | grep -i 'nav\|dark'`) → PASS.
- [ ] **Step 5: Copy** `src/part9_listing.html`, `build.sh`, `tests/test_listing.cjs` into DONE-live (CRLF); April commits "Listing tracker: part9 skeleton" to `staging`.

### Task 4: "Campaign setups" section on the ticket

**Files:**
- Modify: `src/part4_task.html` — one hook line after `attsHTML` is built: `const ltHTML = (typeof ltTaskSectionHTML==='function')? ltTaskSectionHTML(t) : '';` inserted into the modal body right after `${subsHTML}`, and one line after the modal is created: `if(typeof ltTaskSectionWire==='function') ltTaskSectionWire(t, m);`
- Modify: `src/part9_listing.html`
- Test: `tests/test_listing.cjs`

**Interfaces — Produces:**
- `ltBoardOn(project_id) → boolean` (reads `projects.field_config.listing_tracker`)
- `ltTaskSectionHTML(task) → string` (empty string when `!ltBoardOn`)
- `ltTaskSectionWire(task, modalEl)` — loads rows via `db.from('listing_campaigns').select('*').eq('task_id',…)`, renders rows grouped by platform, "planned but not logged" rows from the task's `custom.platform` multiselect, wires Look up / Save / Re-check / see › / Notify / Mark as intended.
- `ltLookup(idOrLink) → Promise<{lookup, skus}|{error}>` — calls `db.functions.invoke('cusp-campaign', …)` twice (`lookup`, `skus`); accepts a bare id or any URL whose path ends in the id.
- `ltSave(task, lookup, skus) → Promise<rpc result>` — builds the `lt_upsert_campaign` payload with `ltParseName` + `ltStatus`, falls back to `lookup.shops[0].platform`.

- [ ] **Step 1: Failing tests**: with `__tables.projects=[{id:'p1',field_config:{listing_tracker:true}}]` and a task on `p1`, `ltTaskSectionHTML(t)` contains `Log a setup`; on a board without the flag → `''`. Mock `db.functions.invoke` to return the 72739 fixture; after `ltLookup('https://cusp.crea.asia/campaigns/72739')` the found box contains `TikTok`, `PDP+Frame`, `12 SKUs`, `No SKU overlap`; after Save, `__rpc` has `lt_upsert_campaign` with `platform:'TikTok'`, `ctype:'both'`, `skus.length===12`. Mock a `503` → the found box text is `CUSP did not answer, try again` and `__rpc` has no `lt_upsert_campaign`. Mock the RPC returning `already:{ticket_no:'CFR-0398',logged_by_name:'May'}` → text `Already logged on CFR-0398 by May`. A row with `overlap:[{…3 skus}]` renders `3 SKUs overlap` and a `Mark as intended` button whose click calls `lt_ack_overlap`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the section (markup and copy from the mockup's ticket view: add box on top, platform groups, columns Platform · Type · Dates (CUSP id under) · SKUs · Status · Logged by + time · Check). Status pills reuse `.pill`-style classes already in part1 if present (`grep -n "\.pill" src/part1_head.html`), else add `.lt-pill` in part9's style.
- [ ] **Step 4: Run** `test_listing.cjs`, `test_taskmodal*`/`test_task*.cjs` suites (whichever exist: `ls tests | grep -i task`) → PASS.
- [ ] **Step 5: Copy** part4, part9, test to DONE-live; April commits "Listing tracker: setups on the ticket" to `staging`; after the staging deploy, open a real Campaign Frames ticket on `/DONE/staging/` and log 72739 (or any approved campaign) end to end.

### Task 5: My Work block

**Files:**
- Modify: `src/part3_views.html` — one hook line next to `obHomeSection()`: `if(typeof ltHomeSection==='function') ltHomeSection();`
- Modify: `src/part9_listing.html`
- Test: `tests/test_listing.cjs`

**Interfaces — Produces:** `ltHomeSection()` — rows where `logged_by = S.me.id` and (`begin_at` within the next 48 h or `overlap` non-empty), inserted before the "My requests" section exactly like `obHomeSection`; heading `My listing setups`.

- [ ] **Step 1: Failing test**: with two such rows in `__tables.listing_campaigns`, after `renderHome()` the content has a section titled `My listing setups` with 2 rows; with none, no section.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `test_listing.cjs` + `test_home*.cjs`/paging lint → PASS. **Step 5: Copy + commit** "Listing tracker: My Work block".

### Task 6: Import of the 2026 Excel (`AWO` sheet)

**Files:**
- Create: `tools/listing_import/import.cjs`, `tools/listing_import/README.md`, `tools/listing_import/pic_map.json`
- Uses: `lt_sync_apply` (Task 1); creates tasks on board `ec8f2549-…` with `ticket_no` from the existing ticket-number trigger

**Interfaces — Consumes:** the xlsx downloaded by April from SharePoint into `C:\Users\April\WorkOS\imports\Listing Tracker Updated 2026.xlsx`.

- [ ] **Step 1: Dry run** — `node import.cjs --dry` reads sheet `AWO` with the repo's existing xlsx reader (`grep -rn "readXLSX\|xlsx" tools/monday_import | head`), prints: rows, distinct monday ticket numbers, brands not matched to `brands.name` (first token, case-insensitive, `[LZD]`/`[SHP]` stripped), PIC initials not in `pic_map.json`, campaign IDs missing. Stop here and send April the two mismatch lists; she fills `pic_map.json` and confirms brand aliases.
- [ ] **Step 2: Load** — `node import.cjs --apply` (service role via `SUPABASE_SERVICE_KEY` env, never committed): one task per monday ticket (`title` = Ticket Name, `status 'done'`, `custom.monday_id`, `created_at` = earliest row start, `assignee_id` from the first row's PIC) inserted in batches of 500 with notification triggers paused for the load (same pattern as the 4 Oct Store Ops import); then `lt_sync_apply` per row with the sheet's times/state (`Set` → `approved`; past end → `ended`); CUSP refresh of October rows via Task 2 `sync`.
- [ ] **Step 3: Verify** — `select count(*) from listing_campaigns` equals the AWO row count minus duplicates reported in Step 1; `lt_month(2026,10)` row count equals the sheet's October rows; spot-check three brands against the `10.10 2026` sheet.
- [ ] **Step 4: Copy** the tool into DONE-live; commit "Listing tracker: AWO import tool".

### Task 7: Month report page — data and summary

**Files:**
- Modify: `src/part2_shell.html` — route map gains `listing:renderListingTracker`; short link comment updated
- Modify: `src/part3_views.html` — one hook line next to `obWorkspaceSection(id)`: `if(typeof ltWorkspaceSection==='function') ltWorkspaceSection(id);`
- Modify: `src/part9_listing.html`
- Test: `tests/test_listing.cjs`

**Interfaces — Produces:**
- `ltLoadMonth(y, m) → Promise<rows>` via `db.rpc('lt_month', {p_year:y, p_month:m})`, cached in `LT`.
- `ltSummary(rows, y, m) → {total, byType:{frame,pdp,both}, live, setSoon, overlaps, noId, pctInSla, brands}`.
- `ltSummaryText(summary, y, m) → string` — the paragraph; sentences in this order: brands and totals by type; live now and set for the next date; "Every campaign has a ticket and a PIC." when `noId===0`; the problem sentence(s) prefixed `One problem to fix:` / `Two problems to fix:` listing overlaps (brand · platform · n SKUs · dates) and tickets without a CUSP ID (count, oldest ticket, due).
- `renderListingTracker(sub)` — `#/listing-tracker` and `#/listing-tracker/YYYY-MM`; `ltWorkspaceSection(wsId)` — a section "Listing Tracker" on the Product Listing workspace page with the six numbers and an "Open report" button (only when the workspace owns a board with `listing_tracker`).

- [ ] **Step 1: Failing tests**: `ltSummary` on a 6-row fixture (2 live, 2 set within 48 h of a frozen `now`, 1 overlap pair, 1 row with `cusp_campaign_id null`) → `{total:6, live:2, setSoon:2, overlaps:1, noId:1}`; `ltSummaryText` contains `ran 6 campaigns`, `2 are live right now`, `One problem to fix:`; with no problems contains `Every campaign has a ticket and a PIC.` and no `problem`; `renderListingTracker()` with `S.nav` bumped mid-await renders nothing (navrace); month boundary fixture from Task 3 counts in both months.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** load, summary, text, the page header (month nav, Excel button placeholder, "＋ Log a setup" → ticket picker = existing quick search modal filtered to the listing boards), the summary block and six numbers from the mockup. **Step 4: Run** suites → PASS. **Step 5: Copy + commit** "Listing tracker: report page (summary)".

### Task 8: Month report page — brand cards, strips, popover, people, log

**Files:**
- Modify: `src/part9_listing.html`
- Test: `tests/test_listing.cjs`

**Interfaces — Produces:** `ltBrandCardsHTML(rows, y, m, filter)`, `ltStripHTML(rowsOfPlatform, y, m)`, `ltPopover(rowId, anchorEl)`, `ltPeopleHTML(rows)`, `ltLogHTML(activity)` (reads `activity_log` where `action like 'listing_%'` for the month, newest first, plus `listing_sync_log`).

- [ ] **Step 1: Failing tests**: cards sorted problems-first then A→Z (fixture brands Zeta(no problem), Alpha(overlap) → Alpha first); a 31-cell strip per platform row with one `.lt-seg` per campaign, `left`/`width` percentages from `ltMonthClip`; overlap segment has class `ov`; filter `Needs attention` leaves only brands with overlaps or `noId`; the popover for an overlap row names the other campaign id and PIC; `ltPeopleHTML` lists PICs by count descending; the CUSP-unavailable state shows `last synced <time>` from `LT.lastSynced`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** from the mockup (classes `lt-bcard`, `lt-strip`, `lt-seg frame|pdp|both set|live|done ov`, `lt-pop`; colours from tokens `--blue`, `--accent`, `--purple`, `--red`). **Step 4: Run** `test_listing.cjs`, navrace, dark-mode lint → PASS. **Step 5: Copy + commit** "Listing tracker: brand cards and log". Open `/DONE/staging/#/listing-tracker` with the imported October data and compare three brands with the `10.10 2026` sheet.

### Task 9: Freeze windows admin and Excel export

**Files:**
- Modify: `src/part6_dash_admin.html` — one hook line in the Admin menu/tab list: `if(typeof ltAdminTab==='function') tabs.push(ltAdminTab());` (find the existing tab array; same shape as the SLA tab)
- Modify: `src/part9_listing.html`
- Test: `tests/test_listing.cjs`

**Interfaces — Produces:** `ltAdminTab() → {k:'listing', label:'Listing Tracker', render}` — CRUD on `listing_freeze_windows` (platform, from, to, note); `ltExport(y, m)` → `downloadXLSX(xlsxFilename('Listing Tracker 2026-10'), rows)` where sheet 1 is the slot grid with header row exactly `['Category','Brand','Country','Platform','PIC','Note','Start Campaign','Status','Campaign End','Campaign ID','Ticket No.', …repeated per campaign up to the month's max per row]` and sheet 2 `Log` with the AWO columns. If `downloadXLSX` supports one sheet only, export two files (`…-overview.xlsx`, `…-log.xlsx`) — check its signature first.

- [ ] **Step 1: Failing tests**: export rows for the Task 8 fixture: header equals the array above; Ultima II Shopee row has Campaign 1 = the 20–27 Oct PDP and Campaign 2 = the 25–31 Oct PDP+Frame with status text `Set` and `Live`; the summary legend shows a freeze window from `__tables.listing_freeze_windows`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** suites → PASS. **Step 5: Copy + commit** "Listing tracker: Excel export and freeze windows". Open the exported file in Excel next to the old sheet.

### Task 10: Nightly sync and state-change entries

**Files:**
- Create: `migrations/2026-10-2x_listing_sync_cron.sql`
- Modify: `supabase/functions/cusp-campaign/index.ts` (sync writes `activity_log` `listing_went_live` / `listing_ended` when state changes)

- [ ] **Step 1: Check** `list_extensions` for `pg_cron` and `pg_net`; enable `pg_cron` if absent (`create extension if not exists pg_cron`).
- [ ] **Step 2: Migration**: `cron.schedule('listing-sync-nightly', '0 23 * * *' /* 06:00 Bangkok */, $$ select net.http_post(url := current_setting('app.functions_url')||'/cusp-campaign', headers := jsonb_build_object('Authorization','Bearer '||current_setting('app.service_key'), 'Content-Type','application/json'), body := '{"action":"sync"}'::jsonb) $$)` — read how the existing automation sweep stores its URL/key (`grep -rn "net.http_post\|app\." migrations/*.sql`) and reuse that setting instead of inventing new ones.
- [ ] **Step 3: Verify**: trigger the job once (`select cron.schedule(...)` then `select * from cron.job_run_details order by start_time desc limit 1`), `listing_sync_log` has a row, and the report's "What happened" shows the nightly line.
- [ ] **Step 4: Commit** migration + function; open the pull request `staging → main` titled "Listing Tracker (Frame/PDP) phase 1–3"; April merges in GitHub Desktop/GitHub; verify the main deploy and load `/DONE/#/listing-tracker`.

### Task 11: Hand-over

- [ ] HANDOFF.md: section "Listing Tracker" — tables, RPCs, edge function + secret, the import tool, the MCP stand-in, go-live date (DONE is the tracker from 1 Nov 2026; Excel read-only).
- [ ] Project memory `workos_listing_tracker.md`: status, ids, the probe gotchas met.
