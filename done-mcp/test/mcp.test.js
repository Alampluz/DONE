import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DoneClient } from "../src/client.js";
import { buildServer } from "../src/server.js";
import { createHttpServer, profilesFromEnv } from "../src/index.js";

const KEY = "done_cuspyy_" + "a".repeat(12) + "_" + "b".repeat(48);
const W = "6f6b7ee3-77d6-41e8-a3e2-9644b8eb469f", R = "c50f6c4e-5c06-42fb-b648-e35069e92fd4";
const T1 = "911d2697-50f9-4da0-aff7-baa1dd17e6e3", T2 = "11111111-1111-4111-8111-111111111111";
const F_PLAT = "aaaaaaaa-0000-4000-8000-000000000001", F_NUM = "aaaaaaaa-0000-4000-8000-000000000002", F_FORM = "aaaaaaaa-0000-4000-8000-000000000003";

// ---- mock bot-api ----
let api, base, calls = [], script = {};
const tasks = {
  [T1]: { id: T1, ticket_no: "GBP-261011-001", title: "test", status: "todo", priority: "normal", project_id: W, custom: {}, due_date: "2026-10-14T00:00:00.000Z", updated_at: "2026-10-11T08:00:00.000Z" },
  [T2]: { id: T2, ticket_no: "GWP-241202-001", title: "real", status: "todo", priority: "normal", project_id: R, custom: {}, updated_at: "2026-10-11T08:00:00.000Z" },
};
const fields = [
  { id: F_PLAT, label: "Platform", ftype: "select", options: ["Shopee", "Lazada"], position: 1 },
  { id: F_NUM, label: "Total number of Mechanic Setups", ftype: "number", options: [], position: 2 },
  { id: F_FORM, label: "Score", ftype: "formula", options: [], position: 3 },
];
const send = (res, s, b, h = {}) => { res.writeHead(s, { "Content-Type": "application/json", ...h }); res.end(JSON.stringify(b)); };

before(async () => {
  api = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : undefined;
    const url = new URL(req.url, "http://x");
    const path = url.pathname.replace(/^\/bot-api/, "");
    calls.push({ method: req.method, path, body, auth: req.headers.authorization, region: req.headers["x-region"] });
    const key = `${req.method} ${path}`;
    if (script[key]?.length) { const [s, b, h] = script[key].shift(); return send(res, s, b, h); }
    if (path === "/whoami" && script.whoami) return send(res, 200, script.whoami);
    if (path === "/boards") return send(res, 200, { boards: [{ id: W, key: "GBP", name: "GWP — Bot Pilot", workspace: "Store Ops", writable: true, open_tasks: 5 }, { id: R, key: "GWP", name: "Request: GWP Set up", workspace: "Store Ops", writable: false, open_tasks: 2919 }] });
    if (path === "/whoami") return send(res, 200, { bot: "cuspyy", display_name: "CUSPyy", user_linked: true, scopes: ["tasks:read", "tasks:write", "comments:write"], deny_statuses: ["done"], write_boards: [W], read_boards: [R], expires_at: "2027-01-09T08:21:42.981Z" });
    if (req.method === "GET" && path === "/people") {
      const q = url.searchParams.get("q"), ids = url.searchParams.get("ids");
      const all = [{ id: "491e412f-06a7-4c2c-bf33-57a76039848e", full_name: "April Niramol", email: "niramol.k@example.test", job_title: "Head of CX" }];
      return send(res, 200, { people: all.filter((p) => (q && (p.full_name + p.email).toLowerCase().includes(q.toLowerCase())) || (ids && ids.split(",").includes(p.id))) });
    }
    if (req.method === "GET" && path === "/tasks") return send(res, 200, { items: Object.values(tasks), next_cursor: null });
    const m = path.match(/^\/tasks\/([^/]+)(\/comments)?$/);
    if (m && req.method === "GET") return send(res, 200, { task: tasks[m[1]], fields, groups: [], comments: [] });
    if (m && req.method === "PATCH") {
      const t = tasks[m[1]];
      if (body.expected_updated_at !== t.updated_at) return send(res, 409, { error: "changed", code: "conflict" });
      Object.assign(t, body, { custom: { ...t.custom, ...(body.custom || {}) }, updated_at: new Date(Date.parse(t.updated_at) + 1000).toISOString() });
      delete t.expected_updated_at;
      return send(res, 200, { task: t });
    }
    if (m && m[2] && req.method === "POST") return send(res, 201, { comment: { id: "c1", body: `[CUSPyy] ${body.body}` } });
    send(res, 404, { error: "x", code: "unknown_route" });
  });
  await new Promise((r) => api.listen(0, r));
  base = `http://127.0.0.1:${api.address().port}/bot-api`;
});
after(() => api.close());

async function connect() {
  const client = new DoneClient({ key: KEY, base, minIntervalMs: 0, retryDelayMs: 10 });
  const me = await client.whoami();
  const server = buildServer(client, me);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "t", version: "1" });
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return { mcp, client };
}
const call = async (mcp, name, args) => {
  const r = await mcp.callTool({ name, arguments: args });
  return { isError: !!r.isError, data: JSON.parse(r.content[0].text) };
};

