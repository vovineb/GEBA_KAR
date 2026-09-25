import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { TERMS_SECTIONS, TERMS_VERSION } from '@/features/legal/terms';
import { space } from '@/theme';

export default function TermsScreen() {
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Terms and Conditions' }} />
      <Text variant="caption" tone="muted">
        Version {TERMS_VERSION}
      </Text>
      {TERMS_SECTIONS.map((s, i) => (
        <View key={s.title} style={styles.section}>
          <Text variant="subheading">
            {i + 1}. {s.title}
          </Text>
          <Text>{s.body}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: space.xs } });
