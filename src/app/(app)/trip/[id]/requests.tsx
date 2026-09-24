import { router, useLocalSearchParams } from 'expo-router';
import { Inbox } from 'lucide-react-native';
import { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, RatingSummary, Text } from '@/components/ui';
import { requestStatusBadge } from '@/features/trips/labels';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { findDirectConversation } from '@/services/chatService';
import { listTripRequests, respondToRequest, type TripRequestRow } from '@/services/tripService';
import { colors, radius, space } from '@/theme';

export default function TripRequestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requests = useAsync(() => listTripRequests(id), [id]);
  const { reload } = requests;

  useEffect(() => {
    const channel = supabase
      .channel(`requests:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_requests', filter: `trip_id=eq.${id}` }, () =>
        void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, reload]);

  if (requests.loading) return <LoadingState />;
  if (requests.error) return <ErrorState message={requests.error.message} onRetry={reload} />;

  return (
    <FlatList
      style={styles.root}
      data={requests.data ?? []}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      refreshing={requests.refreshing}
      onRefresh={requests.refresh}
      renderItem={({ item }) => <RequestRow tripId={id} request={item} onChanged={reload} />}
      ListEmptyComponent={
        <EmptyState
          icon={<Inbox size={36} color={colors.textSubtle} />}
          title="No seat requests yet"
          body="When someone asks to join this trip, you will be notified and can accept or decline here."
        />
      }
    />
  );
}

function RequestRow({ tripId, request, onChanged }: { tripId: string; request: TripRequestRow; onChanged: () => void }) {
  const respond = useAction(async (accept: boolean) => {
    await respondToRequest(request.id, accept);
    onChanged();
  }, { errorTitle: 'Could not update request' });
  const openChat = useAction(async () => {
    if (!request.requester) return;
    const conversationId = await findDirectConversation(tripId, request.requester.id);
    if (conversationId) router.push(`/chat/${conversationId}`);
  });
  const r = request.requester;
  const badge = requestStatusBadge[request.status];

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar path={r?.avatar_path} name={r?.full_name} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" onPress={() => r && router.push(`/user/${r.id}`)}>
            {r?.full_name || 'CASS member'}
          </Text>
          <RatingSummary average={r?.rating_average} count={r?.rating_count} />
          <Text variant="small" tone="subtle">
            {r?.completed_trips_count ?? 0} shared trips · requested {formatRelative(request.created_at)} ago
          </Text>
        </View>
        <Badge label={badge.label} tone={badge.tone} />
      </View>
      <Text>
        {request.seat_count} seat{request.seat_count > 1 ? 's' : ''}
        {request.pickup_point ? ` · pickup at ${request.pickup_point.name}` : ''}
      </Text>
      {request.message ? (
        <Text tone="muted" style={styles.message}>
          “{request.message}”
        </Text>
      ) : null}
      <View style={styles.row}>
        <Button title="Message" variant="secondary" compact loading={openChat.busy} onPress={openChat.run} />
        {request.status === 'pending' ? (
          <>
            <Button title="Decline" variant="secondary" compact disabled={respond.busy} onPress={() => void respond.run(false)} style={styles.flex} />
            <Button title="Accept" compact loading={respond.busy} onPress={() => void respond.run(true)} style={styles.flex} />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: space.lg, gap: space.md, flexGrow: 1 },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  message: { fontStyle: 'italic' },
});
