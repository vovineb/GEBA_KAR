#!/usr/bin/env bash
# Two creators' sessions race to accept two different requests for the LAST
# seat at the same time. Exactly one may succeed. Invoked by test-db.sh with
# PGHOST/PGPORT pointing at the throwaway cluster (data is left committed
# there, the cluster is deleted afterwards).
set -euo pipefail
export PGOPTIONS='-c search_path=public,extensions'
A=aaaaaaaa-0000-4000-8000-00000000000a
P1=aaaaaaaa-0000-4000-8000-0000000000b1
P2=aaaaaaaa-0000-4000-8000-0000000000b2
psql -q -o /dev/null -v ON_ERROR_STOP=1 <<SQL
insert into auth.users (id, email) values ('$A','race-a@test.local'),('$P1','race-p1@test.local'),('$P2','race-p2@test.local');
set role authenticated;
set request.jwt.claims to '{"sub":"$A"}';
insert into public.vehicles (owner_id, make, model, colour, registration_number, seat_capacity) values ('$A','Toyota','Vitz','Blue','KDA 999Z',4);
select public.create_trip(jsonb_build_object('vehicle_id',(select id from public.vehicles where owner_id='$A'),'trip_type','commute',
  'origin_name','Race origin','origin_lat',-1.42,'origin_lng',36.95,'destination_name','Race destination','destination_lat',-1.28,'destination_lng',36.82,
  'departure_time', now() + interval '1 day','total_seats',1));
set request.jwt.claims to '{"sub":"$P1"}';
select public.request_seat((select id from public.trips where creator_id='$A'),1);
set request.jwt.claims to '{"sub":"$P2"}';
select public.request_seat((select id from public.trips where creator_id='$A'),1);
SQL

accept() {
  psql -X -q -t -A 2>&1 <<SQL
set role authenticated;
set request.jwt.claims to '{"sub":"$A"}';
begin;
select public.respond_to_request((select id from public.trip_requests where requester_id='$1'), true);
select pg_sleep(1);
commit;
SQL
}
accept "$P1" > /tmp/race1.out & p1=$!
accept "$P2" > /tmp/race2.out & p2=$!
wait $p1 $p2 || true
ok=$(grep -l '^accepted$' /tmp/race1.out /tmp/race2.out | wc -l)
full=$(grep -l 'not_enough_seats' /tmp/race1.out /tmp/race2.out | wc -l)
reserved=$(psql -X -t -A -c "select reserved_seats from public.trips where creator_id='$A'")
rm -f /tmp/race1.out /tmp/race2.out
if [ "$ok" = 1 ] && [ "$full" = 1 ] && [ "$reserved" = 1 ]; then
  echo "  ok - concurrent acceptance of the last seat: one accepted, one rejected, reserved=1"
else
  echo "  not ok - race result accepted=$ok rejected=$full reserved=$reserved"; exit 1
fi
