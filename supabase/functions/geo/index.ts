// Geocoding + routing proxy. Keeps the OpenRouteService key server-side and
// only serves signed-in users. Actions:
//   search  { text, focus?: {lat,lng} }      -> { results: Place[] }
//   reverse { lat, lng }                     -> { result: Place | null }
//   route   { points: [{lat,lng}...], avoid_tollways?: boolean }
//           -> { geometry: GeoJSON LineString, distance_m, duration_s, uses_tollways }
import { handle, HttpError, json, requireUser } from '../_shared/supabase.ts';

const ORS = 'https://api.openrouteservice.org';
const COUNTRY = Deno.env.get('GEO_COUNTRY_CODE') ?? 'KE';

function orsKey(): string {
  const key = Deno.env.get('ORS_API_KEY');
  if (!key) throw new HttpError(503, 'geo_not_configured');
  return key;
}

type LatLng = { lat: number; lng: number };
type Place = { name: string; label: string; lat: number; lng: number };

function isLatLng(v: unknown): v is LatLng {
  const p = v as LatLng;
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

// deno-lint-ignore no-explicit-any
function toPlace(f: any): Place {
  const [lng, lat] = f.geometry.coordinates;
  return {
    name: f.properties.name ?? f.properties.label,
    label: f.properties.label ?? f.properties.name,
    lat,
    lng,
  };
}

async function orsFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (res.status === 429) throw new HttpError(429, 'geo_rate_limited');
  if (!res.ok) {
    console.error('ORS error', res.status, await res.text());
    throw new HttpError(502, res.status === 404 ? 'route_not_found' : 'geo_upstream_error');
  }
  return res.json();
}

Deno.serve(handle(async (req) => {
  await requireUser(req);
  const body = await req.json().catch(() => ({}));

  switch (body.action) {
    case 'search': {
      const text = String(body.text ?? '').trim().slice(0, 100);
      if (text.length < 2) return json({ results: [] });
      const q = new URLSearchParams({ api_key: orsKey(), text, 'boundary.country': COUNTRY, size: '8' });
      if (isLatLng(body.focus)) {
        q.set('focus.point.lat', String(body.focus.lat));
        q.set('focus.point.lon', String(body.focus.lng));
      }
      const data = await orsFetch(`${ORS}/geocode/autocomplete?${q}`);
      return json({ results: (data.features ?? []).map(toPlace) });
    }
    case 'reverse': {
      if (!isLatLng(body)) throw new HttpError(400, 'invalid_input');
      const q = new URLSearchParams({
        api_key: orsKey(),
        'point.lat': String(body.lat),
        'point.lon': String(body.lng),
        size: '1',
        'boundary.country': COUNTRY,
      });
      const data = await orsFetch(`${ORS}/geocode/reverse?${q}`);
      const f = data.features?.[0];
      return json({ result: f ? toPlace(f) : null });
    }
    case 'route': {
      const points: unknown[] = Array.isArray(body.points) ? body.points : [];
      if (points.length < 2 || points.length > 12 || !points.every(isLatLng)) {
        throw new HttpError(400, 'invalid_input');
      }
      const data = await orsFetch(`${ORS}/v2/directions/driving-car/geojson`, {
        method: 'POST',
        headers: { Authorization: orsKey(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: (points as LatLng[]).map((p) => [p.lng, p.lat]),
          instructions: false,
          extra_info: ['tollways'],
          ...(body.avoid_tollways ? { options: { avoid_features: ['tollways'] } } : {}),
        }),
      });
      const feature = data.features?.[0];
      if (!feature) throw new HttpError(404, 'route_not_found');
      const tolls = feature.properties?.extras?.tollways?.summary ?? [];
      // deno-lint-ignore no-explicit-any
      const usesTollways = tolls.some((s: any) => s.value === 1 && s.distance > 0);
      return json({
        geometry: feature.geometry,
        distance_m: Math.round(feature.properties.summary.distance),
        duration_s: Math.round(feature.properties.summary.duration),
        uses_tollways: usesTollways,
      });
    }
    default:
      throw new HttpError(400, 'invalid_action');
  }
}));
