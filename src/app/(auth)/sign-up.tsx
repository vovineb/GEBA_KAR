import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { signUpSchema } from '@/features/auth/schemas';
import { useAction } from '@/hooks/useAction';
import { signUp } from '@/services/authService';

type Form = z.infer<typeof signUpSchema>;

export default function SignUpScreen() {
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '', confirm: '' },
  });
  const action = useAction(
    async (v: Form) => {
      const { needsConfirmation } = await signUp(v.email, v.password, v.fullName);
      if (needsConfirmation) router.replace({ pathname: '/verify', params: { email: v.email } });
    },
    { errorTitle: 'Could not create account' },
  );

  const field = (name: keyof Form, label: string, props: object = {}) => (
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
      {field('email', 'Email', {
        autoCapitalize: 'none',
        autoComplete: 'email',
        keyboardType: 'email-address',
        textContentType: 'emailAddress',
      })}
      {field('password', 'Password', { secureTextEntry: true, autoComplete: 'new-password', hint: 'At least 8 characters' })}
      {field('confirm', 'Confirm password', { secureTextEntry: true, autoComplete: 'new-password' })}
      <Button title="Create account" loading={action.busy} onPress={handleSubmit(action.run)} />
      <Button title="I already have an account" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
