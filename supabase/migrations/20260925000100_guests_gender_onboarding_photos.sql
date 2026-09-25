-- CASS: guest browsing, gender and women-only trips, one-time onboarding,
-- terms acceptance, and several photos per vehicle.

-- ===========================================================================
-- 1. Guests (Supabase anonymous sign-ins)
--    A guest has a session (role `authenticated`, JWT claim is_anonymous) so
--    every read path works unchanged. Guests get no profile row, and every
--    action RPC goes through require_user(), which now refuses them. Direct
--    table writes already need a profile row (foreign keys), and storage
--    uploads are blocked below.
-- ===========================================================================

create or replace function public.is_anonymous()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create or replace function public.require_user()
returns uuid language plpgsql stable set search_path = '' as $$
declare
  v uuid := auth.uid();
begin
  if v is null then
    perform public.fail('not_authenticated');
  end if;
  if public.is_anonymous() then
    perform public.fail('account_required');
  end if;
  return v;
end;
$$;

-- Browsing only needs a session: members and guests.
create or replace function public.require_viewer()
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

-- Trip search is browsing: switch it to require_viewer() without restating
-- the whole matching query.
do $$
declare
  def text;
begin
  def := pg_get_functiondef(
    'public.search_trips(float8, float8, float8, float8, date, time, integer, public.trip_type, public.expressway_option, boolean, integer, integer)'::regprocedure);
  execute replace(def, 'public.require_user()', 'public.require_viewer()');
end;
$$;

create policy "cass images members only insert" on storage.objects
  as restrictive for insert to authenticated with check (not public.is_anonymous());
create policy "cass images members only update" on storage.objects
  as restrictive for update to authenticated using (not public.is_anonymous());
create policy "cass images members only delete" on storage.objects
  as restrictive for delete to authenticated using (not public.is_anonymous());

-- ===========================================================================
-- 2. Profiles: gender, onboarding, terms
-- ===========================================================================

create type public.gender as enum ('female', 'male');

alter table public.profiles
  add column gender public.gender,
  add column onboarded_at timestamptz,
  add column terms_version text check (terms_version is null or char_length(terms_version) <= 20),
  add column terms_accepted_at timestamptz;

-- People who already use the app have seen it; the welcome guide is for new
-- accounts only.
update public.profiles set onboarded_at = now() where onboarded_at is null;

grant select (gender) on public.profiles to authenticated;
grant update (gender) on public.profiles to authenticated;

-- Gender can be set once by the user (women-only trips depend on it);
-- corrections go through support (service role).
create or replace function public.profiles_gender_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- End users carry a user id in their JWT; the service role does not.
  if old.gender is not null and new.gender is distinct from old.gender and auth.uid() is not null then
    perform public.fail('gender_locked');
  end if;
  return new;
end;
$$;

create trigger profiles_gender_guard before update of gender on public.profiles
  for each row execute function public.profiles_gender_guard();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  terms text := left(nullif(btrim(meta ->> 'terms_version'), ''), 20);
begin
  -- Guests browse without a profile; they get one when they create an account.
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  insert into public.profiles (id, full_name, gender, terms_version, terms_accepted_at)
  values (
    new.id,
    left(coalesce(btrim(meta ->> 'full_name'), ''), 80),
    case when meta ->> 'gender' in ('female', 'male') then (meta ->> 'gender')::public.gender end,
    terms,
    case when terms is not null then now() end
  );
  perform public.track(new.id, 'account_created');
  return new;
end;
$$;

create or replace function public.get_my_profile()
returns public.profiles language sql stable security definer set search_path = '' as $$
  select * from public.profiles where id = auth.uid()
$$;

-- Marks the welcome guide as seen and (optionally) records the accepted
-- terms version.
create or replace function public.complete_onboarding(p_terms_version text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  terms text := left(nullif(btrim(p_terms_version), ''), 20);
begin
  update public.profiles
  set onboarded_at = coalesce(onboarded_at, now()),
      terms_version = coalesce(terms, terms_version),
      terms_accepted_at = case when terms is not null then now() else terms_accepted_at end
  where id = uid;
end;
$$;

-- ===========================================================================
-- 3. Women-only trips
-- ===========================================================================

alter table public.trips add column women_only boolean not null default false;
alter table public.recurring_trips add column women_only boolean not null default false;

create or replace function public.women_only_creator_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.women_only and (select gender from public.profiles where id = new.creator_id) is distinct from 'female' then
    perform public.fail('women_only_requires_female');
  end if;
  return new;
end;
$$;

create trigger trips_women_only_guard before insert or update of women_only on public.trips
  for each row execute function public.women_only_creator_guard();
create trigger recurring_women_only_guard before insert or update of women_only on public.recurring_trips
  for each row execute function public.women_only_creator_guard();

create or replace function public.trip_requests_women_only_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.trips t where t.id = new.trip_id and t.women_only)
     and (select gender from public.profiles where id = new.requester_id) is distinct from 'female' then
    perform public.fail('women_only_trip');
  end if;
  return new;
