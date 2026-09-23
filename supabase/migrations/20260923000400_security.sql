-- CASS: Row Level Security, column privileges and function privileges.
-- Principle: least privilege. Tables are readable only as far as the product
-- needs; all state transitions go through the SECURITY DEFINER RPCs in the
-- business-logic migration.

-- Helper used by chat policies: any (current or former) conversation member.
create or replace function public.is_in_conversation(p_conversation_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id
  )
$$;

-- Policy helpers that must not re-enter RLS (trips <-> trip_requests would
-- otherwise recurse).
create or replace function public.is_trip_creator(p_trip_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trips where id = p_trip_id and creator_id = p_user_id)
$$;

create or replace function public.has_trip_request(p_trip_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trip_requests where trip_id = p_trip_id and requester_id = p_user_id)
$$;

-- Owner's own vehicles, including the registration number.
create or replace function public.my_vehicles()
returns setof public.vehicles language sql stable security definer set search_path = '' as $$
  select * from public.vehicles where owner_id = auth.uid() and status = 'active' order by created_at
$$;

-- A device token belongs to whoever signed in on it most recently.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, uid, p_platform, now())
  on conflict (token) do update set user_id = uid, platform = excluded.platform, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere.
-- ---------------------------------------------------------------------------
alter table public.configuration        enable row level security;
alter table public.profiles             enable row level security;
alter table public.vehicles             enable row level security;
alter table public.places               enable row level security;
alter table public.pickup_points        enable row level security;
alter table public.recurring_trips      enable row level security;
alter table public.trips                enable row level security;
alter table public.trip_stops           enable row level security;
alter table public.trip_requests        enable row level security;
alter table public.trip_members         enable row level security;
alter table public.live_locations       enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.ratings              enable row level security;
alter table public.reports              enable row level security;
alter table public.user_blocks          enable row level security;
alter table public.trip_incidents       enable row level security;
alter table public.notifications        enable row level security;
alter table public.push_tokens          enable row level security;
alter table public.analytics_events     enable row level security;

-- ---------------------------------------------------------------------------
-- Table and column privileges. Start from nothing, then grant.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.configuration, public.places, public.pickup_points to authenticated;

-- Public profile columns only; phone number is private (see get_my_profile).
grant select (id, full_name, avatar_path, bio, rating_average, rating_count, completed_trips_count, created_at)
  on public.profiles to authenticated;
grant update (full_name, phone_number, avatar_path, bio) on public.profiles to authenticated;

-- Registration numbers are only revealed to trip participants (get_trip_detail)
-- and to the owner (my_vehicles).
grant select (id, owner_id, make, model, year, colour, seat_capacity, photo_path, status, created_at, updated_at)
  on public.vehicles to authenticated;
grant insert (owner_id, make, model, year, colour, registration_number, seat_capacity, photo_path)
  on public.vehicles to authenticated;
grant update (make, model, year, colour, registration_number, seat_capacity, photo_path, status)
  on public.vehicles to authenticated;

grant select on public.recurring_trips to authenticated;
grant update (vehicle_id, pickup_point_id, dropoff_point_id, weekdays, departure_local_time, end_date,
              total_seats, suggested_contribution, expressway_option, luggage_policy, notes, status)
  on public.recurring_trips to authenticated;

grant select on public.trips to authenticated;
grant update (vehicle_id, pickup_point_id, dropoff_point_id, total_seats, suggested_contribution, luggage_policy, notes)
  on public.trips to authenticated;

grant select on public.trip_stops, public.trip_requests, public.trip_members, public.live_locations,
  public.conversations, public.conversation_members, public.messages, public.ratings, public.reports,
  public.user_blocks, public.trip_incidents, public.notifications, public.push_tokens to authenticated;

grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
grant insert (trip_id, rater_id, ratee_id, stars, comment) on public.ratings to authenticated;
grant insert (reporter_id, reported_user_id, trip_id, reason, details) on public.reports to authenticated;
grant insert (blocker_id, blocked_id), delete on public.user_blocks to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.push_tokens to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy "configuration readable" on public.configuration
  for select to authenticated using (true);

create policy "places readable when active" on public.places
  for select to authenticated using (is_active);

create policy "pickup points readable when active" on public.pickup_points
  for select to authenticated using (is_active);

create policy "profiles readable" on public.profiles
  for select to authenticated using (true);
create policy "profiles self update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "vehicles readable" on public.vehicles
  for select to authenticated using (true);
create policy "vehicles owner insert" on public.vehicles
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "vehicles owner update" on public.vehicles
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "recurring owner read" on public.recurring_trips
  for select to authenticated using (creator_id = (select auth.uid()));
create policy "recurring owner update" on public.recurring_trips
  for update to authenticated using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));

