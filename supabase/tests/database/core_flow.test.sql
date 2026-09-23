-- End-to-end database test of the core CASS loop plus the security rules
-- that protect it. Runs with `npx supabase test db` or scripts/test-db.sh.
begin;
select plan(81);

-- Fixtures ------------------------------------------------------------------
create temp table ctx (k text primary key, v text);
grant all on ctx to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'a@test.local', '{"full_name":"Alice Creator"}'),
  ('22222222-2222-4222-8222-222222222222', 'b@test.local', '{"full_name":"Brian Passenger"}'),
  ('33333333-3333-4333-8333-333333333333', 'c@test.local', '{"full_name":"Carol Other"}');

select is((select count(*)::int from public.profiles), 3, 'profiles created by auth trigger');
select is((select full_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
          'Alice Creator', 'full_name copied from sign-up metadata');

insert into ctx values
  ('dep', ((((now() at time zone 'Africa/Nairobi')::date + 1) + time '07:00') at time zone 'Africa/Nairobi')::text),
  ('route', '{"type":"LineString","coordinates":[[36.9560,-1.4210],[36.8800,-1.3300],[36.8254,-1.2856]]}');

-- USER A: vehicle ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111"}';

select lives_ok($$
  insert into public.vehicles (owner_id, make, model, colour, registration_number, seat_capacity)
  values ('11111111-1111-4111-8111-111111111111', 'Toyota', 'Noah', 'Silver', 'kdh 123a', 7)
$$, 'A registers a vehicle');
select throws_ok($$
  insert into public.vehicles (owner_id, make, model, colour, registration_number, seat_capacity)
  values ('22222222-2222-4222-8222-222222222222', 'Mazda', 'Demio', 'Red', 'KCA 111B', 5)
$$, '42501', null, 'cannot register a vehicle for someone else');
select is((select registration_number from public.my_vehicles() limit 1), 'KDH 123A', 'plate normalised, visible to owner');
insert into ctx select 'vehicle', id::text from public.my_vehicles() limit 1;
select throws_ok($$ update public.profiles set rating_average = 5 where id = auth.uid() $$,
  '42501', null, 'cannot write own rating');

-- Contribution engine ----------------------------------------------------------
select results_eq($$ select min_amount, max_amount from public.suggest_contribution(30000, false) $$,
  $$ values (100::numeric, 120::numeric) $$, 'normal-road reference range at reference distance');
select results_eq($$ select min_amount, max_amount from public.suggest_contribution(30000, true) $$,
  $$ values (150::numeric, 170::numeric) $$, 'expressway reference range at reference distance');

-- USER A: create trip (Greatwall Gardens -> Nairobi, 07:00, 5 seats) -------
select lives_ok(format($$
  select public.create_trip(jsonb_build_object(
    'vehicle_id', %L, 'trip_type', 'commute',
    'origin_name', 'Greatwall Gardens', 'origin_lat', -1.4210, 'origin_lng', 36.9560,
    'destination_name', 'Nairobi CBD', 'destination_lat', -1.2856, 'destination_lng', 36.8254,
    'route_geojson', %s::jsonb, 'distance_m', 31000, 'duration_s', 3000,
    'departure_time', %L, 'total_seats', 5, 'suggested_contribution', 120,
    'expressway_option', 'avoid', 'stops', '[]'::jsonb))
$$, (select v from ctx where k = 'vehicle'), (select quote_literal(v) from ctx where k = 'route'),
    (select v from ctx where k = 'dep')), 'A creates a trip');
insert into ctx select 'trip', id::text from public.trips where creator_id = auth.uid();

select throws_ok(format($$
  select public.create_trip(jsonb_build_object('vehicle_id', %L, 'trip_type', 'commute',
    'origin_name', 'X origin', 'origin_lat', -1.42, 'origin_lng', 36.95,
    'destination_name', 'Y destination', 'destination_lat', -1.28, 'destination_lng', 36.82,
    'departure_time', %L, 'total_seats', 7))
$$, (select v from ctx where k = 'vehicle'), (select v from ctx where k = 'dep')),
  'P0001', 'seats_exceed_vehicle_capacity', 'seats cannot exceed vehicle capacity minus traveller');
select throws_ok(format($$
  select public.create_trip(jsonb_build_object('vehicle_id', %L, 'trip_type', 'commute',
    'origin_name', 'X origin', 'origin_lat', -1.42, 'origin_lng', 36.95,
    'destination_name', 'Y destination', 'destination_lat', -1.28, 'destination_lng', 36.82,
    'departure_time', now() - interval '1 hour', 'total_seats', 2))
$$, (select v from ctx where k = 'vehicle')), 'P0001', 'departure_in_past', 'departure must be in the future');
select throws_ok(format($$
  select public.create_trip(jsonb_build_object('vehicle_id', %L, 'trip_type', 'commute',
    'origin_name', 'X origin', 'origin_lat', -1.42, 'origin_lng', 36.95,
    'destination_name', 'Y destination', 'destination_lat', -1.28, 'destination_lng', 36.82,
    'distance_m', 30000, 'departure_time', %L, 'total_seats', 2, 'suggested_contribution', 1000))
$$, (select v from ctx where k = 'vehicle'), (select v from ctx where k = 'dep')),
  'P0001', 'contribution_too_high', 'contribution capped relative to reference range');

select is((select status::text from public.trips where id = (select v::uuid from ctx where k = 'trip')), 'open', 'trip is open');
select is((select count(*)::int from public.trip_members where trip_id = (select v::uuid from ctx where k = 'trip') and role = 'creator'),
          1, 'creator recorded as trip member');
select throws_ok(format($$ update public.trips set status = 'completed' where id = %L $$, (select v from ctx where k = 'trip')),
  '42501', null, 'status cannot be written directly');
select throws_ok(format($$ update public.trips set reserved_seats = 5 where id = %L $$, (select v from ctx where k = 'trip')),
  '42501', null, 'reserved seats cannot be written directly');

-- USER B: search and view ------------------------------------------------------
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222"}';

select is((select count(*)::int from public.search_trips(
    -1.4225, 36.9570, -1.2870, 36.8260,
    ((now() at time zone 'Africa/Nairobi')::date + 1), time '07:00', 1, 'commute', 'either', false, 20, 0)),
  1, 'B finds the trip (same corridor, same time)');
select is((select count(*)::int from public.search_trips(
    -1.2870, 36.8260, -1.4225, 36.9570,
    ((now() at time zone 'Africa/Nairobi')::date + 1), time '07:00', 1, 'commute', 'either', false, 20, 0)),
  0, 'opposite direction does not match');
select is((select count(*)::int from public.search_trips(
    -1.4225, 36.9570, -1.2870, 36.8260,
    ((now() at time zone 'Africa/Nairobi')::date + 1), time '11:00', 1, 'commute', 'either', false, 20, 0)),
  0, 'departure outside time tolerance does not match');
select is((select count(*)::int from public.search_trips(
    -1.3300, 36.8800, -1.2870, 36.8260,
    ((now() at time zone 'Africa/Nairobi')::date + 1), time '07:00', 1, 'commute', 'either', false, 20, 0)),
  1, 'joining along the route matches');
select is((select count(*)::int from public.search_trips(
    -1.4225, 36.9570, -1.2870, 36.8260,
    ((now() at time zone 'Africa/Nairobi')::date + 1), time '07:00', 1, 'commute', 'use', false, 20, 0)),
  0, 'expressway preference respected');

select is((public.get_trip_detail((select v::uuid from ctx where k = 'trip')) -> 'vehicle' ->> 'registration_number'),
  null, 'plate hidden from non-participants');
select throws_ok($$ select registration_number from public.vehicles $$, '42501', null, 'plate column not selectable');
select throws_ok($$ select phone_number from public.profiles $$, '42501', null, 'phone column not selectable');

select lives_ok(format($$ select public.request_seat(%L, 1, null, null, 'Hi, I can be at the gate at 6:55') $$,
  (select v from ctx where k = 'trip')), 'B requests one seat');
select throws_ok(format($$ select public.request_seat(%L, 1) $$, (select v from ctx where k = 'trip')),
  'P0001', 'request_exists', 'duplicate active request rejected');
insert into ctx select 'request_b', id::text from public.trip_requests where requester_id = auth.uid();

-- USER A: notification + accept ---------------------------------------------
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111"}';
select is((select count(*)::int from public.notifications where type = 'seat_request_received'), 1, 'A notified of request');
select is((select count(*)::int from public.list_conversations()), 1, 'direct conversation created');
select is((public.respond_to_request((select v::uuid from ctx where k = 'request_b'), true))::text, 'accepted', 'A accepts');
select is((select reserved_seats::int from public.trips where id = (select v::uuid from ctx where k = 'trip')), 1, 'seat reserved');
select throws_ok(format($$ select public.respond_to_request(%L, false) $$, (select v from ctx where k = 'request_b')),
  'P0001', 'request_not_pending', 'accepted request cannot be declined');

-- USER B: participant + chat ---------------------------------------------------
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222"}';
select is((select count(*)::int from public.notifications where type = 'request_accepted'), 1, 'B notified of acceptance');
select is((public.get_trip_detail((select v::uuid from ctx where k = 'trip')) -> 'vehicle' ->> 'registration_number'),
  'KDH 123A', 'plate visible to confirmed participant');
insert into ctx select 'conv', id::text from public.conversations where kind = 'direct';
select lives_ok(format($$ insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'See you at the gate') $$,
  (select v from ctx where k = 'conv')), 'B sends a message');
