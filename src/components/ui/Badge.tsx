import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, space } from '@/theme';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'live';

const palette: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surface, fg: colors.textMuted },
  brand: { bg: colors.brandSoft, fg: colors.brand },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  live: { bg: colors.live, fg: colors.textInverse },
};

/** Status label. Always text, never colour alone. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const p = palette[tone];
  return (
    <View style={[styles.badge, { backgroundColor: p.bg }]}>
      <Text variant="small" style={{ color: p.fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
});
