-- CASS: hardening from the Supabase security/performance advisors.
--
-- 1. The RLS helper functions must be executable by `authenticated` (policies
--    run as the caller), which also exposes them as RPCs. Without a guard any
--    signed-in user could ask "has X blocked Y?" or "is X on trip Z?" about
--    other people. They now only ever answer about the caller.
-- 2. Covering indexes for foreign keys hit by cascades (account deletion) and
--    by common lookups.

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (a = auth.uid() or b = auth.uid()) and exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create or replace function public.is_trip_participant(p_trip_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = p_user_id
      and status in ('confirmed', 'completed')
  )
$$;

create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id and is_active
  )
$$;

create or replace function public.is_in_conversation(p_conversation_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id
  )
$$;

create or replace function public.is_trip_creator(p_trip_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id = auth.uid() and exists (select 1 from public.trips where id = p_trip_id and creator_id = p_user_id)
$$;

create or replace function public.has_trip_request(p_trip_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.trip_requests where trip_id = p_trip_id and requester_id = p_user_id
  )
$$;

create index trips_vehicle_idx on public.trips (vehicle_id);
create index recurring_trips_vehicle_idx on public.recurring_trips (vehicle_id);
create index messages_sender_idx on public.messages (sender_id);
create index notifications_related_trip_idx on public.notifications (related_trip_id);
create index notifications_related_user_idx on public.notifications (related_user_id);
create index ratings_rater_idx on public.ratings (rater_id);
create index conversations_passenger_idx on public.conversations (passenger_id);
create index live_locations_user_idx on public.live_locations (user_id);
create index trip_members_request_idx on public.trip_members (request_id);
create index trip_incidents_recorded_by_idx on public.trip_incidents (recorded_by);
create index reports_reported_user_idx on public.reports (reported_user_id);
create index reports_trip_idx on public.reports (trip_id);
create index analytics_events_user_idx on public.analytics_events (user_id);
