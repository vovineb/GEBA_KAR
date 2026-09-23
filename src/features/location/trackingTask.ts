import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { publishLocation, stopSharing } from '@/services/liveLocationService';

/**
 * Live trip location sharing.
 *
 * Runs as a user-started foreground service on Android (persistent
 * notification, keeps working with the screen off, no "all the time"
 * permission) and with the background location indicator on iOS. It is
 * only ever started for an in-progress trip and stopped when the trip ends.
 * Update cadence comes from configuration.location.
 */
export const LOCATION_TASK = 'cass-trip-location';
const ACTIVE_TRIP_KEY = 'cass.tracking.tripId';

type TaskPayload = { locations?: Location.LocationObject[] };

TaskManager.defineTask<TaskPayload>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const tripId = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  if (!tripId) return;
  const latest = data.locations[data.locations.length - 1]!;
  try {
    await publishLocation(tripId, {
      lat: latest.coords.latitude,
      lng: latest.coords.longitude,
      accuracy: latest.coords.accuracy ?? null,
      heading: latest.coords.heading ?? null,
      speed: latest.coords.speed ?? null,
      recordedAt: new Date(latest.timestamp).toISOString(),
    });
  } catch (e) {
    const message = (e as { code?: string }).code;
    // The trip ended elsewhere (other device, auto-complete): stop sharing.
    if (message === 'trip_not_active' || message === 'not_a_participant') await stopTripTracking();
  }
});

export async function startTripTracking(
  tripId: string,
  opts: { intervalSeconds: number; distanceMeters: number; tripLabel: string },
) {
  await AsyncStorage.setItem(ACTIVE_TRIP_KEY, tripId);
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: opts.intervalSeconds * 1000,
    distanceInterval: opts.distanceMeters,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Sharing your trip location',
      notificationBody: `${opts.tripLabel} · visible only to people on this trip`,
      killServiceOnDestroy: false,
    },
  });
}

export async function stopTripTracking(tripId?: string) {
  const active = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  const id = tripId ?? active;
  if (id) await stopSharing(id).catch(() => undefined);
}

export async function trackingTripId(): Promise<string | null> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  return running ? AsyncStorage.getItem(ACTIVE_TRIP_KEY) : null;
}
