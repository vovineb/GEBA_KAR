import { create } from 'zustand';

import { getMyProfile } from '@/services/profileService';
import type { Profile } from '@/types/domain';

type ProfileState = {
  /** The signed-in member's own profile (null for guests or before loading). */
  profile: Profile | null;
  load: () => Promise<Profile | null>;
  clear: () => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  load: async () => {
    try {
      const profile = await getMyProfile();
      set({ profile });
      return profile;
    } catch {
      return null;
    }
  },
  clear: () => set({ profile: null }),
}));

export const useMyGender = () => useProfileStore((s) => s.profile?.gender ?? null);
