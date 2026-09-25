import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, space, touchTarget } from '@/theme';

type Props = TextInputProps & { label: string; error?: string; hint?: string; right?: ReactNode };

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, right, style, multiline, secureTextEntry, ...rest },
  ref,
) {
  // Password fields get a show/hide toggle.
  const [revealed, setRevealed] = useState(false);
  const toggle = secureTextEntry ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
      hitSlop={8}
      onPress={() => setRevealed((v) => !v)}
      style={styles.toggle}
    >
      {revealed ? <EyeOff size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
    </Pressable>
  ) : null;
  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="muted" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.field, !!error && styles.fieldError, multiline && styles.multiline]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textSubtle}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          {...rest}
        />
        {toggle}
        {right}
      </View>
      {error ? (
        <Text variant="small" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { fontWeight: '600' },
  field: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
  },
  fieldError: { borderColor: colors.danger },
  multiline: { alignItems: 'flex-start', paddingVertical: space.sm },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: space.sm },
  toggle: { paddingLeft: space.sm, paddingVertical: space.xs },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
});
