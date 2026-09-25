import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

/** Which auth screen to open after a guest chooses to sign up or sign in. */
export type AuthIntent = 'sign-in' | 'sign-up' | null;

type AuthState = {
  session: Session | null;
  authIntent: AuthIntent;
  setAuthIntent: (v: AuthIntent) => void;
  initialized: boolean;
  /** True while the user is in the password-recovery flow (signed in via code). */
  recovering: boolean;
  setRecovering: (v: boolean) => void;
  init: () => () => void;
};

/** Global auth state. Supabase Auth is the source of truth; this mirrors it for routing. */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  recovering: false,
  authIntent: null,
  setAuthIntent: (authIntent) => set({ authIntent }),
  setRecovering: (recovering) => set({ recovering }),
  init: () => {
    supabase.auth
      .getSession()
      .then(({ data }) => set({ session: data.session, initialized: true }))
      .catch(() => set({ session: null, initialized: true }));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      set({ session, initialized: true });
      if (event === 'SIGNED_OUT') set({ recovering: false });
    });
    return () => data.subscription.unsubscribe();
  },
}));

export const useUserId = () => useAuthStore((s) => s.session?.user.id ?? null);

/** True while browsing as a guest (anonymous session, no account). */
export const useIsGuest = () => useAuthStore((s) => !!s.session?.user.is_anonymous);
