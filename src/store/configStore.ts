import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { appConfigSchema, type AppConfig } from '@/config/appConfig';
import { toAppError, type AppError } from '@/lib/errors';
import { fetchAppConfig } from '@/services/configService';

const CACHE_KEY = 'cass.config.v1';

type ConfigState = {
  config: AppConfig | null;
  error: AppError | null;
  load: () => Promise<void>;
};

/**
 * Central runtime configuration from the `configuration` table, cached so
 * the app can render when the network is slow at launch.
 */
export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  error: null,
  load: async () => {
    if (!get().config) {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        const parsed = cached ? appConfigSchema.safeParse(JSON.parse(cached)) : null;
        if (parsed?.success) set({ config: parsed.data });
      } catch {
        // ignore a corrupt cache
      }
    }
    try {
      const config = await fetchAppConfig();
      set({ config, error: null });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(config));
    } catch (e) {
      set({ error: toAppError(e) });
    }
  },
}));

/** Use inside screens rendered after the config gate (config is guaranteed). */
export function useAppConfig(): AppConfig {
  const config = useConfigStore((s) => s.config);
  if (!config) throw new Error('App configuration accessed before it loaded');
  return config;
}
