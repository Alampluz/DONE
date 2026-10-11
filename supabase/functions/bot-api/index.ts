// bot-api: lets Grok Bots read/write DONE tickets with a per-bot key.
// Every data query runs inside ONE transaction as the bot's own DONE user
// (SET LOCAL ROLE authenticated + request.jwt.claims.sub), so RLS, triggers and
// activity_log treat it like a human. app.via_bot stamps which bot did it.
// Auth: Authorization: Bearer done_<bot>_<prefix12hex>_<secret48hex>
// v4 (11 Oct 2026): GET /people — find active staff by name/email, or resolve ids.
// v5 (11 Oct 2026): bot_keys.all_boards (whole-account bots) + GET /boards.
// v6 (11 Oct 2026): user mode. A Supabase user JWT as the bearer runs everything as THAT user
//   (their RLS, their name in the activity log, no [bot] prefix); used by the Claude per-user sign-in.
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 4, prepare: false, idle_timeout: 20, connect_timeout: 10 });

const STATUSES = ["todo", "in_progress", "review", "blocked", "done"];
const PRIORITIES = ["urgent", "high", "normal", "low"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY_RE = /^Bearer\s+(done_[a-z0-9-]{2,32}_[0-9a-f]{12})_([0-9a-f]{48})$/;
const JWT_RE = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const TASK_COLS = "t.id, t.ticket_no, t.title, t.status, t.priority, t.assignee_id, t.due_date, t.group_id, t.project_id, t.custom, t.updated_at, t.created_at";

class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string, public extra: Record<string, string> = {}) { super(message || code); }
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

async function sha256hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

type Key = {
  id: string; bot_name: string; display_name: string; bot_user_id: string | null; pending_email: string | null;
  key_hash: string; scopes: string[]; project_ids: string[]; read_project_ids: string[];
  all_boards: boolean; suppress_email: boolean; deny_statuses: string[]; rate_per_min: number; write_per_min: number;
  enabled: boolean; revoked_at: string | null; expires_at: string;
  user?: { id: string; email: string; role: string; full_name: string };  // set in user mode
};