select throws_ok(format($$ insert into public.messages (conversation_id, sender_id, body) values (%L, '11111111-1111-4111-8111-111111111111', 'spoof') $$,
  (select v from ctx where k = 'conv')), 'P0001', 'not_conversation_member', 'cannot send as someone else');

-- USER C: isolation ------------------------------------------------------------
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333"}';
select is((select count(*)::int from public.messages), 0, 'C cannot read other conversations');
select throws_ok(format($$ insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'hello') $$,
  (select v from ctx where k = 'conv')), 'P0001', 'not_conversation_member', 'C cannot post into others conversation');
select is((select count(*)::int from public.trip_members), 0, 'C cannot see trip members');
select is((select count(*)::int from public.trip_requests), 0, 'C cannot see requests');
select is((select count(*)::int from public.notifications), 0, 'C has no access to others notifications');

-- Starting too early is refused -------------------------------------------------
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111"}';
select is((select count(*)::int from public.notifications where type = 'new_message'), 2,
  'A notified of both messages (request note + chat)');
select throws_ok(format($$ select public.start_trip(%L) $$, (select v from ctx where k = 'trip')),
  'P0001', 'too_early_to_start', 'trip cannot start hours before departure');

-- Simulate the trip day: move departure to "in 10 minutes".
reset role;
update public.trips set departure_time = now() + interval '10 minutes' where id = (select v::uuid from ctx where k = 'trip');
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222"}';
select throws_ok(format($$ select public.start_trip(%L) $$, (select v from ctx where k = 'trip')),
  'P0001', 'not_trip_creator', 'passenger cannot start the trip');
