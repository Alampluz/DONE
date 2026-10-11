# done-mcp: DONE for Grok Bots (the monday MCP replacement)

This lets the whole Grok Bot account work DONE tickets the way it worked monday items. One hosted copy, one key (`grokbot`, all boards, full powers), one connector shared by every Bot. There are two ways to connect, both using the same per-bot key:

| You want | Use | Like monday's |
|---|---|---|
| A bot that talks MCP | `done-mcp` (this package) | `@mondaydotcomorg/monday-api-mcp` |
| A bot that calls HTTP APIs or imports OpenAPI | `openapi.yaml` → bot-api | monday GraphQL API |

## monday → DONE cheat-sheet

| monday | DONE | MCP tool |
|---|---|---|
| Board | Board (`project_id`) | `done_list_boards` (search by name or key) |
| Group | Group (`group_id`) | `done_update_task` (`group_id`) |
| Item | Task / ticket (`task_id`, `ticket_no` e.g. `GWP-261002-014`) | `done_get_task` |
| `get_board_items_page` | list / search tickets | `done_list_tasks` |
| `get_board_items_page` / `get_board_info` (columns) | fields come back with every ticket | `done_get_task` → `fields[]` |
| `change_item_column_values` | custom fields by **label**, plus status / priority / assignee / due date | `done_update_task` |
| Status column | `status`: todo · in_progress · review · blocked · done | `done_set_status` |
| `create_update` | comment | `done_add_comment` |
| `create_item` | create ticket (only for keys with `tasks:create`) | `done_create_task` |
| `list_users_and_teams` | find staff by name or email, or ids → names | `done_find_people` |
| `delete_item` | *not available to bots, by design* | — |

## Setup

You need Node 20+ and a DONE bot key (a DONE admin issues it; keep it secret).

**Option A: local / desktop MCP client (stdio).** Like monday's `npx … -t <token>`, but the key goes in an env var, never on the command line:
```json
{
  "mcpServers": {
    "done": {
      "command": "node",
      "args": ["C:/Users/April/WorkOS/done-mcp/src/index.js"],
      "env": { "DONE_BOT_KEY": "done_cuspyy_…" }
    }
  }
}
```
Run `npm install` once in the `done-mcp` folder first.

