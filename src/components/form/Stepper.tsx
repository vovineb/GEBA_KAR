import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, space, touchTarget } from '@/theme';

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn = (icon: 'minus' | 'plus', disabled: boolean, next: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon === 'minus' ? `Fewer ${label}` : `More ${label}`}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={[styles.btn, disabled && styles.disabled]}
    >
      {icon === 'minus' ? <Minus size={20} color={colors.text} /> : <Plus size={20} color={colors.text} />}
    </Pressable>
  );
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={`${label}: ${value}`}>
      <Text variant="bodyStrong" style={styles.label}>
        {label}
      </Text>
      {btn('minus', value <= min, value - 1)}
      <Text variant="subheading" style={styles.value}>
        {value}
      </Text>
      {btn('plus', value >= max, value + 1)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  label: { flex: 1 },
  btn: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  value: { minWidth: 28, textAlign: 'center' },
});
