import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

export type PermissionResult = 'granted' | 'denied' | 'blocked';

function explain(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]),
  );
}

/**
 * Foreground location permission with a plain-language explanation shown
 * BEFORE the system prompt. Never throws; callers render a fallback.
 */
export async function ensureLocationPermission(
  purpose: 'search' | 'trip',
): Promise<PermissionResult> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) {
    Alert.alert(
      'Location is turned off for CASS',
      'You can enable it in your phone settings. You can still type places manually.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => void Linking.openSettings() },
      ],
    );
    return 'blocked';
  }
  const ok = await explain(
    purpose === 'trip' ? 'Share your location during this trip' : 'Use your location',
    purpose === 'trip'
      ? 'While this trip is in progress, CASS shares your live position only with the people on this trip. ' +
          'Sharing stops automatically when the trip ends. A notification shows whenever sharing is on.'
      : 'CASS uses your current location to fill in where you are starting from and to show trips near you. ' +
          'It is not shared with anyone.',
  );
  if (!ok) return 'denied';
  const res = await Location.requestForegroundPermissionsAsync();
  return res.granted ? 'granted' : res.canAskAgain ? 'denied' : 'blocked';
}

export type CurrentFix = { lat: number; lng: number; accuracy: number | null };

/** One real GPS fix. Returns null if location services are unavailable. */
export async function getCurrentFix(): Promise<CurrentFix | null> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
  } catch {
    return null;
  }
}
