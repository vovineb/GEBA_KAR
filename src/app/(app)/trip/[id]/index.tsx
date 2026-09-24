import { router, useLocalSearchParams } from 'expo-router';
import { Car, Clock, Flag, Luggage, MessageCircle, Repeat, Share2, ShieldAlert, Users } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Badge, Button, Divider, ErrorState, ListRow, LoadingState, RatingSummary, Screen, Section, Text } from '@/components/ui';
import { expresswayLabel, luggageLabel, requestStatusBadge, tripStatusBadge, tripTypeLabel } from '@/features/trips/labels';
import { startTripAndShare } from '@/features/trips/lifecycle';
import { RequestSeatPanel } from '@/features/trips/RequestSeatPanel';
import { shareTrip } from '@/features/trips/shareTrip';
import { primaryAction } from '@/features/trips/tripActions';
import { TripMap } from '@/features/trips/TripMap';
import { useTripDetail } from '@/features/trips/useTripDetail';
import { useAction } from '@/hooks/useAction';
import { formatDateTime, formatDistance, formatDuration, formatMoney, formatTime } from '@/lib/format';
import { cancelRequest, cancelTrip, reportNoShow } from '@/services/tripService';
import { useUserId } from '@/store/authStore';
import { useAppConfig } from '@/store/configStore';
import type { TripDetail } from '@/types/domain';
import { colors, space } from '@/theme';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, error, loading, reload, refreshing, refresh } = useTripDetail(id);

  if (loading && !trip) return <LoadingState label="Loading trip…" />;
  if (error && !trip) return <ErrorState message={error.message} onRetry={reload} />;
  if (!trip) return <ErrorState message="This trip is no longer available." />;
  return <TripDetailView trip={trip} reload={reload} refreshing={refreshing} refresh={refresh} />;
}

