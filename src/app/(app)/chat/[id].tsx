import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SendHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { toAppError } from '@/lib/errors';
import { formatMessageTime } from '@/lib/format';
import {
  getConversationHeader,
  listMessages,
  markConversationRead,
  sendMessage,
  subscribeToMessages,
  unsubscribe,
} from '@/services/chatService';
import { useUserId } from '@/store/authStore';
import { useBadgeStore } from '@/store/badgeStore';
import { useAppConfig } from '@/store/configStore';
import type { Message } from '@/types/domain';
import { colors, radius, space } from '@/theme';

type ChatMessage = Message & { pending?: boolean; failed?: boolean };
const PAGE = 40;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId()!;
  const { timezone } = useAppConfig();
  const refreshBadges = useBadgeStore((s) => s.refresh);
  const header = useAsync(() => getConversationHeader(id), [id]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [olderDone, setOlderDone] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const sending = useRef(false);

  const markRead = useCallback(() => {
    void markConversationRead(id).then(refreshBadges);
  }, [id, refreshBadges]);

  /** Merge server rows into the list (newest first), de-duplicated by id. */
  const merge = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    });
  }, []);

  useEffect(() => {
    let alive = true;
    listMessages(id)
      .then((rows) => {
        if (!alive) return;
        merge(rows);
        setOlderDone(rows.length < PAGE);
        markRead();
      })
      .catch((e) => alive && setError(toAppError(e).message))
      .finally(() => alive && setLoading(false));
    const channel = subscribeToMessages(id, (m) => {
      merge([m]);
      if (m.sender_id !== userId) markRead();
    });
    return () => {
      alive = false;
      unsubscribe(channel);
    };
  }, [id, userId, merge, markRead]);

  const loadOlder = async () => {
    const oldest = messages[messages.length - 1];
    if (olderDone || loadingOlder || !oldest) return;
    setLoadingOlder(true);
    try {
      const rows = await listMessages(id, oldest.created_at);
      merge(rows);
      setOlderDone(rows.length < PAGE);
    } catch {
      setOlderDone(true);
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending.current) return;
    sending.current = true;
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: id,
      sender_id: userId,
      body,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [temp, ...prev]);
    setDraft('');
    try {
      const saved = await sendMessage(id, userId, body);
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      merge([saved]);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setDraft(body); // keep the unsent text
      setError(toAppError(e).message);
    } finally {
      sending.current = false;
    }
  };

  const conv = header.data;
  const readOnly = conv ? !conv.is_active : false;

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: conv?.title ?? 'Chat',
          headerRight: conv?.trip_id
            ? () => (
                <Pressable onPress={() => router.push(`/trip/${conv.trip_id}`)} hitSlop={8} accessibilityRole="button" style={styles.headerAction}>
                  <Text variant="caption" tone="brand">
                    View trip
                  </Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      {conv?.trip_label ? (
        <View style={styles.tripBar}>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {conv.trip_label}
          </Text>
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <LoadingState />
        ) : error && !messages.length ? (
          <ErrorState message={error} />
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingOlder ? <ActivityIndicator color={colors.brand} /> : null}
            ListEmptyComponent={
              <View style={styles.flipped}>
                <EmptyState title="No messages yet" body="Say hello and agree where and when to meet." />
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === userId;
              return (
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text tone={mine ? 'inverse' : 'default'}>{item.body}</Text>
                  <Text variant="small" tone={mine ? 'inverse' : 'subtle'} style={styles.meta}>
                    {item.pending ? 'Sending…' : formatMessageTime(item.created_at, timezone)}
                  </Text>
                </View>
              );
            }}
          />
        )}
        {error && messages.length ? (
          <Text variant="small" tone="danger" style={styles.errorLine}>
            {error}
          </Text>
        ) : null}
        {readOnly ? (
          <View style={styles.composer}>
            <Text tone="muted">You are no longer part of this conversation.</Text>
          </View>
        ) : (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                if (error) setError(null);
              }}
              placeholder="Message"
              placeholderTextColor={colors.textSubtle}
              multiline
              maxLength={2000}
              style={styles.input}
              accessibilityLabel="Message"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              onPress={send}
              disabled={!draft.trim()}
              style={[styles.send, !draft.trim() && styles.disabled]}
            >
              <SendHorizontal size={22} color={colors.textInverse} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  tripBar: { paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.surface },
  list: { padding: space.lg, gap: space.sm, flexGrow: 1 },
  flipped: { flex: 1, transform: [{ scaleY: -1 }] },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  meta: { marginTop: 2, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 16,
    color: colors.text,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  errorLine: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  headerAction: { paddingHorizontal: space.sm },
});
