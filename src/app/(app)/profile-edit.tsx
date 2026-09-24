import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Avatar, Button, ErrorState, LoadingState, Screen, Text, TextField } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { pickImage } from '@/lib/imagePicker';
import { getMyProfile, updateMyProfile } from '@/services/profileService';
import { removeImage, uploadImage } from '@/services/storageService';
import { useUserId } from '@/store/authStore';
import type { Profile } from '@/types/domain';
import { space } from '@/theme';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[0-9]{9,15}$/.test(v.replace(/\s/g, '')), 'Enter a valid phone number, e.g. +254712345678'),
  bio: z.string().trim().max(300, 'Keep it under 300 characters'),
});
type Form = z.infer<typeof schema>;

export default function EditProfileScreen() {
  const profile = useAsync(getMyProfile, []);
  if (profile.loading) return <LoadingState />;
  if (!profile.data) return <ErrorState message={profile.error?.message ?? 'Profile unavailable.'} onRetry={profile.reload} />;
  return <EditForm profile={profile.data} />;
}

function EditForm({ profile }: { profile: Profile }) {
  const userId = useUserId()!;
  const [avatar, setAvatar] = useState(profile.avatar_path);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: profile.full_name, phone: profile.phone_number ?? '', bio: profile.bio ?? '' },
  });

  const photo = useAction(async () => {
    const uri = await pickImage([1, 1]);
    if (!uri) return;
    const path = await uploadImage('avatars', userId, uri);
    await updateMyProfile(userId, { avatar_path: path });
    if (avatar) void removeImage('avatars', avatar);
    setAvatar(path);
  }, { errorTitle: 'Photo not saved' });

  const save = useAction(async (v: Form) => {
    await updateMyProfile(userId, {
      full_name: v.fullName,
      phone_number: v.phone ? v.phone.replace(/\s/g, '') : null,
      bio: v.bio || null,
    });
    router.back();
  }, { errorTitle: 'Profile not saved' });

  return (
    <Screen edges={[]} footer={<Button title="Save" loading={save.busy} onPress={handleSubmit(save.run)} />}>
      <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={photo.run} style={styles.photo}>
        <Avatar path={avatar} name={profile.full_name} size={96} />
        <Text tone="brand">{photo.busy ? 'Uploading…' : 'Change photo'}</Text>
      </Pressable>
      <Controller control={control} name="fullName" render={({ field }) => (
        <TextField label="Full name" value={field.value} onChangeText={field.onChange} autoCapitalize="words" error={formState.errors.fullName?.message} />
      )} />
      <Controller control={control} name="phone" render={({ field }) => (
        <TextField label="Phone number (private)" value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" hint="Never shown to other users." error={formState.errors.phone?.message} />
      )} />
      <Controller control={control} name="bio" render={({ field }) => (
        <TextField label="About you" value={field.value} onChangeText={field.onChange} multiline maxLength={300} placeholder="e.g. I work in Upper Hill and leave at 7:00 on weekdays" error={formState.errors.bio?.message} />
      )} />
      <View />
    </Screen>
  );
}

const styles = StyleSheet.create({ photo: { alignItems: 'center', gap: space.sm } });
