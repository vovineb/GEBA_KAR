import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Switch, View, StyleSheet } from 'react-native';

import { Button, Divider, ListRow, Screen, Section, Text } from '@/components/ui';
import { useAction } from '@/hooks/useAction';
import { deleteAccount, signOut } from '@/services/authService';
import { registerForPush, unregisterThisDevice } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { useAppConfig } from '@/store/configStore';
import { colors, space } from '@/theme';

export default function SettingsScreen() {
  const config = useAppConfig();
  const email = useAuthStore((s) => s.session?.user.email);
  const setRecovering = useAuthStore((s) => s.setRecovering);
  const [push, setPush] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('Checking…');

  const refresh = useCallback(async () => {
    const [n, l] = await Promise.all([Notifications.getPermissionsAsync(), Location.getForegroundPermissionsAsync()]);
    setPush(n.granted);
    setLocationStatus(l.granted ? 'Allowed while using the app' : l.canAskAgain ? 'Not allowed yet' : 'Blocked in phone settings');
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const togglePush = useAction(async (on: boolean) => {
    if (!on) {
      await unregisterThisDevice();
      setPush(false);
      return;
    }
    const res = await registerForPush(true);
    if (res.status === 'registered') setPush(true);
    else if (res.status === 'denied')
      Alert.alert('Notifications are off', 'Enable notifications for CASS in your phone settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => void Linking.openSettings() },
      ]);
    else Alert.alert('Push unavailable', res.reason);
  });

  const out = useAction(signOut, { errorTitle: 'Sign out failed' });
  const del = useAction(deleteAccount, { errorTitle: 'Account not deleted' });

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'Your upcoming trips and seats are cancelled (other travellers are notified), your photos are removed and you are signed out. This cannot be undone.',
      [
        { text: 'Keep account', style: 'cancel' },
        { text: 'Delete permanently', style: 'destructive', onPress: () => void del.run() },
      ],
    );

  return (
    <Screen edges={[]}>
      <Section title="Account">
        <ListRow title="Email" subtitle={email} />
        <ListRow
          title="Change password"
          subtitle="We will email you a code"
          onPress={() => {
            setRecovering(false);
            Alert.alert('Change password', 'Sign out and use “Forgot password?” with your email to set a new password.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', onPress: () => void out.run() },
            ]);
          }}
        />
      </Section>
      <Divider />
      <Section title="Notifications">
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">Push notifications on this phone</Text>
            <Text variant="caption" tone="muted">
              Seat requests, confirmations, messages and trip reminders.
            </Text>
          </View>
          <Switch value={push} onValueChange={(v) => void togglePush.run(v)} disabled={togglePush.busy} trackColor={{ true: colors.brand }} accessibilityLabel="Push notifications" />
        </View>
      </Section>
      <Divider />
      <Section title="Location">
        <ListRow title="Location permission" subtitle={locationStatus} onPress={() => void Linking.openSettings()} />
        <Text variant="caption" tone="muted">
          CASS uses your location to find trips near you and, only while a trip you are on is in progress, to share your
          position with the people on that trip. Sharing stops when the trip ends.
        </Text>
      </Section>
      <Divider />
      <Section title="Privacy">
        <Text variant="caption" tone="muted">
          Other members see your name, photo, bio, rating and completed trips. Your phone number and email are never
          shown. Your number plate is only shown to passengers with a confirmed seat. Use approved pickup points instead
          of your home address.
        </Text>
        <ListRow title="Blocked users" onPress={() => router.push('/settings/blocked')} />
      </Section>
      <Divider />
      <Section title="Help">
        {config.support.email ? (
          <>
            <ListRow title="Help & support" subtitle={config.support.email} onPress={() => void Linking.openURL(`mailto:${config.support.email}`)} />
            <ListRow title="Report a problem" onPress={() => void Linking.openURL(`mailto:${config.support.email}?subject=CASS%20problem%20report`)} />
          </>
        ) : (
          <Text variant="caption" tone="muted">
            To report a person or trip, use “Report” on their profile or trip page.
          </Text>
        )}
        {config.support.terms_url ? <ListRow title="Terms of use" onPress={() => void Linking.openURL(config.support.terms_url!)} /> : null}
        {config.support.privacy_url ? <ListRow title="Privacy policy" onPress={() => void Linking.openURL(config.support.privacy_url!)} /> : null}
      </Section>
      <Divider />
      <Button title="Sign out" variant="secondary" loading={out.busy} onPress={out.run} />
      <Button title="Delete account" variant="danger" loading={del.busy} onPress={confirmDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
});
