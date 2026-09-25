import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import type { z } from 'zod';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { signInSchema } from '@/features/auth/schemas';
import { useAction } from '@/hooks/useAction';
import { signIn, signInAsGuest } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { space } from '@/theme';

type Form = z.infer<typeof signInSchema>;

export default function SignInScreen() {
  const { control, handleSubmit, getValues, formState } = useForm<Form>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const action = useAction(async (v: Form) => {
    try {
      await signIn(v.email, v.password);
    } catch (e) {
      if ((e as { code?: string }).code === 'email_not_confirmed') {
        router.push({ pathname: '/verify', params: { email: getValues('email').trim().toLowerCase() } });
        return;
      }
      throw e;
    }
  }, { errorTitle: 'Sign in failed' });
  const guest = useAction(signInAsGuest, { errorTitle: 'Could not continue' });

  // A guest who tapped "Create account" lands here; take them straight to sign-up.
  const authIntent = useAuthStore((s) => s.authIntent);
  const setAuthIntent = useAuthStore((s) => s.setAuthIntent);
  useEffect(() => {
    if (authIntent === null) return;
    setAuthIntent(null);
    if (authIntent === 'sign-up') router.push('/sign-up');
  }, [authIntent, setAuthIntent]);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text variant="title">CASS</Text>
        <Text tone="muted">Share the ride with people already going your way.</Text>
      </View>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.password?.message}
            onSubmitEditing={handleSubmit(action.run)}
          />
        )}
      />
      <Button title="Sign in" loading={action.busy} onPress={handleSubmit(action.run)} />
      <Link href="/forgot-password" asChild>
        <Button title="Forgot password?" variant="ghost" />
      </Link>
      <View style={styles.footer}>
        <Text tone="muted">New to CASS?</Text>
        <Link href="/sign-up" asChild>
          <Button title="Create an account" variant="secondary" />
        </Link>
        <Button
          title="Browse trips without an account"
          variant="ghost"
          loading={guest.busy}
          onPress={guest.run}
          accessibilityHint="You can look around; you will be asked to sign up before creating or joining a trip."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm, marginTop: space.xxl, marginBottom: space.lg },
  footer: { gap: space.sm, marginTop: 'auto' },
});
