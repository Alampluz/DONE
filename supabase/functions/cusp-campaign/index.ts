// cusp-campaign: the Listing Tracker's read-only bridge to CUSP (spec §6).
// POST {action:'lookup', id} | {action:'skus', id} | {action:'sync'}
// sync = refresh the campaigns already logged, then DISCOVER: every recent CUSP campaign whose name starts with
// a ticket's ID (its DONE ticket number, or its "monday ID" field) is logged on that ticket automatically;
// campaigns that match no ticket are listed in listing_sync_log.unmatched (match.mjs).
// Auth (gateway JWT check is OFF; the function verifies the bearer itself, like bot-api v6 user mode):
//   - a Supabase user JWT whose DONE profile is active staff (admin / internal / management), or
//   - the project's service-role key (treated as staff, no company restriction), or
//   - header x-listing-sync-key = vault secret listing_sync_key (pg_cron's poke_listing_sync, the same
//     vault-key pattern as poke_mail_sender / poke_bot_dispatch; read from the vault over SUPABASE_DB_URL,
//     so there is no second copy of the key in the function secrets). Allowed for action 'sync' only.
//   Anything else → 401.
// CUSP: read-only Postgres user in the CUSP_DB_URL secret. Unset → every action answers
//   503 {code:'cusp_not_configured'}; set but unreachable → 503 {code:'cusp_unavailable'}. Until IT
//   issues that user, the nightly sync (and logging a new setup) runs by hand through the CUSP MCP:
//   tools/listing_sync/sync_via_mcp.md (same SQL as below).
// DONE: postgres.js on SUPABASE_DB_URL (no signed-in user), so lt_sync_apply always gets company_id.
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { matchCampaigns, ticketIndex } from "./match.mjs";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 2, prepare: false, idle_timeout: 20, connect_timeout: 10 });
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BEARER_RE = /^Bearer\s+(\S+)$/;
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const STAFF = ["admin", "internal", "management"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message || code); }
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
const unavailable = () => new ApiError(503, "cusp_unavailable", "CUSP did not answer, try again");
const notConfigured = () => new ApiError(503, "cusp_not_configured", "CUSP link not set up yet");

