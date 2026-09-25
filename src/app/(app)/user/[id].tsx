import { router, useLocalSearchParams } from 'expo-router';
import { Car, ShieldAlert, UserX } from 'lucide-react-native';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Button, Divider, ErrorState, ListRow, LoadingState, RatingSummary, Screen, Section, Text } from '@/components/ui';
import { promptAccount } from '@/features/auth/guest';
import { formatGender } from '@/features/profile/gender';
import { VehiclePhotos } from '@/features/vehicles/VehiclePhotos';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/lib/format';
import { getPublicProfile } from '@/services/profileService';
import { blockUser, isBlocked, unblockUser } from '@/services/safetyService';
import { useIsGuest, useUserId } from '@/store/authStore';
import { colors, space } from '@/theme';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUserId()!;
  const isGuest = useIsGuest();
  const data = useAsync(() => Promise.all([getPublicProfile(id), isGuest ? false : isBlocked(me, id)]), [id, me, isGuest]);

  const toggleBlock = useAction(async () => {
    const blocked = data.data?.[1];
    if (blocked) await unblockUser(me, id);
    else await blockUser(me, id);
    await data.reload();
  });

  if (data.loading) return <LoadingState />;
  if (!data.data) return <ErrorState message={data.error?.message ?? 'Profile unavailable.'} onRetry={data.reload} />;
  const [{ profile, ratings, vehicles }, blocked] = data.data;
  const isMe = id === me;

  return (
    <Screen edges={[]}>
      <View style={styles.head}>
        <Avatar path={profile.avatar_path} name={profile.full_name} size={80} />
        <View style={styles.flex}>
          <Text variant="heading">{profile.full_name || 'CASS member'}</Text>
          <RatingSummary average={profile.rating_average} count={profile.rating_count} />
          <Text variant="caption" tone="muted">
            {formatGender(profile.gender) ? `${formatGender(profile.gender)} · ` : ''}
            {profile.completed_trips_count} shared trips · member since {new Date(profile.created_at).getFullYear()}
          </Text>
        </View>
      </View>
      {profile.bio ? <Text>{profile.bio}</Text> : null}

      {vehicles.length ? (
        <Section title="Vehicles">
          {vehicles.map((v) => (
            <View key={v.id} style={styles.vehicle}>
              <ListRow title={`${v.colour} ${v.make} ${v.model}`} left={<Car size={20} color={colors.textMuted} />} />
              <VehiclePhotos paths={v.photo_paths} height={96} />
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Recent ratings">
        {ratings.length ? (
          ratings.map((r, i) => (
            <View key={r.id} style={styles.rating}>
              {i > 0 ? <Divider /> : null}
              <Text variant="bodyStrong">
                {'★'.repeat(r.stars)}
                <Text tone="subtle">{'★'.repeat(5 - r.stars)}</Text>
                <Text variant="caption" tone="muted">
                  {'  '}
                  {r.stars} of 5 · {formatRelative(r.created_at)} ago
                </Text>
              </Text>
              {r.comment ? <Text>{r.comment}</Text> : null}
            </View>
          ))
        ) : (
          <Text tone="muted">No ratings yet.</Text>
        )}
      </Section>

      {!isMe ? (
        <Section title="Safety">
          <ListRow
            title="Report this person"
            left={<ShieldAlert size={20} color={colors.danger} />}
            onPress={() => (isGuest ? promptAccount('report someone') : router.push({ pathname: '/report', params: { userId: id } }))}
          />
          <Button
            title={blocked ? 'Unblock' : 'Block'}
            variant="danger"
            icon={<UserX size={18} color={colors.danger} />}
            loading={toggleBlock.busy}
            onPress={() =>
              isGuest
                ? promptAccount('block someone')
                : blocked
                ? void toggleBlock.run()
                : Alert.alert(
                    `Block ${profile.full_name || 'this person'}?`,
                    'You will not see each other’s trips, and they cannot request your seats or message you.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Block', style: 'destructive', onPress: () => void toggleBlock.run() },
                    ],
                  )
            }
          />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  flex: { flex: 1, gap: 4 },
  rating: { gap: space.xs, paddingVertical: space.xs },
  vehicle: { gap: space.sm },
});
