import { ensureOk } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export async function submitRating(input: {
  tripId: string;
  raterId: string;
  rateeId: string;
  stars: number;
  comment: string | null;
}) {
  ensureOk(
    await supabase.from('ratings').insert({
      trip_id: input.tripId,
      rater_id: input.raterId,
      ratee_id: input.rateeId,
      stars: input.stars,
      comment: input.comment,
    }),
  );
}
