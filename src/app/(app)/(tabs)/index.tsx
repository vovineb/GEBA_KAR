import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { ArrowUpDown, Bell, History, Radio } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ChipSelect } from '@/components/form/ChipSelect';
import { DateTimeField } from '@/components/form/DateTimeField';
import { LocationField } from '@/components/form/LocationField';
import { Stepper } from '@/components/form/Stepper';
import { Badge, Button, Divider, ListRow, Screen, Section, Segmented, Text } from '@/components/ui';
import { ensureLocationPermission, getCurrentFix } from '@/features/location/permissions';
import { encodeQuery, loadRecentSearches, saveRecentSearch, type RecentSearch } from '@/features/search/searchQuery';
import { expresswayOptions } from '@/features/trips/labels';
import { TripCard } from '@/features/trips/TripCard';
import { formatDateTime } from '@/lib/format';
import { addDays, toDateString, toTimeString } from '@/lib/time';
import { listMyTrips, searchTrips } from '@/services/tripService';
import { useBadgeStore } from '@/store/badgeStore';
import { useAppConfig } from '@/store/configStore';
import type { ChosenLocation, ExpresswayOption, MyTrip, TripSearchResult, TripType } from '@/types/domain';
import { colors, radius, space } from '@/theme';

type TypeFilter = 'any' | TripType;

