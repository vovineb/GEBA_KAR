-- CASS: business rules enforced by the database.
-- The mobile client is never trusted: every state change that matters
-- (seat reservation, trip lifecycle, ratings, chat membership) is validated
-- here. Client-callable RPCs are SECURITY DEFINER with explicit auth checks
-- and a fixed search_path.

-- ===========================================================================
-- Generic helpers
-- ===========================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Read a configuration value. Raises if the key is missing so misconfiguration
-- is loud instead of silently falling back to a hidden constant.
create or replace function public.cfg(p_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  select value into v from public.configuration where key = p_key;
  if v is null then
    raise exception 'configuration key "%" is missing', p_key using errcode = 'P0001';
  end if;
  return v;
end;
$$;

create or replace function public.cfg_timezone()
returns text language sql stable set search_path = '' as $$
  select public.cfg('timezone') #>> '{}'
$$;

-- Raise a client-facing error with a stable machine code (the app maps codes
-- to friendly messages; raw database errors are never shown to users).
create or replace function public.fail(p_code text, p_detail text default null)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception '%', p_code using errcode = 'P0001', detail = coalesce(p_detail, p_code), hint = 'cass';
end;
$$;

create or replace function public.require_user()
returns uuid language plpgsql stable set search_path = '' as $$
declare
  v uuid := auth.uid();
begin
  if v is null then
    perform public.fail('not_authenticated');
  end if;
  return v;
end;
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- Creator or confirmed/completed passenger of a trip.
create or replace function public.is_trip_participant(p_trip_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = p_user_id
      and status in ('confirmed', 'completed')
  )
$$;

create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id and is_active
  )
$$;

create or replace function public.track(p_user uuid, p_event public.analytics_event, p_props jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.analytics_events (user_id, event, properties) values (p_user, p_event, coalesce(p_props, '{}'::jsonb));
$$;

create or replace function public.notify(
  p_user uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_trip uuid default null,
  p_related_user uuid default null,
  p_data jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, related_trip_id, related_user_id, data)
  values (p_user, p_type, left(p_title, 120), left(p_body, 300), p_trip, p_related_user, coalesce(p_data, '{}'::jsonb));
end;
$$;

create or replace function public.display_name(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(btrim(full_name), ''), 'A CASS member') from public.profiles where id = p_user
$$;

create or replace function public.trip_label(p_trip_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select origin_name || ' → ' || destination_name || ', ' ||
         to_char(departure_time at time zone public.cfg_timezone(), 'Dy DD Mon HH24:MI')
  from public.trips where id = p_trip_id
$$;

-- ===========================================================================
-- Profiles
-- ===========================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 80));
  perform public.track(new.id, 'account_created');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.get_my_profile()
returns public.profiles language sql stable security definer set search_path = '' as $$
  select * from public.profiles where id = auth.uid()
$$;

-- ===========================================================================
-- Vehicles
-- ===========================================================================

create or replace function public.normalize_vehicle()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.registration_number := upper(regexp_replace(btrim(new.registration_number), '\s+', ' ', 'g'));
  new.make := btrim(new.make);
  new.model := btrim(new.model);
  new.colour := btrim(new.colour);
  if tg_op = 'UPDATE' then
    new.owner_id := old.owner_id;
  end if;
  return new;
end;
$$;

create trigger vehicles_normalize before insert or update on public.vehicles
  for each row execute function public.normalize_vehicle();
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

-- A vehicle's seat capacity includes the traveller's own seat.
create or replace function public.assert_vehicle_for_trip(p_vehicle_id uuid, p_creator uuid, p_seats int)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  v public.vehicles;
begin
  select * into v from public.vehicles where id = p_vehicle_id;
  if v.id is null or v.owner_id <> p_creator or v.status <> 'active' then
    perform public.fail('vehicle_invalid');
  end if;
  if p_seats > v.seat_capacity - 1 then
    perform public.fail('seats_exceed_vehicle_capacity');
  end if;
end;
$$;

