import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChosenLocation, ExpresswayOption, TripType } from '@/types/domain';

/** Serializable search request passed from Home to the results screen. */
export type SearchQuery = {
  from: ChosenLocation | null;
  to: ChosenLocation | null;
  date: string | null; // YYYY-MM-DD (service time zone)
  time: string | null; // HH:MM:SS
  seats: number;
  tripType: TripType | null;
  expressway: ExpresswayOption;
  recurringOnly: boolean;
};

export const encodeQuery = (q: SearchQuery) => JSON.stringify(q);
export function decodeQuery(raw: string | undefined): SearchQuery | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SearchQuery;
  } catch {
    return null;
  }
}

const RECENT_KEY = 'cass.recentSearches.v1';
export type RecentSearch = { from: ChosenLocation; to: ChosenLocation };

export async function loadRecentSearches(): Promise<RecentSearch[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) ?? '[]') as RecentSearch[];
  } catch {
    return [];
  }
}

export async function saveRecentSearch(s: RecentSearch) {
  const list = (await loadRecentSearches()).filter((r) => !(r.from.name === s.from.name && r.to.name === s.to.name));
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify([s, ...list].slice(0, 5)));
}