create policy "trips discoverable or involved" on public.trips
  for select to authenticated using (
    creator_id = (select auth.uid())
    or public.is_trip_participant(id, (select auth.uid()))
    or public.has_trip_request(id, (select auth.uid()))
    or (status in ('open', 'full') and not public.is_blocked_between((select auth.uid()), creator_id))
  );
create policy "trips creator update" on public.trips
  for update to authenticated
  using (creator_id = (select auth.uid()) and status in ('draft', 'open', 'full'))
  with check (creator_id = (select auth.uid()));

create policy "trip stops follow trip visibility" on public.trip_stops
  for select to authenticated using (exists (select 1 from public.trips t where t.id = trip_id));

create policy "requests visible to requester and creator" on public.trip_requests
  for select to authenticated using (
    requester_id = (select auth.uid()) or public.is_trip_creator(trip_id, (select auth.uid()))
  );

create policy "members visible to participants" on public.trip_members
  for select to authenticated using (
    user_id = (select auth.uid()) or public.is_trip_participant(trip_id, (select auth.uid()))
  );

create policy "live location visible to participants during trip" on public.live_locations
  for select to authenticated using (
    public.is_trip_participant(trip_id, (select auth.uid()))
    and exists (select 1 from public.trips t where t.id = trip_id and t.status = 'in_progress')
  );

create policy "conversations visible to members" on public.conversations
  for select to authenticated using (public.is_in_conversation(id, (select auth.uid())));

create policy "conversation members visible to members" on public.conversation_members
  for select to authenticated using (public.is_in_conversation(conversation_id, (select auth.uid())));

create policy "messages visible to members" on public.messages
  for select to authenticated using (public.is_in_conversation(conversation_id, (select auth.uid())));
create policy "messages sent by active members" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id, (select auth.uid()))
  );

create policy "ratings readable" on public.ratings
  for select to authenticated using (true);
create policy "ratings by rater" on public.ratings
  for insert to authenticated with check (rater_id = (select auth.uid()));

create policy "reports own read" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));
create policy "reports own insert" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

create policy "blocks own read" on public.user_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "blocks own insert" on public.user_blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "blocks own delete" on public.user_blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

create policy "incidents involving me" on public.trip_incidents
  for select to authenticated using (
    subject_user_id = (select auth.uid()) or recorded_by = (select auth.uid())
  );

create policy "notifications own read" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications own update" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "push tokens own read" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push tokens own delete" on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- analytics_events: RLS on, no policies -> only the service role and
-- SECURITY DEFINER functions can touch it.

-- ---------------------------------------------------------------------------
-- Function privileges: nothing is executable unless granted below.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function
  -- used inside RLS policies (evaluated as the caller)
  public.is_trip_participant(uuid, uuid),
  public.is_blocked_between(uuid, uuid),
  public.is_conversation_member(uuid, uuid),
  public.is_in_conversation(uuid, uuid),
  public.is_trip_creator(uuid, uuid),
  public.has_trip_request(uuid, uuid),
  -- client RPCs
  public.get_my_profile(),
  public.my_vehicles(),
  public.suggest_contribution(integer, boolean),
  public.create_trip(jsonb),
  public.start_trip(uuid),
  public.complete_trip(uuid),
  public.cancel_trip(uuid, text),
  public.request_seat(uuid, integer, uuid, uuid, text),
  public.respond_to_request(uuid, boolean),
  public.cancel_request(uuid),
  public.report_no_show(uuid, uuid),
  public.create_recurring_trip(jsonb),
  public.search_trips(double precision, double precision, double precision, double precision, date, time,
                      integer, public.trip_type, public.expressway_option, boolean, integer, integer),
  public.get_trip_detail(uuid),
  public.my_trips(boolean, integer, integer),
  public.update_live_location(uuid, double precision, double precision, real, real, real, timestamptz),
  public.stop_sharing_location(uuid),
  public.list_conversations(integer, integer),
  public.mark_conversation_read(uuid),
  public.unread_counts(),
  public.list_blocked_users(),
  public.log_search(jsonb),
  public.prepare_account_deletion(),
  public.register_push_token(text, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public-read image buckets; users write only inside <their uid>/.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('vehicle-photos', 'vehicle-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "cass images own folder read" on storage.objects
  for select to authenticated using (
    bucket_id in ('avatars', 'vehicle-photos') and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "cass images own folder insert" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('avatars', 'vehicle-photos') and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "cass images own folder update" on storage.objects
  for update to authenticated using (
    bucket_id in ('avatars', 'vehicle-photos') and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "cass images own folder delete" on storage.objects
  for delete to authenticated using (
    bucket_id in ('avatars', 'vehicle-photos') and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Realtime: only tables where live updates add real value. Postgres Changes
-- respects the RLS policies above for every subscriber.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.messages, public.trip_requests, public.trips, public.live_locations, public.notifications;
