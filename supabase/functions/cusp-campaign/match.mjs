// Ticket ↔ CUSP campaign matching for the Listing Tracker sync (pure, no I/O; tests/test_listing_match.cjs).
// CUSP campaign names start with the ticket's ID: "<ticket> <platform> <dates> (<type>)", e.g.
//   "CFR-0412 SHP 11-13 NOV 2026 (PDP)"      — the DONE ticket number
//   "13512634613 LZD 11-13 NOV 2026 (Frame)" — the monday item id (the ticket's "monday ID" field)

const PLAT = { shp: "Shopee", shopee: "Shopee", lzd: "Lazada", lazada: "Lazada", tt: "TikTok", tiktok: "TikTok" };

/** "cfr-0412 " → "CFR-0412"; "13512634613" → "13512634613"; anything else → null */
export function ticketKey(v) {
  const m = String(v == null ? "" : v).trim().match(/^([A-Za-z]{2,5}-\d+|\d{4,})$/);
  return m ? m[1].toUpperCase() : null;
}

/** The parts of a CUSP campaign name. ticket = its first token when that looks like a ticket ID. */
export function parseName(name) {
  const s = String(name == null ? "" : name);
  const t = s.match(/^\s*([A-Za-z]{2,5}-\d+|\d{4,})(?=\s|$)/);
  const p = s.match(/(?:^|[^A-Za-z0-9])(SHP|SHOPEE|LZD|LAZADA|TT|TIKTOK)(?![A-Za-z0-9])/i);
  const g = s.match(/\(([^()]*)\)/g) || [];
  const kinds = g.map((x) => x.slice(1, -1).toLowerCase().replace(/\s+/g, ""));
  const ctype = kinds.some((k) => k === "pdp+frame" || k === "frame+pdp") ? "both"
    : kinds.includes("frame") ? "frame" : (kinds.includes("pdp") || kinds.includes("pd")) ? "pdp" : "other";
  return { ticket: t ? t[1].toUpperCase() : null, platform: p ? PLAT[p[1].toLowerCase()] : null, ctype };
}

/** tickets: [{task_id, ticket_no, monday_id, ...}] → Map key → ticket, or → null when two tickets carry the same ID. */
export function ticketIndex(tickets) {
  const idx = new Map();
  for (const t of tickets || []) {
    for (const k of new Set([ticketKey(t.ticket_no), ticketKey(t.monday_id)])) {
      if (!k) continue;
      idx.set(k, idx.has(k) && idx.get(k) && idx.get(k).task_id !== t.task_id ? null : (idx.has(k) ? idx.get(k) : t));
    }
  }
  return idx;
}

/**
 * campaigns: [{id, name, ...}] from CUSP; logged: Set of cusp ids already on a ticket.
 * → links:     [{campaign, ticket, platform, ctype}]  new setups to log on their ticket
 *   unmatched: [{...campaign, why}]                   in CUSP, on no ticket (no ID in the name / no such ticket / two tickets share it)
 */
export function matchCampaigns(campaigns, idx, logged) {
  const links = [], unmatched = [];
  for (const c of campaigns || []) {
    if (logged && logged.has(Number(c.id))) continue;
    const pn = parseName(c.name);
    if (!pn.ticket) { unmatched.push({ ...c, why: "no ticket ID at the start of the name" }); continue; }
    if (!idx.has(pn.ticket)) { unmatched.push({ ...c, why: `no open ticket carries ${pn.ticket}` }); continue; }
    const t = idx.get(pn.ticket);
    if (!t) { unmatched.push({ ...c, why: `two tickets carry ${pn.ticket}` }); continue; }
    links.push({ campaign: c, ticket: t, platform: pn.platform, ctype: pn.ctype });
  }
  return { links, unmatched };
}
