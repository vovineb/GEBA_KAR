import type { TripDetail } from '@/types/domain';

/**
 * The primary action on the trip page, derived purely from database state
 * returned by get_trip_detail. Kept pure so it can be unit-tested.
 */
export type PrimaryAction =
  | { kind: 'request' }
  | { kind: 'pending' }
  | { kind: 'confirmed' }
  | { kind: 'live' }
  | { kind: 'rate' }
  | { kind: 'full' }
  | { kind: 'cancelled' }
  | { kind: 'declined' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'manage'; pending: number; canStart: boolean; startsAt: Date }
  | { kind: 'done' };

/** Other people who completed the trip with me and whom I have not rated yet. */
export function peopleToRate(t: TripDetail, userId: string) {
  if (t.my_membership?.status !== 'completed') return [];
  return t.members.filter((m) => m.user_id !== userId && m.status === 'completed' && !m.rated_by_me);
}

export function primaryAction(t: TripDetail, userId: string, now: Date, startWindowMinutes: number): PrimaryAction {
  if (t.status === 'cancelled') return { kind: 'cancelled' };

  if (t.is_creator) {
    if (t.status === 'open' || t.status === 'full' || t.status === 'draft') {
      const startsAt = new Date(new Date(t.departure_time).getTime() - startWindowMinutes * 60_000);
      return { kind: 'manage', pending: t.pending_request_count ?? 0, canStart: now >= startsAt, startsAt };
    }
    if (t.status === 'in_progress') return { kind: 'live' };
    if (t.status === 'completed') return peopleToRate(t, userId).length ? { kind: 'rate' } : { kind: 'done' };
    return { kind: 'unavailable', reason: 'This trip expired without starting.' };
  }

  const membership = t.my_membership;
  if (membership && (membership.status === 'confirmed' || membership.status === 'completed')) {
    if (t.status === 'in_progress') return { kind: 'live' };
    if (t.status === 'completed') return peopleToRate(t, userId).length ? { kind: 'rate' } : { kind: 'done' };
    if (t.status === 'expired') return { kind: 'unavailable', reason: 'This trip expired without starting.' };
    return { kind: 'confirmed' };
  }
  if (t.is_blocked) return { kind: 'unavailable', reason: 'You cannot join this trip.' };
  if (t.my_request?.status === 'pending') return { kind: 'pending' };
  if (t.status === 'full') return { kind: 'full' };
  if (t.status !== 'open' || new Date(t.departure_time) <= now) {
    return { kind: 'unavailable', reason: 'This trip is no longer taking requests.' };
  }
  if (t.my_request?.status === 'declined') return { kind: 'declined' };
  return { kind: 'request' };
}
