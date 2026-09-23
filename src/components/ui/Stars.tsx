import { Star } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, space } from '@/theme';

/** Compact rating summary: "★ 4.8 (12)" or "New". */
export function RatingSummary({ average, count }: { average?: number | null; count?: number | null }) {
  if (!count) {
    return (
      <Text variant="caption" tone="subtle">
        New member
      </Text>
    );
  }
  return (
    <View style={styles.row} accessibilityLabel={`Rated ${Number(average).toFixed(1)} out of 5 from ${count} ratings`}>
      <Star size={14} color={colors.warning} fill={colors.warning} />
      <Text variant="caption" tone="muted">
        {Number(average).toFixed(1)} ({count})
      </Text>
    </View>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.input} accessibilityRole="adjustable" accessibilityLabel={`Rating ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star size={36} color={colors.warning} fill={n <= value ? colors.warning : 'transparent'} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
});
