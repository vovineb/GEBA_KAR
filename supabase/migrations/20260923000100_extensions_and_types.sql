-- CASS: extensions and controlled vocabularies (enums).
-- Every status/type used by the app is defined here once; the app mirrors
-- these through generated types in src/types/database.ts.

create extension if not exists postgis with schema extensions;

create type public.trip_type as enum ('commute', 'intercity');

create type public.trip_status as enum (
  'draft', 'open', 'full', 'in_progress', 'completed', 'cancelled', 'expired'
);

create type public.request_status as enum (
  'pending', 'accepted', 'declined', 'cancelled', 'expired'
);

create type public.member_role as enum ('creator', 'passenger');

create type public.member_status as enum (
  'confirmed', 'completed', 'cancelled', 'no_show'
);

create type public.expressway_option as enum ('use', 'avoid', 'either');

create type public.luggage_policy as enum ('none', 'small', 'medium', 'large');

create type public.recurring_status as enum ('active', 'paused', 'cancelled');

create type public.vehicle_status as enum ('active', 'inactive');

create type public.place_kind as enum ('estate', 'neighbourhood', 'town', 'landmark');

create type public.conversation_kind as enum ('direct', 'trip_group');

create type public.notification_type as enum (
  'seat_request_received',
  'request_accepted',
  'request_declined',
  'request_cancelled',
  'participant_joined',
  'participant_left',
  'trip_reminder',
  'trip_starting',
  'trip_completed',
  'trip_cancelled',
  'new_message',
  'safety_alert'
);

create type public.report_reason as enum (
  'unsafe_driving', 'harassment', 'no_show', 'inappropriate_behaviour',
  'fraud', 'vehicle_mismatch', 'other'
);

create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

-- Factual trip events recorded for the (future) reliability system.
create type public.incident_kind as enum (
  'passenger_no_show', 'creator_no_show', 'cancellation', 'late_cancellation'
);

create type public.analytics_event as enum (
  'account_created',
  'trip_created',
  'trip_search',
  'trip_request',
  'trip_request_accepted',
  'trip_request_declined',
  'trip_started',
  'trip_completed',
  'trip_cancelled',
  'rating_submitted',
  'message_sent'
);
