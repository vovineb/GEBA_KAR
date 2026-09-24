import type { ConfigContext, ExpoConfig } from 'expo/config';
import { existsSync } from 'fs';

// Build-time configuration. Values come from .env (loaded by the Expo CLI);
// nothing environment-specific is hardcoded here.
const APP_NAME = process.env.APP_NAME || 'CASS';
const APP_ID = process.env.APP_ID || 'app.cass.mobile';
const APP_SLUG = process.env.APP_SLUG || 'gebacass';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || undefined;
const GOOGLE_SERVICES_FILE = process.env.GOOGLE_SERVICES_FILE || './google-services.json';

const LOCATION_WHEN_IN_USE =
  `${APP_NAME} uses your location to find trips near you, and to share your position with ` +
  'the people on your trip while a trip you are on is in progress.';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: APP_SLUG,
  scheme: 'cass',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: false,
  },
  android: {
    package: APP_ID,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Needed for Android push (FCM). Optional until push is configured.
    ...(existsSync(GOOGLE_SERVICES_FILE) ? { googleServicesFile: GOOGLE_SERVICES_FILE } : {}),
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 180, backgroundColor: '#ffffff' }],
    'expo-image',
    '@react-native-community/datetimepicker',
    [
      'expo-location',
      {
        locationWhenInUsePermission: LOCATION_WHEN_IN_USE,
        locationAlwaysAndWhenInUsePermission: LOCATION_WHEN_IN_USE,
        // Live trip sharing continues with the screen off through a visible,
        // user-started foreground service (Android) / background location
        // indicator (iOS). No "all the time" background permission is used.
        isIosBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/android-icon-monochrome.png',
        color: '#0B6E4F',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: `${APP_NAME} lets you choose a profile or vehicle photo.`,
        cameraPermission: `${APP_NAME} lets you take a profile or vehicle photo.`,
        microphonePermission: false,
      },
    ],
    '@maplibre/maplibre-react-native',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});
