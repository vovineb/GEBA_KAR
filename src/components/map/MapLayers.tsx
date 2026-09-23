import { GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import type { LineString } from 'geojson';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { LatLng } from '@/types/domain';
import { colors, radius, space } from '@/theme';

export function RouteLine({ route, id = 'route' }: { route: LineString; id?: string }) {
  return (
    <GeoJSONSource id={id} data={{ type: 'Feature', geometry: route, properties: {} }}>
      <Layer
        id={`${id}-casing`}
        type="line"
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        paint={{ 'line-color': '#FFFFFF', 'line-width': 8 }}
      />
      <Layer
        id={`${id}-line`}
        type="line"
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        paint={{ 'line-color': colors.brand, 'line-width': 5 }}
      />
    </GeoJSONSource>
  );
}

type PinKind = 'origin' | 'destination' | 'pickup' | 'stop' | 'person' | 'picked';

const pinColor: Record<PinKind, string> = {
  origin: colors.brand,
  destination: colors.text,
  pickup: colors.info,
  stop: colors.textMuted,
  person: colors.live,
  picked: colors.brand,
};

/** Map marker with a text label (information is never colour-only). */
export function Pin({ point, kind, label, id }: { point: LatLng; kind: PinKind; label?: string; id: string }) {
  return (
    <Marker id={id} lngLat={[point.lng, point.lat]} anchor="bottom">
      <View style={styles.pinWrap} accessibilityLabel={label ?? kind}>
        {label ? (
          <View style={styles.label}>
            <Text variant="small" numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : null}
        <View style={[styles.dot, { backgroundColor: pinColor[kind] }, kind === 'person' && styles.person]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pinWrap: { alignItems: 'center' },
  label: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    marginBottom: 4,
    maxWidth: 180,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: colors.background },
  person: { width: 20, height: 20, borderRadius: 10 },
});
