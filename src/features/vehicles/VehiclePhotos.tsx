import { Image } from 'expo-image';
import { ScrollView, StyleSheet } from 'react-native';

import { publicImageUrl } from '@/services/storageService';
import { colors, radius, space } from '@/theme';

/** Horizontal strip of a vehicle's photos (renders nothing when there are none). */
export function VehiclePhotos({ paths, height = 120 }: { paths: string[] | null | undefined; height?: number }) {
  if (!paths?.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {paths.map((p, i) => (
        <Image
          key={p}
          source={{ uri: publicImageUrl('vehicle-photos', p) }}
          style={[styles.photo, { height, width: (height * 4) / 3 }]}
          contentFit="cover"
          accessibilityLabel={`Vehicle photo ${i + 1} of ${paths.length}`}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm },
  photo: { borderRadius: radius.md, backgroundColor: colors.surface },
});
