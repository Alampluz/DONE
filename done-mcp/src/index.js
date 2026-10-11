#!/usr/bin/env node
// done-mcp entry point.
//   MCP_TRANSPORT=stdio (default)  → for desktop MCP clients that launch the server
//   MCP_TRANSPORT=http             → Streamable HTTP at /mcp, for hosted bots (Grok)
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DoneClient, DEFAULT_BASE } from "./client.js";
import { buildServer } from "./server.js";

const log = (...a) => console.error("[done-mcp]", ...a); // stderr only: stdout is the MCP channel

export function makeClient(env = process.env) {
  return new DoneClient({
    key: env.DONE_BOT_KEY,
    base: env.DONE_API_BASE || DEFAULT_BASE,
    region: env.DONE_REGION ?? "ap-southeast-1",
    minIntervalMs: Number(env.DONE_MIN_INTERVAL_MS || 2000),
  });
}

function sameToken(given, want) {
  const a = Buffer.from(given || ""), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createHttpServer(client, me, token) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, bot: me.bot }));
    }
    if (url.pathname !== "/mcp") { res.writeHead(404); return res.end(); }
    // Grok's "Add MCP Server" card lets you set custom headers: either works.
    const given = req.headers["x-done-mcp-token"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!sameToken(String(given), token)) {
      res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" });
      return res.end(JSON.stringify({ error: "unauthorized" }));
    }
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" });
      return res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null }));
    }
    let raw = "";
    for await (const chunk of req) { raw += chunk; if (raw.length > 1_000_000) { res.writeHead(413); return res.end(); } }
    let body;
    try { body = JSON.parse(raw); } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
    }
    // Stateless: a fresh MCP server per request, sharing one client (throttle, caches).
    const server = buildServer(client, me);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      log("request failed:", e?.message);
      if (!res.headersSent) { res.writeHead(500); res.end(); }
    }
  });
}

async function main() {
  let client;
  try { client = makeClient(); } catch (e) { log(e.message); process.exit(1); }
  let me;
  try {
    me = await client.whoami(true);
  } catch (e) {
    log(`cannot start: /whoami failed (${e.code || "error"}: ${e.message})`);
    process.exit(1);
  }
  const days = client.daysToExpiry();
  log(`bot ${me.bot} ready · scopes ${me.scopes.join(",")} · write ${me.write_boards.length} board(s) · read ${me.read_boards.length} · key expires in ${days} days`);
  if (days < 14) log(`WARNING: bot key expires in ${days} days — ask a DONE admin for a new one`);

  if ((process.env.MCP_TRANSPORT || "stdio") === "http") {
    const token = process.env.MCP_AUTH_TOKEN || "";
    if (token.length < 32) { log("MCP_AUTH_TOKEN must be set (32+ random characters) for http mode"); process.exit(1); }
    const port = Number(process.env.PORT || 8787);
    createHttpServer(client, me, token).listen(port, () => log(`listening on :${port}/mcp`));
  } else {
    await buildServer(client, me).connect(new StdioServerTransport());
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("done-mcp")) {
  main();
}