**Option B: hosted, for Grok Bot (it runs in Grok's app, so it needs a public HTTPS URL).**

*Deploy on Render (about 5 minutes):*
1. Push this folder to a Git repo, then in Render choose **New → Blueprint** and pick it. `render.yaml` sets everything up (Singapore region, health check).
2. When asked, paste the bot key into `DONE_BOT_KEY`. Render generates `MCP_AUTH_TOKEN` for you.
3. After deploy, open `https://<service>.onrender.com/health`; it should say `{"ok":true,"bot":"cuspyy"}`.

*More bot profiles.* Any `DONE_BOT_KEY_<NAME>` + `MCP_AUTH_TOKEN_<NAME>` env pair adds another key-based profile on the same server.

**Option C: Claude (claude.ai), with each person's own DONE sign-in.** Claude users do not share a bot key. The server is also an OAuth 2.1 authorization server backed by Supabase Auth: when someone adds the DONE connector in Claude, they get a DONE sign-in page (email + password, the same as the app), and every tool then runs as *that person* with their DONE role and RLS; the activity log and comments carry their name. Nothing is stored on the server (codes and refresh tokens are sealed with `MCP_OAUTH_SECRET`), and sessions are refreshed through Supabase.

It switches on when these env vars are set (`render.yaml` already does this): `MCP_OAUTH_SECRET` (32+ random chars; Render generates it), `DONE_SUPABASE_URL`, `DONE_SUPABASE_ANON_KEY` (the public anon key, not the service key) and a public URL (`RENDER_EXTERNAL_URL` is picked up automatically; otherwise set `MCP_PUBLIC_URL`). `GET /health` then shows `"user_signin": true`.

*Connect Claude:* an org owner adds it once for everyone: claude.ai → Admin settings → Connectors → Add custom connector → name `DONE`, URL `https://<service>.onrender.com/mcp`, authentication OAuth (discovery is automatic; no client id or secret). Each person then clicks Connect on the DONE connector, signs in with their DONE account and gets only what their DONE role allows. Removing the connector in Claude revokes it.

*Connect Grok Bot:* in Grok, add a custom MCP server:
- **Type:** Remote HTTPS
- **Server URL:** `https://<service>.onrender.com/mcp`
- **HTTP headers:** key `x-done-mcp-token`, value = the `MCP_AUTH_TOKEN` from Render (Environment tab)
- OAuth fields: leave empty

Connectors are account-wide in Grok, so every Bot on the account sees the DONE tools once added.

*Run it anywhere else:*
```bash
npm install
DONE_BOT_KEY=done_cuspyy_… \
MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
MCP_TRANSPORT=http PORT=8787 node src/index.js
```
- Point the bot at `https://<your-host>/mcp` with header `Authorization: Bearer <MCP_AUTH_TOKEN>`.
- `GET /health` is a liveness check.
- It needs to run somewhere with HTTPS (Render, Fly, a VM). One process per bot key.
- `MCP_AUTH_TOKEN` protects the endpoint. Without it, anyone with the URL could act as the bot, so it refuses to start without 32+ characters.

| Env var | Default | Meaning |
|---|---|---|
| `DONE_BOT_KEY` | required | the bot's key |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `MCP_AUTH_TOKEN` | required for http | bearer token the bot must send |
| `PORT` | `8787` | http port |
| `DONE_API_BASE` | live bot-api | override for testing |
| `DONE_REGION` | `ap-southeast-1` | sent as `x-region` (about 3 s per call instead of about 8 s) |
| `DONE_MIN_INTERVAL_MS` | `2000` | client throttle |

## What the server enforces (so the bot can't get it wrong)
- **Tools come from the key.** On startup it calls `/whoami` and registers only the tools the key's scopes allow. Statuses the bot may not set (CUSPyy: `done`) are left out of the choices entirely.
- **Allowlist.** It refuses writes to read-only boards before calling DONE.
- **Locking.** Every update is locked to the version last read. If someone changed the ticket, the bot gets the fresh ticket back and decides again.
- **Fields by label.** `{"Platform": "Lazada"}` is mapped to the field id. Unknown or ambiguous labels, bad dropdown options, wrong types and computed (`formula` / `mirror`) fields are refused with a clear message listing the valid choices.
- **No duplicate comments.** Comments and creates are never auto-retried after a failure. Reads and locked updates retry once.
- **Rate limits.** One call at a time, at most one every 2 s, and it waits out `429 Retry-After`.
- **The key is never logged or returned.** The server warns when the key has less than 14 days left.

## Keys
| Key | Boards | Powers | Use |
|---|---|---|---|
| `grokbot` (GrokBot) | every board the bot user can see, now and future | read, update, comment, create, close | the Grok Bot account |
| `cuspyy` (CUSPyy) | writes the test board, reads the real GWP board, cannot close | the original pilot; keep for testing or revoke |

Each key runs as DONE user `Agent.ops@crea.asia`; the activity log records which key acted (`via_bot`) and comments carry the `[GrokBot]` prefix. Keys expire after 90 days; the server warns at 14.

## A ticket flow, end to end (GWP example)
0. **Find the board.** `done_list_boards {query:"GWP"}` → the board's `project_id`.
1. **Find new work.** `done_list_tasks {project_id, status:"todo", updated_since:<last check>}`. Later this can be a webhook push instead of polling.
2. **Read it.** `done_get_task {task_id}` gives the description, fields (Platform, Request For, Start/End Date…), and comments.
3. **Pick it up.** `done_set_status {task_id, status:"in_progress"}`
4. **Talk to the requester.** `done_find_people {query:"<Requester email>"}` gives their id, to use in `mentions` or `assignee_id`.
5. **Do the work** in CUSP, then record it with `done_update_task {task_id, fields:{"Total number of Mechanic Setups":3}}`.
6. **Report.** `done_add_comment {task_id, body:"Mechanics set up in CUSP: 3 tiers, live 14 Oct."}`
7. **Hand back.** `done_set_status {task_id, status:"review"}`. The requester gets the in-app notification and a human closes the ticket.

## Tests
`npm test` runs 14 tests against a mock bot-api (and a mock Supabase Auth), covering tool registration from scopes, label mapping, refusals, conflict handling, people lookup, date format, the no-retry rule for comments, throttling, HTTP auth, and the full OAuth sign-in flow (discovery, registration, login page, PKCE, token exchange, refresh).
