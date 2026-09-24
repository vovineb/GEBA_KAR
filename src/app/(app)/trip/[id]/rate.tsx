import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, EmptyState, ErrorState, LoadingState, Screen, StarInput, Text, TextField } from '@/components/ui';
import { peopleToRate } from '@/features/trips/tripActions';
import { useTripDetail } from '@/features/trips/useTripDetail';
import { useAction } from '@/hooks/useAction';
import { submitRating } from '@/services/ratingService';
import { useUserId } from '@/store/authStore';
import type { TripDetail } from '@/types/domain';
import { colors, radius, space } from '@/theme';

export default function RateTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId()!;
  const { data: trip, loading, error, reload } = useTripDetail(id);

  if (loading && !trip) return <LoadingState />;
  if (!trip) return <ErrorState message={error?.message ?? 'Trip unavailable.'} onRetry={reload} />;

  const toRate = peopleToRate(trip, userId);
  return (
    <Screen edges={[]}>
      <Text variant="heading">How was your trip?</Text>
      <Text tone="muted">
        {trip.origin_name} → {trip.destination_name}. Ratings are linked to this trip and help others travel with
        confidence. You can rate each person once.
      </Text>
      {toRate.length === 0 ? (
        <EmptyState
          title="All done"
          body="You have rated everyone on this trip. Thank you."
          actions={[{ label: 'Back to trip', onPress: () => router.replace(`/trip/${trip.id}`) }]}
        />
      ) : (
        toRate.map((m) => <RateCard key={m.user_id} trip={trip} member={m} raterId={userId} onDone={reload} />)
      )}
    </Screen>
  );
}

function RateCard({
  trip,
  member,
  raterId,
  onDone,
}: {
  trip: TripDetail;
  member: TripDetail['members'][number];
  raterId: string;
  onDone: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const submit = useAction(async () => {
    await submitRating({ tripId: trip.id, raterId, rateeId: member.user_id, stars, comment: comment.trim() || null });
    onDone();
  }, { errorTitle: 'Rating not saved' });

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar path={member.avatar_path} name={member.full_name} />
        <View>
          <Text variant="bodyStrong">{member.full_name || 'CASS member'}</Text>
          <Text variant="caption" tone="muted">
            {member.role === 'creator' ? 'Trip creator' : 'Passenger'}
          </Text>
        </View>
      </View>
      <StarInput value={stars} onChange={setStars} />
      <TextField label="Comment (optional)" value={comment} onChangeText={setComment} maxLength={500} multiline />
      <Button title="Submit rating" disabled={stars === 0} loading={submit.busy} onPress={submit.run} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
