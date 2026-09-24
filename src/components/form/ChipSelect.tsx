import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, space } from '@/theme';

/** Horizontal single-select chips (optional "none" allowed). */
export function ChipSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
  allowNone,
  multi,
  values,
  onToggle,
}: {
  label?: string;
  options: readonly { value: T; label: string }[];
  value?: T | null;
  onChange?: (v: T | null) => void;
  allowNone?: boolean;
  multi?: boolean;
  values?: T[];
  onToggle?: (v: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" tone="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((o) => {
          const selected = multi ? !!values?.includes(o.value) : value === o.value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole={multi ? 'checkbox' : 'radio'}
              accessibilityState={multi ? { checked: selected } : { selected }}
              accessibilityLabel={o.label}
              onPress={() => {
                if (multi) onToggle?.(o.value);
                else onChange?.(selected && allowNone ? null : o.value);
              }}
              style={[styles.chip, selected && styles.selected]}
            >
              <Text variant="caption" tone={selected ? 'inverse' : 'default'} style={styles.chipText}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { fontWeight: '600' },
  row: { gap: space.sm, paddingVertical: 2 },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  selected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontWeight: '600' },
});
