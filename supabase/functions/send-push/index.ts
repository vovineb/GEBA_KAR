// Delivers one stored notification to the recipient's devices through the
// Expo Push Service. Invoked by the notifications_dispatch_push database
// trigger (pg_net) with a shared secret that lives only in Supabase Vault;
// not callable by app users.
import { adminClient, handle, HttpError, json } from '../_shared/supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(handle(async (req) => {
  const db = adminClient();
  const { data: authorized } = await db.rpc('verify_push_webhook_secret', {
    p_secret: req.headers.get('x-cass-webhook-secret') ?? '',
  });
  if (authorized !== true) throw new HttpError(401, 'unauthorized');
  const { notification_id } = await req.json();

  const { data: n, error } = await db
    .from('notifications')
    .select('id, user_id, type, title, body, related_trip_id, data')
    .eq('id', notification_id)
    .single();
  if (error || !n) throw new HttpError(404, 'notification_not_found');

  const { data: tokens } = await db.from('push_tokens').select('token').eq('user_id', n.user_id);
  if (!tokens?.length) return json({ sent: 0 });

  const messages = tokens.map(({ token }) => ({
    to: token,
    title: n.title,
    body: n.body,
    sound: 'default',
    channelId: 'default',
    data: { notification_id: n.id, type: n.type, trip_id: n.related_trip_id, ...n.data },
  }));

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error('Expo push error', res.status, await res.text());
    throw new HttpError(502, 'push_upstream_error');
  }
  const { data: tickets } = await res.json();

  // Remove tokens for uninstalled apps / revoked permissions.
  // deno-lint-ignore no-explicit-any
  const dead = (tickets ?? []).map((t: any, i: number) =>
    t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null
  ).filter(Boolean);
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);

  return json({ sent: tokens.length - dead.length });
}));
