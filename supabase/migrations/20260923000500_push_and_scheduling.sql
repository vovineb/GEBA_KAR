-- CASS: push delivery and scheduled maintenance.
--
-- Push: every in-app notification row triggers an HTTP call (pg_net) to the
-- `send-push` Edge Function. The project URL and a shared webhook secret are
-- read from Supabase Vault so nothing environment-specific lives in this
-- migration. Until both secrets exist, notifications are stored in-app only.
-- See README "Push notifications" for the two `vault.create_secret` calls.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.dispatch_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'cass_project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cass_push_webhook_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cass-webhook-secret', v_secret),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
exception when others then
  -- Push is best effort; never block the transaction that created the
  -- notification (e.g. a seat acceptance).
  raise warning 'dispatch_push failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.dispatch_push() from public, anon, authenticated;

create trigger notifications_dispatch_push after insert on public.notifications
  for each row execute function public.dispatch_push();

-- Every 5 minutes: expire stale trips, auto-complete forgotten active trips
-- (which also stops location sharing), send departure reminders and
-- generate upcoming recurring commute instances.
select cron.schedule('cass-trip-maintenance', '*/5 * * * *', $$select public.run_trip_maintenance()$$);
