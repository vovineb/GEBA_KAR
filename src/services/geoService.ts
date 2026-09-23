import { AppError, toAppError, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { LatLng, PickupPoint, Place, RouteResult } from '@/types/domain';

// External geocoding/routing is reached only through the `geo` Edge
// Function, which holds the provider key server-side.

async function invokeGeo<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('geo', { body });
  if (error) {
    const payload = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw toAppError({ message: payload?.error ?? error.message });
  }
  return data as T;
}

export async function listPlaces(): Promise<Place[]> {
  return unwrap(
    await supabase.from('places').select('id, name, kind, lat, lng').eq('is_active', true).order('sort_order'),
  );
}

export async function listPickupPoints(): Promise<PickupPoint[]> {
  return unwrap(
    await supabase
      .from('pickup_points')
      .select('id, name, description, lat, lng, place_id')
      .eq('is_active', true)
      .order('name'),
  );
}

export type GeoResult = LatLng & { name: string; label: string };

export async function searchPlaces(text: string, focus?: LatLng | null): Promise<GeoResult[]> {
  const { results } = await invokeGeo<{ results: GeoResult[] }>({ action: 'search', text, focus: focus ?? undefined });
  return results;
}

export async function reverseGeocode(point: LatLng): Promise<GeoResult | null> {
  const { result } = await invokeGeo<{ result: GeoResult | null }>({ action: 'reverse', ...point });
  return result;
}

export async function getRoute(points: LatLng[], avoidTollways: boolean): Promise<RouteResult> {
  if (points.length < 2) throw new AppError('Choose a start and a destination.', 'invalid_input');
  return invokeGeo<RouteResult>({ action: 'route', points, avoid_tollways: avoidTollways });
}
