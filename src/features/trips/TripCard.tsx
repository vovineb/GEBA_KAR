import { router } from 'expo-router';
import { Car, Users } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Badge, RatingSummary, Text } from '@/components/ui';
import { expresswayLabel } from '@/features/trips/labels';
import { formatDay, formatMoney, formatTime } from '@/lib/format';
import type { TripSearchResult } from '@/types/domain';
import { colors, radius, space } from '@/theme';

/** Search result card: who, when, where, seats, contribution. */
export const TripCard = memo(function TripCard({ trip, timeZone }: { trip: TripSearchResult; timeZone: string }) {
  if (!trip.id || !trip.departure_time) return null;
  const dep = trip.departure_time;
  const contribution = formatMoney(trip.suggested_contribution, trip.currency ?? '');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.origin_name} to ${trip.destination_name}, ${formatDay(dep, timeZone)} at ${formatTime(dep, timeZone)}, ${trip.available_seats} seats left, with ${trip.creator_name}`}
      onPress={() => router.push(`/trip/${trip.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.time}>
          <Text variant="heading">{formatTime(dep, timeZone)}</Text>
          <Text variant="small" tone="muted">
            {formatDay(dep, timeZone)}
          </Text>
        </View>
        <View style={styles.route}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {trip.origin_name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            to {trip.destination_name}
            {trip.estimated_arrival ? ` · arrives ~${formatTime(trip.estimated_arrival, timeZone)}` : ''}
          </Text>
          {trip.pickup_point_name ? (
            <Text variant="small" tone="subtle" numberOfLines={1}>
              Pickup: {trip.pickup_point_name}
            </Text>
          ) : null}
        </View>
        {contribution ? (
          <View style={styles.price}>
            <Text variant="bodyStrong">{contribution}</Text>
            <Text variant="small" tone="subtle">
              per seat
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.row}>
        <Avatar path={trip.creator_avatar_path} name={trip.creator_name} size={32} />
        <View style={styles.flex}>
          <Text variant="caption" numberOfLines={1} style={styles.bold}>
            {trip.creator_name || 'CASS member'}
          </Text>
          <RatingSummary average={trip.creator_rating_average} count={trip.creator_rating_count} />
        </View>
        <View style={styles.meta}>
          <Users size={14} color={colors.textMuted} />
          <Text variant="caption" tone="muted">
            {trip.available_seats} left
          </Text>
        </View>
      </View>
      <View style={styles.tags}>
        <View style={styles.meta}>
          <Car size={14} color={colors.textMuted} />
          <Text variant="small" tone="muted">
            {trip.vehicle_colour} {trip.vehicle_make} {trip.vehicle_model}
          </Text>
        </View>
        {trip.is_recurring ? <Badge label="Regular commute" tone="brand" /> : null}
        {trip.expressway_option && trip.expressway_option !== 'either' ? (
          <Badge label={expresswayLabel[trip.expressway_option]} tone="info" />
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.background,
  },
  pressed: { backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  time: { width: 64 },
  route: { flex: 1, gap: 2 },
  price: { alignItems: 'flex-end' },
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