function TripDetailView({
  trip,
  reload,
  refreshing,
  refresh,
}: {
  trip: TripDetail;
  reload: () => Promise<void>;
  refreshing: boolean;
  refresh: () => Promise<void>;
}) {
  const config = useAppConfig();
  const userId = useUserId()!;
  const tz = config.timezone;
  const [requesting, setRequesting] = useState(false);
  const action = primaryAction(trip, userId, new Date(), config.trip_rules.start_window_minutes);
  const statusBadge = tripStatusBadge[trip.status];
  const contribution = formatMoney(trip.suggested_contribution, trip.currency);

  const start = useAction(async () => {
    await startTripAndShare(trip, config);
    await reload();
    router.push(`/trip/${trip.id}/active`);
  }, { errorTitle: 'Could not start trip' });

  const withdraw = useAction(async () => {
    if (trip.my_request) await cancelRequest(trip.my_request.id);
    await reload();
  }, { errorTitle: 'Could not cancel' });

  const cancel = useAction(async (reason: string | null) => {
    await cancelTrip(trip.id, reason);
    await reload();
  }, { errorTitle: 'Could not cancel trip' });

  const noShow = useAction(async (uid: string) => {
    await reportNoShow(trip.id, uid);
    Alert.alert('Recorded', 'Thank you. The no-show has been recorded.');
    await reload();
  });

  const confirmCancelTrip = () =>
    Alert.alert(
      'Cancel this trip?',
      trip.reserved_seats > 0
        ? 'Passengers with confirmed seats will be notified. Late cancellations are recorded.'
        : 'The trip will be removed from search.',
      [
        { text: 'Keep trip', style: 'cancel' },
        { text: 'Cancel trip', style: 'destructive', onPress: () => void cancel.run(null) },
      ],
    );

  const confirmLeave = () =>
    Alert.alert(
      trip.my_request?.status === 'pending' ? 'Withdraw your request?' : 'Cancel your seat?',
      trip.my_request?.status === 'pending' ? undefined : 'The trip creator will be notified. Late cancellations are recorded.',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Yes, cancel', style: 'destructive', onPress: () => void withdraw.run() },
      ],
    );

  const departed = new Date(trip.departure_time) <= new Date();

  return (
    <Screen
      edges={[]}
      padded={false}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={
        <PrimaryActionBar
          action={action}
          trip={trip}
          timeZone={tz}
          busy={start.busy || withdraw.busy || cancel.busy}
          onRequest={() => setRequesting(true)}
          onStart={start.run}
          onWithdraw={confirmLeave}
        />
      }
    >
      <TripMap trip={trip} style={styles.map} />
      <View style={styles.body}>
        <View style={styles.badges}>
          <Badge label={statusBadge.label} tone={statusBadge.tone} />
          <Badge label={tripTypeLabel[trip.trip_type]} tone="brand" />
          {trip.recurring_trip_id ? <Badge label="Regular commute" tone="brand" /> : null}
          {trip.my_request && !trip.is_creator && trip.my_membership?.status !== 'confirmed' ? (
            <Badge label={requestStatusBadge[trip.my_request.status].label} tone={requestStatusBadge[trip.my_request.status].tone} />
          ) : null}
        </View>

        <View style={styles.route}>
          <Text variant="heading">{trip.origin_name}</Text>
          <Text tone="muted">to {trip.destination_name}</Text>
        </View>

        {trip.status === 'cancelled' && trip.cancellation_reason ? (
          <Text tone="danger">Cancelled: {trip.cancellation_reason}</Text>
        ) : null}

        <View style={styles.facts}>
          <Fact icon={<Clock size={18} color={colors.textMuted} />} text={`${formatDateTime(trip.departure_time, tz)}${trip.estimated_arrival ? ` · arrives ~${formatTime(trip.estimated_arrival, tz)}` : ''}`} />
          <Fact icon={<Users size={18} color={colors.textMuted} />} text={`${trip.available_seats} of ${trip.total_seats} seats free`} />
          {trip.distance_m ? (
            <Fact icon={<Flag size={18} color={colors.textMuted} />} text={`${formatDistance(trip.distance_m)} · ${formatDuration(trip.duration_s)} by road · ${expresswayLabel[trip.expressway_option]}`} />
          ) : (
            <Fact icon={<Flag size={18} color={colors.textMuted} />} text={expresswayLabel[trip.expressway_option]} />
          )}
          <Fact icon={<Luggage size={18} color={colors.textMuted} />} text={luggageLabel[trip.luggage_policy]} />
          {trip.recurring_trip_id ? <Fact icon={<Repeat size={18} color={colors.textMuted} />} text="Part of a regular commute schedule" /> : null}
        </View>

        {contribution ? (
          <View style={styles.contribution}>
            <Text variant="caption" tone="muted">
              Suggested trip contribution
            </Text>
            <Text variant="heading">{contribution} per seat</Text>
            <Text variant="small" tone="subtle">
              Cost sharing agreed between travellers. CASS does not charge fares or take payment.
            </Text>
          </View>
        ) : null}

        {trip.pickup_point || trip.dropoff_point ? (
          <Section title="Meeting points">
            {trip.pickup_point ? <ListRow title={trip.pickup_point.name} subtitle={`Pickup · ${trip.pickup_point.description ?? ''}`} /> : null}
            {trip.dropoff_point ? <ListRow title={trip.dropoff_point.name} subtitle={`Drop-off · ${trip.dropoff_point.description ?? ''}`} /> : null}
          </Section>
        ) : null}

        {trip.stops.length ? (
          <Section title="Planned stops">
            {trip.stops.map((s) => (
              <Text key={s.position}>
                {s.position}. {s.name}
              </Text>
            ))}
          </Section>
        ) : null}

        {trip.notes ? (
          <Section title="Notes">
            <Text>{trip.notes}</Text>
          </Section>
        ) : null}

        <Divider />
        <Section title={trip.is_creator ? 'Your vehicle' : 'Trip creator'}>
          {!trip.is_creator ? (
            <ListRow
              title={trip.creator.full_name || 'CASS member'}
              subtitle={`${trip.creator.completed_trips_count} shared trips completed`}
              left={<Avatar path={trip.creator.avatar_path} name={trip.creator.full_name} />}
              right={<RatingSummary average={trip.creator.rating_average} count={trip.creator.rating_count} />}
              onPress={() => router.push(`/user/${trip.creator.id}`)}
            />
          ) : null}
          <ListRow
            title={`${trip.vehicle.colour} ${trip.vehicle.make} ${trip.vehicle.model}${trip.vehicle.year ? ` (${trip.vehicle.year})` : ''}`}
            subtitle={trip.vehicle.registration_number ? `Registration ${trip.vehicle.registration_number}` : 'Registration shown after your seat is confirmed'}
            left={<Car size={22} color={colors.textMuted} />}
          />
        </Section>

        {trip.is_participant && trip.members.length > 1 ? (
          <Section title="People on this trip">
            {trip.members.map((m) => (
              <ListRow
                key={m.user_id}
                title={`${m.full_name || 'CASS member'}${m.user_id === userId ? ' (you)' : ''}`}
                subtitle={m.role === 'creator' ? 'Trip creator' : `${m.seat_count} seat${m.seat_count > 1 ? 's' : ''}${m.status === 'no_show' ? ' · no-show' : ''}`}
                left={<Avatar path={m.avatar_path} name={m.full_name} size={36} />}
                onPress={
                  m.user_id === userId
                    ? undefined
                    : () =>
                        Alert.alert(m.full_name || 'CASS member', undefined, [
                          { text: 'View profile', onPress: () => router.push(`/user/${m.user_id}`) },
                          ...(departed && m.status !== 'no_show' && (trip.is_creator || m.role === 'creator') && trip.status !== 'completed'
                            ? [{ text: 'Report no-show', onPress: () => void noShow.run(m.user_id) }]
                            : []),
                          { text: 'Close', style: 'cancel' as const },
                        ])
                }
              />
            ))}
          </Section>
        ) : null}

        {requesting && action.kind === 'request' ? (
          <RequestSeatPanel
            trip={trip}
            maxSeatsPerRequest={config.trip_rules.max_seats_per_request}
            onCancel={() => setRequesting(false)}
            onDone={() => {
              setRequesting(false);
              void reload();
            }}
          />
        ) : null}

        <Section title="Trip tools">
          {trip.direct_conversation_id && !trip.is_creator ? (
            <ListRow title={`Message ${trip.creator.full_name || 'the trip creator'}`} left={<MessageCircle size={20} color={colors.brand} />} onPress={() => router.push(`/chat/${trip.direct_conversation_id}`)} />
          ) : null}
          {trip.group_conversation_id ? (
            <ListRow title="Trip group chat" left={<MessageCircle size={20} color={colors.brand} />} onPress={() => router.push(`/chat/${trip.group_conversation_id}`)} />
          ) : null}
          {trip.is_creator && (trip.status === 'open' || trip.status === 'full') ? (
            <ListRow title="Seat requests" subtitle={trip.pending_request_count ? `${trip.pending_request_count} waiting for your reply` : 'No pending requests'} left={<Users size={20} color={colors.brand} />} onPress={() => router.push(`/trip/${trip.id}/requests`)} />
          ) : null}
          <ListRow title="Share trip details" subtitle="Send route, time and vehicle to someone you trust" left={<Share2 size={20} color={colors.brand} />} onPress={() => void shareTrip(trip, tz)} />
          <ListRow title="Report this trip" left={<ShieldAlert size={20} color={colors.danger} />} onPress={() => router.push({ pathname: '/report', params: { tripId: trip.id, userId: trip.is_creator ? '' : trip.creator.id } })} />
          {trip.is_creator && ['open', 'full', 'draft'].includes(trip.status) ? (
            <Button title="Cancel trip" variant="danger" loading={cancel.busy} onPress={confirmCancelTrip} />
          ) : null}
          {!trip.is_creator && trip.my_membership?.status === 'confirmed' && ['open', 'full'].includes(trip.status) ? (
            <Button title="Cancel my seat" variant="danger" loading={withdraw.busy} onPress={confirmLeave} />
          ) : null}
        </Section>
        <Text variant="small" tone="subtle">
          CASS connects people already travelling the same way. It is not a taxi service and does not provide emergency
          response. In an emergency call 999 or 112.
        </Text>
      </View>
    </Screen>
  );
}