select throws_ok(format($$ select public.update_live_location(%L, -1.42, 36.95) $$, (select v from ctx where k = 'trip')),
  'P0001', 'trip_not_active', 'no location sharing before the trip starts');

set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111"}';
select lives_ok(format($$ select public.start_trip(%L) $$, (select v from ctx where k = 'trip')), 'A starts the trip');
select ok(public.update_live_location((select v::uuid from ctx where k = 'trip'), -1.4211, 36.9561, 8, 310, 0), 'A shares GPS location');
select ok(not public.update_live_location((select v::uuid from ctx where k = 'trip'), -1.4200, 36.9550, 8, 310, 3),
  'rapid second update is throttled server-side');

set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222"}';
select is((select count(*)::int from public.live_locations), 1, 'B sees A live location');
select is((select count(*)::int from public.notifications where type = 'trip_starting'), 1, 'B notified trip started');

set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333"}';
select is((select count(*)::int from public.live_locations), 0, 'C cannot see live location');
select throws_ok(format($$ select public.update_live_location(%L, -1.42, 36.95) $$, (select v from ctx where k = 'trip')),
  'P0001', 'not_a_participant', 'outsider cannot publish location');

-- Complete and rate ------------------------------------------------------------
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111"}';
select lives_ok(format($$ select public.complete_trip(%L) $$, (select v from ctx where k = 'trip')), 'A ends the trip');
reset role;
select is((select count(*)::int from public.live_locations), 0, 'live location deleted when trip ends');
select is((select status::text from public.trips where id = (select v::uuid from ctx where k = 'trip')), 'completed', 'trip completed');
select throws_ok(format($$ update public.trips set status = 'open' where id = %L $$, (select v from ctx where k = 'trip')),
  'P0001', 'invalid_trip_transition', 'COMPLETED -> OPEN impossible even for the database owner');
