// Per-user sign-in for done-mcp: a small, stateless OAuth 2.1 authorization server backed by
// Supabase Auth. claude.ai discovers it, registers itself, sends the person to /authorize
// (a DONE sign-in page), and exchanges the code for tokens. The access token IS the person's
// Supabase JWT, so bot-api v6 runs every tool as that person (their RLS, their name).
//
// Nothing is stored server-side: client ids and auth codes are sealed with MCP_OAUTH_SECRET
// (AES-256-GCM), so restarts and multiple instances are harmless.
import { createHash, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const b64u = (b) => Buffer.from(b).toString("base64url");
const unb64u = (s) => Buffer.from(String(s), "base64url");

export class Sealer {
  constructor(secret) {
    if (!secret || secret.length < 32) throw new Error("MCP_OAUTH_SECRET must be set (32+ random characters)");
    this.key = createHash("sha256").update(secret).digest();
  }
  seal(obj, kind) {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.key, iv);
    c.setAAD(Buffer.from(kind));
    const ct = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
    return `${kind}.${b64u(iv)}.${b64u(ct)}.${b64u(c.getAuthTag())}`;
  }
  open(token, kind) {
    try {
      const [k, iv, ct, tag] = String(token).split(".");
      if (k !== kind) return null;
      const d = createDecipheriv("aes-256-gcm", this.key, unb64u(iv));
      d.setAAD(Buffer.from(kind));
      d.setAuthTag(unb64u(tag));
      return JSON.parse(Buffer.concat([d.update(unb64u(ct)), d.final()]).toString("utf8"));
    } catch { return null; }
  }
}

