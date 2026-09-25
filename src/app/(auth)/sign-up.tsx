import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import type { z } from 'zod';

import { ChipSelect } from '@/components/form/ChipSelect';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { signUpSchema } from '@/features/auth/schemas';
import { genderOptions } from '@/features/profile/gender';
import { useAction } from '@/hooks/useAction';
import { signUp } from '@/services/authService';
import { colors, radius, space } from '@/theme';

type FormIn = z.input<typeof signUpSchema>;
type FormOut = z.output<typeof signUpSchema>;

export default function SignUpScreen() {
  const { control, handleSubmit, formState } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '', confirm: '', acceptTerms: false },
  });
  const action = useAction(
    async (v: FormOut) => {
      const { needsConfirmation } = await signUp(v.email, v.password, v.fullName, v.gender);
      if (needsConfirmation) router.replace({ pathname: '/verify', params: { email: v.email } });
    },
    { errorTitle: 'Could not create account' },
  );

  const field = (name: 'fullName' | 'email' | 'password' | 'confirm', label: string, props: object = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => (
        <TextField
          label={label}
          value={f.value}
          onChangeText={f.onChange}
          onBlur={f.onBlur}
          error={formState.errors[name]?.message}
          {...props}
        />
      )}
    />
  );

  return (
    <Screen>
      <Text variant="title">Create account</Text>
      <Text tone="muted">One account lets you offer seats and join other people’s trips.</Text>
      {field('fullName', 'Full name', { autoComplete: 'name', textContentType: 'name', autoCapitalize: 'words' })}
      <Controller
        control={control}
        name="gender"
        render={({ field: f }) => (
          <View style={styles.group}>
            <ChipSelect label="Gender" options={genderOptions} value={f.value ?? null} onChange={(v) => v && f.onChange(v)} />
            <Text variant="small" tone={formState.errors.gender ? 'danger' : 'subtle'}>
              {formState.errors.gender?.message ?? 'Shown on your profile. Used for women-only trips; it cannot be changed later.'}
            </Text>
          </View>
        )}
      />
      {field('email', 'Email', {
        autoCapitalize: 'none',
        autoComplete: 'email',
        keyboardType: 'email-address',
        textContentType: 'emailAddress',
      })}
      {field('password', 'Password', { secureTextEntry: true, autoComplete: 'new-password', hint: 'At least 8 characters' })}
      {field('confirm', 'Confirm password', { secureTextEntry: true, autoComplete: 'new-password' })}
      <Controller
        control={control}
        name="acceptTerms"
        render={({ field: f }) => (
          <View style={styles.group}>
            <View style={styles.termsRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!f.value }}
                accessibilityLabel="I accept the Terms and Conditions"
                hitSlop={8}
                onPress={() => f.onChange(!f.value)}
                style={[styles.box, f.value && styles.boxOn]}
              >
                {f.value ? <Check size={16} color={colors.textInverse} /> : null}
              </Pressable>
              <Text style={styles.flex} onPress={() => f.onChange(!f.value)}>
                I have read and accept the{' '}
                <Text tone="brand" onPress={() => router.push('/terms')}>
                  Terms and Conditions
                </Text>
                .
              </Text>
            </View>
            {formState.errors.acceptTerms ? (
              <Text variant="small" tone="danger">
                {formState.errors.acceptTerms.message}
              </Text>
            ) : null}
          </View>
        )}
      />
      <Button title="Create account" loading={action.busy} onPress={handleSubmit(action.run)} />
      <Button title="I already have an account" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  flex: { flex: 1 },
});
