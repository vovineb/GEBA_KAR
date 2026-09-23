import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { ErrorState, LoadingState, Screen } from '@/components/ui';
import { useNotificationSetup } from '@/features/notifications/useNotificationSetup';
import { useAuthStore } from '@/store/authStore';
import { useConfigStore } from '@/store/configStore';
import { colors } from '@/theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  const userId = useAuthStore((s) => s.session!.user.id);
  const config = useConfigStore((s) => s.config);
  const error = useConfigStore((s) => s.error);
  const load = useConfigStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);
  useNotificationSetup(userId);

  if (!config) {
    return (
      <Screen scroll={false}>
        {error ? <ErrorState message={error.message} onRetry={load} /> : <LoadingState label="Getting ready…" />}
      </Screen>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ title: 'Trips' }} />
      <Stack.Screen name="trip/[id]/index" options={{ title: 'Trip' }} />
      <Stack.Screen name="trip/[id]/requests" options={{ title: 'Seat requests' }} />
      <Stack.Screen name="trip/[id]/active" options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/rate" options={{ title: 'Rate your trip' }} />
      <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="location-picker" options={{ presentation: 'modal', title: 'Choose place' }} />
      <Stack.Screen name="report" options={{ presentation: 'modal', title: 'Report' }} />
      <Stack.Screen name="user/[id]" options={{ title: 'Profile' }} />
      <Stack.Screen name="profile-edit" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="vehicles/index" options={{ title: 'Vehicles' }} />
      <Stack.Screen name="vehicles/edit" options={{ title: 'Vehicle' }} />
      <Stack.Screen name="recurring" options={{ title: 'Recurring commutes' }} />
      <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
      <Stack.Screen name="settings/blocked" options={{ title: 'Blocked users' }} />
    </Stack>
  );
}
