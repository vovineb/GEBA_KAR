import type { RealtimeChannel } from '@supabase/supabase-js';

import { ensureOk, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { LiveLocation } from '@/types/domain';

export type LocationSample = {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recordedAt: string;
};

/** Returns false when the server throttled the update (too soon). */
export async function publishLocation(tripId: string, s: LocationSample): Promise<boolean> {
  return unwrap(
    await supabase.rpc('update_live_location', {
      p_trip_id: tripId,
      p_lat: s.lat,
      p_lng: s.lng,
      p_accuracy_m: s.accuracy ?? undefined,
      p_heading: s.heading ?? undefined,
      p_speed_mps: s.speed ?? undefined,
      p_recorded_at: s.recordedAt,
    }),
  );
}

export async function stopSharing(tripId: string) {
  ensureOk(await supabase.rpc('stop_sharing_location', { p_trip_id: tripId }));
}

export async function listLiveLocations(tripId: string): Promise<LiveLocation[]> {
  return unwrap(await supabase.from('live_locations').select('*').eq('trip_id', tripId));
}

export function subscribeToLiveLocations(
  tripId: string,
  onChange: (loc: LiveLocation, event: 'INSERT' | 'UPDATE' | 'DELETE') => void,
): RealtimeChannel {
  return supabase
    .channel(`live:${tripId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_locations', filter: `trip_id=eq.${tripId}` },
      (payload) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as LiveLocation;
        onChange(row, payload.eventType);
      },
    )
    .subscribe();
}
