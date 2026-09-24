import { Alert } from 'react-native';

import { ensureLocationPermission } from '@/features/location/permissions';
import { startTripTracking, stopTripTracking } from '@/features/location/trackingTask';
import type { AppConfig } from '@/config/appConfig';
import { completeTrip, startTrip } from '@/services/tripService';
import type { TripDetail } from '@/types/domain';

/** Begin real GPS sharing for a trip the user is on (creator or passenger). */
export async function beginSharing(trip: TripDetail, config: AppConfig): Promise<boolean> {
  const perm = await ensureLocationPermission('trip');
  if (perm !== 'granted') {
    Alert.alert(
      'Location not shared',
      'Your trip continues, but the others on this trip will not see where you are. You can turn sharing on from the live trip screen.',
    );
    return false;
  }
  try {
    await startTripTracking(trip.id, {
      intervalSeconds: config.location.min_interval_seconds,
      distanceMeters: config.location.min_distance_m,
      tripLabel: `${trip.origin_name} → ${trip.destination_name}`,
    });
    return true;
  } catch {
    Alert.alert('Location unavailable', 'We could not start location sharing. Check that location services are on.');
    return false;
  }
}

/** Creator starts the trip (server validates timing), then shares location. */
export async function startTripAndShare(trip: TripDetail, config: AppConfig) {
  await startTrip(trip.id);
  await beginSharing(trip, config);
}

/** Creator ends the trip: marks it completed and stops all location sharing. */
export async function endTrip(tripId: string) {
  await completeTrip(tripId);
  await stopTripTracking(tripId);
}