function safeEq(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

type Caller = { kind: "service" } | { kind: "cron" } | { kind: "user"; id: string; company_id: string };

let syncKey: string | null = null;   // cached per isolate; a rotated key is picked up by the next cold start
async function listingSyncKey(): Promise<string> {
  if (syncKey) return syncKey;
  const [r] = await sql`select decrypted_secret as k from vault.decrypted_secrets where name = 'listing_sync_key'`;
  syncKey = (r?.k as string) || null;   // a missing key is not cached
  return syncKey || "";
}

async function authenticate(req: Request): Promise<Caller> {
  const ck = req.headers.get("x-listing-sync-key");
  if (ck) {
    if (safeEq(ck, await listingSyncKey())) return { kind: "cron" };
    throw new ApiError(401, "unauthorized", "Bad sync key");
  }
  const m = (req.headers.get("authorization") || "").match(BEARER_RE);
  if (!m) throw new ApiError(401, "unauthorized", "Sign in required");
  const token = m[1];
  if (safeEq(token, SB_SERVICE)) return { kind: "service" };
  if (!JWT_RE.test(token)) throw new ApiError(401, "unauthorized", "Sign in required");
  // Same check as bot-api v6: GoTrue validates the JWT (the anon key has no user → 401 here).
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new ApiError(401, "invalid_token", "Sign-in expired or invalid");
  const u = await r.json();
  if (!u?.id) throw new ApiError(401, "invalid_token", "Sign-in expired or invalid");
  const [p] = await sql`select id, role, active, company_id from public.profiles where id = ${u.id}`;
  if (!p || !p.active || !STAFF.includes(p.role) || !p.company_id) throw new ApiError(401, "staff_only", "Staff only");
  return { kind: "user", id: p.id, company_id: p.company_id };
}

// ───────── CUSP (read-only; SQL validated with query_cusp on campaign 72731) ─────────
// deno-lint-ignore no-explicit-any
let cuspSql: any = null;
function cuspDb() {
  const url = Deno.env.get("CUSP_DB_URL");
  if (!url) throw notConfigured();
  if (!cuspSql) cuspSql = postgres(url, { max: 2, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  return cuspSql;
}
// deno-lint-ignore no-explicit-any
async function cusp<T>(fn: (c: any) => Promise<T>): Promise<T> {
  const c = cuspDb();
  try { return await fn(c); } catch (e) {
    // deno-lint-ignore no-explicit-any
    console.error("cusp-campaign: CUSP query failed", (e as any)?.code, (e as any)?.message);
    throw unavailable();
  }
}

const PLATFORM: Record<string, string> = { shopee: "Shopee", lazada: "Lazada", tiktok: "TikTok" };

async function lookup(id: number) {
  return await cusp(async (c) => {
    const [row] = await c`
      select c.id, c.name, c.begin, c."end", c.state, c.seller_id, s.name as seller, c.positions,
             (select count(distinct ag.shop_listing_id) from catalog_assetgroup ag where ag.campaign_id = c.id) as sku_count
        from catalog_campaign c left join catalog_seller s on s.id = c.seller_id
       where c.id = ${id}`;
    if (!row) return null;
    const shops = await c`
      select sh.id as shop_id, sh.name, sh.marketplace
        from catalog_campaign_shops cs join catalog_shop sh on sh.id = cs.shop_id
       where cs.campaign_id = ${id} order by sh.id`;
    return {
      id: row.id, name: row.name, begin: row.begin, end: row.end, state: row.state,
      seller_id: row.seller_id, seller: row.seller, positions: row.positions,
      // deno-lint-ignore no-explicit-any
      shops: shops.map((s: any) => ({ shop_id: s.shop_id, name: s.name, platform: PLATFORM[String(s.marketplace || "").toLowerCase()] || "Other" })),
      sku_count: Number(row.sku_count) || 0,
    };
  });
}

async function skus(id: number) {
  // deno-lint-ignore no-explicit-any
  const rows = await cusp<any[]>((c) => c`
    select sl.id as shop_listing_id, v.seller_sku as sku, coalesce(nullif(p.name, ''), v.name) as product_name
      from catalog_shoplisting sl
      join catalog_variant v on v.id = sl.variant_id
      join catalog_product p on p.id = v.product_id
     where sl.id in (select distinct ag.shop_listing_id from catalog_assetgroup ag where ag.campaign_id = ${id} and ag.shop_listing_id is not null)
     order by sl.id limit 5000`);
  // deno-lint-ignore no-explicit-any
  return rows.map((r: any) => ({ shop_listing_id: r.shop_listing_id, sku: r.sku, product_name: r.product_name }));
}

const SYNC_BUDGET_MS = 120_000;   // stop well before the edge wall-clock limit
const DISCOVER_MAX = 80;          // new setups linked per run; the rest wait for the next run
const UNMATCHED_KEEP = 200;       // rows kept in listing_sync_log.unmatched

// Tickets a campaign may be linked to: every unarchived ticket of the last 180 days on a listing board,
// with its ticket number, its "monday ID" field and its assignee (the PIC of an auto-logged setup).
async function linkableTickets(company: string | null) {
  return await sql`
    select t.id as task_id, t.company_id, t.ticket_no, coalesce(t.assignee_id, t.assignee_ids[1]) as assignee,
           (select nullif(trim(t.custom->>(f.id::text)), '') from public.project_fields f
             where f.project_id = t.project_id and lower(trim(f.label)) = 'monday id' limit 1) as monday_id
      from public.tasks t join public.projects p on p.id = t.project_id
     where p.field_config->>'listing_tracker' = 'true' and coalesce(p.status,'') <> 'archived'
       and t.archived_at is null and t.created_at >= now() - interval '180 days'
       and (${company}::uuid is null or t.company_id = ${company}::uuid)`;
}
// CUSP campaigns still relevant: not draft / cancelled, ending no earlier than a week ago.
async function recentCampaigns() {
  // deno-lint-ignore no-explicit-any
  return await cusp<any[]>((c) => c`
    select c.id, c.name, c.begin, c."end", c.state, s.name as seller
      from catalog_campaign c left join catalog_seller s on s.id = c.seller_id
     where c."end" >= now() - interval '7 days' and c.state not in ('draft','cancelled')
     order by c.id desc limit 4000`);
}

// sync refreshes CUSP facts only (name, seller, begin/end, state, skus, sku_count). platform / ctype are
// never sent: lt_sync_apply overwrites any key present, and those two belong to the client.
async function sync(caller: Caller) {
  const t0 = Date.now();
  const company = caller.kind === "user" ? caller.company_id : null;
  const rows = await sql`
    select company_id, cusp_campaign_id from public.listing_campaigns
     where end_at >= now() - interval '7 days'
       and (${company}::uuid is null or company_id = ${company}::uuid)
     order by company_id, cusp_campaign_id`;
  // Companies that get a log row even when nothing is open: the caller's own, or (service role)
  // every company that has Listing Tracker rows at all.
  const companies: string[] = company ? [company]
    // deno-lint-ignore no-explicit-any
    : (await sql`select company_id from public.listing_campaigns
                 union select company_id from public.projects where field_config->>'listing_tracker' = 'true'`).map((x: any) => x.company_id as string);
  const errors: { cusp_campaign_id: number | null; message: string }[] = [];
  // deno-lint-ignore no-explicit-any
  type Acc = { campaigns: number; overlaps: number; errors: string[]; matched: number; unmatched: any[] | null };
  const blank = (): Acc => ({ campaigns: 0, overlaps: 0, errors: [], matched: 0, unmatched: null });
  const per = new Map<string, Acc>();
  for (const c of companies) per.set(c, blank());
  const accOf = (k: string) => {
    if (!per.has(k)) per.set(k, blank());
    return per.get(k)!;
  };
  const fail = (k: string, id: number, message: string) => {
    errors.push({ cusp_campaign_id: id, message });
    accOf(k).errors.push(`${id}: ${message}`);
  };
  // deno-lint-ignore no-explicit-any
  const failRest = (from: number, message: string) => { for (const r of rows.slice(from) as any[]) fail(r.company_id, r.cusp_campaign_id, message); };
  let campaigns = 0, overlaps = 0, matched = 0, unmatchedN = 0;
  let down: ApiError | null = null;
  try {
    try { await cusp((c) => c`select 1`); } catch (e) {   // CUSP down → 503 (after the log rows below)
      if (!(e instanceof ApiError)) throw e;
      down = e;
      failRest(0, e.message);
      if (!rows.length) for (const a of per.values()) a.errors.push(e.message);   // still visible in the log
    }
    for (let i = 0; !down && i < rows.length; i++) {
      const r = rows[i];
      if (Date.now() - t0 > SYNC_BUDGET_MS) { failRest(i, "time budget reached, not synced this run"); break; }
      const k = r.company_id as string;
      try {
        const l = await lookup(r.cusp_campaign_id);
        if (!l) throw new Error("not found in CUSP");
        const s = await skus(r.cusp_campaign_id);
        const payload = {
          company_id: k, cusp_campaign_id: r.cusp_campaign_id,
          cusp_name: l.name, cusp_seller_id: l.seller_id, cusp_seller: l.seller,
          begin_at: l.begin, end_at: l.end, cusp_state: l.state,
          sku_count: l.sku_count, skus: s,
        };
        const [res] = await sql`select public.lt_sync_apply((${JSON.stringify(payload)}::text)::jsonb) as r`;
        const n = Number(res?.r?.new_overlaps) || 0;
        const acc = accOf(k);
        acc.campaigns++; acc.overlaps += n; campaigns++; overlaps += n;
      } catch (e) {
        if (e instanceof ApiError && e.code === "cusp_unavailable") {   // CUSP dropped mid-run: stop, don't wait on every row
          failRest(i, e.message);
          break;
        }
        fail(k, r.cusp_campaign_id, e instanceof Error ? e.message : String(e));
      }
    }
    // ---- discover: CUSP campaigns named after a ticket that are not logged yet ----
    if (!down && Date.now() - t0 < SYNC_BUDGET_MS) {
      try {
        const tickets = await linkableTickets(company);
        const recent = await recentCampaigns();
        // deno-lint-ignore no-explicit-any
        const loggedRows = await sql`select company_id, cusp_campaign_id from public.listing_campaigns` as any[];
        // deno-lint-ignore no-explicit-any
        for (const k of new Set<string>([...per.keys(), ...tickets.map((t: any) => t.company_id as string)])) {
          const acc = accOf(k);
          const logged = new Set<number>(loggedRows.filter((x) => x.company_id === k).map((x) => Number(x.cusp_campaign_id)));
          // deno-lint-ignore no-explicit-any
          const { links, unmatched } = matchCampaigns(recent, ticketIndex(tickets.filter((t: any) => t.company_id === k)), logged);
          // deno-lint-ignore no-explicit-any
          acc.unmatched = unmatched.slice(0, UNMATCHED_KEEP).map((u: any) => ({ id: u.id, name: u.name, seller: u.seller, begin: u.begin, end: u.end, state: u.state, why: u.why }));
          unmatchedN += unmatched.length;
          let done = 0;
          for (const ln of links) {
            if (done >= DISCOVER_MAX || Date.now() - t0 > SYNC_BUDGET_MS) { acc.errors.push(`${links.length - done} matched campaigns wait for the next run`); break; }
            const id = Number(ln.campaign.id);
            try {
              const l = await lookup(id);
              if (!l) throw new Error("not found in CUSP");
              const s = await skus(id);
              const payload = {
                company_id: k, task_id: ln.ticket.task_id, cusp_campaign_id: id,
                cusp_name: l.name, cusp_seller_id: l.seller_id, cusp_seller: l.seller,
                platform: ln.platform || l.shops[0]?.platform || "Other", ctype: ln.ctype,
                begin_at: l.begin, end_at: l.end, cusp_state: l.state, sku_count: l.sku_count, skus: s,
                logged_by: ln.ticket.assignee || null, logged_at: new Date().toISOString(),
              };
              const [res] = await sql`select public.lt_sync_apply((${JSON.stringify(payload)}::text)::jsonb) as r`;
              const n = Number(res?.r?.new_overlaps) || 0;
              acc.campaigns++; acc.matched++; acc.overlaps += n; campaigns++; matched++; overlaps += n; done++;
            } catch (e) {
              if (e instanceof ApiError && e.code === "cusp_unavailable") { acc.errors.push(e.message); break; }
              fail(k, id, e instanceof Error ? e.message : String(e));
            }
          }
        }
      } catch (e) {
        const msg = `matching by ticket ID failed: ${e instanceof Error ? e.message : String(e)}`;
        errors.push({ cusp_campaign_id: null, message: msg });
        for (const a of per.values()) a.errors.push(msg);
      }
    }
  } finally {
    // "CUSP link not set up yet" is a standing fact, not a run: no log row every night until it exists.
    for (const [company_id, a] of down?.code === "cusp_not_configured" ? [] : per) {
      try {
        await sql`
          insert into public.listing_sync_log (company_id, ran_at, scope, campaigns, "overlaps", errors, matched, unmatched)
          values (${company_id}, now(), 'open', ${a.campaigns}, ${a.overlaps}, ${a.errors.length ? a.errors.join("\n") : null},
                  ${a.matched}, ${a.unmatched ? JSON.stringify(a.unmatched) : null}::jsonb)`;
      } catch (e) {
        errors.push({ cusp_campaign_id: null, message: `sync log not written for ${company_id}: ${e instanceof Error ? e.message : String(e)}` });
      }
    }
  }
  if (down) throw down;
  return { campaigns, overlaps, matched, unmatched: unmatchedN, errors };
}

function campaignId(b: Record<string, unknown>): number {
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "bad_id", "id must be a CUSP campaign number");
  return id;
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const caller = await authenticate(req);
  if (req.method !== "POST") throw new ApiError(405, "method_not_allowed", "POST only");
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { throw new ApiError(400, "bad_json", "Body must be JSON"); }
  if (!b || typeof b !== "object") throw new ApiError(400, "bad_json", "Body must be a JSON object");
  if (caller.kind === "cron" && b.action !== "sync") throw new ApiError(403, "sync_only", "The sync key only runs the sync");
  if (b.action === "lookup") {
    const r = await lookup(campaignId(b));
    if (!r) throw new ApiError(404, "not_found", "No CUSP campaign with that id");
    return json(200, r);
  }
  if (b.action === "skus") {
    const id = campaignId(b);
    return json(200, { skus: await skus(id) });
  }
  if (b.action === "sync") return json(200, await sync(caller));
  throw new ApiError(400, "bad_action", "action must be lookup, skus or sync");
}

Deno.serve(async (req: Request) => {
  const t0 = Date.now();
  let status = 500;
  try {
    const res = await handle(req);
    status = res.status;
    return res;
  } catch (e) {
    if (e instanceof ApiError) { status = e.status; return json(e.status, { code: e.code, message: e.message }); }
    // deno-lint-ignore no-explicit-any
    console.error("cusp-campaign internal error", (e as any)?.code, (e as any)?.message);
    return json(500, { code: "internal", message: "Internal error" });
  } finally {
    console.log(JSON.stringify({ fn: "cusp-campaign", method: req.method, status, ms: Date.now() - t0 }));
  }
});
