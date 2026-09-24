import { z } from 'zod';

/**
 * Public, client-safe configuration from `.env` (EXPO_PUBLIC_* values are
 * inlined at build time). Anything secret belongs in Supabase Edge Function
 * secrets, never here.
 */
const schema = z.object({
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(20),
  mapStyleUrl: z.url().optional(),
});

export type Env = z.infer<typeof schema>;

const raw = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  mapStyleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL || undefined,
};

const parsed = schema.safeParse(raw);

/** Missing/invalid keys, reported on the configuration error screen. */
export const envProblems: string[] = parsed.success
  ? []
  : parsed.error.issues.map((i) => {
      const key = String(i.path[0]);
      const name = {
        supabaseUrl: 'EXPO_PUBLIC_SUPABASE_URL',
        supabasePublishableKey: 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        mapStyleUrl: 'EXPO_PUBLIC_MAP_STYLE_URL',
      }[key] ?? key;
      return `${name}: ${i.message}`;
    });

export const env: Env = parsed.success
  ? parsed.data
  : { supabaseUrl: 'https://invalid.local', supabasePublishableKey: 'invalid-key-placeholder', mapStyleUrl: undefined };

export const isEnvValid = parsed.success;
