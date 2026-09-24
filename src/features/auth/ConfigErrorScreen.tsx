import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { envProblems } from '@/config/env';
import { colors, space } from '@/theme';

/** Shown when the build was made without the required .env values. */
export function ConfigErrorScreen() {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text variant="heading">App not configured</Text>
      <Text tone="muted">
        This build is missing required configuration. Add the values below to the project .env file and rebuild. See
        README → Environment variables.
      </Text>
      <View style={styles.box}>
        {envProblems.map((p) => (
          <Text key={p} variant="caption" tone="danger">
            {p}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.lg, backgroundColor: colors.background },
  box: { gap: space.xs, padding: space.md, borderRadius: 8, backgroundColor: colors.dangerSoft },
});
