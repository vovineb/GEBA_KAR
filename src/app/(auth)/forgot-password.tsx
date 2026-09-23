import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { emailSchema, newPasswordSchema, otpSchema } from '@/features/auth/schemas';
import { useAction } from '@/hooks/useAction';
import { sendPasswordResetCode, signOut, updatePassword, verifyRecoveryCode } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

type Step = 'email' | 'code' | 'password';

/**
 * Password recovery with an emailed code:
 * email -> code (signs the user in in "recovery" mode) -> new password.
 */
export default function ForgotPasswordScreen() {
  const signedInRecovering = useAuthStore((s) => s.recovering && !!s.session);
  const setRecovering = useAuthStore((s) => s.setRecovering);
  const [step, setStep] = useState<Step>(signedInRecovering ? 'password' : 'email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const pw = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const sendCode = useAction(async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    await sendPasswordResetCode(parsed.data);
    setEmail(parsed.data);
    setStep('code');
  });

  const verify = useAction(async () => {
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    setRecovering(true); // keep the user on this screen after the code signs them in
    try {
      await verifyRecoveryCode(email, parsed.data);
      setStep('password');
    } catch (e) {
      setRecovering(false);
      throw e;
    }
  });

  const save = useAction(async (v: z.infer<typeof newPasswordSchema>) => {
    await updatePassword(v.password);
    setRecovering(false);
    Alert.alert('Password updated', 'You are now signed in with your new password.');
  });

  const cancel = async () => {
    if (step === 'password') await signOut().catch(() => undefined);
    setRecovering(false);
    router.dismissTo('/sign-in');
  };

  return (
    <Screen>
      <Text variant="title">Reset password</Text>
      {step === 'email' && (
        <>
          <Text tone="muted">Enter your account email. We will send you a reset code.</Text>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={error}
          />
          <Button title="Send code" loading={sendCode.busy} onPress={sendCode.run} />
        </>
      )}
      {step === 'code' && (
        <>
          <Text tone="muted">If an account exists for {email}, a code is on its way. Enter it here.</Text>
          <TextField
            label="Reset code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={10}
            error={error}
          />
          <Button title="Continue" loading={verify.busy} onPress={verify.run} />
          <Button title="Send a new code" variant="ghost" onPress={sendCode.run} />
        </>
      )}
      {step === 'password' && (
        <>
          <Text tone="muted">Choose a new password.</Text>
          <Controller
            control={pw.control}
            name="password"
            render={({ field }) => (
              <TextField
                label="New password"
                secureTextEntry
                autoComplete="new-password"
                value={field.value}
                onChangeText={field.onChange}
                error={pw.formState.errors.password?.message}
              />
            )}
          />
          <Controller
            control={pw.control}
            name="confirm"
            render={({ field }) => (
              <TextField
                label="Confirm new password"
                secureTextEntry
                autoComplete="new-password"
                value={field.value}
                onChangeText={field.onChange}
                error={pw.formState.errors.confirm?.message}
              />
            )}
          />
          <Button title="Save password" loading={save.busy} onPress={pw.handleSubmit(save.run)} />
        </>
      )}
      <Button title="Cancel" variant="ghost" onPress={cancel} />
    </Screen>
  );
}
