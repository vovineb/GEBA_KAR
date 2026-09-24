import { formatDay, formatDistance, formatDuration, formatMoney, formatTime, formatWeekdays } from '@/lib/format';
import { haversineMeters, nearest } from '@/lib/geo';
import { toDateString, todayIn, toTimeString, zonedTimestamp } from '@/lib/time';

const TZ = 'Africa/Nairobi';

describe('time helpers', () => {
  it('builds a Postgres literal in the service time zone from the picked wall-clock values', () => {
    const date = new Date(2026, 9, 1, 0, 0); // 1 Oct 2026 (device local)
    const time = new Date(2026, 0, 1, 7, 5);
    expect(toDateString(date)).toBe('2026-10-01');
    expect(toTimeString(time)).toBe('07:05:00');
    expect(zonedTimestamp(date, time, TZ)).toBe('2026-10-01 07:05:00 Africa/Nairobi');
  });
  it('computes today in Nairobi independent of UTC date', () => {
    expect(todayIn(TZ, new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02');
  });
});

describe('formatting', () => {
  it('formats times in Nairobi time', () => {
    expect(formatTime('2026-10-01T04:00:00Z', TZ)).toBe('07:00');
  });
  it('labels today and tomorrow', () => {
    const now = new Date('2026-10-01T05:00:00Z');
    expect(formatDay('2026-10-01T15:00:00Z', TZ, now)).toBe('Today');
    expect(formatDay('2026-10-02T04:00:00Z', TZ, now)).toBe('Tomorrow');
  });
  it('formats money, distance and duration', () => {
    expect(formatMoney(120, 'KES')).toBe('KES 120');
    expect(formatMoney(null, 'KES')).toBeNull();
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(31_400)).toBe('31 km');
    expect(formatDuration(3000)).toBe('50 min');
    expect(formatDuration(5400)).toBe('1 h 30 min');
  });
  it('summarises weekday schedules', () => {
    expect(formatWeekdays([1, 2, 3, 4, 5])).toBe('Mon–Fri');
    expect(formatWeekdays([6, 1])).toBe('Mon, Sat');
  });
});

describe('geo helpers', () => {
  it('measures great-circle distance', () => {
    const d = haversineMeters({ lat: -1.2856, lng: 36.8254 }, { lat: -1.2986, lng: 36.8163 });
    expect(d).toBeGreaterThan(1500);
    expect(d).toBeLessThan(1900);
  });
  it('ranks nearest points within a radius', () => {
    const pts = [
      { id: 'far', lat: -1.0, lng: 36.0 },
      { id: 'near', lat: -1.29, lng: 36.82 },
    ];
    expect(nearest(pts, { lat: -1.2856, lng: 36.8254 }, 5000, 5).map((p) => p.id)).toEqual(['near']);
  });
});
