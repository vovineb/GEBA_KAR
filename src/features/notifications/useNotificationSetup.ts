import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import { notificationRoute, registerForPush } from '@/services/notificationService';
import { useBadgeStore } from '@/store/badgeStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for push (only if permission was already granted;
 * the Settings screen asks explicitly), routes notification taps, and keeps
 * unread badges fresh through one realtime subscription.
 */
export function useNotificationSetup(userId: string) {
  const refreshBadges = useBadgeStore((s) => s.refresh);

  useEffect(() => {
    void registerForPush(false).catch(() => undefined);
  }, [userId]);

  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = lastResponse.notification.request.content.data as Record<string, unknown>;
    router.push(notificationRoute(data));
  }, [lastResponse]);

  useEffect(() => {
    void refreshBadges();
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => void refreshBadges(),
      )
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void refreshBadges());
    return () => {
      sub.remove();
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshBadges]);
}
