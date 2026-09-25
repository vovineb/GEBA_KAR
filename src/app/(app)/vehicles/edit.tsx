import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ImagePlus, X } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Stepper } from '@/components/form/Stepper';
import { Button, ErrorState, LoadingState, Screen, Text, TextField } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { pickImages } from '@/lib/imagePicker';
import { publicImageUrl, removeImage, uploadImage } from '@/services/storageService';
import { createVehicle, deactivateVehicle, listMyVehicles, updateVehicle } from '@/services/vehicleService';
import { useUserId } from '@/store/authStore';
import type { Vehicle } from '@/types/domain';
import { colors, radius, space } from '@/theme';

const thisYear = new Date().getFullYear();
const MAX_PHOTOS = 8;
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
  const [photos, setPhotos] = useState<string[]>(
    vehicle?.photo_paths?.length ? vehicle.photo_paths : vehicle?.photo_path ? [vehicle.photo_path] : [],
  );
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

  const addPhotos = useAction(async () => {
    const uris = await pickImages(MAX_PHOTOS - photos.length);
    for (const uri of uris) {
      const path = await uploadImage('vehicle-photos', userId, uri);
      setPhotos((prev) => [...prev, path].slice(0, MAX_PHOTOS));
    }
  }, { errorTitle: 'Photo not uploaded' });

  const removePhoto = (path: string) => {
    setPhotos((prev) => prev.filter((p) => p !== path));
    // Only delete files that were never saved on the vehicle.
    if (!vehicle?.photo_paths?.includes(path) && vehicle?.photo_path !== path) void removeImage('vehicle-photos', path);
  };

  const makeCover = (path: string) => setPhotos((prev) => [path, ...prev.filter((p) => p !== path)]);

  const save = useAction(async (v: FormOut) => {
    const input = {
      make: v.make,
      model: v.model,
      colour: v.colour,
      registration_number: v.registration,
      year: v.year ? Number(v.year) : null,
      seat_capacity: v.seatCapacity,
      photo_path: photos[0] ?? null,
      photo_paths: photos,
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
      <View style={styles.photos}>
        <Text variant="caption" tone="muted" style={styles.label}>
          Photos ({photos.length}/{MAX_PHOTOS}) · optional
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((p, i) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={i === 0 ? 'Cover photo' : `Photo ${i + 1}, make cover`}
              onPress={() => makeCover(p)}
              style={styles.thumb}
            >
              <Image source={{ uri: publicImageUrl('vehicle-photos', p) }} style={styles.image} contentFit="cover" />
              {i === 0 ? (
                <View style={styles.cover}>
                  <Text variant="small" tone="inverse">
                    Cover
                  </Text>
                </View>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={8} onPress={() => removePhoto(p)} style={styles.remove}>
                <X size={14} color={colors.textInverse} />
              </Pressable>
            </Pressable>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Add vehicle photos" onPress={addPhotos.run} style={[styles.thumb, styles.add]}>
              <ImagePlus size={24} color={colors.brand} />
              <Text variant="small" tone="brand">
                {addPhotos.busy ? 'Uploading…' : 'Add photos'}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {photos.length > 1 ? (
          <Text variant="small" tone="subtle">
            Tap a photo to make it the cover.
          </Text>
        ) : null}
      </View>
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
  photos: { gap: space.xs },
  label: { fontWeight: '600' },
  photoRow: { gap: space.sm },
  thumb: { width: 128, height: 96, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  add: { alignItems: 'center', justifyContent: 'center', gap: space.xs, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  image: { width: '100%', height: '100%' },
  cover: { position: 'absolute', left: 6, bottom: 6, backgroundColor: colors.brand, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  remove: { position: 'absolute', right: 6, top: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