export default function HomeScreen() {
  const config = useAppConfig();
  const unread = useBadgeStore((s) => s.notifications);
  const [from, setFrom] = useState<ChosenLocation | null>(null);
  const [to, setTo] = useState<ChosenLocation | null>(null);
  const [date, setDate] = useState<Date | null>(new Date());
  const [time, setTime] = useState<Date | null>(null);
  const [seats, setSeats] = useState(1);
  const [tripType, setTripType] = useState<TypeFilter>('any');
  const [expressway, setExpressway] = useState<ExpresswayOption>('either');
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [myTrips, setMyTrips] = useState<MyTrip[]>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [nearby, setNearby] = useState<TripSearchResult[] | null>(null);
  const [nearbyState, setNearbyState] = useState<'idle' | 'loading' | 'no-permission' | 'no-location' | 'error'>('idle');
  const [refreshing, setRefreshing] = useState(false);

  const loadNearby = useCallback(async (ask: boolean) => {
    const perm = ask ? await ensureLocationPermission('search') : (await Location.getForegroundPermissionsAsync()).granted ? 'granted' : 'denied';
    if (perm !== 'granted') return setNearbyState('no-permission');
    setNearbyState('loading');
    const fix = await getCurrentFix();
    if (!fix) return setNearbyState('no-location');
    try {
      setNearby(await searchTrips({ origin: fix, seats: 1, expressway: 'either', recurringOnly: false, limit: 5 }));
      setNearbyState('idle');
    } catch {
      setNearbyState('error');
    }
  }, []);

  const load = useCallback(async () => {
    const [trips, rec] = await Promise.all([listMyTrips(false).catch(() => [] as MyTrip[]), loadRecentSearches()]);
    setMyTrips(trips);
    setRecent(rec);
    await loadNearby(false);
  }, [loadNearby]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const active = myTrips.find((t) => t.status === 'in_progress');
  const upcoming = myTrips.find((t) => t.status !== 'in_progress' && t.request_status !== 'pending');
  const pending = myTrips.filter((t) => t.request_status === 'pending');

  const onSearch = () => {
    if (!from || !to) return setFormError('Choose where you are starting from and where you are going.');
    setFormError(null);
    void saveRecentSearch({ from, to });
    router.push({
      pathname: '/search',
      params: {
        q: encodeQuery({
          from,
          to,
          date: date ? toDateString(date) : null,
          time: date && time ? toTimeString(time) : null,
          seats,
          tripType: tripType === 'any' ? null : tripType,
          expressway,
          recurringOnly,
        }),
      },
    });
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Where are you going?
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          onPress={() => router.push('/notifications')}
          hitSlop={10}
          style={styles.bell}
        >
          <Bell size={24} color={colors.text} />
          {unread ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>

      {active ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/trip/${active.trip_id}/active`)}
          style={styles.live}
        >
          <Radio size={20} color={colors.textInverse} />
          <View style={styles.flex}>
            <Text variant="bodyStrong" tone="inverse">
              You are travelling now
            </Text>
            <Text variant="caption" tone="inverse" numberOfLines={1}>
              {active.origin_name} → {active.destination_name}
            </Text>
          </View>
          <Badge label="LIVE" tone="live" />
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <LocationField pickerKey="home-from" label="From" value={from} onChange={setFrom} placeholder="Estate, pickup point or current location" />
        <Pressable accessibilityRole="button" accessibilityLabel="Swap from and to" onPress={swap} style={styles.swap} hitSlop={8}>
          <ArrowUpDown size={18} color={colors.textMuted} />
        </Pressable>
        <LocationField pickerKey="home-to" label="To" value={to} onChange={setTo} placeholder="Where are you going?" />
        <View style={styles.row}>
          <DateTimeField label="Date" mode="date" value={date} onChange={setDate} minimumDate={new Date()} maximumDate={addDays(new Date(), config.trip_rules.max_advance_days)} />
          <DateTimeField label="Time" mode="time" value={time} onChange={setTime} placeholder="Any time" />
        </View>
        <Stepper label="Seats" value={seats} min={1} max={config.trip_rules.max_seats_per_request} onChange={setSeats} />
        {config.features.intercity ? (
          <Segmented
            label="Trip type"
            value={tripType}
            onChange={setTripType}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'commute', label: 'Commute' },
              { value: 'intercity', label: 'Intercity' },
            ]}
          />
        ) : null}
        {config.features.expressway ? (
          <ChipSelect label="Expressway" options={expresswayOptions} value={expressway} onChange={(v) => setExpressway(v ?? 'either')} />
        ) : null}
        {config.features.recurring ? (
          <View style={styles.switchRow}>
            <Text style={styles.flex}>Regular commutes only</Text>
            <Switch value={recurringOnly} onValueChange={setRecurringOnly} accessibilityLabel="Regular commutes only" trackColor={{ true: colors.brand }} />
          </View>
        ) : null}
        {formError ? <Text variant="caption" tone="danger">{formError}</Text> : null}
        <Button title="Find a trip" onPress={onSearch} />
      </View>

      {pending.length ? (
        <Section title="Waiting for a reply">
          {pending.map((t) => (
            <ListRow
              key={t.trip_id}
              title={`${t.origin_name} → ${t.destination_name}`}
              subtitle={`${formatDateTime(t.departure_time, config.timezone)} · request pending`}
              onPress={() => router.push(`/trip/${t.trip_id}`)}
            />
          ))}
        </Section>
      ) : null}

      <Section title="Your next trip">
        {upcoming ? (
          <ListRow
            title={`${upcoming.origin_name} → ${upcoming.destination_name}`}
            subtitle={`${formatDateTime(upcoming.departure_time, config.timezone)} · ${upcoming.role === 'creator' ? 'You are driving' : `With ${upcoming.creator_name}`}`}
            onPress={() => router.push(`/trip/${upcoming.trip_id}`)}
          />
        ) : (
          <View style={styles.empty}>
            <Text tone="muted">No upcoming trips yet.</Text>
            <View style={styles.row}>
              <Button title="Create a trip" variant="secondary" compact onPress={() => router.push('/create')} style={styles.flex} />
            </View>
          </View>
        )}
      </Section>

      {recent.length ? (
        <Section title="Recent searches">
          {recent.map((r) => (
            <ListRow
              key={`${r.from.name}-${r.to.name}`}
              title={`${r.from.name} → ${r.to.name}`}
              left={<History size={18} color={colors.textMuted} />}
              onPress={() => {
                setFrom(r.from);
                setTo(r.to);
              }}
            />
          ))}
        </Section>
      ) : null}

      <Section title="Available near you">
        {nearbyState === 'no-permission' ? (
          <ListRow title="Show trips near me" subtitle="Uses your location once. Not shared with anyone." onPress={() => void loadNearby(true)} />
        ) : nearbyState === 'loading' ? (
          <Text tone="muted">Looking for trips near you…</Text>
        ) : nearbyState === 'no-location' ? (
          <Text tone="muted">Your location is unavailable right now. Search by place instead.</Text>
        ) : nearbyState === 'error' ? (
          <ListRow title="Could not load nearby trips" subtitle="Tap to try again" onPress={() => void loadNearby(false)} />
        ) : nearby && nearby.length ? (
          <View style={styles.list}>
            {nearby.map((t) => (
              <TripCard key={t.id} trip={t} timeZone={config.timezone} />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text tone="muted">No trips available near you in the next day.</Text>
            <Button title="Create the first trip" variant="secondary" compact onPress={() => router.push('/create')} />
          </View>
        )}
      </Section>
      <Divider />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bell: { padding: space.xs },
  dot: { position: 'absolute', top: 4, right: 4, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.live },
  live: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.brand, borderRadius: radius.lg, padding: space.lg },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  swap: { alignSelf: 'flex-end', marginVertical: -space.sm, backgroundColor: colors.background, borderRadius: 16, padding: 6, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', gap: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  flex: { flex: 1 },
  empty: { gap: space.sm },
  list: { gap: space.md },
});
