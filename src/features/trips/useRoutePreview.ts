import { useEffect, useState } from 'react';

import { toAppError } from '@/lib/errors';
import { getRoute } from '@/services/geoService';
import { suggestContribution } from '@/services/tripService';
import type { ExpresswayOption, LatLng, RouteResult } from '@/types/domain';

export type Suggestion = { min: number; max: number; currency: string } | null;

/**
 * Real road route (via the geo Edge Function) + the server's contribution
 * suggestion for it. Errors are surfaced, never replaced by a straight line.
 */
export function useRoutePreview(points: (LatLng | null)[], expressway: ExpresswayOption) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = points.filter((p): p is LatLng => !!p);
  const key = valid.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|') + expressway;
  const complete = valid.length === points.length && valid.length >= 2;

  useEffect(() => {
    if (!complete) return;
    let alive = true;
    const t = setTimeout(async () => {
      if (!alive) return;
      setLoading(true);
      setError(null);
      try {
        const r = await getRoute(valid, expressway === 'avoid');
        if (!alive) return;
        setRoute(r);
        const usesExpressway = expressway === 'use' || (expressway === 'either' && r.uses_tollways);
        const s = await suggestContribution(r.distance_m, usesExpressway);
        if (alive) setSuggestion(s ? { min: Number(s.min_amount), max: Number(s.max_amount), currency: s.currency } : null);
      } catch (e) {
        if (alive) {
          setRoute(null);
          setSuggestion(null);
          setError(toAppError(e).message);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, complete]);

  // Nothing to show until both ends (and all stops) are chosen.
  if (!complete) return { route: null, suggestion: null, loading: false, error: null };
  return { route, suggestion, loading, error };
}
