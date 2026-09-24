-- CASS: server-side secrets live only in Supabase Vault.
-- Edge Functions read them through these service-role-only functions, so a
-- secret is set once (SQL below / README) and never copied into function
-- settings, the repo or the app.
--
--   select vault.create_secret('<OpenRouteService key>', 'cass_ors_api_key');
--   select vault.create_secret('https://<ref>.supabase.co', 'cass_project_url');
--   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cass_push_webhook_secret');

create or replace function public.get_server_secret(p_name text)
returns text language sql stable security definer set search_path = '' as $$
  -- Allow-list: only secrets Edge Functions legitimately need.
  select decrypted_secret from vault.decrypted_secrets
  where name = p_name and p_name in ('cass_ors_api_key')
$$;

create or replace function public.verify_push_webhook_secret(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_secret is not null and p_secret <> '' and exists (
    select 1 from vault.decrypted_secrets
    where name = 'cass_push_webhook_secret' and decrypted_secret = p_secret
  )
$$;

revoke execute on function public.get_server_secret(text) from public, anon, authenticated;
revoke execute on function public.verify_push_webhook_secret(text) from public, anon, authenticated;
grant execute on function public.get_server_secret(text) to service_role;
grant execute on function public.verify_push_webhook_secret(text) to service_role;
