import { create } from 'zustand';

import { getUnreadCounts } from '@/services/notificationService';

type BadgeState = { messages: number; notifications: number; refresh: () => Promise<void> };

export const useBadgeStore = create<BadgeState>((set) => ({
  messages: 0,
  notifications: 0,
  refresh: async () => {
    try {
      set(await getUnreadCounts());
    } catch {
      // badges are best effort
    }
  },
}));
