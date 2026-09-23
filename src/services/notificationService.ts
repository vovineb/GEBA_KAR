import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ensureOk, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/types/domain';

// In-app notifications are rows in `notifications` (created by the
// database). Push delivery is done server-side by the send-push Edge
// Function; this module only registers the device and reads the inbox.

let currentToken: string | null = null;

export type PushRegistration =
  | { status: 'registered' }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

export async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Trips and messages',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function registerForPush(askPermission: boolean): Promise<PushRegistration> {
  if (!Device.isDevice) return { status: 'unavailable', reason: 'Push notifications need a physical device.' };
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return { status: 'unavailable', reason: 'Push is not configured for this build (EAS_PROJECT_ID).' };

  await ensureAndroidChannel();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && askPermission) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return { status: 'denied' };

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  ensureOk(await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS }));
  currentToken = token;
  return { status: 'registered' };
}

/** Stops push to this device for the signed-in account (sign out / opt out). */
export async function unregisterThisDevice() {
  if (!currentToken) return;
  await supabase.from('push_tokens').delete().eq('token', currentToken);
  currentToken = null;
}

export async function listNotifications(offset = 0): Promise<AppNotification[]> {
  return unwrap(
    await supabase
      .from('notifications')
      .select('*')
      .neq('type', 'new_message')
      .order('created_at', { ascending: false })
      .range(offset, offset + 29),
  );
}

export async function markNotificationRead(id: string) {
  ensureOk(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id));
}

export async function markAllNotificationsRead(userId: string) {
  unwrap(
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null),
  );
}

export async function getUnreadCounts() {
  const rows = unwrap(await supabase.rpc('unread_counts'));
  return { messages: Number(rows[0]?.messages ?? 0), notifications: Number(rows[0]?.notifications ?? 0) };
}

/** Where a notification should take the user. */
export function notificationRoute(data: Record<string, unknown> | null | undefined, tripId?: string | null) {
  const conversationId = data?.conversation_id;
  if (typeof conversationId === 'string') return `/chat/${conversationId}` as const;
  const trip = tripId ?? (typeof data?.trip_id === 'string' ? data.trip_id : null);
  if (trip) return `/trip/${trip}` as const;
  return '/notifications' as const;
}
