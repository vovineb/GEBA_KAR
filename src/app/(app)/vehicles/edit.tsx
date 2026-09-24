import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Stepper } from '@/components/form/Stepper';
import { Button, ErrorState, LoadingState, Screen, Text, TextField } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { pickImage } from '@/lib/imagePicker';
import { publicImageUrl, uploadImage } from '@/services/storageService';
import { createVehicle, deactivateVehicle, listMyVehicles, updateVehicle } from '@/services/vehicleService';
import { useUserId } from '@/store/authStore';
import type { Vehicle } from '@/types/domain';
import { colors, radius, space } from '@/theme';

const thisYear = new Date().getFullYear();
const schema = z.object({
  make: z.string().trim().min(1, 'Enter the make').max(40),
  model: z.string().trim().min(1, 'Enter the model').max(40),
  colour: z.string().trim().min(1, 'Enter the colour').max(30),
  registration: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/\s+/g, ' '))
    .refine((v) => /^[A-Z0-9 ]{4,12}$/.test(v), 'Enter the number plate, e.g. KDA 123A'),
  year: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{4}$/.test(v) && Number(v) >= 1970 && Number(v) <= thisYear + 1), 'Enter a valid year'),
  seatCapacity: z.number().int().min(2).max(14),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const vehicles = useAsync(listMyVehicles, [], { enabled: !!id });
  if (id && vehicles.loading) return <LoadingState />;
  if (id && vehicles.error) return <ErrorState message={vehicles.error.message} onRetry={vehicles.reload} />;
  const vehicle = id ? (vehicles.data?.find((v) => v.id === id) ?? null) : null;
  if (id && !vehicle) return <ErrorState message="Vehicle not found." />;
  return <VehicleForm vehicle={vehicle} />;
}

function VehicleForm({ vehicle }: { vehicle: Vehicle | null }) {
  const userId = useUserId()!;
  const [photo, setPhoto] = useState<string | null>(vehicle?.photo_path ?? null);
  const { control, handleSubmit, formState } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      make: vehicle?.make ?? '',
      model: vehicle?.model ?? '',
      colour: vehicle?.colour ?? '',
      registration: vehicle?.registration_number ?? '',
      year: vehicle?.year ? String(vehicle.year) : '',
      seatCapacity: vehicle?.seat_capacity ?? 5,
    },
  });

  const addPhoto = useAction(async () => {
    const uri = await pickImage([4, 3]);
    if (uri) setPhoto(await uploadImage('vehicle-photos', userId, uri));
  }, { errorTitle: 'Photo not uploaded' });

  const save = useAction(async (v: FormOut) => {
    const input = {
      make: v.make,
      model: v.model,
      colour: v.colour,
      registration_number: v.registration,
      year: v.year ? Number(v.year) : null,
      seat_capacity: v.seatCapacity,
      photo_path: photo,
    };
    if (vehicle) await updateVehicle(vehicle.id, input);
    else await createVehicle(userId, input);
    router.back();
  }, { errorTitle: 'Vehicle not saved' });

  const remove = useAction(async () => {
    if (!vehicle) return;
    await deactivateVehicle(vehicle.id);
    router.back();
  });

  const field = (name: 'make' | 'model' | 'colour' | 'registration' | 'year', label: string, props: object = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => (
        <TextField label={label} value={f.value} onChangeText={f.onChange} onBlur={f.onBlur} error={formState.errors[name]?.message} {...props} />
      )}
    />
  );

  return (
    <Screen edges={[]} footer={<Button title="Save vehicle" loading={save.busy} onPress={handleSubmit(save.run)} />}>
      <Stack.Screen options={{ title: vehicle ? 'Edit vehicle' : 'Add vehicle' }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Add vehicle photo" onPress={addPhoto.run} style={styles.photo}>
        {photo ? (
          <Image source={{ uri: publicImageUrl('vehicle-photos', photo) }} style={styles.image} contentFit="cover" />
        ) : (
          <Text tone="brand">{addPhoto.busy ? 'Uploading…' : 'Add a photo (optional)'}</Text>
        )}
      </Pressable>
      <View style={styles.row}>
        <View style={styles.flex}>{field('make', 'Make', { placeholder: 'Toyota' })}</View>
        <View style={styles.flex}>{field('model', 'Model', { placeholder: 'Axio' })}</View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>{field('colour', 'Colour', { placeholder: 'Silver' })}</View>
        <View style={styles.flex}>{field('year', 'Year (optional)', { keyboardType: 'number-pad', maxLength: 4 })}</View>
      </View>
      {field('registration', 'Number plate', { autoCapitalize: 'characters', placeholder: 'KDA 123A', hint: 'Shown only to passengers with a confirmed seat.' })}
      <Controller
        control={control}
        name="seatCapacity"
        render={({ field: f }) => <Stepper label="Seats (including yours)" value={f.value} min={2} max={14} onChange={f.onChange} />}
      />
      {vehicle ? (
        <Button
          title="Remove vehicle"
          variant="danger"
          loading={remove.busy}
          onPress={() =>
            Alert.alert('Remove this vehicle?', 'Existing trips keep their details.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => void remove.run() },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { height: 160, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
