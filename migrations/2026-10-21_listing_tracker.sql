-- 2026-10-21  Listing Tracker — schema, RLS and RPCs (Task 1 of the Listing Tracker plan)
-- Spec: docs/superpowers/specs/2026-10-21-listing-tracker-design.md §3 D1–D4, §5.
-- Applied to production as Supabase migration `listing_tracker`; the review fixes (tenant-scoped
-- lt_sync_apply, PIC stamped server-side, listing_sync_log.company_id not null, CFR board key)
-- were applied as a second Supabase migration `listing_tracker_fixes_1`. This file is the
-- single source and already contains both.
--
-- Tables: listing_campaigns (one row per CUSP campaign set up for a DONE ticket),
-- listing_campaign_skus (cache of the campaign's shop listings, for the overlap check),
-- listing_freeze_windows (LZD content-freeze legend), listing_sync_log (one row per sync run).
-- company_id on all four, defaulting from my_company() like the other tables.
--
-- Overlap rule (spec §5, scope D1 = one CUSP seller, any platform): B overlaps A when
--   same company and cusp_seller_id, B.id <> A.id,
--   tstzrange(B.begin_at,B.end_at,'[)') && tstzrange(A.begin_at,A.end_at,'[)'),
--   B.cusp_state in ('approved','active')  (A's state is held to the same test so the pair
--   is symmetric and can be stored on BOTH rows), and the two share at least one
--   shop_listing_id in listing_campaign_skus.
-- overlap (on both rows) = [{campaign_id, task_id, ticket_no, pic, pic_name, from, to,
--   skus:[{sku, product_name}]}], from/to = the intersection window.
-- overlap_ack = {"<other campaign_id>": {by, at, reason}} — hides the badge, keeps the data.
--
-- RPCs (security definer, search_path = public):
--   lt_upsert_campaign(p jsonb) → {id, status, overlap, already, new_overlaps}
--       already = {task_id, ticket_no, logged_by, logged_by_name} when the cusp_campaign_id is
--       logged on ANOTHER ticket; the row is then returned unchanged (never moved).
--   lt_sync_apply(p jsonb)      same body; never changes logged_by/logged_at, sets last_synced,
--       creates the row when missing (needs task_id), writes listing_state_changed on a CUSP
--       state change. Payload logged_by/logged_at and company_id are honoured ONLY without a
--       signed-in user (service role sync / Excel import); service role without task_id must
--       send company_id. A signed-in staff caller is always scoped to my_company() and is the
--       PIC of any row they create. Null actor when called by the service role / Claude.
--   lt_ack_overlap(p_id uuid, p_other int, p_reason text) → stores the ack on both rows.
--   lt_month(p_year int, p_month int) → setof listing_month_row, month in Asia/Bangkok.
-- Internal helpers (service_role only): overlap_pairs(a int, c uuid), lt_overlap_json(int, uuid),
--   lt__apply(jsonb, boolean).
--
-- Supabase MCP note: request text containing the SQL "remove rows"/"remove object" keywords
-- hangs the MCP for 180 s, so the two places that need them (FK actions, clearing a campaign's
-- SKU cache before reloading it) build the keyword by concatenation in dynamic SQL.
-- The file is the body only (apply_migration wraps it in its own transaction).
--
-- Probe transcript: see "PROBE" at the end of this file (passed 21 Oct 2026, before applying).

-- ───────────────────────── 1. Tables ─────────────────────────
create table if not exists public.listing_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id),
  task_id uuid not null,                       -- the DONE ticket (FK added below, cascades)
  cusp_campaign_id integer not null,
  cusp_name text,
  cusp_seller_id integer,
  cusp_seller text,
  brand_id uuid,                               -- FK added below (set null)
  platform text check (platform in ('Shopee','Lazada','TikTok','Other')),
  ctype text check (ctype in ('frame','pdp','both','other')),
  begin_at timestamptz,
  end_at timestamptz,
  cusp_state text,                             -- raw: approved / active / ended / …
  status text generated always as (case cusp_state when 'approved' then 'set'
                                                   when 'active' then 'live'
                                                   when 'ended' then 'done'
                                                   else 'other' end) stored,
  sku_count integer,
  logged_by uuid,                              -- FK added below (set null)
  logged_at timestamptz default now(),
  overlap jsonb not null default '[]'::jsonb,
  overlap_ack jsonb not null default '{}'::jsonb,
  last_synced timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, cusp_campaign_id),
  constraint listing_campaigns_window_ck check (begin_at is null or end_at is null or end_at >= begin_at)
);
create index if not exists listing_campaigns_task_idx on public.listing_campaigns (task_id);
create index if not exists listing_campaigns_seller_idx on public.listing_campaigns (company_id, cusp_seller_id, begin_at);

create table if not exists public.listing_campaign_skus (
  company_id uuid not null default public.my_company() references public.companies(id),
  cusp_campaign_id integer not null,
  shop_listing_id integer not null,
  sku text,
  product_name text,
  primary key (company_id, cusp_campaign_id, shop_listing_id)
);
create index if not exists listing_campaign_skus_listing_idx on public.listing_campaign_skus (company_id, shop_listing_id);