select is((select completed_trips_count from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 1,
  'completed shared trip counted');

set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222"}';
select lives_ok(format($$ insert into public.ratings (trip_id, rater_id, ratee_id, stars, comment)
  values (%L, auth.uid(), '11111111-1111-4111-8111-111111111111', 5, 'On time, safe driver') $$, (select v from ctx where k = 'trip')),
  'B rates A');
select throws_ok(format($$ insert into public.ratings (trip_id, rater_id, ratee_id, stars)
  values (%L, auth.uid(), '11111111-1111-4111-8111-111111111111', 1) $$, (select v from ctx where k = 'trip')),
  '23505', null, 'cannot rate the same person twice for a trip');
select throws_ok(format($$ insert into public.ratings (trip_id, rater_id, ratee_id, stars)
  values (%L, auth.uid(), auth.uid(), 5) $$, (select v from ctx where k = 'trip')),
  '23514', null, 'cannot rate yourself');

set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111"}';
select lives_ok(format($$ insert into public.ratings (trip_id, rater_id, ratee_id, stars)
  values (%L, auth.uid(), '22222222-2222-4222-8222-222222222222', 4) $$, (select v from ctx where k = 'trip')), 'A rates B');
select is((select rating_average from public.profiles where id = auth.uid()), 5.00::numeric, 'rating average recalculated');

set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333"}';
select throws_ok(format($$ insert into public.ratings (trip_id, rater_id, ratee_id, stars)
  values (%L, auth.uid(), '11111111-1111-4111-8111-111111111111', 1) $$, (select v from ctx where k = 'trip')),
  'P0001', 'not_a_participant', 'non-participant cannot rate');
select lives_ok($$ insert into public.reports (reporter_id, reported_user_id, reason, details)
  values (auth.uid(), '11111111-1111-4111-8111-111111111111', 'other', 'test report') $$, 'C can report a user');

-- Blocking -----------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111"}';
select lives_ok($$ insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), '33333333-3333-4333-8333-333333333333') $$,
  'A blocks C');
create temp table trip2_created as select public.create_trip(jsonb_build_object('vehicle_id', (select v from ctx where k = 'vehicle'), 'trip_type', 'intercity',
  'origin_name', 'Nairobi CBD', 'origin_lat', -1.2856, 'origin_lng', 36.8254,
  'destination_name', 'Kakamega', 'destination_lat', 0.2827, 'destination_lng', 34.7519,
  'departure_time', now() + interval '2 days', 'total_seats', 3, 'luggage_policy', 'medium',
  'stops', '[{"name":"Nakuru","lat":-0.3031,"lng":36.0800}]'::jsonb));
