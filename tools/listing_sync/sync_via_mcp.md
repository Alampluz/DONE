# Listing Tracker sync through the MCP (stand-in until `CUSP_DB_URL` exists)

The `cusp-campaign` edge function answers `503 cusp_not_configured` ("CUSP link not set up yet")
until CREA IT issues a read-only CUSP DB user and it is stored as the Supabase secret `CUSP_DB_URL`
(`503 cusp_unavailable` once it is set but CUSP does not answer). Until then the ticket's "Log a
setup" box tells the PIC to paste the CUSP ID in a comment and ask April to log it, and a Cowork
session runs the nightly sync — and logs those new setups — by hand with two MCPs:

- **CREA Tech MCP** `query_cusp` (read-only CUSP; SELECT only, 100 rows per call, never select
  credential/token/secret columns, always filter `catalog_assetgroup` / `catalog_shoplisting` /
  `catalog_variant` / `catalog_product` by the campaign).
- **Supabase MCP** `execute_sql` on project `sknspnorwpoayymvndaz` (runs with no signed-in user,
  so `lt_sync_apply` takes `company_id` from the payload — it is required).

The CUSP SQL below is the same SQL the edge function ships (validated on campaign 72731 on
21 Oct 2026: 142 listings; 72736 → 111, 72737 → 7, 72955 → 30). The only difference is the
`json_agg` wrapper in step 2, which packs the SKU rows into one result row so the 100-row MCP
limit does not cut a campaign's listings.

## 1. Which campaigns to refresh (Supabase `execute_sql`)

```sql
select company_id, cusp_campaign_id, platform, ctype
  from public.listing_campaigns
 where end_at >= now() - interval '7 days'
 order by company_id, cusp_campaign_id;
```

## 2. CUSP facts + SKUs, one row per campaign (CREA Tech `query_cusp`)

Put the ids from step 1 in the `in (...)` list (up to ~20 per call keeps the payload readable).

```sql
select c.id as cusp_campaign_id, c.name as cusp_name, c.seller_id as cusp_seller_id, s.name as cusp_seller,
       c.begin as begin_at, c."end" as end_at, c.state as cusp_state,
       (select count(distinct ag.shop_listing_id) from catalog_assetgroup ag where ag.campaign_id = c.id) as sku_count,
       (select coalesce(json_agg(json_build_object('shop_listing_id', x.shop_listing_id, 'sku', x.sku, 'product_name', x.product_name) order by x.shop_listing_id), '[]'::json)
          from (select sl.id as shop_listing_id, v.seller_sku as sku, coalesce(nullif(p.name, ''), v.name) as product_name
                  from catalog_shoplisting sl
                  join catalog_variant v on v.id = sl.variant_id
                  join catalog_product p on p.id = v.product_id
                 where sl.id in (select distinct ag.shop_listing_id from catalog_assetgroup ag where ag.campaign_id = c.id and ag.shop_listing_id is not null)
                 limit 5000) x) as skus
  from catalog_campaign c left join catalog_seller s on s.id = c.seller_id
 where c.id in (72731, 72736, 72737, 72955) limit 100
```

An id from step 1 that does not come back here is "not found in CUSP": record it as an error, do not call step 3 for it.

For reference, the function's own two statements (`lookup` and `skus`, `$1` = campaign id):

```sql
select c.id, c.name, c.begin, c."end", c.state, c.seller_id, s.name as seller, c.positions,
       (select count(distinct ag.shop_listing_id) from catalog_assetgroup ag where ag.campaign_id = c.id) as sku_count
  from catalog_campaign c left join catalog_seller s on s.id = c.seller_id
 where c.id = $1;

select sh.id as shop_id, sh.name, sh.marketplace          -- lookup.shops; marketplace shopee/lazada/tiktok → Shopee/Lazada/TikTok, else Other
  from catalog_campaign_shops cs join catalog_shop sh on sh.id = cs.shop_id
 where cs.campaign_id = $1 order by sh.id;

select sl.id as shop_listing_id, v.seller_sku as sku, coalesce(nullif(p.name, ''), v.name) as product_name
  from catalog_shoplisting sl
  join catalog_variant v on v.id = sl.variant_id
  join catalog_product p on p.id = v.product_id
 where sl.id in (select distinct ag.shop_listing_id from catalog_assetgroup ag where ag.campaign_id = $1 and ag.shop_listing_id is not null)
 order by sl.id limit 5000;   -- through the MCP: limit 100 offset 0, 100, … instead
```

