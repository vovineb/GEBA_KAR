import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, space } from '@/theme';

/** Loading / empty / error states, so no screen is ever a blank page. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.brand} size="large" />
      <Text tone="muted">{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  actions?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' }[];
}) {
  return (
    <View style={styles.center}>
      {icon}
      <Text variant="subheading" style={styles.centerText}>
        {title}
      </Text>
      {body ? (
        <Text tone="muted" style={styles.centerText}>
          {body}
        </Text>
      ) : null}
      {actions?.length ? (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Button key={a.label} title={a.label} onPress={a.onPress} variant={a.variant ?? 'primary'} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Text variant="subheading" style={styles.centerText}>
        Something went wrong
      </Text>
      <Text tone="muted" style={styles.centerText}>
        {message}
      </Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  centerText: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
});