// User mode: validate the JWT with GoTrue (no JWT secret needed in the function), then
// build a Key-shaped object so every route below works unchanged.
async function authenticateUser(jwt: string): Promise<Key> {
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` } });
  if (!r.ok) throw new ApiError(401, "invalid_token", "Sign-in expired or invalid");
  const u = await r.json();
  const [p] = await sql`select id, email, role, active, coalesce(full_name, '') as full_name from public.profiles where id = ${u.id}`;
  if (!p || !p.active) throw new ApiError(403, "forbidden_by_rls", "No active DONE profile for this user");
  let exp = new Date(Date.now() + 3600_000).toISOString();
  try { exp = new Date(JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000).toISOString(); } catch { /* */ }
  return {
    id: p.id, bot_name: "", display_name: p.full_name || p.email, bot_user_id: p.id, pending_email: null, key_hash: "",
    scopes: ["tasks:read", "tasks:write", "tasks:create", "comments:write"], project_ids: [], read_project_ids: [], all_boards: true,
    suppress_email: false, deny_statuses: [], rate_per_min: 120, write_per_min: 40, enabled: true, revoked_at: null, expires_at: exp,
    user: { id: p.id, email: p.email, role: p.role, full_name: p.full_name },
  };
}

async function authenticate(req: Request): Promise<Key> {
  const auth = req.headers.get("authorization") || "";
  const j = auth.match(JWT_RE);
  if (j) return await authenticateUser(j[1]);
  const m = auth.match(KEY_RE);
  if (!m) throw new ApiError(401, "invalid_key", "Missing or malformed bot key");
  const [k] = await sql<Key[]>`select * from public.bot_keys where key_prefix = ${m[1]}`;
  const hash = await sha256hex(`${m[1]}_${m[2]}`);
  if (!k || !safeEq(hash, k.key_hash)) throw new ApiError(401, "invalid_key", "Unknown bot key");
  if (k.revoked_at) throw new ApiError(401, "key_revoked");
  if (!k.enabled) throw new ApiError(401, "key_disabled");
  if (new Date(k.expires_at) <= new Date()) throw new ApiError(401, "key_expired");
  return k;
}

function needScope(k: Key, s: string) {
  if (!k.scopes.includes(s)) throw new ApiError(403, "missing_scope", `Key lacks scope ${s}`);
}
const canRead = (k: Key, pid: string) => k.all_boards || k.project_ids.includes(pid) || k.read_project_ids.includes(pid);
const canWrite = (k: Key, pid: string) => k.all_boards || k.project_ids.includes(pid);

// Allowlist is enforced BEFORE RLS, from the task's board id only.
async function boardOfTask(id: string): Promise<string> {
  const [r] = await sql`select project_id from public.tasks where id = ${id}`;
  if (!r) throw new ApiError(404, "not_found", "Task not found");
  return r.project_id as string;
}

function requireUser(k: Key) {
  if (!k.bot_user_id) throw new ApiError(503, "bot_user_pending",
    `Bot user ${k.pending_email || "(unset)"} is not linked to key '${k.bot_name}' yet`);
}

const userHits = new Map<string, { minute: number; n: number }>();
async function rateLimit(k: Key, write: boolean) {
  if (k.user) { // per-user, in-memory (per isolate); generous: users are interactive
    const minute = Math.floor(Date.now() / 60000);
    const h = userHits.get(k.id);
    const n = h && h.minute === minute ? h.n + 1 : 1;
    userHits.set(k.id, { minute, n });
    if (n > k.rate_per_min) throw new ApiError(429, "rate_limited", "Too many requests", { "Retry-After": String(60 - new Date().getSeconds()) });
    return;
  }
  const [u] = await sql`
    insert into public.bot_usage (key_id, minute, reads, writes)
    values (${k.id}, date_trunc('minute', now()), ${write ? 0 : 1}, ${write ? 1 : 0})
    on conflict (key_id, minute) do update
      set reads = public.bot_usage.reads + excluded.reads, writes = public.bot_usage.writes + excluded.writes
    returning reads, writes, 60 - extract(second from now())::int as retry`;
  const over = write ? u.writes > k.write_per_min : (u.reads + u.writes) > k.rate_per_min;
  if (over) throw new ApiError(429, "rate_limited", "Too many requests", { "Retry-After": String(Math.max(1, u.retry)) });
  if (Math.random() < 0.01) sql`delete from public.bot_usage where minute < now() - interval '1 day'`.catch(() => {});
  sql`update public.bot_keys set last_used_at = now() where id = ${k.id}`.catch(() => {});
}

// deno-lint-ignore no-explicit-any
async function asBot<T>(k: Key, suppressEmail: boolean, fn: (tx: any) => Promise<T>): Promise<T> {
  // deno-lint-ignore no-explicit-any
  return await sql.begin(async (tx: any) => {
    const claims = JSON.stringify(k.user ? { sub: k.bot_user_id, role: "authenticated", email: k.user.email } : { sub: k.bot_user_id, role: "authenticated", via_bot: k.bot_name });
    await tx`select set_config('request.jwt.claims', ${claims}, true),
                    set_config('request.jwt.claim.sub', ${k.bot_user_id}, true),
                    set_config('request.jwt.claim.role', 'authenticated', true),
                    set_config('app.via_bot', ${k.user ? "" : k.bot_name}, true),
                    set_config('app.suppress_email', ${suppressEmail ? "on" : "off"}, true)`;
    await tx`set local role authenticated`;
    const [w] = await tx`select auth.uid()::text as uid, current_user::text as cu`;
    if (w.uid !== k.bot_user_id || w.cu !== "authenticated") throw new ApiError(500, "identity_check_failed");
    return await fn(tx);
  });
}

// deno-lint-ignore no-explicit-any
async function validateCustom(tx: any, pid: string, custom: unknown) {
  if (custom === undefined) return null;
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) throw new ApiError(400, "bad_custom", "custom must be an object");
  const fields = await tx`select id::text, label, ftype, options from public.project_fields where project_id = ${pid}`;
  // deno-lint-ignore no-explicit-any
  const byId = new Map(fields.map((f: any) => [f.id, f]));
  for (const [fid, v] of Object.entries(custom as Record<string, unknown>)) {
    // deno-lint-ignore no-explicit-any
    const f: any = byId.get(fid);
    if (!f) throw new ApiError(400, "unknown_field", `Field ${fid} is not on this board`);
    if (v !== null && !["string", "number", "boolean"].includes(typeof v)) throw new ApiError(400, "bad_value", `Bad value for ${f.label}`);
    if (f.ftype === "select" && v !== null && Array.isArray(f.options) && f.options.length && f.options.every((o: unknown) => typeof o === "string")
        && !f.options.includes(v)) throw new ApiError(400, "bad_option", `"${v}" is not an option of ${f.label}`);
    if (f.ftype === "number" && v !== null && typeof v !== "number") throw new ApiError(400, "bad_value", `${f.label} must be a number`);
    if (f.ftype === "date" && v !== null && !(typeof v === "string" && DATE.test(v))) throw new ApiError(400, "bad_value", `${f.label} must be YYYY-MM-DD`);
  }
  return custom as Record<string, unknown>;
}

async function readBody(req: Request) {
  try { return await req.json(); } catch { throw new ApiError(400, "bad_json", "Body must be JSON"); }
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("bot-api");
  const p = i >= 0 ? parts.slice(i + 1) : parts;

  const [s] = await sql`select api_enabled from public.bot_settings where id = 1`;
  if (!s?.api_enabled) throw new ApiError(503, "api_disabled", "bot-api is switched off");

  const k = await authenticate(req);

  // GET /whoami
  if (req.method === "GET" && p[0] === "whoami" && p.length === 1) {
    return json(200, { bot: k.user ? "user" : k.bot_name, display_name: k.display_name, user_linked: !!k.bot_user_id,
      scopes: k.scopes, deny_statuses: k.deny_statuses, all_boards: !!k.all_boards,
      write_boards: k.project_ids, read_boards: k.read_project_ids, expires_at: k.expires_at,
      ...(k.user ? { user: k.user } : {}) });
  }

  // GET /boards?q=  — boards this bot may use (all_boards keys: every live board RLS lets the bot see).
  if (req.method === "GET" && p[0] === "boards" && p.length === 1) {
    needScope(k, "tasks:read");
    requireUser(k);
    await rateLimit(k, false);
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length > 100) throw new ApiError(400, "bad_input", "q is too long");
    const like = q ? "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%" : null;
    const allowed = k.all_boards ? null : [...new Set([...k.project_ids, ...k.read_project_ids])].join(",");
    const rows = await asBot(k, true, (tx) => tx`
      select pr.id, pr.key, pr.name, pr.description, w.name as workspace,
             (${k.all_boards} or pr.id = any(string_to_array(${k.project_ids.join(",")}, ',')::uuid[])) as writable,
             (select count(*) from public.tasks t where t.project_id = pr.id and t.archived_at is null)::int as open_tasks
      from public.projects pr left join public.workspaces w on w.id = pr.workspace_id
      where pr.archived_at is null
        and (${allowed}::text is null or pr.id = any(string_to_array(${allowed ?? ""}, ',')::uuid[]))
        and (${like}::text is null or pr.name ilike ${like} or pr.key ilike ${like})
      order by w.name nulls last, pr.name limit 200`);
    return json(200, { boards: rows });
  }

  // GET /people?q=<name or email>&limit=  |  GET /people?ids=<uuid,uuid>
  // Active internal staff only (no partners), and only id/name/email/job_title.
  if (req.method === "GET" && p[0] === "people" && p.length === 1) {
    needScope(k, "tasks:read");
    const q = (url.searchParams.get("q") || "").trim();
    const idsRaw = (url.searchParams.get("ids") || "").trim();
    const ids = idsRaw ? idsRaw.split(",").map((x) => x.trim()).filter(Boolean) : [];
    if (!q && !ids.length) throw new ApiError(400, "bad_input", "Give q (name or email, 2+ characters) or ids");
    if (q && q.length < 2) throw new ApiError(400, "bad_input", "q must be at least 2 characters");
    if (q.length > 100) throw new ApiError(400, "bad_input", "q is too long");
    if (ids.length > 50 || !ids.every((x) => UUID.test(x))) throw new ApiError(400, "bad_input", "ids: up to 50 comma-separated uuids");
    requireUser(k);
    await rateLimit(k, false);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20") || 20, 1), 50);
    const like = q ? "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%" : null;
    const rows = await asBot(k, true, (tx) => tx`
      select p.id, p.full_name, p.email, p.job_title from public.profiles p
      where p.active and p.role in ('internal', 'admin')
        and (${ids.length ? ids.join(",") : null}::text is null or p.id = any(string_to_array(${ids.join(",")}, ',')::uuid[]))
        and (${like}::text is null or p.full_name ilike ${like} or p.email ilike ${like})
      order by (lower(p.email) = lower(${q})) desc, (lower(p.full_name) = lower(${q})) desc, p.full_name nulls last
      limit ${ids.length ? 50 : limit}`);
    return json(200, { people: rows });
  }

  // GET /tasks
  if (req.method === "GET" && p[0] === "tasks" && p.length === 1) {
    needScope(k, "tasks:read");
    const pid = url.searchParams.get("project_id");
    if (pid && (!UUID.test(pid) || !canRead(k, pid))) throw new ApiError(403, "board_not_allowed");
    requireUser(k);
    await rateLimit(k, false);
    const pids = pid ? [pid] : k.all_boards ? null : [...new Set([...k.project_ids, ...k.read_project_ids])];
    const status = url.searchParams.get("status");
    if (status && !STATUSES.includes(status)) throw new ApiError(400, "bad_status");
    const q = url.searchParams.get("q");
    const since = url.searchParams.get("updated_since");
    const mine = url.searchParams.get("assignee") === "me";
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50") || 50, 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get("cursor") || "0") || 0, 0);
    const like = q ? "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%" : null;
    const rows = await asBot(k, true, (tx) => tx`
      select ${tx.unsafe(TASK_COLS)} from public.tasks t
      where (${pids === null} or t.project_id = any(string_to_array(${pids ? pids.join(",") : ""}, ',')::uuid[])) and t.archived_at is null
        and (${status}::text is null or t.status = ${status})
        and (${mine} = false or t.assignee_id = auth.uid())
        and (${like}::text is null or t.title ilike ${like} or t.ticket_no ilike ${like})
        and (${since}::timestamptz is null or t.updated_at > ${since}::timestamptz)
      order by t.updated_at desc, t.id limit ${limit + 1} offset ${offset}`);
    const more = rows.length > limit;
    return json(200, { items: rows.slice(0, limit), next_cursor: more ? String(offset + limit) : null });
  }

  // GET /tasks/:id
  if (req.method === "GET" && p[0] === "tasks" && p.length === 2) {
    needScope(k, "tasks:read");
    if (!UUID.test(p[1])) throw new ApiError(400, "bad_id");
    const pid = await boardOfTask(p[1]);
    if (!canRead(k, pid)) throw new ApiError(403, "board_not_allowed");
    requireUser(k);
    await rateLimit(k, false);
    return json(200, await asBot(k, true, async (tx) => {
      const [task] = await tx`select ${tx.unsafe(TASK_COLS)}, t.description, t.start_date, t.tags from public.tasks t where t.id = ${p[1]}`;
      if (!task) throw new ApiError(404, "not_found", "Task not visible to this bot");
      const fields = await tx`select id, label, ftype, options, position from public.project_fields where project_id = ${pid} order by position`;
      const groups = await tx`select id, name, position from public.project_groups where project_id = ${pid} order by position`;
      const comments = await tx`select id, author_id, body, created_at from public.comments
                                where entity_type = 'task' and entity_id = ${p[1]} and deleted_at is null order by created_at limit 100`;
      return { task, fields, groups, comments };
    }));
  }

  // PATCH /tasks/:id
  if (req.method === "PATCH" && p[0] === "tasks" && p.length === 2) {
    needScope(k, "tasks:write");
    if (!UUID.test(p[1])) throw new ApiError(400, "bad_id");
    const pid = await boardOfTask(p[1]);
    if (!canWrite(k, pid)) throw new ApiError(403, "board_not_allowed", "This bot may not write to that board");
    requireUser(k);
    const b = await readBody(req);
    const has = (f: string) => Object.prototype.hasOwnProperty.call(b, f);
    if (has("status") && !STATUSES.includes(b.status)) throw new ApiError(400, "bad_status");
    if (has("status") && (k.deny_statuses || []).includes(b.status))
      throw new ApiError(403, "status_not_allowed", `This bot may not set status '${b.status}'`);
    if (has("priority") && !PRIORITIES.includes(b.priority)) throw new ApiError(400, "bad_priority");
    if (has("assignee_id") && b.assignee_id !== null && !UUID.test(b.assignee_id)) throw new ApiError(400, "bad_assignee");
    if (has("due_date") && b.due_date !== null && !DATE.test(b.due_date)) throw new ApiError(400, "bad_due_date");
    if (has("group_id") && !UUID.test(b.group_id)) throw new ApiError(400, "bad_group");
    if (!["status", "priority", "assignee_id", "due_date", "group_id", "custom"].some(has)) throw new ApiError(400, "nothing_to_update");
    await rateLimit(k, true);
    return json(200, await asBot(k, k.suppress_email, async (tx) => {
      const custom = await validateCustom(tx, pid, b.custom);
      if (has("assignee_id") && b.assignee_id) {
        const [a] = await tx`select 1 from public.profiles where id = ${b.assignee_id} and active`;
        if (!a) throw new ApiError(400, "bad_assignee", "Assignee not found or inactive");
      }
      if (has("group_id")) {
        const [g] = await tx`select 1 from public.project_groups where id = ${b.group_id} and project_id = ${pid}`;
        if (!g) throw new ApiError(400, "bad_group", "Group is not on this board");
      }
      const exp = b.expected_updated_at ?? null;
      const rows = await tx`
        update public.tasks t set updated_at = now()
          ${has("status") ? tx`, status = ${b.status}` : tx``}
          ${has("priority") ? tx`, priority = ${b.priority}` : tx``}
          ${has("assignee_id") ? tx`, assignee_id = ${b.assignee_id}` : tx``}
          ${has("due_date") ? tx`, due_date = ${b.due_date}` : tx``}
          ${has("group_id") ? tx`, group_id = ${b.group_id}` : tx``}
          ${custom ? tx`, custom = t.custom || (${JSON.stringify(custom)}::text)::jsonb` : tx``}
        where t.id = ${p[1]}
          and (${exp}::timestamptz is null or date_trunc('milliseconds', t.updated_at) = date_trunc('milliseconds', ${exp}::timestamptz))
        returning ${tx.unsafe(TASK_COLS)}`;
      if (rows.length) return { task: rows[0] };
      const [cur] = await tx`select updated_at from public.tasks where id = ${p[1]}`;
      if (!cur) throw new ApiError(404, "not_found", "Task not visible to this bot");
      if (exp) throw new ApiError(409, "conflict", `Task changed since ${exp}; current updated_at is ${new Date(cur.updated_at).toISOString()}`);
      throw new ApiError(403, "forbidden_by_rls", "RLS refused the update");
    }));
  }

  // POST /tasks/:id/comments
  if (req.method === "POST" && p[0] === "tasks" && p.length === 3 && p[2] === "comments") {
    needScope(k, "comments:write");
    if (!UUID.test(p[1])) throw new ApiError(400, "bad_id");
    const pid = await boardOfTask(p[1]);
    if (!canWrite(k, pid)) throw new ApiError(403, "board_not_allowed", "This bot may not write to that board");
    requireUser(k);
    const b = await readBody(req);
    if (typeof b.body !== "string" || !b.body.trim() || b.body.length > 5000) throw new ApiError(400, "bad_body", "body: 1-5000 chars");
    const mentions: string[] = Array.isArray(b.mentions) ? b.mentions : [];
    if (mentions.length > 20 || !mentions.every((m) => typeof m === "string" && UUID.test(m))) throw new ApiError(400, "bad_mentions");
    await rateLimit(k, true);
    return json(201, await asBot(k, !k.user /* bot comments never e-mail staff; user comments behave like the app */, async (tx) => {
      const [c] = await tx`
        insert into public.comments (entity_type, entity_id, author_id, body, mentions)
        values ('task', ${p[1]}, auth.uid(), ${k.user ? b.body.trim() : `[${k.display_name}] ${b.body.trim()}`}, string_to_array(${mentions.join(",")}, ',')::uuid[])
        returning id, entity_id as task_id, author_id, body, mentions, created_at`;
      return { comment: c };
    }));
  }

  // POST /tasks
  if (req.method === "POST" && p[0] === "tasks" && p.length === 1) {
    needScope(k, "tasks:create");
    const b = await readBody(req);
    if (typeof b.project_id !== "string" || !UUID.test(b.project_id)) throw new ApiError(400, "bad_project");
    if (!canWrite(k, b.project_id)) throw new ApiError(403, "board_not_allowed", "This bot may not write to that board");
    requireUser(k);
    if (typeof b.title !== "string" || !b.title.trim() || b.title.length > 300) throw new ApiError(400, "bad_title", "title: 1-300 chars");
    if (b.description !== undefined && (typeof b.description !== "string" || b.description.length > 20000)) throw new ApiError(400, "bad_description");
    const status = b.status ?? "todo", priority = b.priority ?? "normal";
    if (!STATUSES.includes(status)) throw new ApiError(400, "bad_status");
    if ((k.deny_statuses || []).includes(status)) throw new ApiError(403, "status_not_allowed", `This bot may not set status '${status}'`);
    if (!PRIORITIES.includes(priority)) throw new ApiError(400, "bad_priority");
    if (b.due_date != null && !DATE.test(b.due_date)) throw new ApiError(400, "bad_due_date");
    if (b.group_id != null && !UUID.test(b.group_id)) throw new ApiError(400, "bad_group");
    await rateLimit(k, true);
    return json(201, await asBot(k, k.suppress_email, async (tx) => {
      const custom = (await validateCustom(tx, b.project_id, b.custom)) || {};
      let gid = b.group_id ?? null;
      if (gid) {
        const [g] = await tx`select 1 from public.project_groups where id = ${gid} and project_id = ${b.project_id}`;
        if (!g) throw new ApiError(400, "bad_group", "Group is not on this board");
      } else {
        const [g] = await tx`select id from public.project_groups where project_id = ${b.project_id} order by position limit 1`;
        gid = g?.id ?? null;
      }
      const [t] = await tx`
        insert into public.tasks as t (project_id, group_id, title, description, status, priority, due_date, custom, created_by, position)
        values (${b.project_id}, ${gid}, ${b.title.trim()}, ${b.description ?? ""}, ${status}, ${priority}, ${b.due_date ?? null},
                (${JSON.stringify(custom)}::text)::jsonb, auth.uid(),
                coalesce((select max(position) from public.tasks where project_id = ${b.project_id}), 0) + 1)
        returning ${tx.unsafe(TASK_COLS)}`;
      return { task: t };
    }));
  }

  throw new ApiError(404, "unknown_route", `${req.method} /${p.join("/")}`);
}

Deno.serve(async (req: Request) => {
  const t0 = Date.now();
  let status = 500, bot = "-";
  try {
    const res = await handle(req);
    status = res.status;
    return res;
  } catch (e) {
    if (e instanceof ApiError) { status = e.status; return json(e.status, { error: e.message, code: e.code }, e.extra); }
    // deno-lint-ignore no-explicit-any
    const pe = e as any;
    const map: Record<string, [number, string]> = {
      "42501": [403, "forbidden_by_rls"], "P0001": [422, "rejected_by_rule"], "23514": [400, "constraint_violation"],
      "22P02": [400, "bad_input"], "22007": [400, "bad_input"], "22008": [400, "bad_input"], "23503": [400, "bad_reference"],
    };
    const m = pe?.code && map[pe.code];
    if (m) { status = m[0]; return json(m[0], { error: pe.message, code: m[1] }); }
    console.error("bot-api internal error", pe?.code, pe?.message);
    return json(500, { error: "Internal error", code: "internal" });
  } finally {
    try { bot = (req.headers.get("authorization") || "").match(/done_([a-z0-9-]+)_/)?.[1] || (JWT_RE.test(req.headers.get("authorization") || "") ? "user" : "-"); } catch { /* */ }
    console.log(JSON.stringify({ fn: "bot-api", bot, method: req.method, path: new URL(req.url).pathname, status, ms: Date.now() - t0 }));
  }
});