test("rejects malformed keys", () => {
  assert.throws(() => new DoneClient({ key: "nope" }), /malformed/);
});

test("tools follow whoami: no create tool, status enum excludes done", async () => {
  const { mcp } = await connect();
  const { tools } = await mcp.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["done_add_comment", "done_find_people", "done_get_task", "done_list_boards", "done_list_tasks", "done_set_status", "done_update_task", "done_whoami"]);
  const st = tools.find((t) => t.name === "done_set_status").inputSchema.properties.status.enum;
  assert.ok(!st.includes("done") && st.includes("review"));
});

test("sends key + region, never leaks key in output", async () => {
  calls = [];
  const { mcp } = await connect();
  const r = await call(mcp, "done_whoami", {});
  assert.equal(calls[0].auth, `Bearer ${KEY}`);
  assert.equal(calls[0].region, "ap-southeast-1");
  assert.ok(!JSON.stringify(r).includes(KEY));
});

test("update maps labels to field ids and auto-fills expected_updated_at", async () => {
  calls = [];
  const { mcp } = await connect();
  const r = await call(mcp, "done_update_task", { task_id: T1, status: "review", fields: { Platform: "Lazada", "total number of mechanic setups": 3 } });
  assert.equal(r.isError, false);
  const patch = calls.find((c) => c.method === "PATCH");
  assert.deepEqual(patch.body.custom, { [F_PLAT]: "Lazada", [F_NUM]: 3 });
  assert.equal(patch.body.expected_updated_at, "2026-10-11T08:00:00.000Z");
  assert.equal(r.data.task.status, "review");
});

test("refuses done, computed fields, bad options and read-only boards before calling the API", async () => {
  const { mcp, client } = await connect();
  await client.getTask(T1);
  calls = [];
  await assert.rejects(client.updateTask(T1, { status: "done" }), { code: "status_not_allowed" });
  assert.equal((await call(mcp, "done_update_task", { task_id: T1, fields: { Score: 5 } })).data.code, "computed_field");
  assert.equal((await call(mcp, "done_update_task", { task_id: T1, fields: { Platform: "TikTok" } })).data.code, "bad_option");
  assert.equal((await call(mcp, "done_update_task", { task_id: T1, fields: { "Total number of Mechanic Setups": "3" } })).data.code, "bad_value");
  assert.equal(calls.filter((c) => c.method !== "GET").length, 0);
  const ro = await call(mcp, "done_add_comment", { task_id: T2, body: "hi" });
  assert.equal(ro.data.code, "board_not_allowed");
  assert.equal(calls.filter((c) => c.method === "POST").length, 0);
});

test("409 returns the fresh task; a 409 with no real change is reported as a permissions refusal", async () => {
  const { mcp, client } = await connect();
  await client.getTask(T1);
  tasks[T1].updated_at = "2026-10-11T09:00:00.000Z"; // someone else edited it
  const r = await call(mcp, "done_set_status", { task_id: T1, status: "blocked" });
  assert.equal(r.data.code, "conflict");
  assert.equal(r.data.current_task.updated_at, "2026-10-11T09:00:00.000Z");
  // now the client has the fresh version; server still answers 409 → RLS
  script["PATCH /tasks/" + T1] = [[409, { error: "x", code: "conflict" }]];
  const r2 = await call(mcp, "done_set_status", { task_id: T1, status: "blocked" });
  assert.equal(r2.data.code, "forbidden_by_rls");
});

test("comments: prefix not doubled, never retried on 500, retried after 429", async () => {
  const { mcp, client } = await connect();
  await client.getTask(T1);
  calls = [];
  await call(mcp, "done_add_comment", { task_id: T1, body: "[CUSPyy] Mechanics set up" });
  assert.equal(calls.at(-1).body.body, "Mechanics set up");
  calls = [];
  script["POST /tasks/" + T1 + "/comments"] = [[500, { error: "boom", code: "internal" }]];
  const r = await call(mcp, "done_add_comment", { task_id: T1, body: "x" });
  assert.equal(r.data.code, "internal");
  assert.equal(calls.filter((c) => c.method === "POST").length, 1);
  calls = [];
  script["POST /tasks/" + T1 + "/comments"] = [[429, { error: "slow", code: "rate_limited" }, { "Retry-After": "1" }]];
  const r3 = await call(mcp, "done_add_comment", { task_id: T1, body: "y" });
  assert.equal(r3.isError, false);
  assert.equal(calls.filter((c) => c.method === "POST").length, 2);
});

test("reads retry once on 500", async () => {
  const { client } = await connect();
  calls = [];
  script["GET /tasks"] = [[500, { error: "boom", code: "internal" }]];
  const r = await client.listTasks({});
  assert.equal(r.items.length, 2);
  assert.equal(calls.filter((c) => c.path === "/tasks").length, 2);
});

test("throttle spaces calls", async () => {
  const client = new DoneClient({ key: KEY, base, minIntervalMs: 150 });
  const t0 = Date.now();
  await Promise.all([client.whoami(true), client.whoami(true), client.whoami(true)]);
  assert.ok(Date.now() - t0 >= 300, "3 calls should take >= 2 intervals");
});

