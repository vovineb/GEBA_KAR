import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';

import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { getTripDetail } from '@/services/tripService';

/**
 * Trip detail with live updates: status/seat changes on the trip row and
 * request changes (both RLS-filtered) trigger a silent reload.
 */
export function useTripDetail(tripId: string) {
  const state = useAsync(() => getTripDetail(tripId), [tripId]);
  const { reload } = state;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, () =>
        void reload(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_requests', filter: `trip_id=eq.${tripId}` }, () =>
        void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tripId, reload]);

  return state;
}
