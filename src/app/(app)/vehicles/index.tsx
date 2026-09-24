import { router, useFocusEffect } from 'expo-router';
import { Car } from 'lucide-react-native';
import { Fragment, useCallback } from 'react';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { Button, Divider, EmptyState, ErrorState, ListRow, LoadingState, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { publicImageUrl } from '@/services/storageService';
import { listMyVehicles } from '@/services/vehicleService';
import { colors } from '@/theme';

export default function VehiclesScreen() {
  const vehicles = useAsync(listMyVehicles, []);
  const { reload } = vehicles;
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  if (vehicles.loading) return <LoadingState />;
  if (vehicles.error) return <ErrorState message={vehicles.error.message} onRetry={reload} />;
  const list = vehicles.data ?? [];
  return (
    <Screen edges={[]} footer={list.length ? <Button title="Add a vehicle" onPress={() => router.push('/vehicles/edit')} /> : undefined}>
      {list.length === 0 ? (
        <EmptyState
          icon={<Car size={40} color={colors.textSubtle} />}
          title="No vehicles yet"
          body="Add a vehicle to create a trip. You can still join other people’s trips without one."
          actions={[{ label: 'Add a vehicle', onPress: () => router.push('/vehicles/edit') }]}
        />
      ) : (
        list.map((v, i) => (
          <Fragment key={v.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={`${v.colour} ${v.make} ${v.model}${v.year ? ` (${v.year})` : ''}`}
              subtitle={`${v.registration_number} · ${v.seat_capacity} seats incl. yours`}
              left={
                v.photo_path ? (
                  <Image source={{ uri: publicImageUrl('vehicle-photos', v.photo_path) }} style={styles.thumb} />
                ) : (
                  <Car size={28} color={colors.textMuted} />
                )
              }
              onPress={() => router.push({ pathname: '/vehicles/edit', params: { id: v.id } })}
            />
          </Fragment>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ thumb: { width: 56, height: 42, borderRadius: 6 } });
