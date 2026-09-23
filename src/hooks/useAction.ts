import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { toAppError } from '@/lib/errors';

/**
 * Wraps a mutation: prevents double submission (double taps on slow
 * networks), exposes `busy`, and shows a friendly error.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: { errorTitle?: string } = {}) {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setBusy(true);
      try {
        return await fn(...args);
      } catch (e) {
        Alert.alert(opts.errorTitle ?? 'Could not complete that', toAppError(e).message);
        return undefined;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [fn, opts.errorTitle],
  );
  return { run, busy };
}