function Fact({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.fact}>
      {icon}
      <Text style={styles.flex}>{text}</Text>
    </View>
  );
}

function PrimaryActionBar({
  action,
  trip,
  timeZone,
  busy,
  onRequest,
  onStart,
  onWithdraw,
}: {
  action: ReturnType<typeof primaryAction>;
  trip: TripDetail;
  timeZone: string;
  busy: boolean;
  onRequest: () => void;
  onStart: () => void;
  onWithdraw: () => void;
}) {
  switch (action.kind) {
    case 'request':
      return <Button title="Request seat" onPress={onRequest} />;
    case 'pending':
      return (
        <View style={styles.bar}>
          <Button title="Request pending" disabled style={styles.flex} />
          <Button title="Withdraw" variant="secondary" loading={busy} onPress={onWithdraw} />
        </View>
      );
    case 'confirmed':
      return <Button title="Seat confirmed · View trip chat" onPress={() => trip.group_conversation_id && router.push(`/chat/${trip.group_conversation_id}`)} />;
    case 'live':
      return <Button title="Open live trip" onPress={() => router.push(`/trip/${trip.id}/active`)} />;
    case 'rate':
      return <Button title="Rate your trip" onPress={() => router.push(`/trip/${trip.id}/rate`)} />;
    case 'full':
      return <Button title="Trip full" disabled />;
    case 'cancelled':
      return <Button title="Trip cancelled" disabled />;
    case 'declined':
      return <Button title="Request declined" disabled />;
    case 'done':
      return <Button title="Trip completed" disabled />;
    case 'unavailable':
      return <Button title={action.reason} disabled />;
    case 'manage':
      return (
        <View style={styles.bar}>
          <Button
            title={action.pending ? `Requests (${action.pending})` : 'Requests'}
            variant="secondary"
            onPress={() => router.push(`/trip/${trip.id}/requests`)}
            style={styles.flex}
          />
          <Button
            title={action.canStart ? 'Start trip' : `Start from ${formatTime(action.startsAt.toISOString(), timeZone)}`}
            disabled={!action.canStart}
            loading={busy}
            onPress={onStart}
            style={styles.flex}
          />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  map: { height: 240, flex: 0 },
  body: { padding: space.lg, gap: space.lg },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  route: { gap: 2 },
  facts: { gap: space.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  contribution: { gap: 2, padding: space.lg, borderRadius: 12, backgroundColor: colors.surface },
  bar: { flexDirection: 'row', gap: space.sm },
});
