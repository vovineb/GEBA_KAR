// Permanently deletes the caller's account: cancels their future trips and
// seats (notifying other travellers), removes their uploaded images and
// deletes the auth user (profile data cascades).
import { adminClient, handle, HttpError, json, requireUser, userClient } from '../_shared/supabase.ts';

const BUCKETS = ['avatars', 'vehicle-photos'];

Deno.serve(handle(async (req) => {
  const { user, authorization } = await requireUser(req);

  const { error: prepError } = await userClient(authorization).rpc('prepare_account_deletion');
  if (prepError) {
    throw new HttpError(
      409,
      prepError.message === 'active_trip_in_progress' ? prepError.message : 'deletion_failed',
    );
  }

  const admin = adminClient();
  for (const bucket of BUCKETS) {
    const { data: files } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (files?.length) {
      await admin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('deleteUser failed', error);
    throw new HttpError(500, 'deletion_failed');
  }
  return json({ deleted: true });
}));
