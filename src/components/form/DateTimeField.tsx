import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, space, touchTarget } from '@/theme';

const pad = (n: number) => String(n).padStart(2, '0');

export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder,
  error,
}: {
  label: string;
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const text = value
    ? mode === 'date'
      ? value.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : `${pad(value.getHours())}:${pad(value.getMinutes())}`
    : (placeholder ?? (mode === 'date' ? 'Choose date' : 'Choose time'));

  const handle = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (e.type === 'set' && d) onChange(d);
  };

  const Icon = mode === 'date' ? CalendarDays : Clock;
  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="muted" style={styles.label}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}`}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.field, !!error && styles.error, pressed && styles.pressed]}
      >
        <Icon size={18} color={value ? colors.brand : colors.textSubtle} />
        <Text tone={value ? 'default' : 'subtle'}>{text}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode}
          is24Hour
          minuteInterval={5}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handle}
        />
      ) : null}
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: space.xs },
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
});
