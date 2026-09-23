import { WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useIsOnline } from '@/hooks/useIsOnline';
import { colors, space } from '@/theme';

export function OfflineBanner() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <WifiOff size={16} color={colors.warning} />
      <Text variant="caption" tone="warning">
        You are offline. Changes will fail until you reconnect.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.warningSoft,
  },
});
