#!/usr/bin/env node
// done-mcp entry point.
//   MCP_TRANSPORT=stdio (default)  → for desktop MCP clients that launch the server
//   MCP_TRANSPORT=http             → Streamable HTTP at /mcp, for hosted bots (Grok)
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DoneClient, DEFAULT_BASE } from "./client.js";
import { buildServer } from "./server.js";
import { makeOAuth, isJwt } from "./oauth.js";

const log = (...a) => console.error("[done-mcp]", ...a); // stderr only: stdout is the MCP channel

export function makeClient(env = process.env, key = env.DONE_BOT_KEY) {
  return new DoneClient({
    key,
    base: env.DONE_API_BASE || DEFAULT_BASE,
    region: env.DONE_REGION ?? "ap-southeast-1",
    minIntervalMs: Number(env.DONE_MIN_INTERVAL_MS || 2000),
  });
}

// Profiles: the default pair DONE_BOT_KEY / MCP_AUTH_TOKEN, plus any DONE_BOT_KEY_<NAME> /
// MCP_AUTH_TOKEN_<NAME> pair (e.g. _CLAUDE). Each profile is its own DONE bot key, so the
// activity log shows who acted; all share one hosted server.
export function profilesFromEnv(env = process.env) {
  const out = [];
  if (env.DONE_BOT_KEY) out.push({ name: "default", key: env.DONE_BOT_KEY, token: env.MCP_AUTH_TOKEN || "" });
  for (const [k, v] of Object.entries(env)) {
    const m = k.match(/^DONE_BOT_KEY_([A-Z0-9]+)$/);
    if (m && v) out.push({ name: m[1].toLowerCase(), key: v, token: env[`MCP_AUTH_TOKEN_${m[1]}`] || "" });
  }
  return out;
}

function sameToken(given, want) {
  const a = Buffer.from(given || ""), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ICON = (() => { try { return readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "icon.png")); } catch { return null; } })();

// `profiles`: [{ name, token, client, me }]. A request is matched to a profile by its token,
// given either as a header (Grok) or in the path /mcp/<token> (clients with no header field, e.g. claude.ai).
export function createHttpServer(profiles, { publicUrl, oauth, env = process.env } = {}) {
  if (!Array.isArray(profiles)) { // backwards compatible: (client, me, token, opts)
    const [client, me, token, opts] = arguments;
    return createHttpServer([{ name: "default", token, client, me }], opts);
  }
  const findProfile = (given) => profiles.find((p) => p.token.length >= 32 && sameToken(String(given || ""), p.token));
  // Per-user sessions (OAuth): token → { client, me, until }. Re-checked with bot-api every 5 minutes.
  const sessions = new Map();
  const userSession = async (jwt) => {
    const hit = sessions.get(jwt);
    if (hit && hit.until > Date.now()) return hit;
    const client = new DoneClient({ bearer: jwt, base: env.DONE_API_BASE || DEFAULT_BASE, region: env.DONE_REGION ?? "ap-southeast-1", minIntervalMs: Number(env.DONE_MIN_INTERVAL_MS || 2000) });
    const me = await client.whoami(true);
    const s = { name: "user", client, me, until: Math.min(Date.now() + 5 * 60_000, new Date(me.expires_at).getTime()) };
    if (sessions.size > 2000) sessions.clear();
    sessions.set(jwt, s);
    return s;
  };
  const unauthorized = (res) => {
    res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": `Bearer resource_metadata="${(publicUrl || "").replace(/\/+$/, "")}/.well-known/oauth-protected-resource"` });
    res.end(JSON.stringify({ error: "unauthorized" }));
  };
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (oauth && await oauth(req, res, url)) return;
    if (url.pathname === "/icon.png" && ICON) {
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
      return res.end(ICON);
    }
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, bot: profiles[0]?.me?.bot, profiles: profiles.map((p) => p.name), user_signin: !!oauth }));
    }
    const pathTok = url.pathname.match(/^\/mcp\/([A-Za-z0-9_-]{32,})$/)?.[1];
    if (url.pathname !== "/mcp" && !pathTok) { res.writeHead(404); return res.end(); }
    // Token from the path, or from a header (Grok's "Add MCP Server" card lets you set custom headers).
    const given = pathTok || req.headers["x-done-mcp-token"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    let profile = findProfile(given);
    if (!profile && oauth && isJwt(given)) {
      try { profile = await userSession(given); }
      catch (e) { if (e?.status === 401 || e?.status === 403) return unauthorized(res); log("user session failed:", e?.code, e?.message); res.writeHead(503); return res.end(); }
    }
    if (!profile) return unauthorized(res);
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
    const server = buildServer(profile.client, profile.me, { publicUrl });
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

async function startProfile(p) {
  const client = makeClient(process.env, p.key);
  const me = await client.whoami(true);
  const days = client.daysToExpiry();
  log(`[${p.name}] bot ${me.bot} ready · scopes ${me.scopes.join(",")} · ${me.all_boards ? "all boards" : `write ${me.write_boards.length} / read ${me.read_boards.length} board(s)`} · key expires in ${days} days`);
  if (days < 14) log(`WARNING: [${p.name}] bot key expires in ${days} days — ask a DONE admin for a new one`);
  return { ...p, client, me };
}

async function main() {
  const defs = profilesFromEnv();
  if (!defs.length) { log("DONE_BOT_KEY is missing"); process.exit(1); }
  const http_ = (process.env.MCP_TRANSPORT || "stdio") === "http";
  const profiles = [];
  for (const d of defs) {
    try { profiles.push(await startProfile(d)); }
    catch (e) { log(`[${d.name}] cannot start: ${e.code || "error"}: ${e.message}`); if (d.name === "default" || !http_) process.exit(1); }
  }
  if (http_) {
    const bad = profiles.filter((p) => p.token.length < 32).map((p) => p.name);
    if (bad.length) { log(`MCP_AUTH_TOKEN${bad.map((n) => n === "default" ? "" : "_" + n.toUpperCase()).join(" / ")} must be set (32+ random characters)`); process.exit(1); }
    const port = Number(process.env.PORT || 8787);
    // Render sets RENDER_EXTERNAL_URL; it's used to tell MCP clients where the icon lives.
    const publicUrl = process.env.MCP_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "";
    // Per-user sign-in needs: MCP_OAUTH_SECRET, DONE_SUPABASE_URL, DONE_SUPABASE_ANON_KEY (anon key is public), and a public URL.
    let oauth = null;
    if (process.env.MCP_OAUTH_SECRET && process.env.DONE_SUPABASE_URL && process.env.DONE_SUPABASE_ANON_KEY && publicUrl) {
      oauth = makeOAuth({ publicUrl, secret: process.env.MCP_OAUTH_SECRET, supabaseUrl: process.env.DONE_SUPABASE_URL, supabaseAnonKey: process.env.DONE_SUPABASE_ANON_KEY });
      log("per-user sign-in (OAuth) enabled");
    } else log("per-user sign-in disabled (set MCP_OAUTH_SECRET, DONE_SUPABASE_URL, DONE_SUPABASE_ANON_KEY)");
    createHttpServer(profiles, { publicUrl, oauth }).listen(port, () => log(`listening on :${port}/mcp (${profiles.map((p) => p.name).join(", ")})`));
  } else {
    await buildServer(profiles[0].client, profiles[0].me).connect(new StdioServerTransport());
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("done-mcp")) {
  main();
}
