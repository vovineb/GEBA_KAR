import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Crosshair, MapPin, Navigation, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CassMap } from '@/components/map/CassMap';
import { Pin } from '@/components/map/MapLayers';
import { Button, Divider, ListRow, Text, TextField } from '@/components/ui';
import { ensureLocationPermission, getCurrentFix } from '@/features/location/permissions';
import { useAsync } from '@/hooks/useAsync';
import { useDebounced } from '@/hooks/useDebounced';
import { toAppError } from '@/lib/errors';
import { listPickupPoints, listPlaces, reverseGeocode, searchPlaces } from '@/services/geoService';
import { useAppConfig } from '@/store/configStore';
import { useLocationPickerStore } from '@/store/locationPickerStore';
import type { ChosenLocation, LatLng } from '@/types/domain';
import { colors, space } from '@/theme';

type Row = { key: string; title: string; subtitle?: string; kind: 'pickup' | 'place' | 'search'; loc: ChosenLocation };

export default function LocationPickerScreen() {
  const { key, title } = useLocalSearchParams<{ key: string; title?: string }>();
  const config = useAppConfig();
  const setResult = useLocationPickerStore((s) => s.setResult);
  const [text, setText] = useState('');
  const [pin, setPin] = useState<ChosenLocation | null>(null);
  const [mapMode, setMapMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useDebounced(text.trim(), 350);

  const local = useAsync(() => Promise.all([listPickupPoints(), listPlaces()]), []);
  const remote = useAsync(() => searchPlaces(query), [query], { enabled: query.length >= 3 });

  const rows = useMemo<Row[]>(() => {
    const q = query.toLowerCase();
    const [points = [], places = []] = local.data ?? [];
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    const out: Row[] = [
      ...points.filter((p) => match(p.name)).map<Row>((p) => ({
        key: `pp-${p.id}`,
        title: p.name,
        subtitle: p.description ?? 'Approved pickup point',
        kind: 'pickup',
        loc: { name: p.name, lat: p.lat, lng: p.lng, pickupPointId: p.id },
      })),
      ...places.filter((p) => match(p.name)).map<Row>((p) => ({
        key: `pl-${p.id}`,
        title: p.name,
        subtitle: 'Area',
        kind: 'place',
        loc: { name: p.name, lat: p.lat, lng: p.lng },
      })),
    ];
    if (query.length >= 3) {
      for (const r of remote.data ?? []) {
        out.push({ key: `g-${r.lat},${r.lng}`, title: r.name, subtitle: r.label, kind: 'search', loc: { name: r.name, lat: r.lat, lng: r.lng } });
      }
    }
    return out;
  }, [local.data, remote.data, query]);

  const choose = (loc: ChosenLocation) => {
    setResult(key, loc);
    router.back();
  };

  const nameFor = async (p: LatLng, fallback: string) => {
    try {
      return (await reverseGeocode(p))?.name ?? fallback;
    } catch {
      return fallback;
    }
  };

  const useCurrent = async () => {
    setNotice(null);
    const perm = await ensureLocationPermission('search');
    if (perm !== 'granted') {
      setNotice('Location permission is off. Search for a place or pick it on the map instead.');
      return;
    }
    setBusy(true);
    try {
      const fix = await getCurrentFix();
      if (!fix) {
        setNotice('Your location is unavailable. Turn on location services or search instead.');
        return;
      }
      if (fix.accuracy != null && fix.accuracy > config.location.poor_accuracy_m) {
        setNotice(`Location accuracy is limited (about ${Math.round(fix.accuracy)} m). Check the pin before continuing.`);
        setMapMode(true);
        setPin({ lat: fix.lat, lng: fix.lng, name: await nameFor(fix, 'Current location') });
        return;
      }
      choose({ lat: fix.lat, lng: fix.lng, name: await nameFor(fix, 'Current location') });
    } finally {
      setBusy(false);
    }
  };

  const dropPin = async (p: LatLng) => {
    setPin({ ...p, name: 'Dropped pin' });
    setPin({ ...p, name: await nameFor(p, 'Dropped pin') });
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: title ?? 'Choose place' }} />
      <View style={styles.top}>
        <TextField
          label="Search"
          placeholder="Estate, landmark, town…"
          value={text}
          onChangeText={setText}
          autoFocus={!mapMode}
          returnKeyType="search"
          right={remote.loading && query.length >= 3 ? <ActivityIndicator color={colors.brand} /> : <Search size={18} color={colors.textSubtle} />}
        />
        <View style={styles.quick}>
          <Button title="Current location" variant="secondary" compact loading={busy} onPress={useCurrent} icon={<Navigation size={16} color={colors.text} />} />
          <Button title={mapMode ? 'List' : 'Pick on map'} variant="secondary" compact onPress={() => setMapMode((m) => !m)} icon={<MapPin size={16} color={colors.text} />} />
        </View>
        {notice ? <Text variant="caption" tone="warning">{notice}</Text> : null}
      </View>

      {mapMode ? (
        <View style={styles.flex}>
          <CassMap showUserLocation center={pin ?? undefined} onLongPress={dropPin} onPress={dropPin}>
            {pin ? <Pin id="picked" point={pin} kind="picked" label={pin.name} /> : null}
          </CassMap>
          <View style={styles.mapFooter}>
            <Text variant="caption" tone="muted">
              <Crosshair size={12} color={colors.textMuted} /> Tap or long-press the map to place the pin.
            </Text>
            <Button title={pin ? `Use “${pin.name}”` : 'Place a pin first'} disabled={!pin} onPress={() => pin && choose(pin)} />
          </View>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => (
            <ListRow
              title={item.title}
              subtitle={item.subtitle}
              onPress={() => choose(item.loc)}
              left={<MapPin size={20} color={item.kind === 'pickup' ? colors.info : colors.brand} />}
            />
          )}
          ListEmptyComponent={
            local.loading ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Text tone="muted" style={styles.empty}>
                {remote.error
                  ? toAppError(remote.error).message
                  : query.length < 3
                    ? 'Type at least 3 letters to search, or pick on the map.'
                    : 'No places found. Try another name or pick on the map.'}
              </Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { padding: space.lg, gap: space.sm },
  quick: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  empty: { textAlign: 'center', marginTop: space.xl },
  mapFooter: { padding: space.lg, gap: space.sm, backgroundColor: colors.background },
});
