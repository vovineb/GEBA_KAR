/**
 * All user-entered dates/times are interpreted in the configured service
 * time zone (configuration.timezone), independent of the phone's setting.
 * Postgres parses "YYYY-MM-DD HH:MM:SS Area/City" directly.
 */
const pad = (n: number) => String(n).padStart(2, '0');

/** Calendar date the user picked on the device, as YYYY-MM-DD. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Clock time the user picked on the device, as HH:MM:00. */
export function toTimeString(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** Timestamp literal Postgres interprets in the service time zone. */
export function zonedTimestamp(date: Date, time: Date, timeZone: string): string {
  return `${toDateString(date)} ${toTimeString(time)} ${timeZone}`;
}

/** Today's date (YYYY-MM-DD) in the service time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
