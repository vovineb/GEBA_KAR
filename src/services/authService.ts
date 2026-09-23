import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { unregisterThisDevice } from '@/services/notificationService';

// Email confirmation and password recovery use 6-digit email codes (OTP)
// rather than deep links, so they work even if the email is opened on
// another device. The email templates must include {{ .Token }} (README).

function check(error: unknown) {
  if (error) throw toAppError(error);
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  check(error);
  return { needsConfirmation: !data.session };
}

export async function verifySignupCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  check(error);
}

export async function resendSignupCode(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  check(error);
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  check(error);
}

export async function signOut() {
  await unregisterThisDevice().catch(() => undefined);
  const { error } = await supabase.auth.signOut();
  check(error);
}

export async function sendPasswordResetCode(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  check(error);
}

/** Verifies the recovery code; on success the user is signed in and may set a new password. */
export async function verifyRecoveryCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
  check(error);
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  check(error);
}

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw toAppError({ message: body?.error ?? 'deletion_failed' });
  }
  await supabase.auth.signOut({ scope: 'local' });
}
