import { z } from 'zod';

/**
 * Typed view of the `configuration` table. The database is the source of
 * truth; the app only validates shape. Keys the app does not use (e.g. the
 * matching radii) are applied server-side and not duplicated here.
 */
const latLng = z.object({ lat: z.number(), lng: z.number() });

export const appConfigSchema = z.object({
  currency: z.string().length(3),
  timezone: z.string().min(3),
  trip_rules: z.object({
    max_seats_per_request: z.number().int().positive(),
    max_advance_days: z.number().int().positive(),
    start_window_minutes: z.number().int().nonnegative(),
    rating_window_days: z.number().int().positive(),
  }),
  location: z.object({
    min_interval_seconds: z.number().positive(),
    min_distance_m: z.number().nonnegative(),
    poor_accuracy_m: z.number().positive(),
  }),
  features: z.object({ intercity: z.boolean(), recurring: z.boolean(), expressway: z.boolean() }),
  map: z.object({ default_center: latLng, default_zoom: z.number() }),
  support: z.object({
    email: z.string().nullable(),
    terms_url: z.string().nullable(),
    privacy_url: z.string().nullable(),
  }),
  corridors: z.array(z.object({ key: z.string(), name: z.string() })),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export function parseAppConfig(rows: { key: string; value: unknown }[]): AppConfig {
  const obj = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return appConfigSchema.parse(obj);
}
