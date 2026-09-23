-- CASS: core tables.
-- Model: USER -> TRIP -> PARTICIPANTS. A user can create trips and join
-- other trips with the same account. trips.creator_id records ownership;
-- trip_members holds everyone travelling (creator included, role = 'creator').

-- ---------------------------------------------------------------------------
-- Central configuration (read by the app, written by admins/service role).
-- ---------------------------------------------------------------------------
create table public.configuration (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users). Ratings/counters are maintained by
-- triggers only; clients cannot write them (see column grants).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  full_name             text not null default '' check (char_length(full_name) <= 80),
  phone_number          text check (phone_number is null or phone_number ~ '^\+?[0-9]{9,15}$'),
  avatar_path           text check (avatar_path is null or char_length(avatar_path) <= 300),
  bio                   text check (bio is null or char_length(bio) <= 300),
  rating_average        numeric(3, 2) not null default 0 check (rating_average between 0 and 5),
  rating_count          integer not null default 0 check (rating_count >= 0),
  completed_trips_count integer not null default 0 check (completed_trips_count >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.profiles (id) on delete cascade,
  make                text not null check (char_length(make) between 1 and 40),
  model               text not null check (char_length(model) between 1 and 40),
  year                smallint check (year is null or year between 1970 and 2100),
  colour              text not null check (char_length(colour) between 1 and 30),
  registration_number text not null check (registration_number ~ '^[A-Z0-9 ]{4,12}$'),
  seat_capacity       smallint not null check (seat_capacity between 2 and 14),
  photo_path          text check (photo_path is null or char_length(photo_path) <= 300),
  status              public.vehicle_status not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index vehicles_owner_idx on public.vehicles (owner_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- Places: named areas (estates, neighbourhoods, towns) offered as quick
-- search suggestions. Pilot data lives in a migration; more can be added
-- without code changes.
-- ---------------------------------------------------------------------------
create table public.places (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 2 and 80),
  kind       public.place_kind not null,
  corridor   text check (corridor is null or corridor ~ '^[a-z0-9_]+$'),
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  location   extensions.geography(Point, 4326)
             generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index places_active_idx on public.places (sort_order) where is_active;

-- ---------------------------------------------------------------------------
-- Approved meeting points (used for both pickup and drop-off).
-- ---------------------------------------------------------------------------
create table public.pickup_points (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid references public.places (id) on delete set null,
  name        text not null unique check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 200),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  location    extensions.geography(Point, 4326)
              generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index pickup_points_place_idx on public.pickup_points (place_id) where is_active;
create index pickup_points_location_idx on public.pickup_points using gist (location);

-- ---------------------------------------------------------------------------
-- Recurring commute definitions. Individual trip instances are generated a
-- few days ahead (configuration.recurring.generation_days).
-- ---------------------------------------------------------------------------
create table public.recurring_trips (
  id                     uuid primary key default gen_random_uuid(),
  creator_id             uuid not null references public.profiles (id) on delete cascade,
  vehicle_id             uuid not null references public.vehicles (id) on delete restrict,
  origin_name            text not null check (char_length(origin_name) between 2 and 120),
  origin_lat             double precision not null check (origin_lat between -90 and 90),
  origin_lng             double precision not null check (origin_lng between -180 and 180),
  destination_name       text not null check (char_length(destination_name) between 2 and 120),
  destination_lat        double precision not null check (destination_lat between -90 and 90),
  destination_lng        double precision not null check (destination_lng between -180 and 180),
  pickup_point_id        uuid references public.pickup_points (id) on delete set null,
  dropoff_point_id       uuid references public.pickup_points (id) on delete set null,
  route_geometry         extensions.geometry(LineString, 4326),
  distance_m             integer check (distance_m is null or distance_m > 0),
  duration_s             integer check (duration_s is null or duration_s > 0),
  weekdays               smallint[] not null
                         check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  departure_local_time   time not null,
  timezone               text not null,
  start_date             date not null,
  end_date               date check (end_date is null or end_date >= start_date),
  total_seats            smallint not null check (total_seats between 1 and 13),
  suggested_contribution numeric(10, 2) check (suggested_contribution is null or suggested_contribution >= 0),
  currency               text not null check (currency ~ '^[A-Z]{3}$'),
  expressway_option      public.expressway_option not null default 'either',
  luggage_policy         public.luggage_policy not null default 'small',
  notes                  text check (notes is null or char_length(notes) <= 500),
  status                 public.recurring_status not null default 'active',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index recurring_trips_creator_idx on public.recurring_trips (creator_id);
create index recurring_trips_active_idx on public.recurring_trips (status) where status = 'active';

-- ---------------------------------------------------------------------------
-- Trips (one row per actual departure).
-- ---------------------------------------------------------------------------
create table public.trips (
  id                     uuid primary key default gen_random_uuid(),
  creator_id             uuid not null references public.profiles (id) on delete cascade,
  vehicle_id             uuid not null references public.vehicles (id) on delete restrict,
  trip_type              public.trip_type not null,
  origin_name            text not null check (char_length(origin_name) between 2 and 120),
  origin_lat             double precision not null check (origin_lat between -90 and 90),
  origin_lng             double precision not null check (origin_lng between -180 and 180),
  origin_point           extensions.geography(Point, 4326)
                         generated always as (extensions.st_setsrid(extensions.st_makepoint(origin_lng, origin_lat), 4326)::extensions.geography) stored,
  destination_name       text not null check (char_length(destination_name) between 2 and 120),
  destination_lat        double precision not null check (destination_lat between -90 and 90),
  destination_lng        double precision not null check (destination_lng between -180 and 180),
  destination_point      extensions.geography(Point, 4326)
                         generated always as (extensions.st_setsrid(extensions.st_makepoint(destination_lng, destination_lat), 4326)::extensions.geography) stored,
  pickup_point_id        uuid references public.pickup_points (id) on delete set null,
  dropoff_point_id       uuid references public.pickup_points (id) on delete set null,
  route_geometry         extensions.geometry(LineString, 4326),
  distance_m             integer check (distance_m is null or distance_m > 0),
  duration_s             integer check (duration_s is null or duration_s > 0),
  departure_time         timestamptz not null,
  estimated_arrival      timestamptz check (estimated_arrival is null or estimated_arrival > departure_time),
  total_seats            smallint not null check (total_seats between 1 and 13),
  reserved_seats         smallint not null default 0,
  available_seats        smallint generated always as (total_seats - reserved_seats) stored,
  suggested_contribution numeric(10, 2) check (suggested_contribution is null or suggested_contribution >= 0),
  currency               text not null check (currency ~ '^[A-Z]{3}$'),
  expressway_option      public.expressway_option not null default 'either',
  luggage_policy         public.luggage_policy not null default 'small',
  notes                  text check (notes is null or char_length(notes) <= 500),
  status                 public.trip_status not null default 'open',
  recurring_trip_id      uuid references public.recurring_trips (id) on delete set null,
  cancellation_reason    text check (cancellation_reason is null or char_length(cancellation_reason) <= 300),
  started_at             timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  reminder_sent_at       timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Overbooking guard of last resort: the database refuses any state where
  -- more seats are reserved than offered.
  constraint trips_reserved_seats_valid check (reserved_seats >= 0 and reserved_seats <= total_seats),
  constraint trips_recurring_instance_unique unique (recurring_trip_id, departure_time)
);
create index trips_creator_idx on public.trips (creator_id, departure_time desc);
create index trips_search_idx on public.trips (trip_type, departure_time) where status = 'open';
create index trips_status_departure_idx on public.trips (status, departure_time);
create index trips_origin_idx on public.trips using gist (origin_point);
create index trips_destination_idx on public.trips using gist (destination_point);
create index trips_route_idx on public.trips using gist ((route_geometry::extensions.geography));
create index trips_recurring_idx on public.trips (recurring_trip_id) where recurring_trip_id is not null;

-- Planned stops (mainly intercity trips).
create table public.trip_stops (
  id       uuid primary key default gen_random_uuid(),
  trip_id  uuid not null references public.trips (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  name     text not null check (char_length(name) between 2 and 120),
  lat      double precision not null check (lat between -90 and 90),
  lng      double precision not null check (lng between -180 and 180),
  unique (trip_id, position)
);

-- ---------------------------------------------------------------------------
-- Seat requests and trip membership.
-- ---------------------------------------------------------------------------
create table public.trip_requests (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips (id) on delete cascade,
  requester_id     uuid not null references public.profiles (id) on delete cascade,
  seat_count       smallint not null check (seat_count between 1 and 13),
  pickup_point_id  uuid references public.pickup_points (id) on delete set null,
  dropoff_point_id uuid references public.pickup_points (id) on delete set null,
  message          text check (message is null or char_length(message) <= 300),
  status           public.request_status not null default 'pending',
  responded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- One live request per passenger per trip.
create unique index trip_requests_one_active_idx
  on public.trip_requests (trip_id, requester_id) where status in ('pending', 'accepted');
create index trip_requests_trip_idx on public.trip_requests (trip_id, status);
create index trip_requests_requester_idx on public.trip_requests (requester_id, created_at desc);

create table public.trip_members (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             public.member_role not null,
  request_id       uuid references public.trip_requests (id) on delete set null,
  seat_count       smallint not null default 0 check (seat_count between 0 and 13),
  pickup_point_id  uuid references public.pickup_points (id) on delete set null,
  dropoff_point_id uuid references public.pickup_points (id) on delete set null,
  status           public.member_status not null default 'confirmed',
  joined_at        timestamptz not null default now(),
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  unique (trip_id, user_id)
);
create index trip_members_user_idx on public.trip_members (user_id, status);

-- ---------------------------------------------------------------------------
-- Live location: latest position per traveller per active trip only.
-- Rows are deleted as soon as the trip leaves 'in_progress'.
-- ---------------------------------------------------------------------------
create table public.live_locations (
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  accuracy_m  real check (accuracy_m is null or accuracy_m >= 0),
  heading     real check (heading is null or heading between 0 and 360),
  speed_mps   real check (speed_mps is null or speed_mps >= 0),
  recorded_at timestamptz not null,
  updated_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Chat
-- direct:     trip creator <-> one passenger (created with the seat request)
-- trip_group: everyone confirmed on the trip
-- ---------------------------------------------------------------------------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  kind            public.conversation_kind not null,
  trip_id         uuid references public.trips (id) on delete cascade,
  passenger_id    uuid references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint conversations_direct_has_passenger check (kind <> 'direct' or passenger_id is not null)
);
create unique index conversations_direct_unique on public.conversations (trip_id, passenger_id) where kind = 'direct';
create unique index conversations_group_unique on public.conversations (trip_id) where kind = 'trip_group';

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  is_active       boolean not null default true,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id) where is_active;

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references public.profiles (id) on delete set null,
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Trust & safety
-- ---------------------------------------------------------------------------
create table public.ratings (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  rater_id   uuid not null references public.profiles (id) on delete cascade,
  ratee_id   uuid not null references public.profiles (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  comment    text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  constraint ratings_not_self check (rater_id <> ratee_id),
  constraint ratings_once_per_trip unique (trip_id, rater_id, ratee_id)
);
create index ratings_ratee_idx on public.ratings (ratee_id, created_at desc);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid references public.profiles (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  trip_id          uuid references public.trips (id) on delete set null,
  reason           public.report_reason not null,
  details          text check (details is null or char_length(details) <= 1000),
  status           public.report_status not null default 'open',
  created_at       timestamptz not null default now(),
  constraint reports_has_subject check (reported_user_id is not null or trip_id is not null),
  constraint reports_not_self check (reporter_id is distinct from reported_user_id)
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- Factual reliability events (no-shows, cancellations). No penalties yet.
create table public.trip_incidents (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips (id) on delete cascade,
  subject_user_id uuid references public.profiles (id) on delete set null,
  recorded_by     uuid references public.profiles (id) on delete set null,
  kind            public.incident_kind not null,
  minutes_before_departure integer,
  created_at      timestamptz not null default now()
);
create index trip_incidents_subject_idx on public.trip_incidents (subject_user_id, created_at desc);
create index trip_incidents_trip_idx on public.trip_incidents (trip_id);

-- ---------------------------------------------------------------------------
-- Notifications (in-app inbox; push delivery is triggered from here).
-- ---------------------------------------------------------------------------
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            public.notification_type not null,
  title           text not null check (char_length(title) <= 120),
  body            text not null check (char_length(body) <= 300),
  related_trip_id uuid references public.trips (id) on delete cascade,
  related_user_id uuid references public.profiles (id) on delete set null,
  data            jsonb not null default '{}'::jsonb,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.push_tokens (
  token      text primary key check (char_length(token) <= 200),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Minimal product analytics.
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete set null,
  event      public.analytics_event not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_event_idx on public.analytics_events (event, created_at);
