import { ensureOk, toAppError, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Profile, PublicProfile } from '@/types/domain';

const PUBLIC_COLUMNS = 'id, full_name, avatar_path, bio, rating_average, rating_count, completed_trips_count, created_at';

export async function getMyProfile(): Promise<Profile> {
  const res = await supabase.rpc('get_my_profile');
  const profile = unwrap(res);
  if (!profile?.id) throw toAppError({ message: 'not_authenticated' });
  return profile;
}

export async function updateMyProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'full_name' | 'phone_number' | 'bio' | 'avatar_path'>>,
) {
  ensureOk(await supabase.from('profiles').update(patch).eq('id', userId));
}

export async function getPublicProfile(userId: string) {
  const [profile, ratings, vehicles] = await Promise.all([
    supabase.from('profiles').select(PUBLIC_COLUMNS).eq('id', userId).single(),
    supabase
      .from('ratings')
      .select('id, stars, comment, created_at, rater:profiles!ratings_rater_id_fkey(id, full_name, avatar_path)')
      .eq('ratee_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('vehicles')
      .select('id, make, model, colour, year, photo_path')
      .eq('owner_id', userId)
      .eq('status', 'active'),
  ]);
  return {
    profile: unwrap(profile) as PublicProfile,
    ratings: unwrap(ratings),
    vehicles: unwrap(vehicles),
  };
}
