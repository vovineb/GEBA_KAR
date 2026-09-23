import '@/features/location/trackingTask';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigErrorScreen } from '@/features/auth/ConfigErrorScreen';
import { isEnvValid } from '@/config/env';
import { useAuthStore } from '@/store/authStore';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialized = useAuthStore((s) => s.initialized);
  const signedIn = useAuthStore((s) => !!s.session);
  const recovering = useAuthStore((s) => s.recovering);
  const init = useAuthStore((s) => s.init);

  useEffect(() => (isEnvValid ? init() : undefined), [init]);
  useEffect(() => {
    if (initialized || !isEnvValid) void SplashScreen.hideAsync();
  }, [initialized]);

  if (!isEnvValid) return <ConfigErrorScreen />;
  if (!initialized) return null; // splash stays visible until the session is known

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!signedIn || recovering}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !recovering}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
