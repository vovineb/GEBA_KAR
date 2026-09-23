import { useCallback, useEffect, useRef, useState } from 'react';

import { toAppError, type AppError } from '@/lib/errors';

/**
 * Minimal data-loading hook: loading / data / error / refresh.
 * The database stays the source of truth; this is only a view cache.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const run = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);

  const execute = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      const id = ++run.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        const result = await load();
        if (mounted.current && id === run.current) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (mounted.current && id === run.current) setError(toAppError(e));
      } finally {
        if (mounted.current && id === run.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [load],
  );

  useEffect(() => {
    mounted.current = true;
    if (enabled) void execute('initial');
    return () => {
      mounted.current = false;
    };
  }, [execute, enabled]);

  return {
    data,
    error,
    loading,
    refreshing,
    setData,
    refresh: useCallback(() => execute('refresh'), [execute]),
    reload: useCallback(() => execute('silent'), [execute]),
  };
}
