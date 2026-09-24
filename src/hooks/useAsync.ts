import { useCallback, useEffect, useRef, useState } from 'react';

import { toAppError, type AppError } from '@/lib/errors';

type Result<T> = { deps: readonly unknown[]; data: T | undefined; error: AppError | null };

const sameDeps = (a: readonly unknown[] | null, b: readonly unknown[]) =>
  !!a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * Minimal data-loading hook: loading / data / error / refresh / reload.
 * The database stays the source of truth; this is only a view cache.
 * `loading` is derived: true until a result exists for the current deps.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[], opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const [result, setResult] = useState<Result<T> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  const depsRef = useRef(deps);
  const run = useRef(0);

  useEffect(() => {
    fnRef.current = fn;
    depsRef.current = deps;
  });

  const execute = useCallback(async () => {
    const id = ++run.current;
    const forDeps = depsRef.current;
    try {
      const data = await fnRef.current();
      if (id === run.current) setResult({ deps: forDeps, data, error: null });
    } catch (e) {
      if (id === run.current) setResult((prev) => ({ deps: forDeps, data: prev?.data, error: toAppError(e) }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    depsRef.current = deps;
    fnRef.current = fn;
    void execute();
    return () => {
      // Invalidate the in-flight load so a stale result is never applied.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      run.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, execute, ...deps]);

  const current = result && sameDeps(result.deps, deps) ? result : null;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await execute();
    } finally {
      setRefreshing(false);
    }
  }, [execute]);

  const setData = useCallback(
    (data: T) => setResult({ deps: depsRef.current, data, error: null }),
    [],
  );

  return {
    data: current?.data ?? (result?.data as T | undefined),
    error: current?.error ?? null,
    loading: enabled && !current,
    refreshing,
    setData,
    refresh,
    reload: execute,
  };
}
