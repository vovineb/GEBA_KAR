import { router, useFocusEffect } from 'expo-router';
import { Bell, Car, Pencil, Repeat, Settings, ShieldCheck } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Divider, ErrorState, ListRow, LoadingState, RatingSummary, Screen, Section, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { getMyProfile } from '@/services/profileService';
import { listMyTrips } from '@/services/tripService';
import { listMyVehicles } from '@/services/vehicleService';
import { useAuthStore } from '@/store/authStore';
import { colors, space } from '@/theme';

export default function ProfileScreen() {
  const email = useAuthStore((s) => s.session?.user.email);
  const emailConfirmed = useAuthStore((s) => !!s.session?.user.email_confirmed_at);
  const data = useAsync(() => Promise.all([getMyProfile(), listMyVehicles(), listMyTrips(false)]), []);
  const { reload } = data;
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  if (data.loading) return <LoadingState />;
  if (data.error || !data.data) return <ErrorState message={data.error?.message ?? 'Profile unavailable.'} onRetry={reload} />;
  const [profile, vehicles, upcoming] = data.data;

  return (
    <Screen refreshing={data.refreshing} onRefresh={data.refresh}>
      <View style={styles.head}>
        <Avatar path={profile.avatar_path} name={profile.full_name} size={80} />
        <View style={styles.flex}>
          <Text variant="heading">{profile.full_name || 'Add your name'}</Text>
          <RatingSummary average={profile.rating_average} count={profile.rating_count} />
          <Text variant="caption" tone="muted">
            {profile.completed_trips_count} shared trip{profile.completed_trips_count === 1 ? '' : 's'} completed
          </Text>
          {emailConfirmed ? <Badge label="Email verified" tone="success" /> : null}
        </View>
      </View>
      {profile.bio ? <Text>{profile.bio}</Text> : null}
      {!profile.full_name ? (
        <Text tone="warning">Add your name and photo so other travellers know who they are meeting.</Text>
      ) : null}

      <Section>
        <ListRow title="Edit profile" subtitle={email} left={<Pencil size={20} color={colors.brand} />} onPress={() => router.push('/profile-edit')} />
        <Divider />
        <ListRow
          title="Vehicles"
          subtitle={vehicles.length ? vehicles.map((v) => `${v.make} ${v.model}`).join(', ') : 'Add a vehicle to offer seats'}
          left={<Car size={20} color={colors.brand} />}
          onPress={() => router.push('/vehicles')}
        />
        <Divider />
        <ListRow
          title="Upcoming trips"
          subtitle={upcoming.length ? `${upcoming.length} upcoming` : 'No upcoming trips yet.'}
          left={<ShieldCheck size={20} color={colors.brand} />}
          onPress={() => router.push('/trips')}
        />
        <Divider />
        <ListRow title="Recurring commutes" left={<Repeat size={20} color={colors.brand} />} onPress={() => router.push('/recurring')} />
        <Divider />
        <ListRow title="Notifications" left={<Bell size={20} color={colors.brand} />} onPress={() => router.push('/notifications')} />
        <Divider />
        <ListRow title="Settings" subtitle="Account, privacy, blocked users, help" left={<Settings size={20} color={colors.brand} />} onPress={() => router.push('/settings')} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.md },
  flex: { flex: 1, gap: 4 },
});
