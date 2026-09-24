import { Camera, Map, UserLocation, type CameraRef, type LngLatBounds } from '@maplibre/maplibre-react-native';
import { MapPinOff } from 'lucide-react-native';
import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui';
import { env } from '@/config/env';
import { useConfigStore } from '@/store/configStore';
import type { LatLng } from '@/types/domain';
import { colors, space } from '@/theme';

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Fit these points on first render (falls back to configured default viewport). */
  fitPoints?: LatLng[];
  center?: LatLng;
  zoom?: number;
  showUserLocation?: boolean;
  interactive?: boolean;
  onLongPress?: (p: LatLng) => void;
  onPress?: (p: LatLng) => void;
  onRegionDidChange?: (center: LatLng) => void;
};

function boundsOf(points: LatLng[]): LngLatBounds {
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/**
 * Real interactive map (MapLibre + the tile provider configured in
 * EXPO_PUBLIC_MAP_STYLE_URL). Shows an explicit "map unavailable" state
 * instead of a fake map when not configured or when the style fails to load.
 */
export const CassMap = forwardRef<CameraRef, Props>(function CassMap(
  { children, style, fitPoints, center, zoom, showUserLocation, interactive = true, onLongPress, onPress, onRegionDidChange },
  cameraRef,
) {
  const mapCfg = useConfigStore((s) => s.config?.map);
  const [failed, setFailed] = useState(false);

  if (!env.mapStyleUrl || failed) {
    return (
      <View style={[styles.fallback, style]} accessibilityRole="image" accessibilityLabel="Map unavailable">
        <MapPinOff size={28} color={colors.textSubtle} />
        <Text variant="caption" tone="muted" style={styles.center}>
          {!env.mapStyleUrl
            ? 'Map not configured (EXPO_PUBLIC_MAP_STYLE_URL).'
            : 'Map could not load. Check your connection.'}
        </Text>
      </View>
    );
  }

  const initialViewState =
    fitPoints && fitPoints.length > 1
      ? { bounds: boundsOf(fitPoints), padding: { top: 60, right: 50, bottom: 60, left: 50 } }
      : {
          center: [
            (center ?? fitPoints?.[0] ?? mapCfg?.default_center ?? { lng: 0, lat: 0 }).lng,
            (center ?? fitPoints?.[0] ?? mapCfg?.default_center ?? { lng: 0, lat: 0 }).lat,
          ] as [number, number],
          zoom: zoom ?? (fitPoints?.length === 1 || center ? 14 : (mapCfg?.default_zoom ?? 10)),
        };

  return (
    <Map
      style={[styles.map, style]}
      mapStyle={env.mapStyleUrl}
      dragPan={interactive}
      touchZoom={interactive}
      touchRotate={false}
      touchPitch={false}
      compass={false}
      attribution
      logo={false}
      onDidFailLoadingMap={() => setFailed(true)}
      onLongPress={onLongPress ? (e) => onLongPress(toLatLng(e.nativeEvent.lngLat)) : undefined}
      onPress={onPress ? (e) => onPress(toLatLng(e.nativeEvent.lngLat)) : undefined}
      onRegionDidChange={
        onRegionDidChange ? (e) => onRegionDidChange(toLatLng(e.nativeEvent.center)) : undefined
      }
    >
      <Camera ref={cameraRef} initialViewState={initialViewState} />
      {showUserLocation ? <UserLocation accuracy heading /> : null}
      {children}
    </Map>
  );
});

function toLatLng(lngLat: [number, number] | readonly number[]): LatLng {
  return { lng: Number(lngLat[0]), lat: Number(lngLat[1]) };
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  fallback: {
    flex: 1,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    padding: space.lg,
  },
  center: { textAlign: 'center' },
});
