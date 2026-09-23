import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

function pickKey(dictVar: string, legacyVar: string): string {
  const dict = Deno.env.get(dictVar);
  if (dict) {
    const parsed = JSON.parse(dict) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  const legacy = Deno.env.get(legacyVar);
  if (!legacy) throw new Error(`Missing ${dictVar}/${legacyVar}`);
  return legacy;
}

/** Service-role client. Bypasses RLS: only use for narrowly scoped server work. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client acting as the calling user (RLS applies). */
export function userClient(authorization: string): SupabaseClient {
  return createClient(SUPABASE_URL, pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/** Verifies the caller's access token with Supabase Auth. */
export async function requireUser(req: Request): Promise<{ user: User; authorization: string }> {
  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'not_authenticated');
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'not_authenticated');
  return { user: data.user, authorization };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code }, e.status);
      console.error(e);
      return json({ error: 'server_error' }, 500);
    }
  };
}
