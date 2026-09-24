import { todayIn } from '@/lib/time';

const LOCALE = 'en-KE';

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  );
}

/** "Today", "Tomorrow" or "Fri 20 Dec". */
export function formatDay(iso: string, timeZone: string, now = new Date()): string {
  const day = todayIn(timeZone, new Date(iso));
  if (day === todayIn(timeZone, now)) return 'Today';
  if (day === todayIn(timeZone, new Date(now.getTime() + 86_400_000))) return 'Tomorrow';
  if (day === todayIn(timeZone, new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return new Intl.DateTimeFormat(LOCALE, { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string, timeZone: string): string {
  return `${formatDay(iso, timeZone)}, ${formatTime(iso, timeZone)}`;
}

export function formatMoney(amount: number | null | undefined, currency: string): string | null {
  if (amount == null) return null;
  return `${currency} ${Math.round(Number(amount)).toLocaleString(LOCALE)}`;
}

export function formatDistance(m: number | null | undefined): string | null {
  if (m == null) return null;
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export function formatDuration(s: number | null | undefined): string | null {
  if (s == null) return null;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatRelative(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86_400)}d`;
}

/** Human "time ago": "just now", "5 min ago", "3 h ago", "2 d ago". */
export function formatAgo(iso: string, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

/** Chat/inbox timestamp: time for today, otherwise day + time. */
export function formatMessageTime(iso: string, timeZone: string, now = new Date()): string {
  const day = formatDay(iso, timeZone, now);
  return day === 'Today' ? formatTime(iso, timeZone) : `${day} ${formatTime(iso, timeZone)}`;
}

export const WEEKDAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 7, short: 'Sun' },
] as const;

export function formatWeekdays(days: number[]): string {
  const sorted = [...days].sort();
  if (sorted.join() === '1,2,3,4,5') return 'Mon–Fri';
  if (sorted.length === 7) return 'Every day';
  return sorted.map((d) => WEEKDAYS[d - 1]?.short).join(', ');
}
