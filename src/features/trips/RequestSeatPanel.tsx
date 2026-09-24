import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipSelect } from '@/components/form/ChipSelect';
import { Stepper } from '@/components/form/Stepper';
import { Button, Text, TextField } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { listPickupPoints } from '@/services/geoService';
import { requestSeat } from '@/services/tripService';
import type { TripDetail } from '@/types/domain';
import { colors, radius, space } from '@/theme';

export function RequestSeatPanel({
  trip,
  maxSeatsPerRequest,
  onDone,
  onCancel,
}: {
  trip: TripDetail;
  maxSeatsPerRequest: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const points = useAsync(listPickupPoints, []);
  const [seats, setSeats] = useState(1);
  const [pickup, setPickup] = useState<string | null>(trip.pickup_point?.id ?? null);
  const [message, setMessage] = useState('');
  const max = Math.max(1, Math.min(trip.available_seats, maxSeatsPerRequest));

  const submit = useAction(async () => {
    await requestSeat(trip.id, seats, pickup, trip.dropoff_point?.id ?? null, message.trim() || null);
    onDone();
  }, { errorTitle: 'Request not sent' });

  return (
    <View style={styles.panel}>
      <Text variant="subheading">Request a seat</Text>
      <Stepper label="Seats" value={seats} min={1} max={max} onChange={setSeats} />
      {points.data?.length ? (
        <ChipSelect
          label="Pickup point"
          options={points.data.map((p) => ({ value: p.id, label: p.name }))}
          value={pickup}
          onChange={setPickup}
          allowNone
        />
      ) : null}
      <TextField
        label="Message to the trip creator (optional)"
        value={message}
        onChangeText={setMessage}
        maxLength={300}
        multiline
        placeholder="e.g. I will be at the main gate at 6:55"
      />
      <Button title={`Send request for ${seats} seat${seats > 1 ? 's' : ''}`} loading={submit.busy} onPress={submit.run} />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
});
