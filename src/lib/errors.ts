/**
 * Maps technical errors (PostgREST/RPC codes, Auth, network) to messages a
 * normal user can act on. Raw database errors are never shown; details go to
 * the dev log.
 */
const RPC_MESSAGES: Record<string, string> = {
  not_authenticated: 'Your session has expired. Please sign in again.',
  vehicle_invalid: 'Choose one of your active vehicles.',
  seats_exceed_vehicle_capacity: 'That is more seats than your vehicle has (excluding your own).',
  seats_below_reserved: 'You cannot offer fewer seats than are already booked.',
  pickup_point_invalid: 'That pickup point is no longer available.',
  contribution_too_high: 'That contribution is well above the suggested range for this distance.',
  departure_in_past: 'Choose a departure time in the future.',
  invalid_trip_status: 'This trip cannot be created in that state.',
  invalid_trip_transition: 'This trip can no longer be changed that way.',
  trip_immutable_field: 'That detail cannot be changed after posting.',
  not_trip_creator: 'Only the trip creator can do that.',
  too_early_to_start: 'It is too early to start this trip.',
  trip_not_found: 'This trip is no longer available.',
  own_trip: 'This is your own trip.',
  blocked: 'You cannot interact with this person.',
  trip_full: 'This trip is full.',
  trip_not_open: 'This trip is no longer taking requests.',
  invalid_seat_count: 'Choose a valid number of seats.',
  not_enough_seats: 'There are not enough free seats left.',
  already_member: 'You already have a seat on this trip.',
  request_exists: 'You already requested a seat on this trip.',
  request_not_found: 'That request no longer exists.',
  request_not_pending: 'That request has already been answered.',
  request_not_active: 'That request is no longer active.',
  invalid_request_transition: 'That request can no longer be changed.',
  no_show_too_early: 'You can report a no-show after the departure time.',
  not_a_participant: 'Only people on this trip can do that.',
  trip_already_started: 'The trip has already started.',
  invalid_recurring_transition: 'A cancelled schedule cannot be restarted. Create a new one.',
  trip_not_active: 'The trip is not in progress.',
  not_conversation_member: 'You are no longer part of this conversation.',
  trip_not_completed: 'You can rate after the trip is completed.',
  rating_window_closed: 'The rating period for this trip has ended.',
  active_trip_in_progress: 'Finish or end your active trip before deleting your account.',
  // Edge functions
  geo_not_configured: 'Location search is not set up yet (routing API key missing on the server).',
  geo_rate_limited: 'Location search is busy. Try again in a moment.',
  geo_upstream_error: 'Location service is unavailable right now.',
  route_not_found: 'No driving route was found between those places.',
  deletion_failed: 'We could not delete your account. Please try again.',
};

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  email_not_confirmed: 'Confirm your email first. Check your inbox for the code.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  weak_password: 'Choose a stronger password (at least 8 characters).',
  over_email_send_rate_limit: 'Too many emails sent. Wait a minute and try again.',
  over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
  otp_expired: 'That code has expired or is incorrect. Request a new one.',
  same_password: 'Choose a password different from your current one.',
  session_not_found: 'Your session has expired. Please sign in again.',
};

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: unknown,
  ) {
    super(message);
  }
}

type Errorish = { message?: string; code?: string; status?: number; hint?: string; name?: string };

export function toAppError(e: unknown, fallback = 'Something went wrong. Please try again.'): AppError {
  if (e instanceof AppError) return e;
  const err = (e ?? {}) as Errorish;
  const message = err.message ?? '';
  if (__DEV__ && process.env.NODE_ENV !== 'test') console.warn('[CASS error]', e);

  const rpcMessage = message ? RPC_MESSAGES[message] : undefined;
  if (rpcMessage) return new AppError(rpcMessage, message, e);
  const authMessage = err.code ? AUTH_MESSAGES[err.code] : undefined;
  if (authMessage && err.code) return new AppError(authMessage, err.code, e);
  if (err.code === 'PGRST301' || err.status === 401 || /JWT/i.test(message)) {
    return new AppError('Your session has expired. Please sign in again.', 'not_authenticated', e);
  }
  if (err.code === '42501') return new AppError('You are not allowed to do that.', 'forbidden', e);
  if (/Network request failed|Failed to fetch|fetch failed|timeout|AbortError/i.test(message) || err.name === 'AbortError') {
    return new AppError('Network problem. Check your connection and try again.', 'network', e);
  }
  if (err.code === '23505') return new AppError('That already exists.', 'duplicate', e);
  return new AppError(fallback, err.code ?? 'unknown', e);
}

/** Returns the data of a Supabase read, throwing a friendly AppError on failure. */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw toAppError(res.error);
  if (res.data == null) throw new AppError('Nothing was returned. Please try again.', 'empty_response');
  return res.data;
}

/** For writes/void RPCs: throws a friendly AppError if the call failed. */
export function ensureOk(res: { error: unknown }): void {
  if (res.error) throw toAppError(res.error);
}
