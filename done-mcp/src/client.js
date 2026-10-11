// DONE bot-api client. All safety rules from the handoff live here, so every
// caller (MCP tools, scripts) gets them: throttle, retry policy, optimistic
// locking, allowlist + deny_statuses checks, label→field-id mapping.

export const DEFAULT_BASE = "https://sknspnorwpoayymvndaz.supabase.co/functions/v1/bot-api";
export const STATUSES = ["todo", "in_progress", "review", "blocked", "done"];
export const PRIORITIES = ["urgent", "high", "normal", "low"];
const KEY_RE = /^done_[a-z0-9-]{2,32}_[0-9a-f]{12}_[0-9a-f]{48}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COMPUTED = new Set(["formula", "mirror"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// bot-api v3/v4 returns DATE columns as midnight-UTC timestamps; give callers YYYY-MM-DD.
const DATE_KEYS = ["due_date", "start_date"];
export function normTask(t) {
  if (!t || typeof t !== "object") return t;
  for (const k of DATE_KEYS) if (typeof t[k] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(t[k])) t[k] = t[k].slice(0, 10);
  return t;
}

export class DoneError extends Error {
  constructor(status, code, message, retryAfter = null) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
  toJSON() { return { status: this.status, code: this.code, error: this.message }; }
}

export class DoneClient {
  constructor({
    key,
    bearer,          // a signed-in user's Supabase JWT (bot-api v6 user mode) instead of a bot key
    base = DEFAULT_BASE,
    region = "ap-southeast-1",
    minIntervalMs = 2000,
    timeoutMs = 45000,
    retryDelayMs = 1500,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (bearer) { this.#key = bearer; this.userMode = true; }
    else {
      if (!key || !KEY_RE.test(key)) throw new Error("DONE_BOT_KEY is missing or malformed (expected done_<bot>_<12hex>_<48hex>)");
      this.#key = key;
    }
    this.base = base.replace(/\/+$/, "");
    this.region = region;
    this.minIntervalMs = minIntervalMs;
    this.timeoutMs = timeoutMs;
    this.retryDelayMs = retryDelayMs;
    this.fetch = fetchImpl;
    this.queue = Promise.resolve();
    this.lastCallAt = 0;
    this.me = null;
    this.meAt = 0;
    this.tasks = new Map();   // task_id -> { updated_at, project_id }
    this.fields = new Map();  // project_id -> { at, list }
  }

  #key;

  // ---------- transport ----------

  // One call in flight at a time, at most one call per minIntervalMs.
  #serial(fn) {
    const run = this.queue.then(async () => {
      const wait = this.lastCallAt + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      try { return await fn(); } finally { this.lastCallAt = Date.now(); }
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async #once(method, path, { query, body } = {}) {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    const headers = { Authorization: `Bearer ${this.#key}`, Accept: "application/json" };
    if (this.region) headers["x-region"] = this.region;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
    } catch (e) {
      throw new DoneError(0, e?.name === "AbortError" ? "timeout" : "network", e?.name === "AbortError" ? `No response after ${this.timeoutMs / 1000}s` : "Network error reaching bot-api");
    } finally { clearTimeout(timer); }
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const ra = Number(res.headers.get("retry-after"));
      throw new DoneError(res.status, data?.code || `http_${res.status}`, data?.error || `HTTP ${res.status}`, Number.isFinite(ra) && ra > 0 ? ra : null);
    }
    return data;
  }

  // retryable=true only for calls that are safe to repeat (reads, locked PATCH).
  async request(method, path, opts = {}, retryable = method === "GET") {
    try {
      return await this.#serial(() => this.#once(method, path, opts));
    } catch (e) {
      if (!(e instanceof DoneError)) throw e;
      if (e.status === 429) {
        // Not processed by the server, so a retry is safe even for writes.
        await sleep(Math.min(e.retryAfter ?? 5, 60) * 1000);
        return await this.#serial(() => this.#once(method, path, opts));
      }
      if (retryable && (e.status >= 500 && e.code !== "api_disabled" && e.code !== "bot_user_pending" || e.code === "timeout" || e.code === "network")) {
        await sleep(this.retryDelayMs);
        return await this.#serial(() => this.#once(method, path, opts));
      }
      throw e;
    }
  }

  // ---------- identity ----------

  async whoami(force = false) {
    if (!force && this.me && Date.now() - this.meAt < 5 * 60_000) return this.me;
    this.me = await this.request("GET", "/whoami");
    this.meAt = Date.now();
    return this.me;
  }

  daysToExpiry() {
    return this.me ? Math.floor((new Date(this.me.expires_at) - Date.now()) / 86_400_000) : null;
  }

  #canRead(pid) { return !!this.me.all_boards || this.me.write_boards.includes(pid) || this.me.read_boards.includes(pid); }
  #canWrite(pid) { return !!this.me.all_boards || this.me.write_boards.includes(pid); }
  canWriteAny() { return !!this.me?.all_boards || (this.me?.write_boards || []).length > 0; }
  #need(scope) {
    if (!this.me.scopes.includes(scope)) throw new DoneError(403, "missing_scope", `This bot key lacks scope ${scope}`);
  }

  // ---------- reads ----------

  async listTasks({ project_id, status, assigned_to_me, query, updated_since, limit, cursor } = {}) {
    await this.whoami();
    if (project_id && !this.#canRead(project_id)) throw new DoneError(403, "board_not_allowed", "That board is not on this bot's allowlist");
    if (status && !STATUSES.includes(status)) throw new DoneError(400, "bad_status", `status must be one of ${STATUSES.join(", ")}`);
    const r = await this.request("GET", "/tasks", {
      query: { project_id, status, assignee: assigned_to_me ? "me" : undefined, q: query, updated_since, limit, cursor },
    });
    for (const t of r.items || []) { normTask(t); this.tasks.set(t.id, { updated_at: t.updated_at, project_id: t.project_id }); }
    return r;
  }

  async getTask(task_id) {
    if (!UUID.test(task_id)) throw new DoneError(400, "bad_id", "task_id must be a uuid");
    await this.whoami();
    const r = await this.request("GET", `/tasks/${task_id}`);
    normTask(r.task);
    this.tasks.set(task_id, { updated_at: r.task.updated_at, project_id: r.task.project_id });
    this.fields.set(r.task.project_id, { at: Date.now(), list: r.fields || [] });
    const comments_truncated = (r.comments || []).length >= 100;
    return {
      ...r,
      comments_truncated,
      ...(comments_truncated ? { note: "Only the OLDEST 100 comments are returned; newer replies are not visible." } : {}),
    };
  }

  // Boards this bot may use (name, key, workspace, writable, open task count).
  async listBoards({ query } = {}) {
    await this.whoami();
    this.#need("tasks:read");
    return await this.request("GET", "/boards", { query: { q: query || undefined } });
  }

  // Find active CREA staff by name or email (q), or resolve profile ids to names (ids).
  async findPeople({ query, ids, limit } = {}) {
    await this.whoami();
    this.#need("tasks:read");
    const q = (query || "").trim();
    const list = (ids || []).filter(Boolean);
    if (!q && !list.length) throw new DoneError(400, "bad_input", "Give a name/email to search for, or profile ids to look up");
    if (q && q.length < 2) throw new DoneError(400, "bad_input", "Search needs at least 2 characters");
    if (list.length > 50 || !list.every((x) => UUID.test(x))) throw new DoneError(400, "bad_input", "ids: up to 50 profile uuids");
    return await this.request("GET", "/people", { query: { q: q || undefined, ids: list.length ? list.join(",") : undefined, limit } });
  }

  async #fieldsFor(task_id, project_id) {
    const c = this.fields.get(project_id);
    if (c && Date.now() - c.at < 5 * 60_000) return c.list;
    return (await this.getTask(task_id)).fields;
  }

  // Map { "Platform": "Lazada", "<uuid>": 3 } → { "<uuid>": ... } with type checks.
  mapFields(list, input) {
    const out = {};
    for (const [k, v] of Object.entries(input || {})) {
      let f = list.find((x) => x.id === k);
      if (!f) {
        const byLabel = list.filter((x) => x.label.trim().toLowerCase() === k.trim().toLowerCase());
        if (byLabel.length > 1) throw new DoneError(400, "ambiguous_field", `More than one field is labelled "${k}"; use its id: ${byLabel.map((x) => x.id).join(", ")}`);
        f = byLabel[0];
      }
      if (!f) throw new DoneError(400, "unknown_field", `No field "${k}" on this board. Fields: ${list.map((x) => x.label).join(", ")}`);
      if (COMPUTED.has(f.ftype)) throw new DoneError(400, "computed_field", `"${f.label}" is a ${f.ftype} field and is computed by DONE; bots must not write it`);
      if (v !== null) {
        if (!["string", "number", "boolean"].includes(typeof v)) throw new DoneError(400, "bad_value", `Bad value for ${f.label}`);
        if (f.ftype === "number" && typeof v !== "number") throw new DoneError(400, "bad_value", `${f.label} must be a number`);
        if (f.ftype === "checkbox" && typeof v !== "boolean") throw new DoneError(400, "bad_value", `${f.label} must be true or false`);
        if (f.ftype === "date" && !(typeof v === "string" && DATE.test(v))) throw new DoneError(400, "bad_value", `${f.label} must be YYYY-MM-DD`);
        if (f.ftype === "select" && Array.isArray(f.options) && f.options.length && f.options.every((o) => typeof o === "string") && !f.options.includes(v))
          throw new DoneError(400, "bad_option", `"${v}" is not an option of ${f.label}. Options: ${f.options.join(" | ")}`);
        if (typeof v === "string" && v.length > 5000) throw new DoneError(400, "bad_value", `${f.label} is longer than 5000 characters`);
      }
      out[f.id] = v;
    }
    return out;
  }

  // ---------- writes ----------

  async #known(task_id) {
    if (!UUID.test(task_id)) throw new DoneError(400, "bad_id", "task_id must be a uuid");
    if (!this.tasks.has(task_id)) await this.getTask(task_id);
    return this.tasks.get(task_id);
  }

  async updateTask(task_id, { status, priority, assignee_id, due_date, group_id, fields, expected_updated_at } = {}) {
    await this.whoami();
    this.#need("tasks:write");
    const known = await this.#known(task_id);
    if (!this.#canWrite(known.project_id)) throw new DoneError(403, "board_not_allowed", "This bot may only read that board, not write to it");

    const body = {};
    if (status !== undefined) {
      if (!STATUSES.includes(status)) throw new DoneError(400, "bad_status", `status must be one of ${STATUSES.join(", ")}`);
      if ((this.me.deny_statuses || []).includes(status))
        throw new DoneError(403, "status_not_allowed", `This bot may not set status '${status}'. Move it to 'review' and a human will close it.`);
      body.status = status;
    }
    if (priority !== undefined) {
      if (!PRIORITIES.includes(priority)) throw new DoneError(400, "bad_priority", `priority must be one of ${PRIORITIES.join(", ")}`);
      body.priority = priority;
    }
    if (assignee_id !== undefined) {
      if (assignee_id !== null && !UUID.test(assignee_id)) throw new DoneError(400, "bad_assignee", "assignee_id must be a profile id (use done_find_people) or null");
      body.assignee_id = assignee_id;
    }
    if (due_date !== undefined) {
      if (due_date !== null && !DATE.test(due_date)) throw new DoneError(400, "bad_due_date", "due_date must be YYYY-MM-DD or null");
      body.due_date = due_date;
    }
    if (group_id !== undefined) {
      if (!UUID.test(group_id)) throw new DoneError(400, "bad_group", "group_id must be a group uuid from done_get_task");
      body.group_id = group_id;
    }
    if (fields && Object.keys(fields).length) {
      body.custom = this.mapFields(await this.#fieldsFor(task_id, known.project_id), fields);
    }
    if (!Object.keys(body).length) throw new DoneError(400, "nothing_to_update", "Give at least one of status, priority, assignee_id, due_date, group_id, fields");

    const expected = expected_updated_at || this.tasks.get(task_id).updated_at;
    body.expected_updated_at = expected;
    try {
      const r = await this.request("PATCH", `/tasks/${task_id}`, { body }, true);
      normTask(r.task);
      this.tasks.set(task_id, { updated_at: r.task.updated_at, project_id: r.task.project_id });
      return r;
    } catch (e) {
      if (e instanceof DoneError && e.code === "conflict") {
        // Re-read so the caller can re-decide. If nothing actually changed,
        // the server's 409 is really an RLS refusal (known bot-api issue).
        const fresh = await this.getTask(task_id);
        if (fresh.task.updated_at === expected)
          throw new DoneError(403, "forbidden_by_rls", "DONE permissions refused this update (reported as a conflict by bot-api). Ask a human.");
        const err = new DoneError(409, "conflict", "The task changed since it was last read. The fresh task is attached; decide again before retrying.");
        err.current = fresh.task;
        throw err;
      }
      throw e;
    }
  }

  async addComment(task_id, body, mentions) {
    await this.whoami();
    this.#need("comments:write");
    const known = await this.#known(task_id);
    if (!this.#canWrite(known.project_id)) throw new DoneError(403, "board_not_allowed", "This bot may only read that board, not comment on it");
    const text = String(body ?? "").trim().replace(new RegExp(`^\\[${escapeRe(this.me.display_name)}\\]\\s*`), "");
    if (!text || text.length > 5000) throw new DoneError(400, "bad_body", "body must be 1-5000 characters");
    if (mentions && (!Array.isArray(mentions) || mentions.length > 20 || !mentions.every((m) => UUID.test(m))))
      throw new DoneError(400, "bad_mentions", "mentions must be up to 20 profile uuids");
    // Not idempotent: never auto-retried (except 429, which the server did not process).
    return await this.request("POST", `/tasks/${task_id}/comments`, { body: { body: text, ...(mentions?.length ? { mentions } : {}) } }, false);
  }

  async createTask({ project_id, title, description, status, priority, due_date, group_id, fields } = {}) {
    await this.whoami();
    this.#need("tasks:create");
    if (!project_id || !this.#canWrite(project_id)) throw new DoneError(403, "board_not_allowed", "This bot may not create tasks on that board");
    if (status && (this.me.deny_statuses || []).includes(status)) throw new DoneError(403, "status_not_allowed", `This bot may not set status '${status}'`);
    const body = { project_id, title };
    if (description !== undefined) body.description = description;
    if (status) body.status = status;
    if (priority) body.priority = priority;
    if (due_date) body.due_date = due_date;
    if (group_id) body.group_id = group_id;
    if (fields && Object.keys(fields).length) {
      const c = this.fields.get(project_id);
      if (!c) throw new DoneError(400, "fields_unknown", "Read any task on this board with done_get_task first so field names can be mapped");
      body.custom = this.mapFields(c.list, fields);
    }
    const r = await this.request("POST", "/tasks", { body }, false);
    normTask(r.task);
    this.tasks.set(r.task.id, { updated_at: r.task.updated_at, project_id: r.task.project_id });
    return r;
  }
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