create or replace function public.assert_meeting_point(p_point_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_point_id is not null and not exists (
    select 1 from public.pickup_points where id = p_point_id and is_active
  ) then
    perform public.fail('pickup_point_invalid');
  end if;
end;
$$;

-- ===========================================================================
-- Contribution engine (single source of truth; the app calls this RPC).
-- Scales the configured pilot reference range by route distance. It is a
-- cost-sharing suggestion, never a fare.
-- ===========================================================================

create or replace function public.suggest_contribution(p_distance_m integer, p_uses_expressway boolean)
returns table (min_amount numeric, max_amount numeric, currency text)
language plpgsql stable security definer set search_path = '' as $$
declare
  c jsonb := public.cfg('contribution');
  band jsonb := c -> (case when p_uses_expressway then 'expressway' else 'normal' end);
  ref_km numeric := (c ->> 'reference_distance_km')::numeric;
  step numeric := (c ->> 'rounding_step')::numeric;
  floor_amount numeric := (c ->> 'minimum_amount')::numeric;
  km numeric;
begin
  if p_distance_m is null or p_distance_m <= 0 then
    return;
  end if;
  km := p_distance_m / 1000.0;
  min_amount := greatest(floor_amount, round((band ->> 'min')::numeric * km / ref_km / step) * step);
  max_amount := greatest(min_amount, round((band ->> 'max')::numeric * km / ref_km / step) * step);
  currency := public.cfg('currency') #>> '{}';
  return next;
end;
$$;

create or replace function public.assert_contribution(p_amount numeric, p_distance_m integer, p_expressway public.expressway_option)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  s record;
  mult numeric := (public.cfg('contribution') ->> 'max_multiplier')::numeric;
begin
  if p_amount is null or p_distance_m is null then
    return;
  end if;
  select * into s from public.suggest_contribution(p_distance_m, p_expressway = 'use');
  if s.max_amount is not null and p_amount > s.max_amount * mult then
    perform public.fail('contribution_too_high', 'Maximum ' || (s.max_amount * mult)::text);
  end if;
end;
$$;

-- ===========================================================================
-- Trips: validation and the status machine
-- ===========================================================================

create or replace function public.trip_transition_allowed(p_from public.trip_status, p_to public.trip_status)
returns boolean language sql immutable set search_path = '' as $$
  select p_from = p_to or (p_from, p_to) in (
    ('draft', 'open'), ('draft', 'cancelled'),
    ('open', 'full'), ('open', 'in_progress'), ('open', 'cancelled'), ('open', 'expired'),
    ('full', 'open'), ('full', 'in_progress'), ('full', 'cancelled'), ('full', 'expired'),
    ('in_progress', 'completed'), ('in_progress', 'cancelled')
  )
$$;

create or replace function public.trips_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'open') then
      perform public.fail('invalid_trip_status');
    end if;
    if new.departure_time <= now() then
      perform public.fail('departure_in_past');
    end if;
    new.reserved_seats := 0;
    new.started_at := null;
    new.completed_at := null;
    new.cancelled_at := null;
    new.reminder_sent_at := null;
    new.currency := coalesce(new.currency, public.cfg('currency') #>> '{}');
    perform public.assert_vehicle_for_trip(new.vehicle_id, new.creator_id, new.total_seats);
    perform public.assert_meeting_point(new.pickup_point_id);
    perform public.assert_meeting_point(new.dropoff_point_id);
    perform public.assert_contribution(new.suggested_contribution, new.distance_m, new.expressway_option);
    return new;
  end if;

  -- UPDATE
  if new.creator_id <> old.creator_id or new.trip_type <> old.trip_type then
    perform public.fail('trip_immutable_field');
  end if;
  if new.total_seats <> old.total_seats or new.vehicle_id <> old.vehicle_id then
    if new.total_seats < new.reserved_seats then
      perform public.fail('seats_below_reserved');
    end if;
    perform public.assert_vehicle_for_trip(new.vehicle_id, new.creator_id, new.total_seats);
  end if;
  if new.pickup_point_id is distinct from old.pickup_point_id then
    perform public.assert_meeting_point(new.pickup_point_id);
  end if;
  if new.dropoff_point_id is distinct from old.dropoff_point_id then
    perform public.assert_meeting_point(new.dropoff_point_id);
  end if;
  if new.suggested_contribution is distinct from old.suggested_contribution then
    perform public.assert_contribution(new.suggested_contribution, new.distance_m, new.expressway_option);
  end if;

  -- Seat availability drives open <-> full automatically.
  if new.status in ('open', 'full') then
    new.status := case when new.reserved_seats >= new.total_seats then 'full' else 'open' end;
  end if;

  if not public.trip_transition_allowed(old.status, new.status) then
    perform public.fail('invalid_trip_transition', old.status || ' -> ' || new.status);
  end if;

  if new.status <> old.status then
    case new.status
      when 'in_progress' then new.started_at := now();
      when 'completed' then new.completed_at := now();
      when 'cancelled' then new.cancelled_at := now();
      else null;
    end case;
  end if;
  return new;
end;
$$;

create trigger trips_before_write before insert or update on public.trips
  for each row execute function public.trips_before_write();
create trigger trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

create or replace function public.trips_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.trip_members (trip_id, user_id, role, seat_count, pickup_point_id, dropoff_point_id)
  values (new.id, new.creator_id, 'creator', 0, new.pickup_point_id, new.dropoff_point_id);
  perform public.track(new.creator_id, 'trip_created',
    jsonb_build_object('trip_id', new.id, 'trip_type', new.trip_type, 'recurring', new.recurring_trip_id is not null));
  return new;
end;
$$;

create trigger trips_after_insert after insert on public.trips
  for each row execute function public.trips_after_insert();

-- Side effects of lifecycle changes.
create or replace function public.trips_after_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m record;
  label text := public.trip_label(new.id);
  late_minutes int := (public.cfg('trip_rules') ->> 'late_cancellation_minutes')::int;
  minutes_left int := floor(extract(epoch from (new.departure_time - now())) / 60);
begin
  -- Location is only ever kept while a trip is in progress.
  if old.status = 'in_progress' and new.status <> 'in_progress' then
    delete from public.live_locations where trip_id = new.id;
  end if;

  if new.status = 'cancelled' then
    update public.trip_requests set status = 'cancelled', responded_at = now()
      where trip_id = new.id and status = 'pending';
    for m in
      select user_id from public.trip_members
      where trip_id = new.id and role = 'passenger' and status = 'confirmed'
    loop
      perform public.notify(m.user_id, 'trip_cancelled', 'Trip cancelled',
        label || ' was cancelled by the trip creator.', new.id, new.creator_id,
        jsonb_build_object('reason', new.cancellation_reason));
    end loop;
    if exists (select 1 from public.trip_members where trip_id = new.id and role = 'passenger' and status = 'confirmed') then
      insert into public.trip_incidents (trip_id, subject_user_id, recorded_by, kind, minutes_before_departure)
      values (new.id, new.creator_id, new.creator_id,
              case when minutes_left <= late_minutes then 'late_cancellation'::public.incident_kind else 'cancellation' end,
              minutes_left);
    end if;
    perform public.track(new.creator_id, 'trip_cancelled', jsonb_build_object('trip_id', new.id, 'from', old.status));
  elsif new.status = 'in_progress' then
    for m in
      select user_id from public.trip_members
      where trip_id = new.id and role = 'passenger' and status = 'confirmed'
    loop
      perform public.notify(m.user_id, 'trip_starting', 'Your trip has started',
        public.display_name(new.creator_id) || ' started ' || label || '. Open the trip to see live location.',
        new.id, new.creator_id);
    end loop;
    perform public.track(new.creator_id, 'trip_started', jsonb_build_object('trip_id', new.id));
  elsif new.status = 'expired' then
    update public.trip_requests set status = 'expired', responded_at = now()
      where trip_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger trips_after_status_change after update of status on public.trips
  for each row when (old.status is distinct from new.status)
  execute function public.trips_after_status_change();

-- Create a trip (single or recurring instance). Route geometry arrives as a
-- GeoJSON LineString produced by the routing service.
create or replace function public.create_trip(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  v_id uuid;
  s jsonb;
  i int := 0;
begin
  insert into public.trips (
    creator_id, vehicle_id, trip_type,
    origin_name, origin_lat, origin_lng,
    destination_name, destination_lat, destination_lng,
    pickup_point_id, dropoff_point_id,
    route_geometry, distance_m, duration_s,
    departure_time, estimated_arrival, total_seats,
    suggested_contribution, expressway_option, luggage_policy, notes, status
  ) values (
    uid, (p ->> 'vehicle_id')::uuid, (p ->> 'trip_type')::public.trip_type,
    btrim(p ->> 'origin_name'), (p ->> 'origin_lat')::float8, (p ->> 'origin_lng')::float8,
    btrim(p ->> 'destination_name'), (p ->> 'destination_lat')::float8, (p ->> 'destination_lng')::float8,
    nullif(p ->> 'pickup_point_id', '')::uuid, nullif(p ->> 'dropoff_point_id', '')::uuid,
    case when p ? 'route_geojson' and jsonb_typeof(p -> 'route_geojson') = 'object'
         then extensions.st_setsrid(extensions.st_geomfromgeojson((p -> 'route_geojson')::text), 4326) end,
    nullif(p ->> 'distance_m', '')::numeric::int, nullif(p ->> 'duration_s', '')::numeric::int,
    (p ->> 'departure_time')::timestamptz,
    coalesce(
      nullif(p ->> 'estimated_arrival', '')::timestamptz,
      case when nullif(p ->> 'duration_s', '') is not null
           then (p ->> 'departure_time')::timestamptz + make_interval(secs => (p ->> 'duration_s')::numeric) end
    ),
    (p ->> 'total_seats')::smallint,
    nullif(p ->> 'suggested_contribution', '')::numeric,
    coalesce((p ->> 'expressway_option')::public.expressway_option, 'either'),
    coalesce((p ->> 'luggage_policy')::public.luggage_policy, 'small'),
    nullif(btrim(p ->> 'notes'), ''),
    'open'
  ) returning id into v_id;

  if jsonb_typeof(p -> 'stops') = 'array' then
    for s in select * from jsonb_array_elements(p -> 'stops') loop
      i := i + 1;
      insert into public.trip_stops (trip_id, position, name, lat, lng)
      values (v_id, i, btrim(s ->> 'name'), (s ->> 'lat')::float8, (s ->> 'lng')::float8);
    end loop;
  end if;
  return v_id;
end;
$$;

create or replace function public.start_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  t public.trips;
  window_min int := (public.cfg('trip_rules') ->> 'start_window_minutes')::int;
begin
  select * into t from public.trips where id = p_trip_id for update;
  if t.id is null or t.creator_id <> uid then
    perform public.fail('not_trip_creator');
  end if;
  if t.status not in ('open', 'full') then
    perform public.fail('invalid_trip_transition', t.status || ' -> in_progress');
  end if;
  if now() < t.departure_time - make_interval(mins => window_min) then
    perform public.fail('too_early_to_start', window_min::text);
  end if;
  update public.trips set status = 'in_progress' where id = p_trip_id;
end;
$$;

create or replace function public.complete_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  t public.trips;
  shared boolean;
  m record;
begin
  select * into t from public.trips where id = p_trip_id for update;
  if t.id is null or t.creator_id <> uid then
    perform public.fail('not_trip_creator');
  end if;
  if t.status <> 'in_progress' then
    perform public.fail('invalid_trip_transition', t.status || ' -> completed');
  end if;
  perform public.finish_trip(p_trip_id);
end;
$$;

-- Shared by complete_trip and the maintenance job (auto-complete).
create or replace function public.finish_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  shared boolean;
  m record;
begin
  select * into t from public.trips where id = p_trip_id;
  update public.trips set status = 'completed' where id = p_trip_id;
  update public.trip_members set status = 'completed', completed_at = now()
    where trip_id = p_trip_id and status = 'confirmed';
  shared := exists (select 1 from public.trip_members where trip_id = p_trip_id and role = 'passenger' and status = 'completed');
  if shared then
    update public.profiles p set completed_trips_count = completed_trips_count + 1
      from public.trip_members tm
      where tm.trip_id = p_trip_id and tm.status = 'completed' and p.id = tm.user_id;
  end if;
  for m in select user_id from public.trip_members where trip_id = p_trip_id and role = 'passenger' and status = 'completed' loop
    perform public.notify(m.user_id, 'trip_completed', 'Trip completed',
      'You arrived. Rate your trip with ' || public.display_name(t.creator_id) || '.', p_trip_id, t.creator_id);
  end loop;
  perform public.track(t.creator_id, 'trip_completed', jsonb_build_object('trip_id', p_trip_id, 'shared', shared));
end;
$$;

create or replace function public.cancel_trip(p_trip_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  t public.trips;
begin
  select * into t from public.trips where id = p_trip_id for update;
  if t.id is null or t.creator_id <> uid then
    perform public.fail('not_trip_creator');
  end if;
  update public.trips set status = 'cancelled', cancellation_reason = nullif(left(btrim(p_reason), 300), '')
    where id = p_trip_id;
end;
$$;

-- ===========================================================================
-- Seat requests
-- ===========================================================================

create or replace function public.trip_requests_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not (old.status = new.status or (old.status, new.status) in (
    ('pending', 'accepted'), ('pending', 'declined'), ('pending', 'cancelled'), ('pending', 'expired'),
    ('accepted', 'cancelled')
  )) then
    perform public.fail('invalid_request_transition', old.status || ' -> ' || new.status);
  end if;
  return new;
end;
$$;

create trigger trip_requests_guard before update on public.trip_requests
  for each row execute function public.trip_requests_guard();
create trigger trip_requests_updated_at before update on public.trip_requests
  for each row execute function public.set_updated_at();

-- Direct conversation between the trip creator and one passenger.
create or replace function public.ensure_direct_conversation(p_trip_id uuid, p_passenger uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_creator uuid;
begin
  select creator_id into v_creator from public.trips where id = p_trip_id;
  insert into public.conversations (kind, trip_id, passenger_id)
  values ('direct', p_trip_id, p_passenger)
  on conflict (trip_id, passenger_id) where kind = 'direct' do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.conversations
      where kind = 'direct' and trip_id = p_trip_id and passenger_id = p_passenger;
  end if;
  insert into public.conversation_members (conversation_id, user_id)
  values (v_id, v_creator), (v_id, p_passenger)
  on conflict (conversation_id, user_id) do update set is_active = true;
  return v_id;
end;
$$;

create or replace function public.ensure_group_membership(p_trip_id uuid, p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_creator uuid;
begin
  select creator_id into v_creator from public.trips where id = p_trip_id;
  select id into v_id from public.conversations where kind = 'trip_group' and trip_id = p_trip_id;
  if v_id is null then
    if not p_active then
      return;
    end if;
    insert into public.conversations (kind, trip_id) values ('trip_group', p_trip_id)
    on conflict (trip_id) where kind = 'trip_group' do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.conversations where kind = 'trip_group' and trip_id = p_trip_id;
    end if;
    insert into public.conversation_members (conversation_id, user_id) values (v_id, v_creator)
    on conflict do nothing;
  end if;
  insert into public.conversation_members (conversation_id, user_id, is_active)
  values (v_id, p_user, p_active)
  on conflict (conversation_id, user_id) do update set is_active = excluded.is_active;
end;
$$;

create or replace function public.request_seat(
  p_trip_id uuid,
  p_seat_count int,
  p_pickup_point_id uuid default null,
  p_dropoff_point_id uuid default null,
  p_message text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  t public.trips;
  v_request uuid;
  v_conversation uuid;
  max_seats int := (public.cfg('trip_rules') ->> 'max_seats_per_request')::int;
begin
  select * into t from public.trips where id = p_trip_id;
  if t.id is null then
    perform public.fail('trip_not_found');
  end if;
  if t.creator_id = uid then
    perform public.fail('own_trip');
  end if;
  if public.is_blocked_between(uid, t.creator_id) then
    perform public.fail('blocked');
  end if;
  if t.status = 'full' then
    perform public.fail('trip_full');
  end if;
  if t.status <> 'open' or t.departure_time <= now() then
    perform public.fail('trip_not_open');
  end if;
  if p_seat_count < 1 or p_seat_count > max_seats then
    perform public.fail('invalid_seat_count', max_seats::text);
  end if;
  if p_seat_count > t.available_seats then
    perform public.fail('not_enough_seats', t.available_seats::text);
  end if;
  if exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = uid and status = 'confirmed') then
    perform public.fail('already_member');
  end if;
  perform public.assert_meeting_point(p_pickup_point_id);
  perform public.assert_meeting_point(p_dropoff_point_id);

  begin
    insert into public.trip_requests (trip_id, requester_id, seat_count, pickup_point_id, dropoff_point_id, message)
    values (p_trip_id, uid, p_seat_count,
            coalesce(p_pickup_point_id, t.pickup_point_id), coalesce(p_dropoff_point_id, t.dropoff_point_id),
            nullif(left(btrim(p_message), 300), ''))
    returning id into v_request;
  exception when unique_violation then
    perform public.fail('request_exists');
  end;

  v_conversation := public.ensure_direct_conversation(p_trip_id, uid);
  if nullif(btrim(p_message), '') is not null then
    insert into public.messages (conversation_id, sender_id, body) values (v_conversation, uid, left(btrim(p_message), 300));
  end if;

  perform public.notify(t.creator_id, 'seat_request_received', 'New seat request',
    public.display_name(uid) || ' requested ' || p_seat_count || ' seat' || case when p_seat_count > 1 then 's' else '' end ||
    ' on ' || public.trip_label(p_trip_id) || '.', p_trip_id, uid, jsonb_build_object('request_id', v_request));
  perform public.track(uid, 'trip_request', jsonb_build_object('trip_id', p_trip_id, 'seats', p_seat_count));
  return v_request;
end;
$$;

-- Accept or decline. Accepting locks the trip row so two acceptances can
-- never both take the last seat; the CHECK constraint on trips is the final
-- guard.
create or replace function public.respond_to_request(p_request_id uuid, p_accept boolean)
returns public.request_status language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  r public.trip_requests;
  t public.trips;
begin
  select * into r from public.trip_requests where id = p_request_id for update;
  if r.id is null then
    perform public.fail('request_not_found');
  end if;
  select * into t from public.trips where id = r.trip_id for update;
  if t.creator_id <> uid then
    perform public.fail('not_trip_creator');
  end if;
  if r.status <> 'pending' then
    perform public.fail('request_not_pending', r.status::text);
  end if;

  if not p_accept then
    update public.trip_requests set status = 'declined', responded_at = now() where id = r.id;
    perform public.notify(r.requester_id, 'request_declined', 'Request declined',
      'Your request for ' || public.trip_label(t.id) || ' was declined.', t.id, uid,
      jsonb_build_object('request_id', r.id));
    perform public.track(uid, 'trip_request_declined', jsonb_build_object('trip_id', t.id));
    return 'declined';
  end if;

  if t.status = 'full' or t.available_seats < r.seat_count then
    perform public.fail('not_enough_seats', t.available_seats::text);
  end if;
  if t.status <> 'open' or t.departure_time <= now() then
    perform public.fail('trip_not_open');
  end if;
  if public.is_blocked_between(uid, r.requester_id) then
    perform public.fail('blocked');
  end if;

  update public.trips set reserved_seats = reserved_seats + r.seat_count where id = t.id;
  update public.trip_requests set status = 'accepted', responded_at = now() where id = r.id;

  insert into public.trip_members (trip_id, user_id, role, request_id, seat_count, pickup_point_id, dropoff_point_id, status)
  values (t.id, r.requester_id, 'passenger', r.id, r.seat_count, r.pickup_point_id, r.dropoff_point_id, 'confirmed')
  on conflict (trip_id, user_id) do update set
    status = 'confirmed', request_id = excluded.request_id, seat_count = excluded.seat_count,
    pickup_point_id = excluded.pickup_point_id, dropoff_point_id = excluded.dropoff_point_id,
    joined_at = now(), completed_at = null, updated_at = now();

  perform public.ensure_group_membership(t.id, r.requester_id, true);

  perform public.notify(r.requester_id, 'request_accepted', 'Seat confirmed',
    public.display_name(uid) || ' accepted your request for ' || public.trip_label(t.id) || '.', t.id, uid,
    jsonb_build_object('request_id', r.id));
  perform public.track(uid, 'trip_request_accepted', jsonb_build_object('trip_id', t.id, 'seats', r.seat_count));
  return 'accepted';
end;
$$;

-- Passenger withdraws a pending request or leaves an accepted seat.
create or replace function public.cancel_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  r public.trip_requests;
  t public.trips;
  late_minutes int := (public.cfg('trip_rules') ->> 'late_cancellation_minutes')::int;
  minutes_left int;
begin
  select * into r from public.trip_requests where id = p_request_id for update;
  if r.id is null or r.requester_id <> uid then
    perform public.fail('request_not_found');
  end if;
  if r.status not in ('pending', 'accepted') then
    perform public.fail('request_not_active', r.status::text);
  end if;
  select * into t from public.trips where id = r.trip_id for update;

  if r.status = 'pending' then
    update public.trip_requests set status = 'cancelled', responded_at = now() where id = r.id;
    perform public.notify(t.creator_id, 'request_cancelled', 'Request withdrawn',
      public.display_name(uid) || ' withdrew their request for ' || public.trip_label(t.id) || '.', t.id, uid);
    return;
  end if;

  if t.status not in ('open', 'full') then
    perform public.fail('trip_not_open');
  end if;
  minutes_left := floor(extract(epoch from (t.departure_time - now())) / 60);
  update public.trip_requests set status = 'cancelled', responded_at = now() where id = r.id;
  update public.trip_members set status = 'cancelled' where trip_id = t.id and user_id = uid;
  update public.trips set reserved_seats = reserved_seats - r.seat_count where id = t.id;
  perform public.ensure_group_membership(t.id, uid, false);
  insert into public.trip_incidents (trip_id, subject_user_id, recorded_by, kind, minutes_before_departure)
  values (t.id, uid, uid,
          case when minutes_left <= late_minutes then 'late_cancellation'::public.incident_kind else 'cancellation' end,
          minutes_left);
  perform public.notify(t.creator_id, 'participant_left', 'Passenger cancelled',
    public.display_name(uid) || ' cancelled their seat on ' || public.trip_label(t.id) || '.', t.id, uid);
end;
$$;

-- No-show records: the creator reports a passenger, or a passenger reports
-- that the creator never showed up. Facts only; no automatic penalties.
create or replace function public.report_no_show(p_trip_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  t public.trips;
begin
  select * into t from public.trips where id = p_trip_id;
  if t.id is null or now() < t.departure_time then
    perform public.fail('no_show_too_early');
  end if;
  if uid = t.creator_id then
    if not exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = p_user_id
                   and role = 'passenger' and status in ('confirmed', 'completed')) then
      perform public.fail('not_a_participant');
    end if;
    update public.trip_members set status = 'no_show' where trip_id = p_trip_id and user_id = p_user_id;
    insert into public.trip_incidents (trip_id, subject_user_id, recorded_by, kind)
    values (p_trip_id, p_user_id, uid, 'passenger_no_show') on conflict do nothing;
  elsif p_user_id = t.creator_id and public.is_trip_participant(p_trip_id, uid) then
    if t.status in ('in_progress', 'completed') then
      perform public.fail('trip_already_started');
    end if;
    insert into public.trip_incidents (trip_id, subject_user_id, recorded_by, kind)
    values (p_trip_id, t.creator_id, uid, 'creator_no_show') on conflict do nothing;
  else
    perform public.fail('not_a_participant');
  end if;
end;
$$;

create unique index trip_incidents_no_show_once
  on public.trip_incidents (trip_id, subject_user_id, recorded_by, kind)
  where kind in ('passenger_no_show', 'creator_no_show');

-- ===========================================================================
-- Recurring commutes
-- ===========================================================================

create or replace function public.recurring_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.creator_id := old.creator_id;
    if old.status = 'cancelled' and new.status <> 'cancelled' then
      perform public.fail('invalid_recurring_transition');
    end if;
  end if;
  new.timezone := coalesce(new.timezone, public.cfg_timezone());
  new.currency := coalesce(new.currency, public.cfg('currency') #>> '{}');
  if new.status <> 'cancelled' then
    perform public.assert_vehicle_for_trip(new.vehicle_id, new.creator_id, new.total_seats);
  end if;
  perform public.assert_meeting_point(new.pickup_point_id);
  perform public.assert_meeting_point(new.dropoff_point_id);
  perform public.assert_contribution(new.suggested_contribution, new.distance_m, new.expressway_option);
  return new;
end;
$$;

create trigger recurring_before_write before insert or update on public.recurring_trips
  for each row execute function public.recurring_before_write();
create trigger recurring_updated_at before update on public.recurring_trips
  for each row execute function public.set_updated_at();

-- Generate upcoming instances (idempotent thanks to the unique constraint).
create or replace function public.generate_recurring_instances(p_recurring_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  rt public.recurring_trips;
  d date;
  dep timestamptz;
  horizon int := (public.cfg('recurring') ->> 'generation_days')::int;
  lead_min int := (public.cfg('trip_rules') ->> 'min_minutes_before_departure')::int;
  created int := 0;
  n int;
begin
  for rt in
    select * from public.recurring_trips
    where status = 'active' and (p_recurring_id is null or id = p_recurring_id)
  loop
    for d in
      select generate_series(
        greatest(rt.start_date, (now() at time zone rt.timezone)::date),
        least(coalesce(rt.end_date, 'infinity'::date), (now() at time zone rt.timezone)::date + horizon),
        interval '1 day')::date
    loop
      continue when not (extract(isodow from d)::smallint = any (rt.weekdays));
      dep := (d + rt.departure_local_time) at time zone rt.timezone;
      continue when dep <= now() + make_interval(mins => lead_min);
      insert into public.trips (
        creator_id, vehicle_id, trip_type, origin_name, origin_lat, origin_lng,
        destination_name, destination_lat, destination_lng, pickup_point_id, dropoff_point_id,
        route_geometry, distance_m, duration_s, departure_time, estimated_arrival, total_seats,
        suggested_contribution, currency, expressway_option, luggage_policy, notes, status, recurring_trip_id
      ) values (
        rt.creator_id, rt.vehicle_id, 'commute', rt.origin_name, rt.origin_lat, rt.origin_lng,
        rt.destination_name, rt.destination_lat, rt.destination_lng, rt.pickup_point_id, rt.dropoff_point_id,
        rt.route_geometry, rt.distance_m, rt.duration_s, dep,
        case when rt.duration_s is not null then dep + make_interval(secs => rt.duration_s) end,
        rt.total_seats, rt.suggested_contribution, rt.currency, rt.expressway_option, rt.luggage_policy,
        rt.notes, 'open', rt.id
      ) on conflict (recurring_trip_id, departure_time) do nothing;
      get diagnostics n = row_count;
      created := created + n;
    end loop;
  end loop;
  return created;
end;
$$;

-- When a schedule changes, unbooked future instances (no requests at all)
-- are removed and regenerated. Instances with passengers are left alone so
-- nobody loses a confirmed seat silently.
create or replace function public.recurring_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.trips t
    where t.recurring_trip_id = new.id and t.status = 'open' and t.departure_time > now()
      and t.reserved_seats = 0
      and not exists (select 1 from public.trip_requests r where r.trip_id = t.id);
  end if;
  if new.status = 'active' then
    perform public.generate_recurring_instances(new.id);
  end if;
  return new;
end;
$$;

create trigger recurring_after_write after insert or update on public.recurring_trips
  for each row execute function public.recurring_after_write();

create or replace function public.create_recurring_trip(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  v_id uuid;
begin
  insert into public.recurring_trips (
    creator_id, vehicle_id, origin_name, origin_lat, origin_lng,
    destination_name, destination_lat, destination_lng, pickup_point_id, dropoff_point_id,
    route_geometry, distance_m, duration_s, weekdays, departure_local_time, start_date, end_date,
    total_seats, suggested_contribution, expressway_option, luggage_policy, notes
  ) values (
    uid, (p ->> 'vehicle_id')::uuid, btrim(p ->> 'origin_name'), (p ->> 'origin_lat')::float8, (p ->> 'origin_lng')::float8,
    btrim(p ->> 'destination_name'), (p ->> 'destination_lat')::float8, (p ->> 'destination_lng')::float8,
    nullif(p ->> 'pickup_point_id', '')::uuid, nullif(p ->> 'dropoff_point_id', '')::uuid,
    case when jsonb_typeof(p -> 'route_geojson') = 'object'
         then extensions.st_setsrid(extensions.st_geomfromgeojson((p -> 'route_geojson')::text), 4326) end,
    nullif(p ->> 'distance_m', '')::numeric::int, nullif(p ->> 'duration_s', '')::numeric::int,
    array(select jsonb_array_elements_text(p -> 'weekdays')::smallint),
    (p ->> 'departure_local_time')::time,
    coalesce(nullif(p ->> 'start_date', '')::date, (now() at time zone public.cfg_timezone())::date),
    nullif(p ->> 'end_date', '')::date,
    (p ->> 'total_seats')::smallint,
    nullif(p ->> 'suggested_contribution', '')::numeric,
    coalesce((p ->> 'expressway_option')::public.expressway_option, 'either'),
    coalesce((p ->> 'luggage_policy')::public.luggage_policy, 'small'),
    nullif(btrim(p ->> 'notes'), '')
  ) returning id into v_id;
  return v_id;
end;
$$;

-- ===========================================================================
-- Search & matching (deterministic, debuggable rules)
--   1. origin within radius of the trip origin OR close to its route
--   2. destination within radius of the trip destination OR close to its route
--   3. direction: the searcher's origin comes before their destination along
--      the route
--   4. departure time within tolerance (or anywhere on the chosen day)
--   5. enough free seats, trip type, expressway preference, recurring filter
--   6. never your own trips; never trips involving a blocked user
-- Ranked by normalised distance + time difference.
-- ===========================================================================

create type public.trip_search_result as (
  id uuid,
  trip_type public.trip_type,
  status public.trip_status,
  origin_name text,
  destination_name text,
  departure_time timestamptz,
  estimated_arrival timestamptz,
  available_seats smallint,
  total_seats smallint,
  suggested_contribution numeric,
  currency text,
  expressway_option public.expressway_option,
  luggage_policy public.luggage_policy,
  is_recurring boolean,
  distance_m integer,
  duration_s integer,
  pickup_point_name text,
  creator_id uuid,
  creator_name text,
  creator_avatar_path text,
  creator_rating_average numeric,
  creator_rating_count integer,
  creator_completed_trips integer,
  vehicle_make text,
  vehicle_model text,
  vehicle_colour text,
  origin_distance_m integer,
  destination_distance_m integer,
  time_difference_min integer
);

create or replace function public.search_trips(
  p_origin_lat double precision default null,
  p_origin_lng double precision default null,
  p_destination_lat double precision default null,
  p_destination_lng double precision default null,
  p_date date default null,
  p_time time default null,
  p_seats integer default 1,
  p_trip_type public.trip_type default null,
  p_expressway public.expressway_option default 'either',
  p_recurring_only boolean default false,
  p_limit integer default 20,
  p_offset integer default 0
) returns setof public.trip_search_result
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  m jsonb := public.cfg('matching');
  tz text := public.cfg_timezone();
  o extensions.geography;
  d extensions.geography;
  og extensions.geometry;
  dg extensions.geometry;
  win_start timestamptz;
  win_end timestamptz;
  target timestamptz;
begin
  if p_origin_lat is not null and p_origin_lng is not null then
    og := extensions.st_setsrid(extensions.st_makepoint(p_origin_lng, p_origin_lat), 4326);
    o := og::extensions.geography;
  end if;
  if p_destination_lat is not null and p_destination_lng is not null then
    dg := extensions.st_setsrid(extensions.st_makepoint(p_destination_lng, p_destination_lat), 4326);
    d := dg::extensions.geography;
  end if;

  if p_date is null then
    win_start := now();
    win_end := now() + make_interval(hours => (m ->> 'default_window_hours')::int);
  elsif p_time is null then
    win_start := greatest(now(), (p_date::timestamp) at time zone tz);
    win_end := ((p_date + 1)::timestamp) at time zone tz;
  else
    target := (p_date + p_time) at time zone tz;
  end if;

  return query
  with params as (
    select
      tp.trip_type as tt,
      (m -> tp.trip_type::text ->> 'origin_radius_m')::float8 as r_o,
      (m -> tp.trip_type::text ->> 'destination_radius_m')::float8 as r_d,
      (m -> tp.trip_type::text ->> 'time_tolerance_minutes')::int as tol,
      (m ->> 'corridor_buffer_m')::float8 as buf
    from unnest(enum_range(null::public.trip_type)) as tp(trip_type)
  ),
  candidates as (
    select t.*, p.r_o, p.r_d, p.tol, p.buf,
      case when o is null then null else
        least(extensions.st_distance(t.origin_point, o),
              coalesce(extensions.st_distance(t.route_geometry::extensions.geography, o), 'infinity'::float8)) end as o_dist,
      case when d is null then null else
        least(extensions.st_distance(t.destination_point, d),
              coalesce(extensions.st_distance(t.route_geometry::extensions.geography, d), 'infinity'::float8)) end as d_dist
    from public.trips t
    join params p on p.tt = t.trip_type
    where t.status = 'open'
      and t.departure_time > now()
      and t.creator_id <> uid
      and t.available_seats >= greatest(p_seats, 1)
      and (p_trip_type is null or t.trip_type = p_trip_type)
      and (not p_recurring_only or t.recurring_trip_id is not null)
      and (p_expressway = 'either' or t.expressway_option in (p_expressway, 'either'))
      and (
        (target is null and t.departure_time between win_start and win_end)
        or (target is not null and t.departure_time between greatest(now(), target - make_interval(mins => p.tol))
                                                        and target + make_interval(mins => p.tol))
      )
      and not public.is_blocked_between(uid, t.creator_id)
      and (o is null or extensions.st_dwithin(t.origin_point, o, p.r_o)
           or (t.route_geometry is not null and extensions.st_dwithin(t.route_geometry::extensions.geography, o, p.buf)))
      and (d is null or extensions.st_dwithin(t.destination_point, d, p.r_d)
           or (t.route_geometry is not null and extensions.st_dwithin(t.route_geometry::extensions.geography, d, p.buf)))
  )
  select
    c.id, c.trip_type, c.status, c.origin_name, c.destination_name, c.departure_time, c.estimated_arrival,
    c.available_seats, c.total_seats, c.suggested_contribution, c.currency, c.expressway_option, c.luggage_policy,
    c.recurring_trip_id is not null, c.distance_m, c.duration_s, pp.name,
    c.creator_id, pr.full_name, pr.avatar_path, pr.rating_average, pr.rating_count, pr.completed_trips_count,
    v.make, v.model, v.colour,
    c.o_dist::int, c.d_dist::int,
    case when target is null then null else abs(extract(epoch from (c.departure_time - target)) / 60)::int end
  from candidates c
  join public.profiles pr on pr.id = c.creator_id
  join public.vehicles v on v.id = c.vehicle_id
  left join public.pickup_points pp on pp.id = c.pickup_point_id
  where
    -- Direction check: the searcher must travel the same way as the trip.
    o is null or d is null or (
      case when c.route_geometry is not null
        then extensions.st_linelocatepoint(c.route_geometry, og) < extensions.st_linelocatepoint(c.route_geometry, dg)
        else extensions.st_distance(c.origin_point, o) < extensions.st_distance(c.origin_point, d)
      end)
  order by
    coalesce(c.o_dist / c.r_o, 0) + coalesce(c.d_dist / c.r_d, 0)
      + case when target is null then 0 else abs(extract(epoch from (c.departure_time - target)) / 60) / c.tol end,
    c.departure_time
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
end;
$$;

-- Full trip view. Visible when the trip is discoverable, or the caller is a
-- participant or has requested a seat. Registration plates and member lists
-- are only returned to participants.
create or replace function public.get_trip_detail(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  t public.trips;
  participant boolean;
  has_request boolean;
  result jsonb;
begin
  select * into t from public.trips where id = p_trip_id;
  if t.id is null then
    perform public.fail('trip_not_found');
  end if;
  participant := public.is_trip_participant(t.id, uid);
  has_request := exists (select 1 from public.trip_requests where trip_id = t.id and requester_id = uid);
  if not (participant or has_request or t.creator_id = uid or t.status in ('open', 'full')) then
    perform public.fail('trip_not_found');
  end if;

  select jsonb_build_object(
    'id', t.id, 'trip_type', t.trip_type, 'status', t.status,
    'origin_name', t.origin_name, 'origin_lat', t.origin_lat, 'origin_lng', t.origin_lng,
    'destination_name', t.destination_name, 'destination_lat', t.destination_lat, 'destination_lng', t.destination_lng,
    'route', case when t.route_geometry is null then null else extensions.st_asgeojson(t.route_geometry, 6)::jsonb end,
    'distance_m', t.distance_m, 'duration_s', t.duration_s,
    'departure_time', t.departure_time, 'estimated_arrival', t.estimated_arrival,
    'total_seats', t.total_seats, 'reserved_seats', t.reserved_seats, 'available_seats', t.available_seats,
    'suggested_contribution', t.suggested_contribution, 'currency', t.currency,
    'expressway_option', t.expressway_option, 'luggage_policy', t.luggage_policy, 'notes', t.notes,
    'cancellation_reason', t.cancellation_reason, 'recurring_trip_id', t.recurring_trip_id,
    'started_at', t.started_at, 'completed_at', t.completed_at,
    'is_creator', t.creator_id = uid,
    'is_participant', participant,
    'is_blocked', public.is_blocked_between(uid, t.creator_id),
    'creator', (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_path', p.avatar_path,
                  'bio', p.bio, 'rating_average', p.rating_average, 'rating_count', p.rating_count,
                  'completed_trips_count', p.completed_trips_count, 'member_since', p.created_at)
                from public.profiles p where p.id = t.creator_id),
    'vehicle', (select jsonb_build_object('id', v.id, 'make', v.make, 'model', v.model, 'year', v.year,
                  'colour', v.colour, 'seat_capacity', v.seat_capacity, 'photo_path', v.photo_path,
                  'registration_number', case when participant then v.registration_number end)
                from public.vehicles v where v.id = t.vehicle_id),
    'pickup_point', (select jsonb_build_object('id', pp.id, 'name', pp.name, 'description', pp.description, 'lat', pp.lat, 'lng', pp.lng)
                     from public.pickup_points pp where pp.id = t.pickup_point_id),
    'dropoff_point', (select jsonb_build_object('id', pp.id, 'name', pp.name, 'description', pp.description, 'lat', pp.lat, 'lng', pp.lng)
                      from public.pickup_points pp where pp.id = t.dropoff_point_id),
    'stops', coalesce((select jsonb_agg(jsonb_build_object('position', s.position, 'name', s.name, 'lat', s.lat, 'lng', s.lng) order by s.position)
                       from public.trip_stops s where s.trip_id = t.id), '[]'::jsonb),
    'my_request', (select jsonb_build_object('id', r.id, 'status', r.status, 'seat_count', r.seat_count, 'created_at', r.created_at)
                   from public.trip_requests r where r.trip_id = t.id and r.requester_id = uid
                   order by r.created_at desc limit 1),
    'my_membership', (select jsonb_build_object('role', tm.role, 'status', tm.status, 'seat_count', tm.seat_count)
                      from public.trip_members tm where tm.trip_id = t.id and tm.user_id = uid),
    'members', case when participant then coalesce((
                  select jsonb_agg(jsonb_build_object('user_id', tm.user_id, 'role', tm.role, 'status', tm.status,
                         'seat_count', tm.seat_count, 'full_name', p.full_name, 'avatar_path', p.avatar_path,
                         'rating_average', p.rating_average, 'rating_count', p.rating_count,
                         'pickup_point_id', tm.pickup_point_id,
                         'rated_by_me', exists (select 1 from public.ratings ra where ra.trip_id = t.id and ra.rater_id = uid and ra.ratee_id = tm.user_id))
                         order by tm.role, tm.joined_at)
                  from public.trip_members tm join public.profiles p on p.id = tm.user_id
                  where tm.trip_id = t.id and tm.status in ('confirmed', 'completed', 'no_show')), '[]'::jsonb)
                else '[]'::jsonb end,
    'pending_request_count', case when t.creator_id = uid then
                  (select count(*) from public.trip_requests r where r.trip_id = t.id and r.status = 'pending') else null end,
    'direct_conversation_id', (select c.id from public.conversations c
                  where c.kind = 'direct' and c.trip_id = t.id
                    and c.passenger_id = case when t.creator_id = uid then null else uid end),
    'group_conversation_id', case when participant then
                  (select c.id from public.conversations c where c.kind = 'trip_group' and c.trip_id = t.id) end
  ) into result;
  return result;
end;
$$;

-- The caller's trips (as creator or passenger) plus open seat requests.
create or replace function public.my_trips(p_past boolean default false, p_limit integer default 30, p_offset integer default 0)
returns table (
  trip_id uuid, role public.member_role, member_status public.member_status, request_id uuid,
  request_status public.request_status, trip_type public.trip_type, status public.trip_status,
  origin_name text, destination_name text, departure_time timestamptz, estimated_arrival timestamptz,
  available_seats smallint, total_seats smallint, is_recurring boolean, pending_request_count bigint,
  creator_id uuid, creator_name text, creator_avatar_path text
) language sql stable security definer set search_path = '' as $$
  with mine as (
    select t.id, tm.role, tm.status as member_status, tm.request_id, null::public.request_status as request_status
    from public.trip_members tm join public.trips t on t.id = tm.trip_id
    where tm.user_id = auth.uid() and tm.status <> 'cancelled'
    union all
    select r.trip_id, 'passenger'::public.member_role, null, r.id, r.status
    from public.trip_requests r
    where r.requester_id = auth.uid() and r.status in ('pending', 'declined')
      and not exists (select 1 from public.trip_members tm2 where tm2.trip_id = r.trip_id and tm2.user_id = auth.uid() and tm2.status <> 'cancelled')
      and r.created_at = (select max(r2.created_at) from public.trip_requests r2 where r2.trip_id = r.trip_id and r2.requester_id = auth.uid())
  )
  select t.id, mine.role, mine.member_status, mine.request_id, mine.request_status,
         t.trip_type, t.status, t.origin_name, t.destination_name, t.departure_time, t.estimated_arrival,
         t.available_seats, t.total_seats, t.recurring_trip_id is not null,
         case when mine.role = 'creator' then (select count(*) from public.trip_requests r where r.trip_id = t.id and r.status = 'pending') else 0 end,
         t.creator_id, p.full_name, p.avatar_path
  from mine join public.trips t on t.id = mine.id join public.profiles p on p.id = t.creator_id
  where case when p_past
          then t.status in ('completed', 'cancelled', 'expired') or (mine.request_status = 'declined')
          else t.status in ('draft', 'open', 'full', 'in_progress') and mine.request_status is distinct from 'declined'
        end
  order by case when p_past then null else t.departure_time end asc,
           case when p_past then t.departure_time end desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

-- ===========================================================================
-- Live location
-- ===========================================================================

create or replace function public.update_live_location(
  p_trip_id uuid, p_lat double precision, p_lng double precision,
  p_accuracy_m real default null, p_heading real default null, p_speed_mps real default null,
  p_recorded_at timestamptz default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  min_interval int := (public.cfg('location') ->> 'min_interval_seconds')::int;
  last_update timestamptz;
begin
  if not exists (select 1 from public.trips where id = p_trip_id and status = 'in_progress') then
    perform public.fail('trip_not_active');
  end if;
  if not public.is_trip_participant(p_trip_id, uid) then
    perform public.fail('not_a_participant');
  end if;
  select updated_at into last_update from public.live_locations where trip_id = p_trip_id and user_id = uid;
  if last_update is not null and last_update > now() - make_interval(secs => min_interval) then
    return false; -- server-side throttle
  end if;
  insert into public.live_locations (trip_id, user_id, lat, lng, accuracy_m, heading, speed_mps, recorded_at, updated_at)
  values (p_trip_id, uid, p_lat, p_lng, p_accuracy_m,
          case when p_heading is null or p_heading < 0 then null else mod(p_heading::numeric, 360)::real end,
          case when p_speed_mps is null or p_speed_mps < 0 then null else p_speed_mps end,
          least(coalesce(p_recorded_at, now()), now()), now())
  on conflict (trip_id, user_id) do update set
    lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, heading = excluded.heading,
    speed_mps = excluded.speed_mps, recorded_at = excluded.recorded_at, updated_at = now();
  return true;
end;
$$;

create or replace function public.stop_sharing_location(p_trip_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.live_locations where trip_id = p_trip_id and user_id = auth.uid();
$$;

-- ===========================================================================
-- Chat
-- ===========================================================================

create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.sender_id is distinct from auth.uid() or not public.is_conversation_member(new.conversation_id, new.sender_id) then
    perform public.fail('not_conversation_member');
  end if;
  if exists (
    select 1 from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = new.conversation_id and c.kind = 'direct' and cm.user_id <> new.sender_id
      and public.is_blocked_between(new.sender_id, cm.user_id)
  ) then
    perform public.fail('blocked');
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end;
$$;

create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cm record;
  v_trip uuid;
  sender text := public.display_name(new.sender_id);
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id
    returning trip_id into v_trip;
  update public.conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  for cm in
    select user_id from public.conversation_members
    where conversation_id = new.conversation_id and is_active and user_id <> new.sender_id
      and not public.is_blocked_between(user_id, new.sender_id)
  loop
    perform public.notify(cm.user_id, 'new_message', sender, left(new.body, 140), v_trip, new.sender_id,
      jsonb_build_object('conversation_id', new.conversation_id));
  end loop;
  perform public.track(new.sender_id, 'message_sent', jsonb_build_object('conversation_id', new.conversation_id));
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

create or replace function public.list_conversations(p_limit integer default 30, p_offset integer default 0)
returns table (
  conversation_id uuid, kind public.conversation_kind, trip_id uuid, trip_label text, trip_status public.trip_status,
  title text, avatar_path text, other_user_id uuid, last_message text, last_message_at timestamptz,
  last_sender_id uuid, unread_count bigint, is_active boolean
) language sql stable security definer set search_path = '' as $$
  select c.id, c.kind, c.trip_id, t.origin_name || ' → ' || t.destination_name, t.status,
         case when c.kind = 'trip_group' then 'Trip group' else coalesce(nullif(op.full_name, ''), 'CASS member') end,
         case when c.kind = 'direct' then op.avatar_path end,
         case when c.kind = 'direct' then op.id end,
         lm.body, coalesce(lm.created_at, c.created_at), lm.sender_id,
         (select count(*) from public.messages mm
          where mm.conversation_id = c.id and mm.created_at > me.last_read_at and mm.sender_id is distinct from auth.uid()),
         me.is_active
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join public.trips t on t.id = c.trip_id
  left join lateral (
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = c.id and cm.user_id <> auth.uid() limit 1
  ) other on c.kind = 'direct'
  left join public.profiles op on op.id = other.user_id
  left join lateral (
    select m.body, m.created_at, m.sender_id from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = auth.uid();
$$;

create or replace function public.unread_counts()
returns table (messages bigint, notifications bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.conversation_members me
       join public.messages m on m.conversation_id = me.conversation_id
      where me.user_id = auth.uid() and m.created_at > me.last_read_at and m.sender_id is distinct from auth.uid()),
    (select count(*) from public.notifications n where n.user_id = auth.uid() and n.read_at is null and n.type <> 'new_message')
$$;

-- ===========================================================================
-- Ratings
-- ===========================================================================

create or replace function public.ratings_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t public.trips;
  window_days int := (public.cfg('trip_rules') ->> 'rating_window_days')::int;
begin
  if new.rater_id is distinct from auth.uid() then
    perform public.fail('not_authenticated');
  end if;
  select * into t from public.trips where id = new.trip_id;
  if t.id is null or t.status <> 'completed' then
    perform public.fail('trip_not_completed');
  end if;
  if t.completed_at < now() - make_interval(days => window_days) then
    perform public.fail('rating_window_closed');
  end if;
  if not exists (select 1 from public.trip_members where trip_id = t.id and user_id = new.rater_id and status = 'completed')
     or not exists (select 1 from public.trip_members where trip_id = t.id and user_id = new.ratee_id and status = 'completed') then
    perform public.fail('not_a_participant');
  end if;
  new.comment := nullif(btrim(new.comment), '');
  new.created_at := now();
  return new;
end;
$$;

create trigger ratings_before_insert before insert on public.ratings
  for each row execute function public.ratings_before_insert();

create or replace function public.ratings_after_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target uuid := coalesce(new.ratee_id, old.ratee_id);
begin
  update public.profiles p set
    rating_average = coalesce((select round(avg(stars)::numeric, 2) from public.ratings where ratee_id = target), 0),
    rating_count = (select count(*) from public.ratings where ratee_id = target)
  where p.id = target;
  if tg_op = 'INSERT' then
    perform public.track(new.rater_id, 'rating_submitted', jsonb_build_object('trip_id', new.trip_id, 'stars', new.stars));
  end if;
  return null;
end;
$$;

create trigger ratings_after_change after insert or delete on public.ratings
  for each row execute function public.ratings_after_change();

-- ===========================================================================
-- Blocking side effects: pending requests between the two users end.
-- ===========================================================================

create or replace function public.user_blocks_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.trip_requests r set status = 'declined', responded_at = now()
  from public.trips t
  where r.trip_id = t.id and r.status = 'pending'
    and ((t.creator_id = new.blocker_id and r.requester_id = new.blocked_id)
      or (t.creator_id = new.blocked_id and r.requester_id = new.blocker_id));
  return new;
end;
$$;

create trigger user_blocks_after_insert after insert on public.user_blocks
  for each row execute function public.user_blocks_after_insert();

create or replace function public.list_blocked_users()
returns table (user_id uuid, full_name text, avatar_path text, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.blocked_id, p.full_name, p.avatar_path, b.created_at
  from public.user_blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;

-- ===========================================================================
-- Analytics from the client (only events the server cannot observe).
-- ===========================================================================

create or replace function public.log_search(p_props jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.track(public.require_user(), 'trip_search', coalesce(p_props, '{}'::jsonb) - 'user_id');
end;
$$;

-- ===========================================================================
-- Account deletion (called by the delete-account Edge Function with the
-- user's own JWT before the auth user is removed).
-- ===========================================================================

create or replace function public.prepare_account_deletion()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  r record;
begin
  if exists (
    select 1 from public.trip_members tm join public.trips t on t.id = tm.trip_id
    where tm.user_id = uid and tm.status = 'confirmed' and t.status = 'in_progress'
  ) then
    perform public.fail('active_trip_in_progress');
  end if;
  update public.recurring_trips set status = 'cancelled' where creator_id = uid and status <> 'cancelled';
  for r in select id from public.trips where creator_id = uid and status in ('draft', 'open', 'full') loop
    update public.trips set status = 'cancelled', cancellation_reason = 'Account closed' where id = r.id;
  end loop;
  for r in select id from public.trip_requests tr where tr.requester_id = uid and tr.status in ('pending', 'accepted')
           and exists (select 1 from public.trips t where t.id = tr.trip_id and t.status in ('open', 'full')) loop
    perform public.cancel_request(r.id);
  end loop;
end;
$$;

-- ===========================================================================
-- Scheduled maintenance (pg_cron, see scheduling migration).
-- ===========================================================================

create or replace function public.run_trip_maintenance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  rules jsonb := public.cfg('trip_rules');
  reminder_min int := (public.cfg('notifications') ->> 'reminder_minutes_before')::int;
  grace int := (rules ->> 'expire_after_minutes')::int;
  auto_complete_h int := (rules ->> 'auto_complete_after_hours')::int;
  n_expired int;
  n_completed int := 0;
  n_reminders int := 0;
  n_generated int;
  t record;
  m record;
begin
  -- Trips that never started expire after the grace period.
  update public.trips set status = 'expired'
  where status in ('open', 'full', 'draft') and departure_time < now() - make_interval(mins => grace)
    and status <> 'draft';
  get diagnostics n_expired = row_count;
  update public.trips set status = 'cancelled', cancellation_reason = 'Draft expired'
  where status = 'draft' and departure_time < now();

  -- In-progress trips nobody ended are completed so tracking always stops.
  for t in
    select id from public.trips
    where status = 'in_progress'
      and coalesce(estimated_arrival, departure_time) < now() - make_interval(hours => auto_complete_h)
  loop
    perform public.finish_trip(t.id);
    n_completed := n_completed + 1;
  end loop;

  -- Departure reminders.
  for t in
    select id, creator_id from public.trips
    where status in ('open', 'full') and reminder_sent_at is null
      and departure_time between now() and now() + make_interval(mins => reminder_min)
    for update skip locked
  loop
    for m in select user_id, role from public.trip_members where trip_id = t.id and status = 'confirmed' loop
      perform public.notify(m.user_id, 'trip_reminder', 'Trip starting soon',
        public.trip_label(t.id) || case when m.role = 'creator' then '. Start the trip when you set off.' else '.' end, t.id, t.creator_id);
    end loop;
    update public.trips set reminder_sent_at = now() where id = t.id;
    n_reminders := n_reminders + 1;
  end loop;

  -- Safety net for stale location rows.
  delete from public.live_locations l
  where l.updated_at < now() - make_interval(hours => (public.cfg('location') ->> 'retention_hours')::int)
     or not exists (select 1 from public.trips tt where tt.id = l.trip_id and tt.status = 'in_progress');

  n_generated := public.generate_recurring_instances(null);

  return jsonb_build_object('expired', n_expired, 'auto_completed', n_completed,
                            'reminders', n_reminders, 'generated', n_generated);
end;
$$;
