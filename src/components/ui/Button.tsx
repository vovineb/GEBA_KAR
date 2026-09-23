import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, space, touchTarget } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  accessibilityHint,
  compact = false,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  accessibilityHint?: string;
  compact?: boolean;
}) {
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: colors.brand, pressed: colors.brandPressed, fg: 'inverse' as const, border: colors.brand },
    secondary: { bg: colors.background, pressed: colors.surface, fg: 'default' as const, border: colors.borderStrong },
    ghost: { bg: 'transparent', pressed: colors.surface, fg: 'brand' as const, border: 'transparent' },
    danger: { bg: colors.background, pressed: colors.dangerSoft, fg: 'danger' as const, border: colors.danger },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: pressed ? palette.pressed : palette.bg, borderColor: palette.border },
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.textInverse : colors.brand} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="bodyStrong" tone={palette.fg}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: 40, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  inactive: { opacity: 0.5 },
});
