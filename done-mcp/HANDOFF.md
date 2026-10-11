# DONE MCP — handoff for the tech team

*11 Oct 2026. Written for whoever owns the DONE ↔ AI integration next. No secrets in this file; every secret is named and where it lives is stated.*

## 1. Goal

CREA is moving from monday.com to DONE (its own ticket tracker, https://alampluz.github.io/DONE/, Supabase project `sknspnorwpoayymvndaz`). Two kinds of AI client need to work tickets:

1. **Grok Bot** (xAI): unattended routines; only April uses it. Connects with a shared bot key. **Working today.**
2. **Claude** (claude.ai, many CREA users): each person signs in with their own DONE account so Claude is limited by that person's DONE role (admin / internal / requester / partner) and the activity log shows their name. **Built and tested on 11 Oct (bot-api v6 live; done-mcp OAuth in the repo); waiting on the Render deploy (§3) and IT adding the connector (§4).**

## 2. What exists and where

| Piece | Where | State |
|---|---|---|
| `bot-api` edge function v6 | Supabase function `bot-api`; source `supabase/functions/bot-api/index.ts` in `Alampluz/DONE` | Live. REST API for bots (key) **and for signed-in users (Supabase JWT as the bearer; v6)**. In user mode `/whoami` answers `"bot":"user"` plus `user{id,email,role,full_name}`, all scopes, `all_boards: true`, no status denials, rate limit 120/40 per minute per user, `app.via_bot` empty, comments carry no `[Name]` prefix and are not email-suppressed. Everything else is unchanged. Endpoints: `GET /whoami`, `GET /boards`, `GET /people`, `GET /tasks`, `GET /tasks/:id`, `PATCH /tasks/:id`, `POST /tasks/:id/comments`, `POST /tasks`. Every call runs as the bot's DONE user inside one transaction with RLS on (`set local role authenticated` + `request.jwt.claims`), so permissions, triggers and the activity log behave as for a human. `app.via_bot` stamps which key acted. |
| `bot-dispatch` edge function v1 | Supabase function `bot-dispatch` (deployed only; no source in repo) | Live but idle. Drains `bot_events` to a key's `webhook_url` with an HMAC signature. No key has a URL yet. |
| Tables | `bot_keys`, `bot_usage`, `bot_events`, `bot_settings` (kill switches `api_enabled`, `events_enabled`), `loadtest_runs` | `bot_keys.all_boards` added 11 Oct (`migrations/2026-10-11_bot_keys_all_boards.sql`). |
| Keys in `bot_keys` | DB | `grokbot` (GrokBot; all boards; read/write/create/comment; may set `done`; expires 2027-01-09), `claude` (same powers; expires 2027-01-09; **revoke once per-user sign-in ships**), `cuspyy` (original pilot: writes test board only), `qa-probe` (disabled). All keys map to one DONE user, `Agent.ops@crea.asia` (role internal), which sees 75 of 134 boards under RLS. |
| `done-mcp` server | `done-mcp/` in `Alampluz/DONE`; hosted on Render as web service `done-mcp` (srv-db5oapo473hc73brtbmg), https://done-mcp.onrender.com, Singapore, Starter plan ≈ US$7/mo, auto-deploys from `main` when `done-mcp/` changes | Node 22, `@modelcontextprotocol/sdk` 1.32, Streamable HTTP at `/mcp`. 9 tools (`done_whoami`, `done_list_boards`, `done_list_tasks`, `done_get_task`, `done_update_task`, `done_set_status`, `done_add_comment`, `done_create_task`, `done_find_people`), built from the key's `/whoami` scopes. 14 tests: `npm test`. OpenAPI for the REST layer in `done-mcp/openapi.yaml`. |
| Render env vars | Render → done-mcp → Environment | `DONE_BOT_KEY` + `MCP_AUTH_TOKEN` (Grok profile), `MCP_TRANSPORT=http`, and for user sign-in `MCP_OAUTH_SECRET` (generated), `DONE_SUPABASE_URL`, `DONE_SUPABASE_ANON_KEY` (public anon key). `DONE_BOT_KEY_CLAUDE` + `MCP_AUTH_TOKEN_CLAUDE` still exist on the service: delete them once sign-in is verified. |
| Vault secrets (Supabase) | `vault.decrypted_secrets` | `bot_dispatch_key` (dispatch auth), `loadtest_key`. Webhook secrets per key go in `bot_keys.webhook_secret_name`. |
| Load-test harness | Supabase function `loadtest` (v4), table `loadtest_runs` | Simulates N users opening boards exactly as the app does; also `{"cleanup":true}` and `{"probe_user_mode":true}`. See §6. |

**Auth to `done-mcp` today:** a shared token, either header `x-done-mcp-token: <MCP_AUTH_TOKEN>` (Grok's "Add MCP Server" card; Grok refuses `Authorization`/Bearer on custom servers) or in the path `/mcp/<token>` (for clients with no header field). Tokens select a *profile* (`DONE_BOT_KEY_<NAME>` / `MCP_AUTH_TOKEN_<NAME>` env pairs).

## 3. ⚠ Deploy steps still needed on Render

1. The last deploy failed with "Dockerfile not found": the service's **Root Directory** was blank after a blueprint re-sync. Render → done-mcp → Settings → Build → Root Directory = `done-mcp` (exactly that; the folder picker likes to autocomplete `done-mcp/assets/`). Save.
2. Push the current `done-mcp/` from the repo (it carries the OAuth build and the updated `render.yaml`). The blueprint sync should add `MCP_OAUTH_SECRET` (generated), `DONE_SUPABASE_URL` and `DONE_SUPABASE_ANON_KEY`; if it does not, add them by hand in Environment (anon key = Supabase → Settings → API → anon public).
3. Check `GET https://done-mcp.onrender.com/health` → `"user_signin": true`, and `GET /.well-known/oauth-authorization-server` returns JSON.
4. Test the sign-in with April's account (§4), then delete the `claude` row in `bot_keys` (`update bot_keys set active=false where bot_name='claude'`) and the `_CLAUDE` env pair on Render.

Until step 1 is done the server runs the previous build (Grok profile only).

## 4. Per-user sign-in for Claude (built 11 Oct)

### Requirements (from April)
- Claude users sign in with their **own DONE account** (email + password, Supabase Auth, same as the app).
- Every action runs with **that user's permissions** (RLS) and is logged under **their name**.
- Grok keeps the bot key; nothing changes for it.
- IT adds **one org-wide connector** in claude.ai (April cannot: custom connectors are org-owner only in CREA's Claude org). So the connector uses **OAuth**, with no secret in the URL.

### How it works
`done-mcp` is now also an OAuth 2.1 authorization server + resource server (`done-mcp/src/oauth.js`), backed by Supabase Auth. Stateless: nothing is stored server-side, so restarts and several instances are harmless.

1. **Discovery:** `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`. A request to `/mcp` without a valid token gets `401` with `WWW-Authenticate: Bearer resource_metadata=…`, which is how claude.ai finds the sign-in.
2. **Registration:** `POST /register` (dynamic client registration; claude.ai registers itself). Only `https://` redirect URIs are accepted; the client id is the registration sealed with AES-256-GCM under `MCP_OAUTH_SECRET`.
3. **Authorize:** `GET /authorize` shows a DONE-branded sign-in page; `POST /authorize` calls Supabase `grant_type=password`. The authorization code is the Supabase session (access + refresh token) sealed together with the PKCE challenge, client id and redirect URI; valid 10 minutes.
4. **Token:** `POST /token` (`authorization_code` with PKCE S256 verification; `refresh_token` → Supabase `grant_type=refresh_token`). The **access token handed to Claude is the person's Supabase JWT** (≈1 h); the refresh token is the sealed Supabase refresh token.
5. **Resource:** `/mcp` with a JWT bearer → `done-mcp` keeps a 5-minute in-memory session (`DoneClient` with `bearer: <jwt>`), calls `bot-api /whoami`, and registers tools from the answer. bot-api v6 verifies the JWT with Supabase Auth (`/auth/v1/user`), requires an active `profiles` row, and runs the transaction with `request.jwt.claims = {sub, role: authenticated, email}`, so RLS is the person's own. Tool instructions say "You act as <name> (<email>, DONE role <role>)…".
6. **Attribution:** `auth.uid()` is the person, so activity_log actor and comment author are them; no `[Claude]` prefix; requester emails are not suppressed.
7. **Revocation:** removing the connector in Claude drops the tokens; disabling the user in DONE (`profiles.active=false`) blocks them on the next call.

Tested: 14 tests in `done-mcp/test/mcp.test.js` (test 14 walks discovery → register → login page → wrong password → code → bad PKCE → token → MCP call as the user → refresh → rejected JWT), and a live probe (`loadtest` function, `{"probe_user_mode":true,…}`) that created a throwaway internal user, signed in, and got `"bot":"user"` from the live bot-api with that user's boards.

Things to keep: claude.ai calls `initialize` per request and may open several sessions at once; the server stays stateless per request (one `McpServer` per request). The 2-second client throttle is per user session, not per server. Supabase Auth password sign-in is enabled (all users have passwords; no SSO). If CREA later moves to SSO, swap the `/authorize` page for a redirect to Supabase's OAuth provider flow; nothing else changes.

### Handover to IT
Admin settings → Connectors → Add custom connector: name `DONE`, URL `https://done-mcp.onrender.com/mcp`, authentication **OAuth** (leave client id/secret blank; discovery and registration are automatic). Test with April's account first: Connect → DONE sign-in page → "Sign in and allow" → ask Claude "who am I in DONE?" and expect her name and role.

## 5. Grok Bot connection (working)
In any Grok Bot chat: "Add a custom remote MCP server named DONE. Type: Remote HTTPS. Server URL: https://done-mcp.onrender.com/mcp . Send the HTTP header x-done-mcp-token with the value <MCP_AUTH_TOKEN from Render>. No OAuth." Approve the card. Connectors are account-wide in Grok.

**Webhooks (not enabled):** `bot_enqueue_event` already queues `task.created`, `task.status_changed`, `task.assigned`, `comment.created` for each key's boards (max 20 events per task per hour, `held` while `webhook_url` is null). To push into a Grok routine: Grok gives a URL `https://api2.cursor.sh/automations/webhook/<id>` and a `crsr_…` key that must be sent as `Authorization: Bearer`. `bot-dispatch` only sends the HMAC header today, so add a per-key bearer secret (vault name in a new `bot_keys.webhook_auth_secret_name`) and send it. Then set `webhook_url` on the `grokbot` key, flip `bot_settings.events_enabled`, and expect a run per event. Held events are never back-filled.

## 6. Performance and the load test

- **Fix applied 11 Oct (`migrations/2026-10-11_fast_task_access_policies.sql`):** the RLS policies on `subtasks`, `task_checklist`, `comments`, `attachments`, `activity_log` called `has_task_access()` per row; reading one board's subtasks scanned 4,119 rows × a security-definer EXISTS = 6.7 s, so the app's subtasks call on every board open hit the 8 s statement timeout. Replaced with `x in (select id from public.tasks)` (hashed subplan; same rows, 0.29 s). Verified equal row counts for two users before applying.
- **Still slow:** the `projects` select policy evaluates `is_ws_member()` / `is_board_member()` etc. per row (≈125 ms for 134 boards) and is re-run inside every tasks query. Caching the allowed-project set per statement (a STABLE function returning uuid[]) would cut ~100 ms from every read.
- **Load test:** `POST https://sknspnorwpoayymvndaz.supabase.co/functions/v1/loadtest` with header `x-loadtest-key` (vault `loadtest_key`) and body `{tag, slot, users≤60, rounds≤5, company_id, workspaces[], boards[]}` creates throwaway `loadtest-…@example.test` internal users (added to the workspaces so RLS shows boards), opens boards concurrently, writes per-round samples to `loadtest_runs`, deletes the users. `{"cleanup":true}` removes leftovers. Fire several slots in parallel with `net.http_post` from SQL. A 300-user run (10 × 30) exceeded the edge function's 150 s idle limit before reporting; run 100 then 200 users first. Do it outside 9:30–18:30 and expect brief slowness for anyone online.
- **Compute:** the DB is on Nano (60 connections, shared CPU). Before 300 concurrent users: Pro plan + Small compute (≈ US$30/mo total), then re-test; Medium is the next step. Also consider paging the biggest boards (`EZ` 9,855 tasks, `VCH` 6,251) instead of loading them whole.

## 7. Known API issues (handoff v2 §11, still open)
Oldest-100 comments on `GET /tasks/:id`; POSTs are not idempotent (a timed-out comment can post twice; the MCP never auto-retries them); a 409 is returned when RLS refuses a PATCH that carried `expected_updated_at` (the MCP detects this by re-reading); the list cursor is a row offset; writes to `formula`/`mirror` fields are accepted (the MCP refuses them); DATE columns come back as `YYYY-MM-DDT00:00:00.000Z` (the MCP normalises; server fix is `::text`).

## 8. Operating notes
- Keys expire after 90 days; `done-mcp` logs a warning at 14 days. No rotation endpoint: insert a new row in `bot_keys` (see the SQL pattern used on 11 Oct: `done_<bot>_<12hex>_<48hex>`, `key_hash = sha256(prefix_secret)`), update Render, revoke the old row.
- Kill switches: `bot_settings.api_enabled` / `events_enabled`.
- Tests: `cd done-mcp && npm test` (mock bot-api + mock Supabase Auth, 14 tests). The repo is public: fixtures stay on `@example.test`, never commit keys.
- From Cowork/Claude sessions, outbound HTTPS to `*.supabase.co` and `*.onrender.com` is blocked; use `net.http_get` via SQL to probe.