const pkceOk = (verifier, challenge) => {
  if (!verifier || !challenge) return false;
  const a = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function loginPage({ publicUrl, params, error }) {
  const hidden = ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "resource"]
    .map((k) => `<input type="hidden" name="${k}" value="${esc(params[k] || "")}">`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in to DONE</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f6f5;color:#1b1f1e;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);padding:32px;width:min(380px,92vw)}
  .logo{display:flex;align-items:center;gap:12px;margin-bottom:20px}.logo img{width:40px;height:40px;border-radius:10px}
  h1{font-size:20px;margin:0}p{margin:0 0 18px;color:#4b5552;font-size:14px;line-height:1.45}
  label{display:block;font-size:13px;font-weight:600;margin:12px 0 6px}
  input[type=email],input[type=password]{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cfd8d5;border-radius:10px;font-size:15px}
  button{margin-top:18px;width:100%;padding:12px;border:0;border-radius:10px;background:#2bb3a0;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  .err{background:#fde8e8;color:#9b1c1c;border-radius:10px;padding:10px 12px;font-size:13px;margin-top:12px}
  .foot{margin-top:16px;font-size:12px;color:#6b7572}
</style></head><body><form class="card" method="post" action="${esc(publicUrl)}/authorize">
<div class="logo"><img src="${esc(publicUrl)}/icon.png" alt=""><h1>Sign in to DONE</h1></div>
<p>Claude is asking to use DONE on your behalf. Sign in with your DONE email and password. Claude will only be able to do what you can do in DONE.</p>
${hidden}
<label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required autofocus>
<label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required>
${error ? `<div class="err">${esc(error)}</div>` : ""}
<button type="submit">Sign in and allow</button>
<div class="foot">You can revoke this at any time by removing the DONE connector in Claude.</div>
</form></body></html>`;
}

/**
 * Returns a request handler (req, res, url) => boolean handled.
 * opts: { publicUrl, secret, supabaseUrl, supabaseAnonKey, fetchImpl }
 */
export function makeOAuth(opts) {
  const { publicUrl, supabaseUrl, supabaseAnonKey, fetchImpl = globalThis.fetch } = opts;
  const sealer = new Sealer(opts.secret);
  const issuer = publicUrl.replace(/\/+$/, "");
  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
    res.end(JSON.stringify(body));
  };
  const html = (res, status, body) => { res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); res.end(body); };
  const readForm = async (req) => {
    let raw = ""; for await (const c of req) { raw += c; if (raw.length > 100_000) break; }
    const ct = req.headers["content-type"] || "";
    if (ct.includes("application/json")) { try { return JSON.parse(raw); } catch { return {}; } }
    return Object.fromEntries(new URLSearchParams(raw));
  };
  const metadata = {
    issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, registration_endpoint: `${issuer}/register`,
    response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["done"], service_documentation: "https://alampluz.github.io/DONE/",
  };
  const resourceMetadata = { resource: `${issuer}/mcp`, authorization_servers: [issuer], scopes_supported: ["done"], bearer_methods_supported: ["header"] };

  async function supabaseToken(grant, body) {
    const r = await fetchImpl(`${supabaseUrl}/auth/v1/token?grant_type=${grant}`, {
      method: "POST", headers: { apikey: supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { error: j.error_description || j.msg || j.error || "sign-in failed" };
  }

  const clientFromId = (id) => sealer.open(id, "c");

  return async function handle(req, res, url) {
    const p = url.pathname;
    if (p === "/.well-known/oauth-authorization-server" || p.startsWith("/.well-known/oauth-authorization-server/")) { send(res, 200, metadata); return true; }
    if (p === "/.well-known/oauth-protected-resource" || p.startsWith("/.well-known/oauth-protected-resource/")) { send(res, 200, resourceMetadata); return true; }

    if (p === "/register" && req.method === "POST") {
      const b = await readForm(req);
      const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris.filter((u) => /^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)/.test(u)) : [];
      if (!uris.length) return send(res, 400, { error: "invalid_client_metadata", error_description: "redirect_uris (https) required" }), true;
      const client_id = sealer.seal({ u: uris, n: String(b.client_name || "").slice(0, 80), t: Date.now() }, "c");
      send(res, 201, { client_id, client_name: b.client_name, redirect_uris: uris, token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], client_id_issued_at: Math.floor(Date.now() / 1000) });
      return true;
    }

    if (p === "/authorize" && (req.method === "GET" || req.method === "POST")) {
      const params = req.method === "GET" ? Object.fromEntries(url.searchParams) : await readForm(req);
      const client = clientFromId(params.client_id);
      if (!client) return html(res, 400, "<p>Unknown client. Remove and re-add the DONE connector in Claude.</p>"), true;
      if (!client.u.includes(params.redirect_uri)) return html(res, 400, "<p>Redirect address not registered for this client.</p>"), true;
      const back = (q) => { const r = new URL(params.redirect_uri); for (const [k, v] of Object.entries(q)) r.searchParams.set(k, v); if (params.state) r.searchParams.set("state", params.state); res.writeHead(302, { Location: r.toString(), "Cache-Control": "no-store" }); res.end(); };
      if (params.response_type !== "code") return back({ error: "unsupported_response_type" }), true;
      if (!params.code_challenge || (params.code_challenge_method || "S256") !== "S256") return back({ error: "invalid_request", error_description: "PKCE S256 required" }), true;
      if (req.method === "GET") return html(res, 200, loginPage({ publicUrl: issuer, params })), true;
      // POST: credentials
      const email = String(params.email || "").trim().toLowerCase(), password = String(params.password || "");
      if (!email || !password) return html(res, 200, loginPage({ publicUrl: issuer, params, error: "Enter your email and password." })), true;
      const s = await supabaseToken("password", { email, password });
      if (s.error) return html(res, 200, loginPage({ publicUrl: issuer, params, error: "Sign-in failed: " + s.error })), true;
      const code = sealer.seal({ at: s.access_token, rt: s.refresh_token, exp: s.expires_at, cc: params.code_challenge, ci: params.client_id, ru: params.redirect_uri, t: Date.now() }, "a");
      return back({ code }), true;
    }

    if (p === "/token" && req.method === "POST") {
      const b = await readForm(req);
      if (b.grant_type === "authorization_code") {
        const c = sealer.open(b.code, "a");
        if (!c || Date.now() - c.t > 10 * 60_000) return send(res, 400, { error: "invalid_grant", error_description: "code expired or invalid" }), true;
        if (b.client_id && b.client_id !== c.ci) return send(res, 400, { error: "invalid_grant", error_description: "client mismatch" }), true;
        if (b.redirect_uri && b.redirect_uri !== c.ru) return send(res, 400, { error: "invalid_grant", error_description: "redirect_uri mismatch" }), true;
        if (!pkceOk(b.code_verifier, c.cc)) return send(res, 400, { error: "invalid_grant", error_description: "PKCE verification failed" }), true;
        const expiresIn = Math.max(60, Math.floor(c.exp - Date.now() / 1000));
        send(res, 200, { access_token: c.at, token_type: "Bearer", expires_in: expiresIn, refresh_token: sealer.seal({ rt: c.rt, ci: c.ci }, "r"), scope: "done" });
        return true;
      }
      if (b.grant_type === "refresh_token") {
        const r = sealer.open(b.refresh_token, "r");
        if (!r) return send(res, 400, { error: "invalid_grant", error_description: "refresh token invalid" }), true;
        const s = await supabaseToken("refresh_token", { refresh_token: r.rt });
        if (s.error) return send(res, 400, { error: "invalid_grant", error_description: "Session expired; sign in again" }), true;
        send(res, 200, { access_token: s.access_token, token_type: "Bearer", expires_in: s.expires_in || 3600, refresh_token: sealer.seal({ rt: s.refresh_token, ci: r.ci }, "r"), scope: "done" });
        return true;
      }
      send(res, 400, { error: "unsupported_grant_type" });
      return true;
    }
    return false;
  };
}

export const isJwt = (s) => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(s || ""));
