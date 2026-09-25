-- Minimal stand-ins for the Supabase platform pieces the migrations touch,
-- so migrations + pgTAP tests can run on a plain PostgreSQL/PostGIS server
-- (scripts/test-db.sh). Not used on real Supabase projects.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create schema auth;
create schema storage;
create schema vault;
create schema net;
create schema cron;
grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  is_anonymous boolean not null default false
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant execute on function auth.jwt() to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to authenticated;

create table vault.secrets (name text primary key, secret text);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;

create table net.calls (id bigserial primary key, url text, headers jsonb, body jsonb);
create function net.http_post(url text, headers jsonb default '{}', body jsonb default '{}')
returns bigint language sql as $$
  insert into net.calls (url, headers, body) values (url, headers, body) returning id
$$;

create table cron.jobs (name text primary key, schedule text, command text);
create function cron.schedule(name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.jobs values (name, schedule, command)
  on conflict (name) do update set schedule = excluded.schedule, command = excluded.command;
  select 1::bigint
$$;

create publication supabase_realtime;