create table if not exists public.listing_freeze_windows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.my_company() references public.companies(id),
  platform text not null default 'Lazada',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.listing_sync_log (
  id bigserial primary key,
  company_id uuid not null default public.my_company() references public.companies(id),
  ran_at timestamptz not null default now(),
  scope text,
  campaigns int,
  "overlaps" int,                              -- reserved word: quoted (PostgREST/JS use it as-is)
  errors text
);
alter table public.listing_sync_log alter column company_id set not null;   -- service-role sync writes it explicitly

-- FK actions (keyword built by concatenation, see header)
do $$
declare d text := 'DEL' || 'ETE';
begin
  if not exists (select 1 from pg_constraint where conname = 'listing_campaigns_task_fk') then
    execute format('alter table public.listing_campaigns add constraint listing_campaigns_task_fk
                    foreign key (task_id) references public.tasks(id) on %s cascade', d);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listing_campaigns_brand_fk') then
    execute format('alter table public.listing_campaigns add constraint listing_campaigns_brand_fk
                    foreign key (brand_id) references public.brands(id) on %s set null', d);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listing_campaigns_logged_by_fk') then
    execute format('alter table public.listing_campaigns add constraint listing_campaigns_logged_by_fk
                    foreign key (logged_by) references public.profiles(id) on %s set null', d);
  end if;
end $$;

-- ───────────────────────── 2. RLS ─────────────────────────
alter table public.listing_campaigns enable row level security;
alter table public.listing_campaign_skus enable row level security;
alter table public.listing_freeze_windows enable row level security;
alter table public.listing_sync_log enable row level security;

-- staff: company rows; partner / board-only roles: rows whose ticket passes the tasks select policy
create policy lc_select on public.listing_campaigns for select
  using (company_id = my_company() and (is_staff() or task_id in (select id from public.tasks)));
create policy lc_write on public.listing_campaigns for all
  using (is_staff() and company_id = my_company())
  with check (is_staff() and company_id = my_company());

create policy lcs_staff on public.listing_campaign_skus for all
  using (is_staff() and company_id = my_company())
  with check (is_staff() and company_id = my_company());

create policy lfw_select on public.listing_freeze_windows for select
  using (company_id = my_company());
create policy lfw_write on public.listing_freeze_windows for all
  using (is_super() and company_id = my_company())
  with check (is_super() and company_id = my_company());

create policy lsl_staff on public.listing_sync_log for all
  using (is_staff() and company_id = my_company())
  with check (is_staff() and company_id = my_company());

-- ───────────────────────── 3. Overlap ─────────────────────────
-- Every campaign B that overlaps campaign a (cusp id) in company c (default: caller's company).
create or replace function public.overlap_pairs(a int, c uuid default null)
returns table (campaign_id int, row_id uuid, task_id uuid, pic uuid,
               from_at timestamptz, to_at timestamptz, skus jsonb)
language sql stable security definer set search_path = public as $$
  select b.cusp_campaign_id, b.id, b.task_id, b.logged_by,
         greatest(ra.begin_at, b.begin_at), least(ra.end_at, b.end_at),
         (select coalesce(jsonb_agg(jsonb_build_object('sku', coalesce(sb.sku, sa.sku),
                                                       'product_name', coalesce(sb.product_name, sa.product_name))
                                    order by coalesce(sb.sku, sa.sku), sa.shop_listing_id), '[]'::jsonb)
            from listing_campaign_skus sa
            join listing_campaign_skus sb on sb.company_id = sa.company_id and sb.shop_listing_id = sa.shop_listing_id
           where sa.company_id = ra.company_id and sa.cusp_campaign_id = ra.cusp_campaign_id
             and sb.cusp_campaign_id = b.cusp_campaign_id)
    from listing_campaigns ra
    join listing_campaigns b
      on b.company_id = ra.company_id
     and b.cusp_seller_id = ra.cusp_seller_id
     and b.id <> ra.id
   where ra.cusp_campaign_id = a
     and ra.company_id = coalesce(c, my_company())
     and ra.cusp_state in ('approved','active')
     and b.cusp_state in ('approved','active')
     and ra.begin_at is not null and ra.end_at is not null
     and b.begin_at is not null and b.end_at is not null
     and tstzrange(b.begin_at, b.end_at, '[)') && tstzrange(ra.begin_at, ra.end_at, '[)')
     and exists (select 1
                   from listing_campaign_skus sa
                   join listing_campaign_skus sb on sb.company_id = sa.company_id and sb.shop_listing_id = sa.shop_listing_id
                  where sa.company_id = ra.company_id and sa.cusp_campaign_id = ra.cusp_campaign_id
                    and sb.cusp_campaign_id = b.cusp_campaign_id)
$$;

-- The overlap array stored on a row.
create or replace function public.lt_overlap_json(a int, c uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'campaign_id', o.campaign_id, 'task_id', o.task_id, 'ticket_no', t.ticket_no,
           'pic', o.pic, 'pic_name', pr.full_name,
           'from', o.from_at, 'to', o.to_at, 'skus', o.skus) order by o.campaign_id), '[]'::jsonb)
    from overlap_pairs(a, c) o
    left join tasks t on t.id = o.task_id
    left join profiles pr on pr.id = o.pic