test("HTTP mode requires the bearer token and serves tools", async () => {
  const client = new DoneClient({ key: KEY, base, minIntervalMs: 0 });
  const me = await client.whoami();
  const token = "t".repeat(40);
  const srv = createHttpServer(client, me, token, { publicUrl: "https://example.test" });
  await new Promise((r) => srv.listen(0, r));
  const url = `http://127.0.0.1:${srv.address().port}/mcp`;
  const bad = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(bad.status, 401);
  const mcp = new Client({ name: "t", version: "1" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const { tools } = await mcp.listTools();
  assert.ok(tools.some((t) => t.name === "done_get_task"));
  const info = mcp.getServerVersion();
  assert.equal(info.title, "DONE");
  assert.equal(info.icons[0].src, "https://example.test/icon.png");
  const icon = await fetch(url.replace(/\/mcp$/, "/icon.png"));
  assert.equal(icon.status, 200);
  assert.equal(icon.headers.get("content-type"), "image/png");
  const r = await mcp.callTool({ name: "done_get_task", arguments: { task_id: T1 } });
  assert.equal(JSON.parse(r.content[0].text).task.id, T1);
  await mcp.close();
  srv.close();
});

test("find people by name or id; dates come back as YYYY-MM-DD", async () => {
  const { mcp } = await connect();
  const byName = await call(mcp, "done_find_people", { query: "april" });
  assert.equal(byName.data.people[0].id, "491e412f-06a7-4c2c-bf33-57a76039848e");
  const byId = await call(mcp, "done_find_people", { ids: ["491e412f-06a7-4c2c-bf33-57a76039848e"] });
  assert.equal(byId.data.people.length, 1);
  const none = await call(mcp, "done_find_people", {});
  assert.equal(none.data.code, "bad_input");
  const t = await call(mcp, "done_get_task", { task_id: T1 });
  assert.equal(t.data.task.due_date, "2026-10-14");
});

test("all_boards key: create tool appears, any board is writable, done is allowed, boards listed", async () => {
  script.whoami = { bot: "grokbot", display_name: "GrokBot", user_linked: true, scopes: ["tasks:read", "tasks:write", "tasks:create", "comments:write"], deny_statuses: [], all_boards: true, write_boards: [], read_boards: [], expires_at: "2027-01-09T11:34:45.952Z" };
  try {
    const { mcp } = await connect();
    const { tools } = await mcp.listTools();
    assert.ok(tools.some((t) => t.name === "done_create_task"));
    assert.ok(tools.find((t) => t.name === "done_set_status").inputSchema.properties.status.enum.includes("done"));
    const b = await call(mcp, "done_list_boards", { query: "GWP" });
    assert.equal(b.data.boards.length, 2);
    // T2 is on the formerly read-only board: writable now
    const c = await call(mcp, "done_add_comment", { task_id: T2, body: "hello" });
    assert.equal(c.isError, false);
    assert.ok(c.data.comment.body.startsWith("[CUSPyy]")); // mock prefix; real server uses GrokBot
  } finally { delete script.whoami; }
});

test("profiles from env; path token selects the profile; wrong path token is refused", async () => {
  const KEY2 = "done_claude_" + "c".repeat(12) + "_" + "d".repeat(48);
  const defs = profilesFromEnv({ DONE_BOT_KEY: KEY, MCP_AUTH_TOKEN: "g".repeat(40), DONE_BOT_KEY_CLAUDE: KEY2, MCP_AUTH_TOKEN_CLAUDE: "k".repeat(40), DONE_BOT_KEY_X: "" });
  assert.deepEqual(defs.map((d) => d.name), ["default", "claude"]);
  script.whoami = undefined;
  const c1 = new DoneClient({ key: KEY, base, minIntervalMs: 0 }); const me1 = await c1.whoami();
  script.whoami = { bot: "claude", display_name: "Claude", user_linked: true, scopes: ["tasks:read"], deny_statuses: [], all_boards: true, write_boards: [], read_boards: [], expires_at: "2027-01-09T11:34:45.952Z" };
  const c2 = new DoneClient({ key: KEY2, base, minIntervalMs: 0 }); const me2 = await c2.whoami();
  delete script.whoami;
  const srv = createHttpServer([{ name: "default", token: "g".repeat(40), client: c1, me: me1 }, { name: "claude", token: "k".repeat(40), client: c2, me: me2 }]);
  await new Promise((r) => srv.listen(0, r));
  const root = `http://127.0.0.1:${srv.address().port}`;
  const h = await fetch(`${root}/health`).then((r) => r.json());
  assert.deepEqual(h.profiles, ["default", "claude"]);
  const bad = await fetch(`${root}/mcp/${"z".repeat(40)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(bad.status, 401);
  const mcp = new Client({ name: "t", version: "1" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(`${root}/mcp/${"k".repeat(40)}`)));
  const { tools } = await mcp.listTools();
  assert.ok(tools.some((t) => t.name === "done_get_task") && !tools.some((t) => t.name === "done_update_task")); // claude profile: read-only key
  await mcp.close();
  srv.close();
});
