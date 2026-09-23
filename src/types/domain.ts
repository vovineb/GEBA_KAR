import type { LineString } from 'geojson';
import type { Database } from '@/types/database';

type PublicSchema = Database['public'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];

export type TripType = Enums<'trip_type'>;
export type TripStatus = Enums<'trip_status'>;
export type RequestStatus = Enums<'request_status'>;
export type ExpresswayOption = Enums<'expressway_option'>;
export type LuggagePolicy = Enums<'luggage_policy'>;
export type ReportReason = Enums<'report_reason'>;
export type NotificationType = Enums<'notification_type'>;

export type Profile = Tables<'profiles'>;
export type PublicProfile = Pick<
  Profile,
  'id' | 'full_name' | 'avatar_path' | 'bio' | 'rating_average' | 'rating_count' | 'completed_trips_count' | 'created_at'
>;
export type Vehicle = Tables<'vehicles'>;
export type Place = Pick<Tables<'places'>, 'id' | 'name' | 'kind' | 'lat' | 'lng'>;
export type PickupPoint = Pick<Tables<'pickup_points'>, 'id' | 'name' | 'description' | 'lat' | 'lng' | 'place_id'>;
export type TripSearchResult = PublicSchema['CompositeTypes']['trip_search_result'];
export type MyTrip = PublicSchema['Functions']['my_trips']['Returns'][number];
export type ConversationSummary = PublicSchema['Functions']['list_conversations']['Returns'][number];
export type Message = Tables<'messages'>;
export type AppNotification = Tables<'notifications'>;
export type RecurringTrip = Omit<Tables<'recurring_trips'>, 'route_geometry'>;
export type LiveLocation = Tables<'live_locations'>;

export type LatLng = { lat: number; lng: number };

/** A place chosen by the user (search result, map pin, current location or pickup point). */
export type ChosenLocation = LatLng & { name: string; pickupPointId?: string | null };

export type RouteResult = {
  geometry: LineString;
  distance_m: number;
  duration_s: number;
  uses_tollways: boolean;
};

/** Shape of the get_trip_detail RPC (jsonb). */
export type TripDetail = {
  id: string;
  trip_type: TripType;
  status: TripStatus;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  route: LineString | null;
  distance_m: number | null;
  duration_s: number | null;
  departure_time: string;
  estimated_arrival: string | null;
  total_seats: number;
  reserved_seats: number;
  available_seats: number;
  suggested_contribution: number | null;
  currency: string;
  expressway_option: ExpresswayOption;
  luggage_policy: LuggagePolicy;
  notes: string | null;
  cancellation_reason: string | null;
  recurring_trip_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  is_creator: boolean;
  is_participant: boolean;
  is_blocked: boolean;
  creator: PublicProfile & { member_since: string };
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number | null;
    colour: string;
    seat_capacity: number;
    photo_path: string | null;
    registration_number: string | null;
  };
  pickup_point: (LatLng & { id: string; name: string; description: string | null }) | null;
  dropoff_point: (LatLng & { id: string; name: string; description: string | null }) | null;
  stops: (LatLng & { position: number; name: string })[];
  my_request: { id: string; status: RequestStatus; seat_count: number; created_at: string } | null;
  my_membership: { role: Enums<'member_role'>; status: Enums<'member_status'>; seat_count: number } | null;
  members: {
    user_id: string;
    role: Enums<'member_role'>;
    status: Enums<'member_status'>;
    seat_count: number;
    full_name: string;
    avatar_path: string | null;
    rating_average: number;
    rating_count: number;
    pickup_point_id: string | null;
    rated_by_me: boolean;
  }[];
  pending_request_count: number | null;
  direct_conversation_id: string | null;
  group_conversation_id: string | null;
};
