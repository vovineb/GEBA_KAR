import { Text as RNText, type TextProps } from 'react-native';

import { colors, type } from '@/theme';

type Variant = keyof typeof type;
type Tone = 'default' | 'muted' | 'subtle' | 'inverse' | 'brand' | 'danger' | 'success' | 'warning';

const toneColor: Record<Tone, string> = {
  default: colors.text,
  muted: colors.textMuted,
  subtle: colors.textSubtle,
  inverse: colors.textInverse,
  brand: colors.brand,
  danger: colors.danger,
  success: colors.success,
  warning: colors.warning,
};

export function Text({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  return <RNText maxFontSizeMultiplier={1.6} {...rest} style={[type[variant], { color: toneColor[tone] }, style]} />;
}
