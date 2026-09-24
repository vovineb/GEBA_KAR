import type { BadgeTone } from '@/components/ui';
import { Constants } from '@/types/database';
import type {
  ExpresswayOption,
  LuggagePolicy,
  ReportReason,
  RequestStatus,
  TripStatus,
  TripType,
} from '@/types/domain';

// Human-readable labels for database enums. Option lists are derived from
// the generated enum constants so they always match the schema.

const E = Constants.public.Enums;

export const tripTypeLabel: Record<TripType, string> = { commute: 'Commute', intercity: 'Intercity' };
export const tripTypeOptions = E.trip_type.map((v) => ({ value: v, label: tripTypeLabel[v] }));

export const expresswayLabel: Record<ExpresswayOption, string> = {
  use: 'Expressway',
  avoid: 'Avoid expressway',
  either: 'Either route',
};
export const expresswayOptions = E.expressway_option.map((v) => ({
  value: v,
  label: { use: 'Use', avoid: 'Avoid', either: 'Either' }[v],
}));

export const luggageLabel: Record<LuggagePolicy, string> = {
  none: 'No luggage',
  small: 'Small bag',
  medium: 'Medium bag',
  large: 'Large luggage OK',
};
export const luggageOptions = E.luggage_policy.map((v) => ({ value: v, label: luggageLabel[v] }));

export const tripStatusBadge: Record<TripStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  open: { label: 'Open', tone: 'success' },
  full: { label: 'Full', tone: 'warning' },
  in_progress: { label: 'LIVE', tone: 'live' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
};

export const requestStatusBadge: Record<RequestStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Request pending', tone: 'info' },
  accepted: { label: 'Seat confirmed', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
};

export const reportReasonLabel: Record<ReportReason, string> = {
  unsafe_driving: 'Unsafe driving',
  harassment: 'Harassment or threats',
  no_show: 'Did not show up',
  inappropriate_behaviour: 'Inappropriate behaviour',
  fraud: 'Scam or fraud',
  vehicle_mismatch: 'Vehicle did not match',
  other: 'Something else',
};
export const reportReasonOptions = E.report_reason.map((v) => ({ value: v, label: reportReasonLabel[v] }));
