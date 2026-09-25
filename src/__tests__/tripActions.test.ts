import { peopleToRate, primaryAction } from '@/features/trips/tripActions';
import type { TripDetail } from '@/types/domain';

const ME = 'me';
const OTHER = 'other';
const now = new Date('2026-10-01T04:00:00Z');

function trip(over: Partial<TripDetail> = {}): TripDetail {
  return {
    id: 't1',
    trip_type: 'commute',
    status: 'open',
    origin_name: 'Greatwall Gardens',
    origin_lat: -1.42,
    origin_lng: 36.95,
    destination_name: 'Nairobi CBD',
    destination_lat: -1.28,
    destination_lng: 36.82,
    route: null,
    distance_m: 30000,
    duration_s: 3000,
    departure_time: '2026-10-01T06:00:00Z',
    estimated_arrival: null,
    total_seats: 4,
    reserved_seats: 0,
    available_seats: 4,
    suggested_contribution: 120,
    currency: 'KES',
    expressway_option: 'either',
    luggage_policy: 'small',
    notes: null,
    women_only: false,
    cancellation_reason: null,
    recurring_trip_id: null,
    started_at: null,
    completed_at: null,
    is_creator: false,
    is_participant: false,
    is_blocked: false,
    creator: {
      id: OTHER,
      full_name: 'Alice',
      avatar_path: null,
      bio: null,
      gender: null,
      rating_average: 0,
      rating_count: 0,
      completed_trips_count: 0,
      created_at: '',
      member_since: '',
    },
    vehicle: { id: 'v', make: 'Toyota', model: 'Noah', year: null, colour: 'Silver', seat_capacity: 7, photo_path: null, photo_paths: [], registration_number: null },
    pickup_point: null,
    dropoff_point: null,
    stops: [],
    my_request: null,
    my_membership: null,
    members: [],
    pending_request_count: null,
    direct_conversation_id: null,
    group_conversation_id: null,
    ...over,
  };
}

const member = (user_id: string, status: 'confirmed' | 'completed', rated = false) => ({
  user_id,
  role: user_id === OTHER ? ('creator' as const) : ('passenger' as const),
  status,
  seat_count: 1,
  full_name: user_id,
  avatar_path: null,
  gender: null,
  rating_average: 0,
  rating_count: 0,
  pickup_point_id: null,
  rated_by_me: rated,
});

describe('primaryAction (passenger view)', () => {
  it('offers REQUEST SEAT on an open trip', () => {
    expect(primaryAction(trip(), ME, now, 60).kind).toBe('request');
  });
  it('shows REQUEST PENDING', () => {
    const t = trip({ my_request: { id: 'r', status: 'pending', seat_count: 1, created_at: '' } });
    expect(primaryAction(t, ME, now, 60).kind).toBe('pending');
  });
  it('shows TRIP FULL', () => {
    expect(primaryAction(trip({ status: 'full', available_seats: 0 }), ME, now, 60).kind).toBe('full');
  });
  it('shows TRIP CANCELLED even for confirmed passengers', () => {
    const t = trip({ status: 'cancelled', my_membership: { role: 'passenger', status: 'confirmed', seat_count: 1 } });
    expect(primaryAction(t, ME, now, 60).kind).toBe('cancelled');
  });
  it('shows confirmed seat, then live, then rate', () => {
    const base = { my_membership: { role: 'passenger' as const, status: 'confirmed' as const, seat_count: 1 } };
    expect(primaryAction(trip(base), ME, now, 60).kind).toBe('confirmed');
    expect(primaryAction(trip({ ...base, status: 'in_progress' }), ME, now, 60).kind).toBe('live');
    const done = trip({
      status: 'completed',
      my_membership: { role: 'passenger', status: 'completed', seat_count: 1 },
      members: [member(OTHER, 'completed'), member(ME, 'completed')],
    });
    expect(primaryAction(done, ME, now, 60).kind).toBe('rate');
    expect(peopleToRate(done, ME).map((m) => m.user_id)).toEqual([OTHER]);
  });
  it('does not ask to rate again once rated', () => {
    const done = trip({
      status: 'completed',
      my_membership: { role: 'passenger', status: 'completed', seat_count: 1 },
      members: [member(OTHER, 'completed', true), member(ME, 'completed')],
    });
    expect(primaryAction(done, ME, now, 60).kind).toBe('done');
  });
  it('blocks blocked users and departed trips', () => {
    expect(primaryAction(trip({ is_blocked: true }), ME, now, 60).kind).toBe('unavailable');
    expect(primaryAction(trip({ departure_time: '2026-10-01T03:00:00Z' }), ME, now, 60).kind).toBe('unavailable');
  });
  it('shows declined requests', () => {
    const t = trip({ my_request: { id: 'r', status: 'declined', seat_count: 1, created_at: '' } });
    expect(primaryAction(t, ME, now, 60).kind).toBe('declined');
  });
});

describe('primaryAction (creator view)', () => {
  const mine = { is_creator: true, creator: { ...trip().creator, id: ME }, pending_request_count: 2 };
  it('cannot start before the start window', () => {
    const a = primaryAction(trip(mine), ME, now, 60);
    expect(a).toMatchObject({ kind: 'manage', pending: 2, canStart: false });
  });
  it('can start inside the window', () => {
    const a = primaryAction(trip(mine), ME, new Date('2026-10-01T05:30:00Z'), 60);
    expect(a).toMatchObject({ kind: 'manage', canStart: true });
  });
  it('goes live when in progress', () => {
    expect(primaryAction(trip({ ...mine, status: 'in_progress' }), ME, now, 60).kind).toBe('live');
  });
});