## 3. Apply each campaign (Supabase `execute_sql`)

One statement per step-1 row. Paste the step-2 row for that campaign as the JSON literal (keys
`cusp_campaign_id, cusp_name, cusp_seller_id, cusp_seller, begin_at, end_at, cusp_state, sku_count, skus`);
`company_id`, `platform` and `ctype` come from the DONE row and are passed unchanged.
Double any single quote inside the JSON (`'` → `''`) — product names sometimes contain one.

```sql
select lc.cusp_campaign_id,
       public.lt_sync_apply(
         '<step-2 row as JSON>'::jsonb
         || jsonb_build_object('company_id', lc.company_id, 'platform', lc.platform, 'ctype', lc.ctype)
       ) as result
  from public.listing_campaigns lc
 where lc.company_id = '<company_id from step 1>'
   and lc.cusp_campaign_id = <cusp_campaign_id>;
```

`result.new_overlaps` is the number of new overlap pairs this campaign raised (notifications already sent by the RPC).
If a statement errors, note `{cusp_campaign_id, message}` and carry on with the next one.

## 4. Log the run, one row per company touched (Supabase `execute_sql`)

```sql
insert into public.listing_sync_log (company_id, ran_at, scope, campaigns, "overlaps", errors)
values ('<company_id>', now(), 'mcp', <campaigns applied>, <sum of new_overlaps>, <null or '72731: message' lines>);
```

`"overlaps"` must stay quoted (reserved word). `scope = 'mcp'` tells these runs apart from the
edge function's (`'open'`). The page's "last synced" reads `listing_campaigns.last_synced`, which
step 3 already stamped.

## Log a new setup by hand (until CUSP is connected)

A PIC pastes the CUSP campaign ID in a comment on the ticket. To create the `listing_campaigns`
row from it:

1. Find the ticket, its company and the PIC who asked (Supabase `execute_sql`):

   ```sql
   select t.id as task_id, t.company_id, t.ticket_no, c.author_id as logged_by, c.created_at as logged_at
     from public.tasks t join public.comments c on c.entity_type = 'task' and c.entity_id = t.id
    where t.ticket_no = '<CFR-0412>' and c.body like '%<72739>%'
    order by c.created_at limit 1;
   ```

2. Run the step-2 CUSP query above for that one id (`where c.id in (<72739>)`). No row → the ID is
   wrong; reply on the ticket instead of logging.
3. Read `platform` and `ctype` from the campaign name the same way the page does: `SHP`/`Shopee` →
   `Shopee`, `LZD`/`Lazada` → `Lazada`, `TT`/`TikTok` → `TikTok`, else `Other`; the trailing
   `(Frame)` → `frame`, `(PDP)`/`(PD)` → `pdp`, `(PDP+Frame)` → `both`, anything else → `other`.
4. Create the row with the service role (Supabase `execute_sql`; no signed-in user, so
   `lt_sync_apply` honours `company_id`, `logged_by` and `logged_at` from the payload, creates the
   row because `task_id` is set, stamps `last_synced`, and runs the overlap check + notifications):

   ```sql
   select public.lt_sync_apply('{
     "task_id":          "<task_id from 1>",
     "company_id":       "<company_id from 1>",
     "logged_by":        "<logged_by from 1>",
     "logged_at":        "<logged_at from 1>",
     "platform":         "Shopee",
     "ctype":            "both",
     "cusp_campaign_id": 72739,
     "cusp_name":        "<step-2 cusp_name>",
     "cusp_seller_id":   <step-2 cusp_seller_id>,
     "cusp_seller":      "<step-2 cusp_seller>",
     "begin_at":         "<step-2 begin_at>",
     "end_at":           "<step-2 end_at>",
     "cusp_state":       "<step-2 cusp_state>",
     "sku_count":        <step-2 sku_count>,
     "skus":             <step-2 skus array>
   }'::jsonb) as result;
   ```

   Double any single quote inside the JSON (`'` → `''`). `result.already` set means the campaign
   is already logged on another ticket (nothing was moved); tell the PIC which one. Otherwise the
   row now shows under "Campaign setups" on the ticket with the PIC as the person who logged it.
