import { router, useFocusEffect } from 'expo-router';
import { Repeat } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ChipSelect } from '@/components/form/ChipSelect';
import { DateTimeField } from '@/components/form/DateTimeField';
import { Stepper } from '@/components/form/Stepper';
import { Badge, Button, EmptyState, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { formatWeekdays, WEEKDAYS } from '@/lib/format';
import { toTimeString } from '@/lib/time';
import { listMyRecurringTrips, updateRecurringTrip } from '@/services/tripService';
import type { RecurringTrip } from '@/types/domain';
import { colors, radius, space } from '@/theme';

export default function RecurringScreen() {
  const list = useAsync(listMyRecurringTrips, []);
  const { reload } = list;
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  if (list.loading) return <LoadingState />;
  if (list.error) return <ErrorState message={list.error.message} onRetry={reload} />;
  const items = list.data ?? [];
  return (
    <Screen edges={[]} refreshing={list.refreshing} onRefresh={list.refresh}>
      <Text tone="muted">
        Each schedule opens individual trips a few days ahead. Pausing removes upcoming trips nobody has requested yet;
        trips with passengers stay until you cancel them.
      </Text>
      {items.length === 0 ? (
        <EmptyState
          icon={<Repeat size={36} color={colors.textSubtle} />}
          title="No recurring commutes"
          body="Create a commute trip and turn on “Repeat every week”."
          actions={[{ label: 'Create a commute', onPress: () => router.push('/create') }]}
        />
      ) : (
        items.map((r) => <ScheduleCard key={r.id} schedule={r} onChanged={reload} />)
      )}
    </Screen>
  );
}

function timeToDate(t: string) {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function ScheduleCard({ schedule, onChanged }: { schedule: RecurringTrip; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>(schedule.weekdays);
  const [time, setTime] = useState<Date>(timeToDate(schedule.departure_local_time));
  const [seats, setSeats] = useState(schedule.total_seats);

  const update = useAction(async (patch: Parameters<typeof updateRecurringTrip>[1]) => {
    await updateRecurringTrip(schedule.id, patch);
    setEditing(false);
    onChanged();
  }, { errorTitle: 'Schedule not updated' });

  const active = schedule.status === 'active';
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text variant="bodyStrong" style={styles.flex} numberOfLines={2}>
          {schedule.origin_name} → {schedule.destination_name}
        </Text>
        <Badge label={active ? 'Active' : 'Paused'} tone={active ? 'success' : 'warning'} />
      </View>
      <Text tone="muted">
        {formatWeekdays(schedule.weekdays)} at {schedule.departure_local_time.slice(0, 5)} · {schedule.total_seats} seats
      </Text>
      {editing ? (
        <View style={styles.edit}>
          <ChipSelect
            label="Days"
            multi
            options={WEEKDAYS.map((d) => ({ value: d.value, label: d.short }))}
            values={weekdays}
            onToggle={(d) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()))}
          />
          <DateTimeField label="Departure" mode="time" value={time} onChange={setTime} />
          <Stepper label="Seats" value={seats} min={1} max={13} onChange={setSeats} />
          <View style={styles.row}>
            <Button title="Cancel" variant="secondary" compact onPress={() => setEditing(false)} style={styles.flex} />
            <Button
              title="Save"
              compact
              disabled={weekdays.length === 0}
              loading={update.busy}
              onPress={() => void update.run({ weekdays, departure_local_time: toTimeString(time), total_seats: seats })}
              style={styles.flex}
            />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Button title="Edit" variant="secondary" compact onPress={() => setEditing(true)} style={styles.flex} />
          <Button
            title={active ? 'Pause' : 'Resume'}
            variant="secondary"
            compact
            loading={update.busy}
            onPress={() => void update.run({ status: active ? 'paused' : 'active' })}
            style={styles.flex}
          />
          <Button
            title="Delete"
            variant="danger"
            compact
            onPress={() =>
              Alert.alert('Cancel this schedule?', 'No new trips will be created. Trips with passengers stay until you cancel them.', [
                { text: 'Keep', style: 'cancel' },
                { text: 'Cancel schedule', style: 'destructive', onPress: () => void update.run({ status: 'cancelled' }) },
              ])
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  edit: { gap: space.md },
});
