-- Listing Tracker: nightly CUSP sync (Task 10).
-- pg_cron calls poke_listing_sync() at 23:00 UTC (06:00 Bangkok); the poke posts {"action":"sync"} to the
-- cusp-campaign edge function. Same pattern as poke_mail_sender / poke_bot_dispatch: a shared key in the
-- vault (listing_sync_key) sent as a custom header (x-listing-sync-key), fixed functions URL, pg_net.
-- cusp-campaign reads the same vault secret over SUPABASE_DB_URL, so the key exists in one place only and
-- never appears in this file. The key is accepted for action 'sync' only.
-- State-change entries: lt__apply (2026-10-21_listing_tracker.sql) already writes activity_log
-- 'listing_state_changed' {cusp_campaign_id, from, to} with a null actor when a sync changes cusp_state;
-- ltLogHTML renders them as "CUSP <brand> · <platform> · <Type> (<id>) went live / ended".

-- 1. The shared key (random, generated in the database; created once).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'listing_sync_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'listing_sync_key',
      'x-listing-sync-key header for the cusp-campaign edge function (nightly Listing Tracker sync)');
  end if;
end $$;

-- 2. The poke.
create or replace function public.poke_listing_sync()
returns void language plpgsql security definer set search_path = public as $$
declare k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'listing_sync_key';
  if k is null then return; end if;
  perform net.http_post(
    url := 'https://sknspnorwpoayymvndaz.supabase.co/functions/v1/cusp-campaign',
    headers := jsonb_build_object('Content-Type','application/json','x-listing-sync-key', k),
    body := '{"action":"sync"}'::jsonb,
    timeout_milliseconds := 150000);   -- the function stops itself at 120 s (SYNC_BUDGET_MS)
exception when others then
  raise warning 'poke_listing_sync: %', sqlerrm;
end $$;

revoke all on function public.poke_listing_sync() from public, anon, authenticated;

-- 3. The schedule (idempotent: replace an existing job of the same name).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'listing-sync-nightly') then
    perform cron.unschedule('listing-sync-nightly');
  end if;
  perform cron.schedule('listing-sync-nightly', '0 23 * * *', $job$select public.poke_listing_sync()$job$);
end $$;

-- Verify:
--   select jobid, jobname, schedule, command from cron.job where jobname = 'listing-sync-nightly';
--   select public.poke_listing_sync();
--   select id, status_code, left(content,200) from net._http_response order by id desc limit 1;
--   select * from listing_sync_log order by ran_at desc limit 3;
