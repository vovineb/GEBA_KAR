-- Guest browsing, gender, women-only trips, onboarding and vehicle photos.
begin;
select plan(24);

create temp table ctx (k text primary key, v text);
grant all on ctx to public;

insert into auth.users (id, email, raw_user_meta_data, is_anonymous) values
  ('a1111111-1111-4111-8111-111111111111', 'wanjiru@test.local', '{"full_name":"Wanjiru","gender":"female","terms_version":"2026-09-25"}', false),
  ('b2222222-2222-4222-8222-222222222222', 'otieno@test.local', '{"full_name":"Otieno","gender":"male"}', false),
  ('c3333333-3333-4333-8333-333333333333', 'akinyi@test.local', '{"full_name":"Akinyi","gender":"female"}', false),
  ('d4444444-4444-4444-8444-444444444444', null, '{}', true);

select is((select count(*)::int from public.profiles where id = 'd4444444-4444-4444-8444-444444444444'), 0,
  'guests get no profile');
select is((select gender::text from public.profiles where id = 'a1111111-1111-4111-8111-111111111111'), 'female',
  'gender copied from sign-up metadata');
select is((select terms_version from public.profiles where id = 'a1111111-1111-4111-8111-111111111111'), '2026-09-25',
  'accepted terms version recorded');
select ok((select terms_accepted_at is not null and onboarded_at is null from public.profiles
           where id = 'a1111111-1111-4111-8111-111111111111'), 'new account: terms time set, onboarding pending');

insert into ctx values
  ('dep', ((((now() at time zone 'Africa/Nairobi')::date + 1) + time '07:00') at time zone 'Africa/Nairobi')::text);

-- Wanjiru (female) --------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1111111-1111-4111-8111-111111111111"}';

select lives_ok($$
  insert into public.vehicles (owner_id, make, model, colour, registration_number, seat_capacity, photo_paths)
  values (auth.uid(), 'Toyota', 'Axio', 'White', 'KDE 555W', 5, array['a1111111-1111-4111-8111-111111111111/1.jpg',
                                                                     'a1111111-1111-4111-8111-111111111111/2.jpg'])
$$, 'vehicle saved with two photos');
insert into ctx select 'vehicle', id::text from public.my_vehicles() limit 1;
select is((select photo_path from public.my_vehicles() limit 1), 'a1111111-1111-4111-8111-111111111111/1.jpg',
  'first photo becomes the cover');
select throws_ok($$ update public.vehicles set photo_paths = array_fill('x'::text, array[9]) where owner_id = auth.uid() $$,
  '23514', null, 'at most 8 photos');

select lives_ok($$ select public.complete_onboarding(null) $$, 'onboarding completed');
select ok((select onboarded_at is not null from public.get_my_profile()), 'onboarding recorded');
select throws_ok($$ update public.profiles set gender = 'male' where id = auth.uid() $$,
  'P0001', 'gender_locked', 'gender cannot be changed once set');

select lives_ok(format($$
  select public.create_trip(jsonb_build_object(
    'vehicle_id', %L, 'trip_type', 'commute', 'women_only', true,
    'origin_name', 'Greatwall Gardens', 'origin_lat', -1.4210, 'origin_lng', 36.9560,
    'destination_name', 'Nairobi CBD', 'destination_lat', -1.2856, 'destination_lng', 36.8254,
    'distance_m', 31000, 'duration_s', 3000, 'departure_time', %L, 'total_seats', 3))
$$, (select v from ctx where k = 'vehicle'), (select v from ctx where k = 'dep')), 'a woman posts a women-only trip');
insert into ctx select 'trip', id::text from public.trips where creator_id = auth.uid();
select ok((select women_only from public.trips where id = (select v::uuid from ctx where k = 'trip')), 'trip is women-only');
select is((public.get_trip_detail((select v::uuid from ctx where k = 'trip')) -> 'vehicle' -> 'photo_paths') ->> 1,
  'a1111111-1111-4111-8111-111111111111/2.jpg', 'trip detail lists all vehicle photos');

-- Guest ------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"d4444444-4444-4444-8444-444444444444","is_anonymous":true}';
select ok((select count(*) from public.search_trips(
  p_date => ((select v::timestamptz from ctx where k = 'dep') at time zone 'Africa/Nairobi')::date)) >= 1,
  'guest can search trips');
select is(public.get_trip_detail((select v::uuid from ctx where k = 'trip')) ->> 'women_only', 'true',
  'guest can open a trip');
select is((public.get_trip_detail((select v::uuid from ctx where k = 'trip')) -> 'creator' ->> 'gender'), 'female',
  'trip detail shows the creator gender');
select throws_ok(format($$ select public.request_seat(%L, 1) $$, (select v from ctx where k = 'trip')),
  'P0001', 'account_required', 'guest cannot request a seat');
select throws_ok($$ select public.create_trip('{}'::jsonb) $$, 'P0001', 'account_required', 'guest cannot create a trip');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', 'd4444444-4444-4444-8444-444444444444/x.jpg') $$,
  '42501', null, 'guest cannot upload images');

-- Otieno (male) ----------------------------------------------------------------
set local request.jwt.claims to '{"sub":"b2222222-2222-4222-8222-222222222222"}';
select throws_ok(format($$ select public.request_seat(%L, 1) $$, (select v from ctx where k = 'trip')),
  'P0001', 'women_only_trip', 'a man cannot request a women-only trip');
select lives_ok($$
  insert into public.vehicles (owner_id, make, model, colour, registration_number, seat_capacity)
  values (auth.uid(), 'Mazda', 'Demio', 'Blue', 'KCB 222B', 5)
$$, 'male member adds a vehicle');
select throws_ok(format($$
  select public.create_trip(jsonb_build_object(
    'vehicle_id', %L, 'trip_type', 'commute', 'women_only', true,
    'origin_name', 'Greatwall Gardens', 'origin_lat', -1.4210, 'origin_lng', 36.9560,
    'destination_name', 'Nairobi CBD', 'destination_lat', -1.2856, 'destination_lng', 36.8254,
    'departure_time', %L, 'total_seats', 2))
$$, (select id from public.my_vehicles() limit 1), (select v from ctx where k = 'dep')),
  'P0001', 'women_only_requires_female', 'only women can post women-only trips');

-- Akinyi (female) --------------------------------------------------------------
set local request.jwt.claims to '{"sub":"c3333333-3333-4333-8333-333333333333"}';
select lives_ok(format($$ select public.request_seat(%L, 1) $$, (select v from ctx where k = 'trip')),
  'a woman can request a women-only trip');
select lives_ok($$ update public.profiles set bio = 'Hi' where id = auth.uid() $$, 'profile still editable');

select * from finish();
rollback;
