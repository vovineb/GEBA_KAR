import { router, useFocusEffect } from 'expo-router';
import { MessageCircle, Users } from 'lucide-react-native';
import { useCallback, useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Divider, EmptyState, ErrorState, ListRow, LoadingState, Screen, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { listConversations } from '@/services/chatService';
import { useUserId } from '@/store/authStore';
import { useBadgeStore } from '@/store/badgeStore';
import { colors, radius, space } from '@/theme';

export default function MessagesScreen() {
  const userId = useUserId()!;
  const refreshBadges = useBadgeStore((s) => s.refresh);
  const list = useAsync(listConversations, []);
  const { reload } = list;

  useFocusEffect(
    useCallback(() => {
      void reload();
      void refreshBadges();
    }, [reload, refreshBadges]),
  );

  // One subscription for the inbox: new messages the user can see (RLS).
  useEffect(() => {
    const channel = supabase
      .channel(`conversations:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        void reload();
        void refreshBadges();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, reload, refreshBadges]);

  return (
    <Screen scroll={false} padded={false}>
      <Text variant="title" style={styles.title} accessibilityRole="header">
        Messages
      </Text>
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState message={list.error.message} onRetry={reload} />
      ) : (
        <FlatList
          data={list.data ?? []}
          keyExtractor={(c) => c.conversation_id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Divider}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          renderItem={({ item }) => (
            <ListRow
              title={item.title}
              subtitle={`${item.trip_label ?? ''}\n${item.last_message ? `${item.last_sender_id === userId ? 'You: ' : ''}${item.last_message}` : 'No messages yet'}`}
              left={
                item.kind === 'trip_group' ? (
                  <View style={styles.groupIcon}>
                    <Users size={20} color={colors.brand} />
                  </View>
                ) : (
                  <Avatar path={item.avatar_path} name={item.title} />
                )
              }
              right={
                <View style={styles.right}>
                  <Text variant="small" tone="subtle">
                    {formatRelative(item.last_message_at)}
                  </Text>
                  {item.unread_count > 0 ? (
                    <View style={styles.unread} accessibilityLabel={`${item.unread_count} unread`}>
                      <Text variant="small" tone="inverse">
                        {item.unread_count}
                      </Text>
                    </View>
                  ) : null}
                </View>
              }
              onPress={() => router.push(`/chat/${item.conversation_id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={<MessageCircle size={36} color={colors.textSubtle} />}
              title="No conversations yet."
              body="When you request a seat or someone requests yours, you can chat here."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: space.lg, paddingTop: space.lg },
  list: { paddingHorizontal: space.lg, flexGrow: 1 },
  groupIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end', gap: 4 },
  unread: { minWidth: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