insert into ctx select 'trip2', id::text from public.trips where trip_type = 'intercity';

set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333"}';
select throws_ok(format($$ select public.request_seat(%L, 1) $$, (select v from ctx where k = 'trip2')),
  'P0001', 'blocked', 'blocked user cannot request a seat');
select is((select count(*)::int from public.search_trips(null, null, null, null, null, null, 1, null, 'either', false, 20, 0)
           where creator_id = '11111111-1111-4111-8111-111111111111'), 0, 'blocked user does not see trips in search');

-- Recurring commutes -------------------------------------------------------------
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111"}';
select lives_ok(format($$ select public.create_recurring_trip(jsonb_build_object(
  'vehicle_id', %L, 'origin_name', 'Greatwall Gardens', 'origin_lat', -1.4210, 'origin_lng', 36.9560,
  'destination_name', 'Nairobi CBD', 'destination_lat', -1.2856, 'destination_lng', 36.8254,
  'weekdays', '[1,2,3,4,5]'::jsonb, 'departure_local_time', '07:00', 'total_seats', 3)) $$,
  (select v from ctx where k = 'vehicle')), 'A creates a Mon-Fri recurring commute');
select ok((select count(*) from public.trips where recurring_trip_id is not null) between 4 and 6,
  'upcoming weekday instances generated (not thousands)');
select lives_ok($$ update public.recurring_trips set status = 'paused' $$, 'A pauses the schedule');
select is((select count(*)::int from public.trips where recurring_trip_id is not null and status = 'open'), 0,
  'unbooked future instances removed on pause');
select lives_ok($$ update public.recurring_trips set status = 'active' $$, 'A resumes the schedule');
select ok((select count(*) from public.trips where recurring_trip_id is not null) >= 4, 'instances regenerated on resume');

-- Cancellation frees seats and notifies ----------------------------------------------
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222"}';
select lives_ok(format($$ select public.request_seat(%L, 2) $$, (select v from ctx where k = 'trip2')), 'B requests 2 seats on intercity trip');
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111"}';
select is(public.respond_to_request((select id from public.trip_requests where trip_id = (select v::uuid from ctx where k = 'trip2')), true)::text,
  'accepted', 'A accepts 2 seats');
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222"}';
select lives_ok(format($$ select public.cancel_request((select id from public.trip_requests where trip_id = %L and requester_id = auth.uid())) $$,
  (select v from ctx where k = 'trip2')), 'B cancels an accepted seat');
reset role;
select is((select reserved_seats::int from public.trips where id = (select v::uuid from ctx where k = 'trip2')), 0, 'seats released on cancellation');
select is((select count(*)::int from public.trip_incidents where kind in ('cancellation', 'late_cancellation')
           and subject_user_id = '22222222-2222-4222-8222-222222222222'), 1, 'cancellation recorded as a factual incident');
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111"}';
select lives_ok(format($$ select public.cancel_trip(%L, 'Car in the garage') $$, (select v from ctx where k = 'trip2')), 'A cancels trip');

-- Maintenance & push dispatch ---------------------------------------------------------
reset role;
select is((select count(*)::int from net.calls), 0, 'no push calls until Vault secrets are configured');
insert into vault.secrets values ('cass_project_url', 'https://example.supabase.co'), ('cass_push_webhook_secret', 'test-secret');
select public.notify('22222222-2222-4222-8222-222222222222', 'safety_alert', 'Test', 'Push dispatch test');
select is((select url from net.calls order by id desc limit 1), 'https://example.supabase.co/functions/v1/send-push',
  'notification dispatched to send-push edge function');
select lives_ok($$ select public.run_trip_maintenance() $$, 'scheduled maintenance runs');

select * from finish();
rollback;