end;
$$;

create trigger trip_requests_women_only_guard before insert on public.trip_requests
  for each row execute function public.trip_requests_women_only_guard();

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
    suggested_contribution, expressway_option, luggage_policy, notes, women_only, status
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
    coalesce((p ->> 'women_only')::boolean, false),
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
    total_seats, suggested_contribution, expressway_option, luggage_policy, notes, women_only
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
    nullif(btrim(p ->> 'notes'), ''),
    coalesce((p ->> 'women_only')::boolean, false)
  ) returning id into v_id;
  return v_id;
end;
$$;

-- Instances inherit women_only from their schedule.
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
        suggested_contribution, currency, expressway_option, luggage_policy, notes, women_only, status, recurring_trip_id
      ) values (
        rt.creator_id, rt.vehicle_id, 'commute', rt.origin_name, rt.origin_lat, rt.origin_lng,
        rt.destination_name, rt.destination_lat, rt.destination_lng, rt.pickup_point_id, rt.dropoff_point_id,
        rt.route_geometry, rt.distance_m, rt.duration_s, dep,
        case when rt.duration_s is not null then dep + make_interval(secs => rt.duration_s) end,
        rt.total_seats, rt.suggested_contribution, rt.currency, rt.expressway_option, rt.luggage_policy,
        rt.notes, rt.women_only, 'open', rt.id
      ) on conflict (recurring_trip_id, departure_time) do nothing;
      get diagnostics n = row_count;
      created := created + n;
    end loop;
  end loop;
  return created;
end;
$$;

-- ===========================================================================
-- 4. Several photos per vehicle (photo_path stays as the cover = first photo)
-- ===========================================================================

alter table public.vehicles
  add column photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 8);
update public.vehicles set photo_paths = array[photo_path] where photo_path is not null;

grant select (photo_paths) on public.vehicles to authenticated;
grant insert (photo_paths), update (photo_paths) on public.vehicles to authenticated;

create or replace function public.vehicles_photos_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from unnest(new.photo_paths) p where p is null or char_length(p) > 300) then
    perform public.fail('invalid_photo');
  end if;
  if cardinality(new.photo_paths) > 0 then
    new.photo_path := new.photo_paths[1];
  elsif new.photo_path is not null then
    new.photo_paths := array[new.photo_path];
  end if;
  return new;
end;
$$;

create trigger vehicles_photos_sync before insert or update on public.vehicles
  for each row execute function public.vehicles_photos_sync();

-- ===========================================================================
-- 5. Trip detail: browsable by guests; adds women_only, gender and photos.
-- ===========================================================================

create or replace function public.get_trip_detail(p_trip_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_viewer();
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
    'women_only', t.women_only,
    'cancellation_reason', t.cancellation_reason, 'recurring_trip_id', t.recurring_trip_id,
    'started_at', t.started_at, 'completed_at', t.completed_at,
    'is_creator', t.creator_id = uid,
    'is_participant', participant,
    'is_blocked', public.is_blocked_between(uid, t.creator_id),
    'creator', (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_path', p.avatar_path,
                  'bio', p.bio, 'gender', p.gender, 'rating_average', p.rating_average, 'rating_count', p.rating_count,
                  'completed_trips_count', p.completed_trips_count, 'member_since', p.created_at)
                from public.profiles p where p.id = t.creator_id),
    'vehicle', (select jsonb_build_object('id', v.id, 'make', v.make, 'model', v.model, 'year', v.year,
                  'colour', v.colour, 'seat_capacity', v.seat_capacity, 'photo_path', v.photo_path,
                  'photo_paths', to_jsonb(v.photo_paths),
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
                         'gender', p.gender, 'rating_average', p.rating_average, 'rating_count', p.rating_count,
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

-- ===========================================================================
-- Function privileges
-- ===========================================================================
revoke execute on function public.is_anonymous(), public.require_viewer(), public.complete_onboarding(text),
  public.profiles_gender_guard(), public.women_only_creator_guard(), public.trip_requests_women_only_guard(),
  public.vehicles_photos_sync() from public, anon, authenticated;
grant execute on function public.is_anonymous(), public.complete_onboarding(text) to authenticated;
