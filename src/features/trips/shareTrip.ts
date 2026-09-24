import { Share } from 'react-native';

import { formatDateTime, formatTime } from '@/lib/format';
import type { TripDetail } from '@/types/domain';

/**
 * Shares trip details (who, vehicle, route, time) with someone the user
 * trusts, using the phone's share sheet. This is not an emergency service.
 */
export async function shareTrip(t: TripDetail, timeZone: string) {
  const v = t.vehicle;
  const lines = [
    `My CASS trip: ${t.origin_name} → ${t.destination_name}`,
    `Departure: ${formatDateTime(t.departure_time, timeZone)}` +
      (t.estimated_arrival ? ` · expected arrival ~${formatTime(t.estimated_arrival, timeZone)}` : ''),
    `Travelling with: ${t.creator.full_name}`,
    `Vehicle: ${[v.colour, v.make, v.model].filter(Boolean).join(' ')}${v.registration_number ? ` (${v.registration_number})` : ''}`,
    t.pickup_point ? `Pickup: ${t.pickup_point.name}` : null,
    t.status === 'in_progress' ? 'Status: on the road now' : null,
  ].filter(Boolean);
  await Share.share({ message: lines.join('\n') });
}
