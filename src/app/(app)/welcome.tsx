import { router, Stack } from 'expo-router';
import { Camera, Car, Check, MapPin, MessageCircle, ShieldCheck, Users } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { TERMS_VERSION } from '@/features/legal/terms';
import { useAction } from '@/hooks/useAction';
import { completeOnboarding } from '@/services/profileService';
import { useProfileStore } from '@/store/profileStore';
import { colors, radius, space } from '@/theme';

type Step = { icon: ReactNode; title: string; body: string };

const icon = (I: typeof MapPin) => <I size={40} color={colors.brand} />;

const STEPS: Step[] = [
  {
    icon: icon(Users),
    title: 'Welcome to CASS',
    body:
      'CASS connects people already travelling the same way, so you can share the empty seats and the cost of the journey. ' +
      'It is not a taxi service: trip creators are neighbours and colleagues making the trip anyway.',
  },
  {
    icon: icon(MapPin),
    title: '1. Find a ride',
    body:
      'On Home, enter where you are going and when. Open a trip to see the route, meeting point, the trip creator’s profile and ratings, then tap “Request seat”.',
  },
  {
    icon: icon(Car),
    title: '2. Offer your empty seats',
    body:
      'Driving anyway? Add your vehicle (with photos) under Profile → Vehicles, then use the Create tab to post a trip or a weekly commute. You choose who joins.',
  },
  {
    icon: icon(MessageCircle),
    title: '3. Agree the details',
    body:
      'Chat with the trip creator or the trip group to agree the meeting point and time. Contributions are cost sharing, paid directly between travellers.',
  },
  {
    icon: icon(ShieldCheck),
    title: '4. Travel safely',
    body:
      'Share live location during the trip, share trip details with someone you trust, and report or block anyone who makes you uncomfortable. ' +
      'Women can offer and join women-only trips. In an emergency call 999 or 112.',
  },
  {
    icon: icon(Camera),
    title: '5. Complete your profile',
    body: 'Add a clear profile photo and a short bio so other travellers recognise you at the meeting point. Rate each other after the trip.',
  },
];

/** One-time guide after sign-up (also collects terms acceptance if missing). */
export default function WelcomeScreen() {
  const profile = useProfileStore((s) => s.profile);
  const load = useProfileStore((s) => s.load);
  const needsTerms = !profile?.terms_accepted_at;
  const [index, setIndex] = useState(profile?.onboarded_at ? STEPS.length - 1 : 0);
  const [accepted, setAccepted] = useState(false);
  const last = index === STEPS.length - 1;
  const step = STEPS[index]!;

  const finish = useAction(async (next: 'photo' | 'home') => {
    await completeOnboarding(needsTerms ? TERMS_VERSION : null);
    await load();
    router.replace('/');
    if (next === 'photo') router.push('/profile-edit');
  }, { errorTitle: 'Could not continue' });

  const canFinish = !needsTerms || accepted;

  return (
    <Screen
      footer={
        last ? (
          <View style={styles.actions}>
            <Button title="Add my photo" disabled={!canFinish} loading={finish.busy} onPress={() => void finish.run('photo')} />
            <Button title="Start exploring" variant="secondary" disabled={!canFinish} onPress={() => void finish.run('home')} />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button title="Next" onPress={() => setIndex(index + 1)} />
            <Button title="Skip guide" variant="ghost" onPress={() => setIndex(STEPS.length - 1)} />
          </View>
        )
      }
    >
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === index && styles.dotOn]} />
        ))}
      </View>
      <View style={styles.card}>
        {step.icon}
        <Text variant="title" style={styles.center}>
          {step.title}
        </Text>
        <Text tone="muted" style={styles.center}>
          {step.body}
        </Text>
      </View>
      {last && needsTerms ? (
        <View style={styles.termsRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            accessibilityLabel="I accept the Terms and Conditions"
            hitSlop={8}
            onPress={() => setAccepted(!accepted)}
            style={[styles.box, accepted && styles.boxOn]}
          >
            {accepted ? <Check size={16} color={colors.textInverse} /> : null}
          </Pressable>
          <Text style={styles.flex} onPress={() => setAccepted(!accepted)}>
            I have read and accept the{' '}
            <Text tone="brand" onPress={() => router.push('/terms')}>
              Terms and Conditions
            </Text>
            .
          </Text>
        </View>
      ) : null}
      {index > 0 && !last ? <Button title="Back" variant="ghost" onPress={() => setIndex(index - 1)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginTop: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.brand, width: 20 },
  card: { alignItems: 'center', gap: space.lg, paddingVertical: space.xxl, paddingHorizontal: space.md },
  center: { textAlign: 'center' },
  actions: { gap: space.sm },
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
