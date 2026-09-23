import { ensureOk, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { ReportReason } from '@/types/domain';

export async function submitReport(input: {
  reporterId: string;
  reportedUserId: string | null;
  tripId: string | null;
  reason: ReportReason;
  details: string | null;
}) {
  ensureOk(
    await supabase.from('reports').insert({
      reporter_id: input.reporterId,
      reported_user_id: input.reportedUserId,
      trip_id: input.tripId,
      reason: input.reason,
      details: input.details,
    }),
  );
}

export async function blockUser(blockerId: string, blockedId: string) {
  const res = await supabase.from('user_blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (res.error?.code === '23505') return; // already blocked
  ensureOk(res);
}

export async function unblockUser(blockerId: string, blockedId: string) {
  ensureOk(await supabase.from('user_blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId));
}

export async function listBlockedUsers() {
  return unwrap(await supabase.rpc('list_blocked_users'));
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const rows = unwrap(
    await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', blockerId).eq('blocked_id', blockedId),
  );
  return rows.length > 0;
}
