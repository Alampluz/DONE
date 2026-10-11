import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DoneError, STATUSES, PRIORITIES } from "./client.js";

const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (e) => {
  const body = e instanceof DoneError
    ? { error: e.message, code: e.code, status: e.status, ...(e.current ? { current_task: e.current } : {}), hint: hintFor(e.code) }
    : { error: "Unexpected error in done-mcp", code: "client_error" };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
};

function hintFor(code) {
  return ({
    invalid_key: "The bot key is wrong, expired or revoked. Stop and tell a human.",
    key_expired: "The bot key has expired. Stop and tell a human.",
    key_revoked: "The bot key was revoked. Stop and tell a human.",
    key_disabled: "The bot key is disabled. Stop and tell a human.",
    board_not_allowed: "That board is outside this bot's allowlist. Do not retry.",
    status_not_allowed: "Use status 'review' instead; a human closes the ticket.",
    missing_scope: "This bot is not allowed to do that.",
    conflict: "Someone changed the ticket. Look at current_task, decide again, then retry.",
    forbidden_by_rls: "DONE permissions refused it. Report to a human.",
    rejected_by_rule: "A board rule refused it. Tell the requester what the rule said.",
    api_disabled: "DONE has switched bot access off. Stop and try again later.",
    rate_limited: "Too many calls. Wait a minute.",
    bot_user_pending: "The bot is not set up in DONE yet. Tell a human.",
    timeout: "DONE did not answer. For comments, check with done_get_task whether it was posted before trying again.",
  })[code];
}

const wrap = (fn) => async (args) => { try { return ok(await fn(args)); } catch (e) { return fail(e); } };

/**
 * Build an MCP server for one bot. `me` is the /whoami result; tools are
 * registered from its scopes, and status choices exclude deny_statuses.
 */
