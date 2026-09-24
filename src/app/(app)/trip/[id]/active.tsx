import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, LocateFixed, LocateOff, Share2, ShieldAlert } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pin } from '@/components/map/MapLayers';
import { Badge, Button, ErrorState, LoadingState, Text } from '@/components/ui';
import { stopTripTracking, trackingTripId } from '@/features/location/trackingTask';
import { beginSharing, endTrip } from '@/features/trips/lifecycle';
import { shareTrip } from '@/features/trips/shareTrip';
import { TripMap } from '@/features/trips/TripMap';
import { useTripDetail } from '@/features/trips/useTripDetail';
import { useAction } from '@/hooks/useAction';
import { formatRelative, formatTime } from '@/lib/format';
import { listLiveLocations, subscribeToLiveLocations } from '@/services/liveLocationService';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/store/authStore';
import { useAppConfig } from '@/store/configStore';
import type { LiveLocation, TripDetail } from '@/types/domain';
import { colors, radius, space } from '@/theme';

export default function ActiveTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, error, loading, reload } = useTripDetail(id);
  if (loading && !trip) return <LoadingState label="Opening live trip…" />;
  if (!trip) return <ErrorState message={error?.message ?? 'Trip unavailable.'} onRetry={reload} />;
  return <ActiveTrip trip={trip} reload={reload} />;
}

function useLiveLocations(tripId: string, active: boolean) {
  const [locations, setLocations] = useState<Record<string, LiveLocation>>({});
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    listLiveLocations(tripId)
      .then((rows) => !cancelled && setLocations(Object.fromEntries(rows.map((r) => [r.user_id, r]))))
      .catch(() => undefined);
    const channel = subscribeToLiveLocations(tripId, (loc) => setLocations((prev) => ({ ...prev, [loc.user_id]: loc })));
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [tripId, active]);
  return active ? locations : {};
}

function ActiveTrip({ trip, reload }: { trip: TripDetail; reload: () => Promise<void> }) {
  const config = useAppConfig();
  const userId = useUserId()!;
  const tz = config.timezone;
  const live = trip.status === 'in_progress';
  const locations = useLiveLocations(trip.id, live);
  const [sharing, setSharing] = useState(false);
  const [, tick] = useState(0);

  const refreshSharing = useCallback(async () => {
    const tracked = await trackingTripId();
    setSharing(tracked === trip.id);
  }, [trip.id]);
  useEffect(() => {
    let alive = true;
    trackingTripId().then((tracked) => alive && setSharing(tracked === trip.id));
    return () => {
      alive = false;
    };
  }, [trip.id]);

  // Tracking must never outlive the trip on this device.
  useEffect(() => {
    if (!live && sharing) void stopTripTracking(trip.id).then(refreshSharing);
  }, [live, sharing, trip.id, refreshSharing]);

  // Re-render every 15 s so "updated Xs ago" stays honest.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const names = useMemo(() => Object.fromEntries(trip.members.map((m) => [m.user_id, m.full_name || 'Traveller'])), [trip.members]);
  const others = Object.values(locations).filter((l) => l.user_id !== userId);
  const mine = locations[userId];
  const creatorLoc = locations[trip.creator.id];

  const toggleSharing = useAction(async () => {
    if (sharing) await stopTripTracking(trip.id);
    else await beginSharing(trip, config);
    await refreshSharing();
  });

  const end = useAction(async () => {
    await endTrip(trip.id);
    await refreshSharing();
    await reload();
    router.replace(`/trip/${trip.id}/rate`);
  }, { errorTitle: 'Could not end trip' });

  const confirmEnd = () =>
    Alert.alert('End this trip?', 'Location sharing stops for everyone and the trip is marked completed.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'End trip', onPress: () => void end.run() },
    ]);

  const poorAccuracy = mine?.accuracy_m != null && mine.accuracy_m > config.location.poor_accuracy_m;

  return (
    <View style={styles.root}>
      <TripMap
        trip={trip}
        style={styles.map}
        showUserLocation={sharing}
        extraPoints={Object.values(locations).map((l) => ({ lat: l.lat, lng: l.lng }))}
      >
        {others.map((l) => (
          <Pin key={l.user_id} id={`live-${l.user_id}`} point={l} kind="person" label={names[l.user_id] ?? 'Traveller'} />
        ))}
      </TripMap>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        {live ? <Badge label="LIVE" tone="live" /> : <Badge label="Trip ended" tone="neutral" />}
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.panel}>
        <Text variant="subheading" numberOfLines={1}>
          {trip.origin_name} → {trip.destination_name}
        </Text>
        <Text tone="muted">
          {trip.estimated_arrival ? `Expected arrival ~${formatTime(trip.estimated_arrival, tz)}` : 'Arrival time not estimated'}
          {trip.started_at ? ` · started ${formatTime(trip.started_at, tz)}` : ''}
        </Text>

        {live ? (
          <View style={styles.status}>
            {trip.is_creator ? null : creatorLoc ? (
              <Text variant="caption">
                {names[trip.creator.id]}’s location updated {formatRelative(creatorLoc.updated_at)} ago
              </Text>
            ) : (
              <Text variant="caption" tone="warning">
                Waiting for {trip.creator.full_name || 'the trip creator'} to share location…
              </Text>
            )}
            <Text variant="caption" tone={sharing ? 'success' : 'muted'}>
              {sharing ? 'You are sharing your live location with this trip only.' : 'You are not sharing your location.'}
            </Text>
            {poorAccuracy ? (
              <Text variant="caption" tone="warning">
                Your location accuracy is limited (about {Math.round(mine!.accuracy_m!)} m).
              </Text>
            ) : null}
          </View>
        ) : (
          <Text tone="muted">This trip is no longer in progress. Location sharing has stopped.</Text>
        )}

        <View style={styles.row}>
          {live ? (
            <Button
              title={sharing ? 'Stop sharing' : 'Share my location'}
              variant="secondary"
              compact
              loading={toggleSharing.busy}
              onPress={toggleSharing.run}
              icon={sharing ? <LocateOff size={16} color={colors.text} /> : <LocateFixed size={16} color={colors.text} />}
              style={styles.flex}
            />
          ) : null}
          <Button title="Share trip" variant="secondary" compact onPress={() => void shareTrip(trip, tz)} icon={<Share2 size={16} color={colors.text} />} style={styles.flex} />
          <Button
            title="Report"
            variant="secondary"
            compact
            onPress={() => router.push({ pathname: '/report', params: { tripId: trip.id, userId: trip.is_creator ? '' : trip.creator.id } })}
            icon={<ShieldAlert size={16} color={colors.danger} />}
          />
        </View>
        {trip.is_creator && live ? <Button title="End trip" loading={end.busy} onPress={confirmEnd} /> : null}
        {!live ? <Button title="Back to trip" onPress={() => router.replace(`/trip/${trip.id}`)} /> : null}
        <Text variant="small" tone="subtle">
          CASS is not an emergency service. In an emergency call 999 or 112.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  back: { backgroundColor: colors.background, borderRadius: 22, padding: 10, marginTop: space.sm },
  panel: {
    gap: space.sm,
    padding: space.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.background,
    marginTop: -radius.lg,
  },
  status: { gap: 2 },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
