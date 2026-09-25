import type { LineString } from 'geojson';

import { ensureOk, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import type {
  ExpresswayOption,
  LuggagePolicy,
  MyTrip,
  RecurringTrip,
  RequestStatus,
  TripDetail,
  TripSearchResult,
  TripType,
} from '@/types/domain';

export type TripPayload = {
  vehicle_id: string;
  trip_type: TripType;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  pickup_point_id: string | null;
  dropoff_point_id: string | null;
  route_geojson: LineString | null;
  distance_m: number | null;
  duration_s: number | null;
  total_seats: number;
  suggested_contribution: number | null;
  expressway_option: ExpresswayOption;
  luggage_policy: LuggagePolicy;
  notes: string | null;
  women_only: boolean;
};

export async function createTrip(
  p: TripPayload & { departure_time: string; stops: { name: string; lat: number; lng: number }[] },
): Promise<string> {
  return unwrap(await supabase.rpc('create_trip', { p: p as unknown as Json }));
}

export async function createRecurringTrip(
  p: TripPayload & { weekdays: number[]; departure_local_time: string; start_date: string; end_date: string | null },
): Promise<string> {
  return unwrap(await supabase.rpc('create_recurring_trip', { p: p as unknown as Json }));
}

export type SearchParams = {
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  date?: string | null; // YYYY-MM-DD in service time zone
  time?: string | null; // HH:MM:SS
  seats: number;
  tripType?: TripType | null;
  expressway: ExpresswayOption;
  recurringOnly: boolean;
  limit?: number;
  offset?: number;
};

export async function searchTrips(s: SearchParams): Promise<TripSearchResult[]> {
  const rows: TripSearchResult[] = unwrap(
    await supabase.rpc('search_trips', {
      p_origin_lat: s.origin?.lat,
      p_origin_lng: s.origin?.lng,
      p_destination_lat: s.destination?.lat,
      p_destination_lng: s.destination?.lng,
      p_date: s.date ?? undefined,
      p_time: s.time ?? undefined,
      p_seats: s.seats,
      p_trip_type: s.tripType ?? undefined,
      p_expressway: s.expressway,
      p_recurring_only: s.recurringOnly,
      p_limit: s.limit ?? 20,
      p_offset: s.offset ?? 0,
    }),
  );
  // Women-only flags for the result cards (best effort; the trip screen and
  // the server enforce the rule).
  const ids = rows.map((r) => r.id).filter((id): id is string => !!id);
  if (!ids.length) return rows;
  const { data } = await supabase.from('trips').select('id, women_only').in('id', ids);
  const womenOnly = new Set((data ?? []).filter((t) => t.women_only).map((t) => t.id));
  return rows.map((r) => ({ ...r, women_only: !!r.id && womenOnly.has(r.id) }));
}

export async function logSearch(props: Record<string, unknown>) {
  await supabase.rpc('log_search', { p_props: props as never });
}

export async function getTripDetail(id: string): Promise<TripDetail> {
  return unwrap(await supabase.rpc('get_trip_detail', { p_trip_id: id })) as unknown as TripDetail;
}

export async function listMyTrips(past: boolean, offset = 0): Promise<MyTrip[]> {
  return unwrap(await supabase.rpc('my_trips', { p_past: past, p_limit: 30, p_offset: offset }));
}

export async function suggestContribution(distanceM: number, usesExpressway: boolean) {
  const rows = unwrap(
    await supabase.rpc('suggest_contribution', { p_distance_m: Math.round(distanceM), p_uses_expressway: usesExpressway }),
  );
  return rows[0] ?? null;
}

export async function requestSeat(
  tripId: string,
  seats: number,
  pickupPointId: string | null,
  dropoffPointId: string | null,
  message: string | null,
) {
  return unwrap(
    await supabase.rpc('request_seat', {
      p_trip_id: tripId,
      p_seat_count: seats,
      p_pickup_point_id: pickupPointId ?? undefined,
      p_dropoff_point_id: dropoffPointId ?? undefined,
      p_message: message ?? undefined,
    }),
  );
}

export type TripRequestRow = {
  id: string;
  status: RequestStatus;
  seat_count: number;
  message: string | null;
  created_at: string;
  pickup_point: { name: string } | null;
  requester: {
    id: string;
    full_name: string;
    avatar_path: string | null;
    rating_average: number;
    rating_count: number;
    completed_trips_count: number;
    gender: 'female' | 'male' | null;
  } | null;
};

export async function listTripRequests(tripId: string): Promise<TripRequestRow[]> {
  const rows = unwrap(
    await supabase
      .from('trip_requests')
      .select(
        'id, status, seat_count, message, created_at, ' +
          'pickup_point:pickup_points!trip_requests_pickup_point_id_fkey(name), ' +
          'requester:profiles!trip_requests_requester_id_fkey(id, full_name, avatar_path, gender, rating_average, rating_count, completed_trips_count)',
      )
      .eq('trip_id', tripId)
      .in('status', ['pending', 'accepted'])
      .order('created_at'),
  );
  return rows as unknown as TripRequestRow[];
}

export async function respondToRequest(requestId: string, accept: boolean) {
  return unwrap(await supabase.rpc('respond_to_request', { p_request_id: requestId, p_accept: accept }));
}

export async function cancelRequest(requestId: string) {
  ensureOk(await supabase.rpc('cancel_request', { p_request_id: requestId }));
}

export async function startTrip(tripId: string) {
  ensureOk(await supabase.rpc('start_trip', { p_trip_id: tripId }));
}

export async function completeTrip(tripId: string) {
  ensureOk(await supabase.rpc('complete_trip', { p_trip_id: tripId }));
}

export async function cancelTrip(tripId: string, reason: string | null) {
  ensureOk(await supabase.rpc('cancel_trip', { p_trip_id: tripId, p_reason: reason ?? undefined }));
}

export async function reportNoShow(tripId: string, userId: string) {
  ensureOk(await supabase.rpc('report_no_show', { p_trip_id: tripId, p_user_id: userId }));
}

export async function updateTripDetails(
  tripId: string,
  patch: { total_seats?: number; notes?: string | null; suggested_contribution?: number | null },
) {
  ensureOk(await supabase.from('trips').update(patch).eq('id', tripId));
}

const RECURRING_COLUMNS =
  'id, creator_id, vehicle_id, origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng, ' +
  'pickup_point_id, dropoff_point_id, distance_m, duration_s, weekdays, departure_local_time, timezone, start_date, ' +
  'end_date, total_seats, suggested_contribution, currency, expressway_option, luggage_policy, notes, status, created_at, updated_at';

export async function listMyRecurringTrips(): Promise<RecurringTrip[]> {
  const rows = unwrap(
    await supabase.from('recurring_trips').select(RECURRING_COLUMNS).neq('status', 'cancelled').order('created_at'),
  );
  return rows as unknown as RecurringTrip[];
}

export async function updateRecurringTrip(
  id: string,
  patch: Partial<Pick<RecurringTrip, 'status' | 'weekdays' | 'departure_local_time' | 'total_seats' | 'notes' | 'end_date'>>,
) {
  ensureOk(await supabase.from('recurring_trips').update(patch).eq('id', id));
}
