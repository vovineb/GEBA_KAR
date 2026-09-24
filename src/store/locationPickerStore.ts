import { create } from 'zustand';

import type { ChosenLocation } from '@/types/domain';

/**
 * Hand-off between a form and the location-picker modal: the form opens the
 * picker with a request key, the picker stores the chosen place under that
 * key, and the form consumes it on focus.
 */
type PickerState = {
  results: Record<string, ChosenLocation | undefined>;
  setResult: (key: string, loc: ChosenLocation) => void;
  take: (key: string) => ChosenLocation | undefined;
};

export const useLocationPickerStore = create<PickerState>((set, get) => ({
  results: {},
  setResult: (key, loc) => set((s) => ({ results: { ...s.results, [key]: loc } })),
  take: (key) => {
    const loc = get().results[key];
    if (loc) set((s) => ({ results: { ...s.results, [key]: undefined } }));
    return loc;
  },
}));
