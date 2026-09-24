import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { CassMap } from '@/components/map/CassMap';
import { Pin, RouteLine } from '@/components/map/MapLayers';
import type { LatLng, TripDetail } from '@/types/domain';

/** Route, origin/destination, meeting points and stops for a trip. */
export function TripMap({
  trip,
  style,
  children,
  showUserLocation,
  extraPoints = [],
}: {
  trip: TripDetail;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  showUserLocation?: boolean;
  extraPoints?: LatLng[];
}) {
  const origin = { lat: trip.origin_lat, lng: trip.origin_lng };
  const destination = { lat: trip.destination_lat, lng: trip.destination_lng };
  const routePoints: LatLng[] = trip.route?.coordinates.map(([lng, lat]) => ({ lat: lat!, lng: lng! })) ?? [];
  const fit = [origin, destination, ...routePoints.filter((_, i) => i % 20 === 0), ...extraPoints];
  return (
    <CassMap style={style} fitPoints={fit} showUserLocation={showUserLocation}>
      {trip.route ? <RouteLine route={trip.route} /> : null}
      <Pin id="origin" point={origin} kind="origin" label={trip.origin_name} />
      <Pin id="destination" point={destination} kind="destination" label={trip.destination_name} />
      {trip.pickup_point ? <Pin id="pickup" point={trip.pickup_point} kind="pickup" label={`Pickup: ${trip.pickup_point.name}`} /> : null}
      {trip.dropoff_point ? <Pin id="dropoff" point={trip.dropoff_point} kind="pickup" label={`Drop-off: ${trip.dropoff_point.name}`} /> : null}
      {trip.stops.map((s) => (
        <Pin key={s.position} id={`stop-${s.position}`} point={s} kind="stop" label={s.name} />
      ))}
      {children}
    </CassMap>
  );
}
