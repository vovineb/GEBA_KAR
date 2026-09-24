import { router, Stack, useFocusEffect } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Divider, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/lib/format';
import { listNotifications, markAllNotificationsRead, markNotificationRead, notificationRoute } from '@/services/notificationService';
import { useUserId } from '@/store/authStore';
import { useBadgeStore } from '@/store/badgeStore';
import type { AppNotification } from '@/types/domain';
import { colors, space } from '@/theme';

export default function NotificationsScreen() {
  const userId = useUserId()!;
  const refreshBadges = useBadgeStore((s) => s.refresh);
  const list = useAsync(() => listNotifications(), []);
  const { reload } = list;
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const readAll = useAction(async () => {
    await markAllNotificationsRead(userId);
    await Promise.all([reload(), refreshBadges()]);
  });

  const open = (n: AppNotification) => {
    if (!n.read_at) void markNotificationRead(n.id).then(refreshBadges);
    router.push(notificationRoute(n.data as Record<string, unknown>, n.related_trip_id));
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={readAll.run} hitSlop={8}>
              <Text variant="caption" tone="brand">
                Mark all read
              </Text>
            </Pressable>
          ),
        }}
      />
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState message={list.error.message} onRetry={reload} />
      ) : (
        <FlatList
          data={list.data ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Divider}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.read_at ? '' : 'Unread. '}${item.title}. ${item.body}`}
              onPress={() => open(item)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              {!item.read_at ? <View style={styles.dot} /> : <View style={styles.dotSpace} />}
              <View style={styles.flex}>
                <Text variant="bodyStrong">{item.title}</Text>
                <Text tone="muted">{item.body}</Text>
              </View>
              <Text variant="small" tone="subtle">
                {formatRelative(item.created_at)}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState icon={<Bell size={36} color={colors.textSubtle} />} title="No notifications yet" body="Seat requests, confirmations and trip updates appear here." />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: space.lg, flexGrow: 1 },
  item: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, alignItems: 'flex-start' },
  pressed: { opacity: 0.6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand, marginTop: 6 },
  dotSpace: { width: 10 },
  flex: { flex: 1, gap: 2 },
});
