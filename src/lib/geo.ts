import type { LatLng } from '@/types/domain';

/**
 * Great-circle distance in metres. Only used to rank nearby meeting points
 * in the UI; road distances always come from the routing service.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearest<T extends LatLng>(items: T[], to: LatLng, maxMeters: number, limit: number): T[] {
  return items
    .map((item) => ({ item, d: haversineMeters(item, to) }))
    .filter((x) => x.d <= maxMeters)
    .sort((x, y) => x.d - y.d)
    .slice(0, limit)
    .map((x) => x.item);
}
