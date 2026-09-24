import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { decodeQuery } from '@/features/search/searchQuery';
import { TripCard } from '@/features/trips/TripCard';
import { toAppError, type AppError } from '@/lib/errors';
import { logSearch, searchTrips } from '@/services/tripService';
import { useAppConfig } from '@/store/configStore';
import type { TripSearchResult } from '@/types/domain';
import { colors, space } from '@/theme';

const PAGE = 20;

export default function SearchResultsScreen() {
  const { q } = useLocalSearchParams<{ q: string }>();
  const query = decodeQuery(q);
  const config = useAppConfig();
  const [items, setItems] = useState<TripSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const fetchPage = useCallback(
    async (offset: number) => {
      if (!query) return [];
      return searchTrips({
        origin: query.from,
        destination: query.to,
        date: query.date,
        time: query.time,
        seats: query.seats,
        tripType: query.tripType,
        expressway: query.expressway,
        recurringOnly: query.recurringOnly,
        limit: PAGE,
        offset,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(0);
      setItems(page);
      setDone(page.length < PAGE);
      if (query) {
        void logSearch({
          trip_type: query.tripType,
          seats: query.seats,
          has_time: !!query.time,
          recurring_only: query.recurringOnly,
          results: page.length,
        }).catch(() => undefined);
      }
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (done || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(items.length);
      setItems((prev) => [...prev, ...page.filter((p) => !prev.some((x) => x.id === p.id))]);
      setDone(page.length < PAGE);
    } catch {
      setDone(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const title = query?.from && query.to ? `${query.from.name} → ${query.to.name}` : 'Trips';

  if (!query) return <ErrorState message="This search could not be opened." onRetry={() => router.back()} />;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title }} />
      {loading ? (
        <LoadingState label="Finding trips going your way…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id ?? ''}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <TripCard trip={item} timeZone={config.timezone} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            items.length ? (
              <Text variant="caption" tone="muted">
                {items.length}
                {done ? '' : '+'} trip{items.length === 1 ? '' : 's'} going your way. Contributions are suggested cost
                sharing, not fares.
              </Text>
            ) : null
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon={<SearchX size={36} color={colors.textSubtle} />}
              title="No trips available yet."
              body="Nobody has posted a matching trip for this time. Try another time, or offer your own seats."
              actions={[
                { label: 'Create the first trip', onPress: () => router.push('/create') },
                { label: 'Change search', onPress: () => router.back(), variant: 'secondary' },
              ]}
            />
          }
        />
      )}
      {!loading && !error && items.length ? (
        <View style={styles.footer}>
          <Button title="Change search" variant="secondary" onPress={() => router.back()} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: space.lg, gap: space.md, flexGrow: 1 },
  footer: { padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
