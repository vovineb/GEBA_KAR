import { UserPlus } from 'lucide-react-native';
import { Alert } from 'react-native';

import { EmptyState, Screen, Text } from '@/components/ui';
import { leaveGuestSession } from '@/services/authService';
import { useAuthStore, type AuthIntent } from '@/store/authStore';
import { colors } from '@/theme';

/** Ends guest browsing and opens the sign-up or sign-in screen. */
export async function leaveGuest(intent: Exclude<AuthIntent, null>) {
  useAuthStore.getState().setAuthIntent(intent);
  await leaveGuestSession();
}

/** Asks a guest to create an account (or sign in) before an action. */
export function promptAccount(action: string) {
  Alert.alert('Create a free account', `You need an account to ${action}. It only takes a minute.`, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Sign in', onPress: () => void leaveGuest('sign-in') },
    { text: 'Create account', onPress: () => void leaveGuest('sign-up') },
  ]);
}

/** Full-screen placeholder for tabs that need an account. */
export function GuestGate({ title, body }: { title: string; body: string }) {
  return (
    <Screen>
      <Text variant="title">{title}</Text>
      <EmptyState
        icon={<UserPlus size={40} color={colors.textSubtle} />}
        title="Create a free account"
        body={body}
        actions={[
          { label: 'Create account', onPress: () => void leaveGuest('sign-up') },
          { label: 'I already have an account', onPress: () => void leaveGuest('sign-in'), variant: 'secondary' },
        ]}
      />
    </Screen>
  );
}
