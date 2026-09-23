import { router, useFocusEffect } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useLocationPickerStore } from '@/store/locationPickerStore';
import type { ChosenLocation } from '@/types/domain';
import { colors, radius, space, touchTarget } from '@/theme';

/** Tappable field that opens the location picker and receives its result. */
export function LocationField({
  pickerKey,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  pickerKey: string;
  label: string;
  value: ChosenLocation | null;
  onChange: (loc: ChosenLocation) => void;
  placeholder: string;
  error?: string;
}) {
  const take = useLocationPickerStore((s) => s.take);
  useFocusEffect(
    useCallback(() => {
      const picked = take(pickerKey);
      if (picked) onChange(picked);
    }, [take, pickerKey, onChange]),
  );

  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="muted" style={styles.label}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value?.name ?? placeholder}`}
        onPress={() => router.push({ pathname: '/location-picker', params: { key: pickerKey, title: label } })}
        style={({ pressed }) => [styles.field, !!error && styles.error, pressed && styles.pressed]}
      >
        <MapPin size={18} color={value ? colors.brand : colors.textSubtle} />
        <Text tone={value ? 'default' : 'subtle'} numberOfLines={1} style={styles.value}>
          {value?.name ?? placeholder}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { fontWeight: '600' },
  field: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  error: { borderColor: colors.danger },
  pressed: { backgroundColor: colors.surface },
  value: { flex: 1 },
});
