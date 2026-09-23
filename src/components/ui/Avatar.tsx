import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { publicImageUrl } from '@/services/storageService';
import { colors } from '@/theme';

export function Avatar({ path, name, size = 44 }: { path?: string | null; name?: string | null; size?: number }) {
  const initials =
    (name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  const style = { width: size, height: size, borderRadius: size / 2 };
  const uri = path ? publicImageUrl('avatars', path) : null;
  return uri ? (
    <Image source={{ uri }} style={[style, styles.bg]} contentFit="cover" accessibilityLabel={`${name ?? 'User'} photo`} />
  ) : (
    <View style={[style, styles.bg, styles.center]} accessibilityLabel={`${name ?? 'User'} initials`}>
      <Text variant="bodyStrong" tone="brand" style={{ fontSize: size * 0.38 }}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.brandSoft },
  center: { alignItems: 'center', justifyContent: 'center' },
});
