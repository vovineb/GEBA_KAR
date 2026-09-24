import { router, useFocusEffect } from 'expo-router';
import { Repeat, Route } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Badge, EmptyState, ErrorState, ListRow, LoadingState, Screen, Segmented, Text } from '@/components/ui';
import { requestStatusBadge, tripStatusBadge } from '@/features/trips/labels';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime } from '@/lib/format';
import { listMyTrips } from '@/services/tripService';
import { useAppConfig } from '@/store/configStore';
import type { MyTrip } from '@/types/domain';
import { colors, radius, space } from '@/theme';

type Tab = 'upcoming' | 'past';

export default function TripsScreen() {
  const config = useAppConfig();
  const [tab, setTab] = useState<Tab>('upcoming');
  const trips = useAsync(() => listMyTrips(tab === 'past'), [tab]);
  const { reload } = trips;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">
          Your trips
        </Text>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
        />
        {config.features.recurring ? (
          <ListRow
            title="Recurring commutes"
            subtitle="Manage your regular schedules"
            left={<Repeat size={20} color={colors.brand} />}
            onPress={() => router.push('/recurring')}
          />
        ) : null}
      </View>
      {trips.loading ? (
        <LoadingState />
      ) : trips.error ? (
        <ErrorState message={trips.error.message} onRetry={reload} />
      ) : (
        <FlatList
          data={trips.data ?? []}
          keyExtractor={(t) => `${t.trip_id}-${t.request_id ?? 'm'}`}
          contentContainerStyle={styles.list}
          refreshing={trips.refreshing}
          onRefresh={trips.refresh}
          renderItem={({ item }) => <TripRow trip={item} timeZone={config.timezone} />}
          ListEmptyComponent={
            <EmptyState
              icon={<Route size={36} color={colors.textSubtle} />}
              title={tab === 'upcoming' ? 'No upcoming trips yet.' : 'No past trips yet.'}
              body={tab === 'upcoming' ? 'Find someone going your way, or offer your empty seats.' : undefined}
              actions={
                tab === 'upcoming'
                  ? [
                      { label: 'Find a trip', onPress: () => router.push('/') },
                      { label: 'Create a trip', onPress: () => router.push('/create'), variant: 'secondary' },
                    ]
                  : undefined
              }
            />
          }
        />
      )}
    </Screen>
  );
}

function TripRow({ trip, timeZone }: { trip: MyTrip; timeZone: string }) {
  const status = trip.request_status ? requestStatusBadge[trip.request_status] : tripStatusBadge[trip.status];
  const roleLabel = trip.role === 'creator' ? 'You created this trip' : `With ${trip.creator_name || 'CASS member'}`;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(trip.status === 'in_progress' ? `/trip/${trip.trip_id}/active` : `/trip/${trip.trip_id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
          {trip.origin_name} → {trip.destination_name}
        </Text>
        <Badge label={status.label} tone={status.tone} />
      </View>
      <Text tone="muted">{formatDateTime(trip.departure_time, timeZone)}</Text>
      <View style={styles.row}>
        <Text variant="caption" tone="subtle" style={styles.flex}>
          {roleLabel}
          {trip.is_recurring ? ' · regular commute' : ''}
        </Text>
        {trip.role === 'creator' && trip.pending_request_count > 0 ? (
          <Badge label={`${trip.pending_request_count} request${trip.pending_request_count > 1 ? 's' : ''}`} tone="info" />
        ) : trip.role === 'creator' && ['open', 'full'].includes(trip.status) ? (
          <Text variant="caption" tone="muted">
            {trip.total_seats - trip.available_seats}/{trip.total_seats} booked
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { padding: space.lg, gap: space.md },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md, flexGrow: 1 },
  card: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