export function buildServer(client, me) {
  const server = new McpServer({ name: "done", version: "1.0.0" }, {
    instructions:
      `DONE is CREA's ticket tracker (boards → groups → tasks/tickets). You act as bot "${me.display_name}". ` +
      `Use done_list_boards to find a board, then done_list_tasks / done_get_task. Read a ticket before changing it. ` +
      (me.deny_statuses?.length ? `You may NOT set status ${me.deny_statuses.join("/")}: move finished work to 'review' and a human closes it. ` : "") +
      `Custom fields can be given by their label (e.g. "Platform"). To assign or mention someone, find their profile id with done_find_people first. ` +
      `Never repeat a comment that may already have been posted: re-read the ticket first.`,
  });

  const allowedStatuses = STATUSES.filter((s) => !(me.deny_statuses || []).includes(s));
  const boards = me.all_boards ? null : [...me.write_boards, ...me.read_boards];
  const writable = me.all_boards || me.write_boards.length > 0;
  const boardSchema = me.all_boards ? z.string().uuid() : z.enum(me.write_boards);
  const RO = { readOnlyHint: true, openWorldHint: true };
  const RW = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

  server.registerTool("done_whoami", {
    title: "Who am I in DONE",
    description: "Shows this bot's name, scopes, boards it can write and read, denied statuses and key expiry.",
    inputSchema: {},
    annotations: RO,
  }, wrap(async () => {
    const w = await client.whoami(true);
    const days = client.daysToExpiry();
    return { ...w, days_to_key_expiry: days, ...(days !== null && days < 14 ? { warning: `Bot key expires in ${days} days. Ask a DONE admin for a new key.` } : {}) };
  }));

  if (me.scopes.includes("tasks:read")) {
    server.registerTool("done_list_boards", {
      title: "List DONE boards",
      description: "Lists the boards this bot can use, with id, key (ticket prefix), name, workspace, whether it is writable, and open ticket count. Filter by part of a name or key, e.g. 'GWP'. Call this first to find the right project_id.",
      inputSchema: { query: z.string().max(100).optional() },
      annotations: RO,
    }, wrap((a) => client.listBoards(a)));

    server.registerTool("done_list_tasks", {
      title: "List or search DONE tickets",
      description: "Lists tickets on the boards this bot may read, newest-updated first. Filter by board, status, assignment to this bot, text in title/ticket number, or updated_since (ISO time) for polling. Archived tickets are excluded.",
      inputSchema: {
        project_id: z.string().uuid().optional().describe(boards ? `Board id. Allowed: ${boards.join(", ")}. Omit for all.` : "Board id from done_list_boards. Omit to search every board."),
        status: z.enum(STATUSES).optional(),
        assigned_to_me: z.boolean().optional().describe("Only tickets assigned to the bot user"),
        query: z.string().max(200).optional().describe("Substring of title or ticket_no, e.g. GWP-261002-014"),
        updated_since: z.string().datetime({ offset: true }).optional().describe("Only tickets updated strictly after this ISO time"),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional().describe("next_cursor from the previous page"),
      },
      annotations: RO,
    }, wrap((a) => client.listTasks(a)));

    server.registerTool("done_get_task", {
      title: "Read one DONE ticket",
      description: "Returns the ticket with description, its board's custom fields (labels, types, options), groups and comments. Always call this before changing a ticket.",
      inputSchema: { task_id: z.string().uuid() },
      annotations: RO,
    }, wrap(({ task_id }) => client.getTask(task_id)));
  }

  if (me.scopes.includes("tasks:read")) {
    server.registerTool("done_find_people", {
      title: "Find people in DONE",
      description: "Finds active CREA staff by name or email (e.g. a ticket's 'Requester email'), or turns profile ids (assignee_id, comment author_id) into names. Use the returned id for assignee_id or mentions.",
      inputSchema: {
        query: z.string().min(2).max(100).optional().describe("Part of a name or email"),
        ids: z.array(z.string().uuid()).max(50).optional().describe("Profile ids to look up"),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: RO,
    }, wrap((a) => client.findPeople(a)));
  }

  if (me.scopes.includes("tasks:write") && writable) {
    server.registerTool("done_update_task", {
      title: "Update a DONE ticket",
      description:
        "Changes status, priority, assignee, due date, group, or custom fields of a ticket on a board this bot may write. " +
        "fields takes labels or field ids, e.g. {\"Platform\":\"Lazada\",\"Total number of Mechanic Setups\":3}; null clears a value. " +
        "The ticket is locked to the version you last read; if someone changed it you get a conflict with the fresh ticket.",
      inputSchema: {
        task_id: z.string().uuid(),
        status: z.enum(allowedStatuses).optional(),
        priority: z.enum(PRIORITIES).optional(),
        assignee_id: z.string().uuid().nullable().optional().describe("Profile id from done_find_people, or null to unassign"),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        group_id: z.string().uuid().optional().describe("Group uuid from done_get_task"),
        fields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
        expected_updated_at: z.string().optional().describe("Leave empty: filled from your last read"),
      },
      annotations: { ...RW, idempotentHint: true },
    }, wrap(({ task_id, ...rest }) => client.updateTask(task_id, rest)));

    server.registerTool("done_set_status", {
      title: "Set a DONE ticket's status",
      description: `Moves a ticket to another status: ${allowedStatuses.join(", ")}.` + (me.deny_statuses?.length ? ` (${me.deny_statuses.join("/")} is for humans only: use review.)` : ""),
      inputSchema: { task_id: z.string().uuid(), status: z.enum(allowedStatuses) },
      annotations: { ...RW, idempotentHint: true },
    }, wrap(({ task_id, status }) => client.updateTask(task_id, { status })));
  }

  if (me.scopes.includes("comments:write") && writable) {
    server.registerTool("done_add_comment", {
      title: "Comment on a DONE ticket",
      description: `Posts a comment as ${me.display_name}. DONE adds the "[${me.display_name}]" prefix itself. Comments never send email. Not safe to repeat: if a call fails or times out, read the ticket first to see whether it was posted.`,
      inputSchema: {
        task_id: z.string().uuid(),
        body: z.string().min(1).max(5000),
        mentions: z.array(z.string().uuid()).max(20).optional().describe("Profile ids from done_find_people"),
      },
      annotations: { ...RW, idempotentHint: false },
    }, wrap(({ task_id, body, mentions }) => client.addComment(task_id, body, mentions)));
  }

  if (me.scopes.includes("tasks:create") && writable) {
    server.registerTool("done_create_task", {
      title: "Create a DONE ticket",
      description: "Creates a ticket on a board this bot may write. DONE assigns the ticket number. Not safe to repeat: search by title before retrying a failed call.",
      inputSchema: {
        project_id: boardSchema.describe("Board id from done_list_boards"),
        title: z.string().min(1).max(300),
        description: z.string().max(20000).optional(),
        status: z.enum(allowedStatuses).optional(),
        priority: z.enum(PRIORITIES).optional(),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        group_id: z.string().uuid().optional(),
        fields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      },
      annotations: { ...RW, idempotentHint: false },
    }, wrap((a) => client.createTask(a)));
  }

  return server;
}