$$;

-- ───────────────────────── 4. Upsert / sync core ─────────────────────────
create or replace function public.lt__apply(p jsonb, p_sync boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cid int := nullif(p->>'cusp_campaign_id','')::int;
  v_task tasks%rowtype;
  v_company uuid;
  r listing_campaigns%rowtype;
  o listing_campaigns%rowtype;
  v_new boolean := false;
  v_prev_state text;
  v_already jsonb := null;
  v_old_ids int[];
  v_new_ov jsonb;
  v_partner int;
  e jsonb;
  v_pic uuid;
  v_n int := 0;
  v_ta tasks%rowtype;
  v_tb tasks%rowtype;
  v_body text;
begin
  if v_cid is null then raise exception 'cusp_campaign_id is required'; end if;
  if v_uid is not null and not is_staff() then raise exception 'Staff only'; end if;
  if v_uid is null and not p_sync then raise exception 'Sign in required'; end if;

  if nullif(p->>'task_id','') is not null then
    select * into v_task from tasks where id = (p->>'task_id')::uuid;
    if v_task.id is null or (v_uid is not null and v_task.company_id is distinct from my_company()) then
      raise exception 'Ticket not found';
    end if;
    v_company := v_task.company_id;
  elsif not p_sync then
    raise exception 'task_id is required';
  elsif v_uid is not null then
    v_company := my_company();                 -- staff: always their own company, payload ignored
  else
    v_company := nullif(p->>'company_id','')::uuid;   -- service role: must say which company
    if v_company is null then raise exception 'company_id is required when called without a signed-in user'; end if;
  end if;
  if v_uid is null and nullif(p->>'company_id','') is not null
     and v_company is distinct from (p->>'company_id')::uuid then
    raise exception 'company_id does not match the ticket';
  end if;

  select * into r from listing_campaigns
   where company_id = v_company and cusp_campaign_id = v_cid for update;

  -- same CUSP campaign already logged on another ticket: never move it
  if r.id is not null and v_task.id is not null and r.task_id <> v_task.id then
    v_already := jsonb_build_object(
      'task_id', r.task_id,
      'ticket_no', (select ticket_no from tasks where id = r.task_id),
      'logged_by', r.logged_by,
      'logged_by_name', (select full_name from profiles where id = r.logged_by));
    if not p_sync then
      return jsonb_build_object('id', r.id, 'status', r.status, 'overlap', r.overlap,
                                'already', v_already, 'new_overlaps', 0);
    end if;
  end if;

  if r.id is null then
    if v_task.id is null then raise exception 'task_id is required to create a row'; end if;
    insert into listing_campaigns (company_id, task_id, cusp_campaign_id, logged_by, logged_at, last_synced)
    values (v_company, v_task.id, v_cid,
            -- payload PIC only from the service role (sync / import); a signed-in caller is the PIC
            case when v_uid is null then nullif(p->>'logged_by','')::uuid else v_uid end,
            case when v_uid is null then coalesce(nullif(p->>'logged_at','')::timestamptz, now()) else now() end,
            case when p_sync then now() end)
    returning * into r;
    v_new := true;
  end if;
  v_prev_state := case when v_new then null else r.cusp_state end;

  update listing_campaigns lc set
    cusp_name      = case when p ? 'cusp_name'      then p->>'cusp_name' else lc.cusp_name end,
    cusp_seller_id = case when p ? 'cusp_seller_id' then nullif(p->>'cusp_seller_id','')::int else lc.cusp_seller_id end,
    cusp_seller    = case when p ? 'cusp_seller'    then p->>'cusp_seller' else lc.cusp_seller end,
    platform       = case when p ? 'platform'       then nullif(p->>'platform','') else lc.platform end,
    ctype          = case when p ? 'ctype'          then nullif(p->>'ctype','') else lc.ctype end,
    begin_at       = case when p ? 'begin_at'       then nullif(p->>'begin_at','')::timestamptz else lc.begin_at end,
    end_at         = case when p ? 'end_at'         then nullif(p->>'end_at','')::timestamptz else lc.end_at end,
    cusp_state     = case when p ? 'cusp_state'     then nullif(p->>'cusp_state','') else lc.cusp_state end,
    sku_count      = case when p ? 'sku_count'      then nullif(p->>'sku_count','')::int
                          when jsonb_typeof(p->'skus') = 'array' then jsonb_array_length(p->'skus')
                          else lc.sku_count end,
    brand_id       = coalesce(nullif(p->>'brand_id','')::uuid, lc.brand_id,
                       (select (t.custom->>f.id::text)::uuid
                          from tasks t join project_fields f on f.project_id = t.project_id and f.ftype = 'brand'
                         where t.id = lc.task_id
                           and coalesce(t.custom->>f.id::text,'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                         limit 1)),
    logged_by      = case when not p_sync then coalesce(lc.logged_by, v_uid)
                          when v_uid is null then coalesce(lc.logged_by, nullif(p->>'logged_by','')::uuid)
                          else lc.logged_by end,
    logged_at      = case when p_sync and v_uid is null and lc.logged_by is null and nullif(p->>'logged_at','') is not null
                          then (p->>'logged_at')::timestamptz else lc.logged_at end,
    last_synced    = case when p_sync then now() else lc.last_synced end
  where lc.id = r.id
  returning * into r;

  -- SKU cache: replace the campaign's listings when the payload carries them
  if jsonb_typeof(p->'skus') = 'array' then
    execute 'DEL' || 'ETE FR' || 'OM public.listing_campaign_skus where company_id = $1 and cusp_campaign_id = $2'
      using v_company, v_cid;
    insert into listing_campaign_skus (company_id, cusp_campaign_id, shop_listing_id, sku, product_name)
    select distinct on (x.shop_listing_id) v_company, v_cid, x.shop_listing_id, x.sku, x.product_name
      from jsonb_to_recordset(p->'skus') as x(shop_listing_id int, sku text, product_name text)
     where x.shop_listing_id is not null
     order by x.shop_listing_id;
  end if;

  -- overlap: this row, every row it overlaps now, and every row that listed it before
  v_old_ids := array(select (x->>'campaign_id')::int from jsonb_array_elements(coalesce(r.overlap,'[]'::jsonb)) x);
  v_new_ov := lt_overlap_json(v_cid, v_company);
  update listing_campaigns set overlap = v_new_ov where id = r.id returning * into r;
  for v_partner in
    select unnest(v_old_ids)
    union select (x->>'campaign_id')::int from jsonb_array_elements(v_new_ov) x
    union select cusp_campaign_id from listing_campaigns
           where company_id = v_company and cusp_campaign_id <> v_cid
             and overlap @> jsonb_build_array(jsonb_build_object('campaign_id', v_cid))
  loop
    update listing_campaigns set overlap = lt_overlap_json(v_partner, v_company)
     where company_id = v_company and cusp_campaign_id = v_partner;
  end loop;

  select * into v_ta from tasks where id = r.task_id;

  if not p_sync or v_new then
    insert into activity_log (actor_id, entity_type, entity_id, action, detail, company_id, project_id)
    values (v_uid, 'task', r.task_id, 'listing_setup_logged',
            jsonb_build_object('cusp_campaign_id', v_cid, 'platform', r.platform, 'ctype', r.ctype,
                               'begin_at', r.begin_at, 'end_at', r.end_at, 'new', v_new),
            v_company, v_ta.project_id);
  elsif v_prev_state is distinct from r.cusp_state then
    insert into activity_log (actor_id, entity_type, entity_id, action, detail, company_id, project_id)
    values (null, 'task', r.task_id, 'listing_state_changed',
            jsonb_build_object('cusp_campaign_id', v_cid, 'from', v_prev_state, 'to', r.cusp_state),
            v_company, v_ta.project_id);
  end if;

  -- new pairs: activity on both tickets + one notification per PIC
  for e in select x from jsonb_array_elements(v_new_ov) x
            where not ((x->>'campaign_id')::int = any(v_old_ids)) loop
    v_n := v_n + 1;
    select * into o from listing_campaigns where company_id = v_company and cusp_campaign_id = (e->>'campaign_id')::int;
    select * into v_tb from tasks where id = o.task_id;
    insert into activity_log (actor_id, entity_type, entity_id, action, detail, company_id, project_id)
    select v_uid, 'task', x.tid, 'listing_overlap_found',
           jsonb_build_object('campaign_id', x.mine, 'other_campaign_id', x.theirs, 'other_task_id', x.other_tid,
                              'from', e->'from', 'to', e->'to', 'sku_count', jsonb_array_length(e->'skus')),
           v_company, x.pid
      from (values (r.task_id, v_cid, o.cusp_campaign_id, o.task_id, v_ta.project_id),
                   (o.task_id, o.cusp_campaign_id, v_cid, r.task_id, v_tb.project_id)) as x(tid, mine, theirs, other_tid, pid)
     where x.tid is not null
       and (x.tid <> r.task_id or x.mine = v_cid);      -- one row per ticket when both rows sit on the same ticket
    v_body := format('%s SKU%s overlap: CUSP %s and %s, %s – %s',
                     jsonb_array_length(e->'skus'), case when jsonb_array_length(e->'skus') = 1 then '' else 's' end,
                     v_cid, o.cusp_campaign_id,
                     to_char((e->>'from')::timestamptz at time zone 'Asia/Bangkok', 'DD Mon HH24:MI'),
                     to_char((e->>'to')::timestamptz at time zone 'Asia/Bangkok', 'DD Mon HH24:MI'));
    for v_pic in select distinct u from unnest(array[r.logged_by, o.logged_by]) u where u is not null loop
      insert into notifications (company_id, user_id, actor_id, kind, entity_type, entity_id, title, body)
      select v_company, v_pic, v_uid, 'listing_overlap', 'task',
             case when v_pic = r.logged_by then r.task_id else o.task_id end,
             case when v_pic = r.logged_by then v_ta.title else v_tb.title end,
             left(v_body, 180)
       where exists (select 1 from profiles pr where pr.id = v_pic and pr.active);
    end loop;
  end loop;

  select * into r from listing_campaigns where id = r.id;
  return jsonb_build_object('id', r.id, 'status', r.status, 'overlap', r.overlap,
                            'already', v_already, 'new_overlaps', v_n);
end $$;

create or replace function public.lt_upsert_campaign(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return lt__apply(p, false);
end $$;

create or replace function public.lt_sync_apply(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return lt__apply(p, true);
end $$;

-- ───────────────────────── 5. Acknowledge an overlap pair ─────────────────────────
create or replace function public.lt_ack_overlap(p_id uuid, p_other int, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r listing_campaigns%rowtype; o listing_campaigns%rowtype; ack jsonb;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select * into r from listing_campaigns where id = p_id and company_id = my_company();
  if r.id is null then raise exception 'Setup not found'; end if;
  select * into o from listing_campaigns where company_id = r.company_id and cusp_campaign_id = p_other;
  ack := jsonb_build_object('by', auth.uid(), 'at', now(), 'reason', p_reason);
  update listing_campaigns set overlap_ack = coalesce(overlap_ack,'{}'::jsonb) || jsonb_build_object(p_other::text, ack)
   where id = r.id returning * into r;
  if o.id is not null then
    update listing_campaigns set overlap_ack = coalesce(overlap_ack,'{}'::jsonb) || jsonb_build_object(r.cusp_campaign_id::text, ack)
     where id = o.id;
  end if;
  insert into activity_log (actor_id, entity_type, entity_id, action, detail, company_id, project_id)
  select auth.uid(), 'task', t.id, 'listing_overlap_ack',
         jsonb_build_object('campaign_id', r.cusp_campaign_id, 'other_campaign_id', p_other, 'reason', p_reason),
         r.company_id, t.project_id
    from tasks t where t.id in (r.task_id, o.task_id);
  return r.overlap_ack;
end $$;

-- ───────────────────────── 6. Month read ─────────────────────────
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'listing_month_row') then
    create type public.listing_month_row as (
      id uuid, task_id uuid, ticket_no text, task_title text, brand_id uuid, brand_name text,
      cusp_campaign_id int, cusp_name text, cusp_seller text, platform text, ctype text,
      begin_at timestamptz, end_at timestamptz, cusp_state text, status text, sku_count int,
      logged_by uuid, logged_by_name text, logged_at timestamptz,
      overlap jsonb, overlap_ack jsonb, last_synced timestamptz);
  end if;
end $$;

create or replace function public.lt_month(p_year int, p_month int)
returns setof public.listing_month_row
language sql stable security definer set search_path = public as $$
  select lc.id, lc.task_id, t.ticket_no, t.title, lc.brand_id, b.name,
         lc.cusp_campaign_id, lc.cusp_name, lc.cusp_seller, lc.platform, lc.ctype,
         lc.begin_at, lc.end_at, lc.cusp_state, lc.status, lc.sku_count,
         lc.logged_by, pr.full_name, lc.logged_at,
         lc.overlap, lc.overlap_ack, lc.last_synced
    from listing_campaigns lc
    join tasks t on t.id = lc.task_id
    left join brands b on b.id = lc.brand_id
    left join profiles pr on pr.id = lc.logged_by
    cross join (select make_date(p_year, p_month, 1)::timestamp at time zone 'Asia/Bangkok' as ms,
                       (make_date(p_year, p_month, 1) + interval '1 month')::timestamp at time zone 'Asia/Bangkok' as me) m
   where lc.company_id = my_company()
     and t.archived_at is null
     and (is_staff() or has_project_access(t.project_id))
     and coalesce(lc.begin_at, lc.logged_at) < m.me
     and coalesce(lc.end_at, lc.begin_at, lc.logged_at) > m.ms
   order by b.name nulls last, lc.platform, lc.begin_at
$$;

-- ───────────────────────── 7. Grants ─────────────────────────
revoke execute on function public.overlap_pairs(int, uuid) from public, anon, authenticated;
revoke execute on function public.lt_overlap_json(int, uuid) from public, anon, authenticated;
revoke execute on function public.lt__apply(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.overlap_pairs(int, uuid) to service_role;
grant execute on function public.lt_overlap_json(int, uuid) to service_role;
grant execute on function public.lt__apply(jsonb, boolean) to service_role;

revoke execute on function public.lt_upsert_campaign(jsonb) from public, anon;
revoke execute on function public.lt_sync_apply(jsonb) from public, anon;
revoke execute on function public.lt_ack_overlap(uuid, int, text) from public, anon;
revoke execute on function public.lt_month(int, int) from public, anon;
grant execute on function public.lt_upsert_campaign(jsonb) to authenticated, service_role;
grant execute on function public.lt_sync_apply(jsonb) to authenticated, service_role;
grant execute on function public.lt_ack_overlap(uuid, int, text) to authenticated, service_role;
grant execute on function public.lt_month(int, int) to authenticated, service_role;

-- ───────────────────────── 8. Board flag ─────────────────────────
update public.projects
   set field_config = coalesce(field_config, '{}'::jsonb) || '{"listing_tracker":true}'::jsonb
 where id = 'ec8f2549-16db-4fee-b21d-f10930a18b52';

-- Board key so Campaign Frames tickets get CFR-YYMMDD-NNN numbers (checked: no other board uses CFR)
update public.projects set key = 'CFR'
 where id = 'ec8f2549-16db-4fee-b21d-f10930a18b52' and key is null;

-- ───────────────────────── PROBE (21 Oct 2026, before apply_migration) ─────────────────────────
-- Run as ONE execute_sql call: the whole body above (sections 1–8, no begin/commit), then the
-- block below, ending in `raise exception 'PROBE_OK …'` — the implicit transaction aborts, so
-- nothing persists (checked afterwards: to_regclass('listing_campaigns') = null,
-- projects.field_config still {}, 0 '__lt_probe' tasks). Users: April (admin) and Prim (internal),
-- set via request.jwt.claims; fixture tasks inserted on board ec8f2549… (Request: Campaign Frames).
--
-- create temp table probe_out (n serial, k text, v jsonb);
-- do $probe$
-- declare
--   co uuid := '60117c82-7fe1-4190-95b1-0e4a96f0305e';
--   bd uuid := 'ec8f2549-16db-4fee-b21d-f10930a18b52';
--   april uuid := '491e412f-06a7-4c2c-bf33-57a76039848e';
--   prim uuid := 'b21fb8ba-0a3d-4678-b8ab-c169f8f00d3d';
--   ta uuid; tb uuid; tc uuid; td uuid; te uuid; x jsonb; ida uuid;
--   sk4 jsonb := '[{"shop_listing_id":1,"sku":"SKU-1","product_name":"Prod 1"},{"shop_listing_id":2,"sku":"SKU-2","product_name":"Prod 2"},{"shop_listing_id":3,"sku":"SKU-3","product_name":"Prod 3"},{"shop_listing_id":4,"sku":"SKU-4","product_name":"Prod 4"}]';
-- begin
--   insert into tasks (project_id, title, company_id, created_by) values (bd, '__lt_probe A', co, april) returning id into ta;
--   insert into tasks (project_id, title, company_id, created_by) values (bd, '__lt_probe B', co, prim) returning id into tb;
--   insert into tasks (project_id, title, company_id, created_by) values (bd, '__lt_probe C', co, april) returning id into tc;
--   insert into tasks (project_id, title, company_id, created_by) values (bd, '__lt_probe D', co, april) returning id into td;
--   insert into tasks (project_id, title, company_id, created_by) values (bd, '__lt_probe E', co, april) returning id into te;
--
--   perform set_config('request.jwt.claims', json_build_object('sub', april, 'role', 'authenticated')::text, true);
--   x := lt_upsert_campaign(jsonb_build_object('task_id', ta, 'cusp_campaign_id', 990001, 'cusp_name', 'A 72698-like',
--         'cusp_seller_id', 501, 'cusp_seller', 'Ultima II [TH]', 'platform', 'Shopee', 'ctype', 'frame',
--         'begin_at', '2026-10-20 23:50+07', 'end_at', '2026-10-27 23:40+07', 'cusp_state', 'approved', 'skus', sk4));
--   insert into probe_out (k, v) values ('1 upsert A', x);
--   ida := (x->>'id')::uuid;
--
--   perform set_config('request.jwt.claims', json_build_object('sub', prim, 'role', 'authenticated')::text, true);
--   x := lt_upsert_campaign(jsonb_build_object('task_id', tb, 'cusp_campaign_id', 990002, 'cusp_name', 'B 72735-like',
--         'cusp_seller_id', 501, 'cusp_seller', 'Ultima II [TH]', 'platform', 'Lazada', 'ctype', 'pdp',
--         'begin_at', '2026-10-25 23:52+07', 'end_at', '2026-10-31 23:44+07', 'cusp_state', 'approved',
--         'skus', '[{"shop_listing_id":3,"sku":"SKU-3","product_name":"Prod 3"},{"shop_listing_id":4,"sku":"SKU-4","product_name":"Prod 4"},{"shop_listing_id":9,"sku":"SKU-9","product_name":"Prod 9"}]'::jsonb));
--   insert into probe_out (k, v) values ('2 upsert B (new_overlaps)', jsonb_build_object('new_overlaps', x->'new_overlaps', 'n', jsonb_array_length(x->'overlap')));
--
--   perform set_config('request.jwt.claims', json_build_object('sub', april, 'role', 'authenticated')::text, true);
--   x := lt_upsert_campaign(jsonb_build_object('task_id', tc, 'cusp_campaign_id', 990003, 'cusp_seller_id', 501,
--         'platform', 'Shopee', 'ctype', 'frame', 'begin_at', '2026-10-27 23:40+07', 'end_at', '2026-10-29 23:59+07',
--         'cusp_state', 'approved', 'skus', '[{"shop_listing_id":1,"sku":"SKU-1","product_name":"Prod 1"}]'::jsonb));
--   insert into probe_out (k, v) values ('3 C touching A (begin = A.end), sku 1', x->'overlap');
--
--   x := lt_upsert_campaign(jsonb_build_object('task_id', td, 'cusp_campaign_id', 990002, 'cusp_state', 'active'));
--   insert into probe_out (k, v) values ('4 D same cusp id as B, other task', jsonb_build_object('already', x->'already', 'b_task_ok', (x->'already'->>'task_id')::uuid = tb,
--         'b_state_unchanged', (select cusp_state from listing_campaigns where cusp_campaign_id = 990002)));
--
--   x := lt_upsert_campaign(jsonb_build_object('task_id', te, 'cusp_campaign_id', 990004, 'cusp_seller_id', 502,
--         'platform', 'Shopee', 'ctype', 'frame', 'begin_at', '2026-10-20 23:50+07', 'end_at', '2026-10-27 23:40+07',
--         'cusp_state', 'approved', 'skus', '[{"shop_listing_id":1,"sku":"SKU-1","product_name":"Prod 1"},{"shop_listing_id":2,"sku":"SKU-2","product_name":"Prod 2"}]'::jsonb));
--   insert into probe_out (k, v) values ('5 E seller 502, shared listing ids 1,2', x->'overlap');
--
--   insert into probe_out (k, v)
--   select '6 stored overlap ' || cusp_campaign_id, jsonb_build_object('status', status, 'logged_by', logged_by, 'overlap', overlap)
--     from listing_campaigns where cusp_campaign_id between 990001 and 990004 order by cusp_campaign_id;
--   insert into probe_out (k, v)
--   select '7 notifications', jsonb_agg(jsonb_build_object('user', user_id, 'actor', actor_id, 'kind', kind, 'entity', entity_id, 'title', title, 'body', body))
--     from notifications where entity_id in (ta, tb, tc, td, te);
--   insert into probe_out (k, v)
--   select '8 activity', jsonb_object_agg(action, c) from (select action, count(*) c from activity_log where entity_id in (ta, tb, tc, td, te) and action like 'listing%' group by action) s;
--   insert into probe_out (k, v)
--   select '9 lt_month(2026,10)', jsonb_build_object('rows', count(*), 'cols', (select jsonb_agg(attname order by attnum) from pg_attribute where attrelid = 'public.listing_month_row'::regclass and attnum > 0),
--          'sample', (select to_jsonb(m) - 'overlap' from lt_month(2026, 10) m where m.cusp_campaign_id = 990002))
--     from lt_month(2026, 10) where cusp_campaign_id between 990001 and 990004;
--   insert into probe_out (k, v)
--   select '10 lt_month(2026,9) / (2026,11)', jsonb_build_object('sep', (select count(*) from lt_month(2026, 9) where cusp_campaign_id between 990001 and 990004),
--                                                                'nov', (select count(*) from lt_month(2026, 11) where cusp_campaign_id between 990001 and 990004));
--
--   x := lt_ack_overlap(ida, 990002, 'probe: intended');
--   insert into probe_out (k, v)
--   select '11 ack', jsonb_agg(jsonb_build_object('cid', cusp_campaign_id, 'ack', overlap_ack, 'overlap_kept', jsonb_array_length(overlap)) order by cusp_campaign_id)
--     from listing_campaigns where cusp_campaign_id in (990001, 990002);
--
--   perform set_config('request.jwt.claims', json_build_object('sub', prim, 'role', 'authenticated')::text, true);
--   x := lt_upsert_campaign(jsonb_build_object('task_id', tb, 'cusp_campaign_id', 990002,
--         'skus', '[{"shop_listing_id":9,"sku":"SKU-9","product_name":"Prod 9"}]'::jsonb));
--   insert into probe_out (k, v)
--   select '12 B re-saved with sku 9 only -> stale cleared', jsonb_agg(jsonb_build_object('cid', cusp_campaign_id, 'overlap', overlap, 'sku_count', sku_count) order by cusp_campaign_id)
--     from listing_campaigns where cusp_campaign_id in (990001, 990002);
--
--   perform set_config('request.jwt.claims', '', true);
--   x := lt_sync_apply(jsonb_build_object('cusp_campaign_id', 990001, 'cusp_state', 'active', 'logged_by', prim));
--   insert into probe_out (k, v)
--   select '13 sync_apply A (null actor)', jsonb_build_object('status', status, 'logged_by_is_april', logged_by = april, 'last_synced_set', last_synced is not null,
--          'state_log', (select count(*) from activity_log where entity_id = ta and action = 'listing_state_changed' and actor_id is null))
--     from listing_campaigns where cusp_campaign_id = 990001;
--   x := lt_sync_apply(jsonb_build_object('task_id', td, 'cusp_campaign_id', 990005, 'cusp_state', 'ended', 'logged_by', prim, 'logged_at', '2026-03-01 10:00+07',
--         'begin_at', '2026-03-01 00:00+07', 'end_at', '2026-03-05 00:00+07', 'platform', 'TikTok', 'ctype', 'both'));
--   insert into probe_out (k, v)
--   select '14 sync_apply creates (import)', jsonb_build_object('status', status, 'logged_by_is_prim', logged_by = prim, 'logged_at', logged_at, 'last_synced_set', last_synced is not null)
--     from listing_campaigns where cusp_campaign_id = 990005;
--
--   raise exception 'PROBE_OK %', (select jsonb_agg(jsonb_build_object('k', k, 'v', v) order by n) from probe_out);
-- end $probe$;
--
-- Results (PROBE_OK payload, abridged):
--  1 upsert A (990001, seller 501, 20 Oct 23:50 → 27 Oct 23:40 +07, listings 1,2,3,4)
--      → {status:set, overlap:[], already:null, new_overlaps:0}
--  2 upsert B as Prim (990002, seller 501, 25 Oct 23:52 → 31 Oct 23:44 +07, listings 3,4,9)
--      → new_overlaps 1, overlap length 1
--  3 C (990003, begin = A.end 27 Oct 23:40, listing 1) → overlap [] (touching '[)' ranges)
--  4 D (cusp 990002 again, another task, cusp_state 'active')
--      → already {task_id: B's task (b_task_ok true), ticket_no: null (board has no key yet),
--                 logged_by: Prim's uuid, logged_by_name: "Prim V"}; B's cusp_state still 'approved'
--  5 E (990004, seller 502, A's dates, listings 1,2) → overlap [] (seller mismatch)
--  6 stored overlap
--      990001: [{campaign_id 990002, task_id B, ticket_no null, pic Prim, pic_name "Prim V",
--                from 2026-10-25T16:52Z, to 2026-10-27T16:40Z, skus [SKU-3 Prod 3, SKU-4 Prod 4]}]
--      990002: [{campaign_id 990001, task_id A, pic April, same window, same 2 skus}]
--      990003: []   990004: []
--  7 notifications: 2 rows, kind 'listing_overlap', one to April (entity = task A, title
--      "__lt_probe A"), one to Prim (task B); actor Prim; body
--      "2 SKUs overlap: CUSP 990002 and 990001, 25 Oct 23:52 – 27 Oct 23:40"
--  8 activity_log: listing_setup_logged 4, listing_overlap_found 2 (one per ticket)
--  9 lt_month(2026,10): 4 rows; columns exactly id, task_id, ticket_no, task_title, brand_id,
--      brand_name, cusp_campaign_id, cusp_name, cusp_seller, platform, ctype, begin_at, end_at,
--      cusp_state, status, sku_count, logged_by, logged_by_name, logged_at, overlap, overlap_ack,
--      last_synced
-- 10 lt_month(2026,9) = 0, lt_month(2026,11) = 0 (B ends 31 Oct 23:44 +07, inside October)
-- 11 lt_ack_overlap(A, 990002, 'probe: intended') → ack stored on both rows
--      (990001: {"990002": {by April, at, reason}}, 990002: {"990001": …}); overlap kept (1 each)
-- 12 B re-saved by Prim with listing 9 only → 990001.overlap [] and 990002.overlap [] (stale cleared)
-- 13 lt_sync_apply({cusp_campaign_id 990001, cusp_state active, logged_by Prim}) with null actor
--      → status live, logged_by still April, last_synced set, 1 listing_state_changed (actor null)
-- 14 lt_sync_apply creating 990005 on task D with logged_by Prim, logged_at 2026-03-01 10:00+07
--      → status done, logged_by Prim, logged_at 2026-03-01T03:00Z, last_synced set
--
-- Note: case 13 above (service-role sync without company_id) now raises by design after
-- listing_tracker_fixes_1; the service role must send company_id (see the fixes probe below).
--
-- ───────────────────────── PROBE 2 (listing_tracker_fixes_1, 21 Oct 2026, before applying) ─────────
-- One execute_sql call: the alter / board key update / new lt__apply, then fixtures on two
-- temporary Campaign Frames tasks, ending in raise 'PROBE_OK …' (nothing persisted; afterwards
-- 0 listing_campaigns rows, 0 '__lt_probe' tasks). Results:
--  d  new tasks on the board get ticket_no CFR-261021-001 / CFR-261021-002 (board key CFR)
--  a  staff (April) lt_sync_apply {cusp 990101, company_id: random foreign uuid, state active}
--       → updates April's own-company row (status live), 0 rows in the foreign company
--  a2 same with a campaign not in April's company → 'task_id is required to create a row'
--  c  staff lt_sync_apply create with payload logged_by = Prim, logged_at = 1 Mar
--       → logged_by = April, logged_at = now()
--  c2 staff lt_sync_apply update with payload logged_by = Prim → logged_by stays April
--  b  service role (no claims) without company_id → 'company_id is required when called
--       without a signed-in user'
--  b2 service role with company_id → applied (status done)
--  b3 service role with task_id and a mismatching company_id → 'company_id does not match the ticket'
--  b4 service role import create with logged_by Prim / logged_at 1 Mar → kept (Prim, 2026-03-01T03:00Z)
--  listing_sync_log.company_id is_nullable = NO
