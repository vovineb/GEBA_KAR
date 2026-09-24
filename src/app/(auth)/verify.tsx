import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { otpSchema } from '@/features/auth/schemas';
import { useAction } from '@/hooks/useAction';
import { resendSignupCode, verifySignupCode } from '@/services/authService';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [resent, setResent] = useState(false);

  const verify = useAction(async () => {
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    await verifySignupCode(email, parsed.data);
    // Session is now active; the root layout switches to the app.
  }, { errorTitle: 'Verification failed' });
  const resend = useAction(async () => {
    await resendSignupCode(email);
    setResent(true);
  });

  return (
    <Screen>
      <Text variant="title">Check your email</Text>
      <Text tone="muted">We sent a verification code to {email}. Enter it below to activate your account.</Text>
      <TextField
        label="Verification code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        error={error}
      />
      <Button title="Verify" loading={verify.busy} onPress={verify.run} />
      <Button
        title={resent ? 'Code sent again' : 'Send a new code'}
        variant="ghost"
        disabled={resent}
        loading={resend.busy}
        onPress={resend.run}
      />
      <Button title="Back to sign in" variant="ghost" onPress={() => router.dismissTo('/sign-in')} />
    </Screen>
  );
}
