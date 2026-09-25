import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { ErrorState, LoadingState, Screen } from '@/components/ui';
import { useNotificationSetup } from '@/features/notifications/useNotificationSetup';
import { useAuthStore, useIsGuest } from '@/store/authStore';
import { useConfigStore } from '@/store/configStore';
import { useProfileStore } from '@/store/profileStore';
import { colors } from '@/theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  const userId = useAuthStore((s) => s.session!.user.id);
  const config = useConfigStore((s) => s.config);
  const error = useConfigStore((s) => s.error);
  const load = useConfigStore((s) => s.load);

  const isGuest = useIsGuest();
  const loadProfile = useProfileStore((s) => s.load);
  const clearProfile = useProfileStore((s) => s.clear);

  useEffect(() => {
    void load();
  }, [load]);
  // Guests have no account: no push registration.
  useNotificationSetup(userId, !!config && !isGuest);

  // New members see the welcome guide once (and accept the terms if they
  // have not yet); later sign-ins skip it.
  const ready = !!config;
  useEffect(() => {
    if (!ready || isGuest) {
      clearProfile();
      return;
    }
    let alive = true;
    void loadProfile().then((p) => {
      if (alive && p && (!p.onboarded_at || !p.terms_accepted_at)) router.push('/welcome');
    });
    return () => {
      alive = false;
    };
  }, [ready, isGuest, userId, loadProfile, clearProfile]);

  // The navigator is always mounted so deep links and notification taps that
  // arrive during start-up keep their target; each screen's content waits for
  // the remote configuration instead.
  return (
    <Stack
      screenLayout={({ children }) =>
        config ? (
          children
        ) : (
          <Screen scroll={false}>
            {error ? <ErrorState message={error.message} onRetry={load} /> : <LoadingState label="Getting ready…" />}
          </Screen>
        )
      }
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
      <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}
