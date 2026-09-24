# CASS — shared travel for people already going your way

CASS connects people who are **already travelling in the same direction** so they can share empty seats and split
the travel cost. It is not taxi-hailing, not a PSV dispatch system and it never charges fares: trips show an optional
*suggested trip contribution* that travellers agree between themselves.

One account does everything: the same user can create trips (as the traveller with the car) and join other people’s
trips. The data model is **USER → TRIP → PARTICIPANTS**, not driver/passenger accounts.

The first pilot is the **Greatwall Gardens / Crystal Rivers ⇄ Nairobi** corridor (Athi River / Mombasa Road). All
places, pickup points, contribution references, matching radii and rules are database configuration, so new estates,
corridors and intercity routes are added with data, not code.

---

## Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [What you need to create (credentials)](#what-you-need-to-create-credentials)
4. [Installation](#installation)
5. [Environment variables](#environment-variables)
6. [Supabase setup](#supabase-setup)
7. [Maps, geocoding and routing](#maps-geocoding-and-routing)
8. [Push notifications](#push-notifications)
9. [Pilot locations](#pilot-locations)
10. [Running the app (development build)](#running-the-app-development-build)
11. [Testing](#testing)
12. [Building Android](#building-android)
13. [Production and deployment](#production-and-deployment)
14. [Configuration reference](#configuration-reference)
15. [Security model](#security-model)
16. [Troubleshooting](#troubleshooting)
17. [Known platform limitations](#known-platform-limitations)
18. [Future expansion](#future-expansion)

---

## Architecture

| Layer | Technology |
| --- | --- |
| Mobile app | React Native 0.86, Expo SDK 57, TypeScript (strict), Expo Router |
| State / forms | Zustand (auth, config, badges, picker hand-off only), React Hook Form + Zod |
| Maps | MapLibre React Native 11 with a production tile provider (configurable style URL) |
| Location | Expo Location + Task Manager (foreground service while a trip is live) |
| Backend | Supabase: Postgres 17 + PostGIS, Auth, Realtime, Storage, Edge Functions, pg_cron, pg_net, Vault |
| Push | Expo Notifications → Expo Push Service (sent server-side by an Edge Function) |

```
src/
  app/            Expo Router screens: (auth) sign-in/up/verify/reset, (app) tabs + trip/chat/profile/settings
  components/     ui/ (design system), form/ (location, date/time, stepper, chips), map/ (MapLibre wrappers)
  config/         env.ts (public .env values, validated) and appConfig.ts (typed view of the configuration table)
  features/       auth, location (permissions + tracking task), notifications, search, trips (actions, lifecycle, map)
  hooks/          useAsync, useAction (double-tap safe mutations), useIsOnline, useDebounced
  lib/            supabase client, encrypted session storage, errors, formatting, time zone helpers
  services/       the only place that talks to Supabase: trips, chat, profile, vehicles, geo, storage, safety…
  store/          zustand stores
  theme/          design tokens
  types/          database.ts (generated from the schema) and domain.ts
supabase/
  migrations/     schema, business rules, RLS, storage, realtime, cron, pilot configuration
  functions/      geo (geocoding/routing proxy), send-push, delete-account
  tests/database/ pgTAP tests of the full trip loop and security rules
scripts/          test-db.sh — runs migrations + pgTAP tests on a plain local PostgreSQL/PostGIS
```

**Where the rules live.** The database enforces everything that matters: seat reservation with row locks (no
overbooking), the trip and request state machines, who may see what (RLS and column privileges), rating eligibility,
blocking, location visibility and retention. Client-callable changes go through `SECURITY DEFINER` RPCs
(`create_trip`, `request_seat`, `respond_to_request`, `start_trip`, `complete_trip`, …). The app never writes
status, seat counts or ratings directly.

**Main flow → RPCs**

| Step | Call |
| --- | --- |
| Find / match | `search_trips` — PostGIS: origin/destination radius *or* distance to the trip’s route, direction along the route, time tolerance, seats, type, expressway, recurring, blocks |
| Request | `request_seat` (creates the creator↔passenger conversation, notifies the creator) |
| Accept / decline | `respond_to_request` (locks the trip row, reserves seats, adds participant, notifies) |
| Communicate | `messages` table + Realtime |
| Travel | `start_trip`, `update_live_location` (throttled), `complete_trip` (deletes live locations) |
| Rate | insert into `ratings` (validated by trigger; averages recomputed server-side) |

Scheduled job (`pg_cron`, every 5 minutes): expires stale trips/requests, auto-completes forgotten active trips (which
stops location sharing), sends departure reminders and generates the next few days of recurring commute trips.

---

## Prerequisites

- Node.js 20 or 22 and npm
- Git
- A Supabase account (free tier is enough for the pilot)
- An Expo account (free) for EAS Build and push notifications
- An **Android phone** (Android 8+) for testing. Expo Go is **not** sufficient: MapLibre and background location
  need native code, so you install a *development build* (see below).
- Optional for local native builds: Android Studio (SDK + platform tools, JDK 17)
- Optional for local Supabase: Docker Desktop (then `npx supabase start`)

The Supabase CLI and EAS CLI run through `npx`; no global install is needed.

---

## What you need to create (credentials)

| # | Service | What to create | Value you get | Where it goes | Safe in the app? |
| --- | --- | --- | --- | --- | --- |
| 1 | [Supabase](https://supabase.com/dashboard) | A project | Project URL, **Publishable key** (`sb_publishable_…`, or legacy `anon` key) | `.env` | Yes (RLS protects data) |
| 2 | Supabase | (same project) | **Secret key** / `service_role` key, database password | **Nowhere in the app.** Only the Supabase dashboard/CLI. Edge Functions receive it automatically. | **Never** |
| 3 | [OpenRouteService](https://openrouteservice.org/dev/#/signup) | Free account → *Dashboard* → create a token (Standard plan) | API key | Supabase **Vault** secret `cass_ors_api_key` (SQL below) | No — server only |
| 4 | [MapTiler](https://cloud.maptiler.com/account/keys/) (or another MapLibre-compatible tile provider) | Account → API key; pick a map (e.g. *Streets v2*) | Style URL `https://api.maptiler.com/maps/streets-v2/style.json?key=…` | `.env` `EXPO_PUBLIC_MAP_STYLE_URL` | Yes (tile keys are public by design; restrict it in the MapTiler dashboard) |
| 5 | [Expo](https://expo.dev/signup) | Account, then `npx eas-cli init` in this folder | EAS project ID (UUID) | `.env` `EAS_PROJECT_ID` | Yes |
| 6 | [Firebase](https://console.firebase.google.com/) (for Android push) | Project → add Android app with package `app.cass.mobile` → download `google-services.json`; *Project settings → Service accounts → Generate new private key* | `google-services.json` (project root) and a service-account JSON | `google-services.json` in the project root (git-ignored). Service-account JSON: upload with `npx eas-cli credentials` → Android → *Google Service Account Key for FCM V1*. **Do not** commit it or put it in `.env`. | `google-services.json`: yes. Service account: **never** |
| 7 | Generated inside the database (SQL below) | — | Push webhook secret | Supabase **Vault** secret `cass_push_webhook_secret` — never leaves the database | No — server only |
| 8 | An SMTP provider (recommended before inviting pilot users) | e.g. Resend, Brevo, Mailgun | SMTP host/user/password | Supabase *Authentication → Emails → SMTP settings* | No — server only |

Billing notes: all of the above have free tiers suitable for a pilot. Check each provider’s current free-tier limits
and terms (MapTiler and OpenRouteService limit requests per month/day). Nothing in CASS turns on paid features.

If you accidentally paste a secret into chat, a commit or `.env`: rotate it immediately (Supabase *Settings → API
Keys → roll*, OpenRouteService dashboard → delete/recreate token, Firebase → delete the service-account key).

---

## Installation

```bash
git clone https://github.com/vovineb/GEBA_KAR.git
cd GEBA_KAR
npm install
cp .env.example .env      # then fill it in (next section)
```

---

## Environment variables

There is one environment file: **`.env`** (git-ignored). `.env.example` documents it.

| Variable | Required | Bundled into the app | Purpose |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | yes | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | yes | Supabase publishable (or legacy anon) key |
| `EXPO_PUBLIC_MAP_STYLE_URL` | for maps | yes | MapLibre style JSON URL incl. the provider’s public key |
| `EAS_PROJECT_ID` | for push | build-time only | Expo project ID used for push tokens |
| `APP_NAME`, `APP_ID`, `GOOGLE_SERVICES_FILE` | no | build-time only | Branding / Android package / path to `google-services.json` |

Only `EXPO_PUBLIC_*` values end up inside the app, so they must never contain secrets. If the Supabase values are
missing, the app shows a “not configured” screen listing what is missing instead of crashing. If the map style is
missing, maps show “Map not configured” — they are never faked.

For **EAS cloud builds**, `.env` is not uploaded. Add the same variables in the Expo dashboard (*Project → Environment
variables*, environments `development` / `preview` / `production`, visibility “Plain text” is fine for these public
values). `eas.json` maps each build profile to the environment of the same name.

Server-side secrets (never in `.env`) live in **Supabase Vault** and are read by the Edge Functions through
service-role-only database functions (`get_server_secret`, `verify_push_webhook_secret`):
`cass_ors_api_key`, `cass_project_url`, `cass_push_webhook_secret`. Optional `EXPO_ACCESS_TOKEN` (only if you enable
“enhanced push security” in Expo) is an Edge Function secret (`npx supabase secrets set EXPO_ACCESS_TOKEN=…`).

---

## Supabase setup

1. **Create the project** at <https://supabase.com/dashboard> → *New project*. Choose a strong database password and
   store it in a password manager (never in this repo). Pick the region with the best latency for Kenya that your plan
   offers (Europe — Frankfurt/London — or Mumbai are the usual choices).
2. **Copy the client values**: *Project Settings → API Keys* → Project URL and **Publishable key** → `.env`.
3. **Apply the migrations** (schema, RLS, storage buckets, realtime, cron, pilot configuration):
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   The migrations enable `postgis`, `pg_net` and `pg_cron`. If your project refuses to create an extension from a
   migration, enable it in *Database → Extensions* and run `npx supabase db push` again.
4. **Auth settings** (*Authentication*):
   - *Sign In / Providers → Email*: enable Email, keep **Confirm email** on, set minimum password length to 8.
   - *Emails → Templates*: CASS uses 6-digit **codes** (they work even if the email is opened on another device).
     Add the code to two templates:
     - **Confirm signup**: `<p>Your CASS verification code is <strong>{{ .Token }}</strong></p>`
     - **Reset Password**: `<p>Your CASS password reset code is <strong>{{ .Token }}</strong></p>`
   - *Emails → SMTP*: configure your own SMTP before the pilot. Supabase’s built-in sender is heavily rate-limited
     and meant for testing only.
5. **Deploy the Edge Functions and set their secrets**:
   ```bash
   npx supabase functions deploy geo send-push delete-account
   ```
   Then store the server secrets in Vault (*SQL Editor*):
   ```sql
   select vault.create_secret('<OpenRouteService key>', 'cass_ors_api_key');
   select vault.create_secret('https://<project-ref>.supabase.co', 'cass_project_url');
   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cass_push_webhook_secret');
   ```
   (`supabase/config.toml` sets `verify_jwt = false` for these three; each function verifies the caller itself —
   signed-in user for `geo`/`delete-account`, the webhook secret for `send-push`.)
6. Push dispatch is enabled as soon as `cass_project_url` and `cass_push_webhook_secret` exist (step 5).
7. **Regenerate types after any schema change**: `npm run gen:types` (uses the linked project).

What the migrations set up for you:

- **RLS on every table**, plus column privileges (phone numbers and number plates are not selectable by other users).
- **Storage**: public-read buckets `avatars` and `vehicle-photos` (2 MB, JPEG/PNG/WebP). Users can only write inside
  `<their user id>/`. Images are resized to ≤1024 px and compressed on the phone before upload.
- **Realtime**: `messages`, `trip_requests`, `trips`, `live_locations`, `notifications` are published; Postgres
  Changes respect RLS for each subscriber.
- **Cron**: `cass-trip-maintenance` every 5 minutes.

**Migrations workflow.** Every schema change is a new file: `npx supabase migration new <name>`, write SQL, test
locally (`npm run test:db`), then `npx supabase db push`. Never edit the production schema by hand. New functions are
**not** executable by `anon`/`authenticated` by default (default privileges are revoked); add an explicit `grant
execute` for any new client RPC.

---

## Maps, geocoding and routing

- **Map tiles/style**: any MapLibre-compatible provider via `EXPO_PUBLIC_MAP_STYLE_URL`. Recommended: MapTiler
  (*Account → API keys*; restrict the key to your app in its settings). The MapLibre demo tiles are not used.
- **Place search, reverse geocoding and road routing**: OpenRouteService through the `geo` Edge Function, so the ORS
  key never ships in the app and only signed-in users can use it. Search results are limited to Kenya
  (`GEO_COUNTRY_CODE`, default `KE`, can be set as a function secret). Approved pickup points and pilot places from
  the database are always offered first.
- Routes are real driving routes (geometry, distance, duration). If routing is unavailable, the app says so and
  still lets a trip be posted; matching then uses start/end points only. Straight lines are never presented as
  road distance.
- **Expressway**: “Avoid” requests a route that avoids toll roads. For “Either”, the route’s toll-road usage is
  detected and used to pick the contribution reference band. Toll prices are not stored anywhere in the app; if you
  need them, verify them from the official source and add them to configuration.

---

## Push notifications

Every in-app notification is a row in `notifications` (created by database logic). A trigger calls the `send-push`
Edge Function through `pg_net`, which sends to the Expo Push Service. Until the Vault secrets exist, notifications
still work in-app (inbox + badges) but no push is sent.

1. In the project folder: `npx eas-cli init` → copy the project ID into `.env` as `EAS_PROJECT_ID`.
2. Firebase: add an Android app with package `app.cass.mobile` (or your `APP_ID`), download
   `google-services.json` into the project root.
3. Upload the FCM V1 service-account key: `npx eas-cli credentials` → Android → *Google Service Account* → *FCM V1*.
4. Make sure the two Vault secrets from [Supabase setup](#supabase-setup) step 5 exist.
5. Rebuild the development build (push config is native). In the app: *Profile → Settings → Push notifications*.

---

## Pilot locations

The pilot migration seeds Nairobi destinations (active) and **Greatwall Gardens, Crystal Rivers and their four
pickup points as inactive**, because their coordinates are approximate and must be verified before anyone is told to
meet there. To verify and activate:

1. Open Google Maps / OpenStreetMap, long-press the exact gate/meeting spot, copy the latitude and longitude.
2. In Supabase *SQL Editor*:
   ```sql
   update public.places set lat = -1.xxxx, lng = 36.xxxx, is_active = true where name = 'Greatwall Gardens';
   update public.places set lat = -1.xxxx, lng = 36.xxxx, is_active = true where name = 'Crystal Rivers';
   update public.pickup_points set lat = -1.xxxx, lng = 36.xxxx, is_active = true where name = 'Greatwall Gardens Main Gate';
   update public.pickup_points set lat = -1.xxxx, lng = 36.xxxx, is_active = true where name = 'Greatwall Gardens Shopping Centre';
   update public.pickup_points set lat = -1.xxxx, lng = 36.xxxx, is_active = true where name = 'Crystal Rivers Main Gate';
   update public.pickup_points set lat = -1.xxxx, lng = 36.xxxx, is_active = true where name = 'Crystal Rivers Mall';
   ```
3. Add more places (Mlolongo, Syokimau, Kitengela, …) or meeting points the same way:
   ```sql
   insert into public.places (name, kind, corridor, lat, lng, sort_order) values ('Syokimau', 'neighbourhood', 'athi_river_nairobi', -1.xx, 36.xx, 70);
   insert into public.pickup_points (place_id, name, description, lat, lng)
     select id, 'Syokimau SGR Station', 'Main entrance', -1.xx, 36.xx from public.places where name = 'Syokimau';
   ```
   Deactivate with `is_active = false` (existing trips keep working).

---

## Running the app (development build)

MapLibre and trip location sharing are native modules, so use a **development build** instead of Expo Go.

Option A — cloud build (no Android Studio needed):
```bash
npx eas-cli login
npx eas-cli build --profile development --platform android
# install the APK from the link/QR code on your phone, then:
npm start          # expo start --dev-client; open the app and connect
```

Option B — local build (Android Studio + SDK installed, phone connected with USB debugging):
```bash
npm run android    # expo run:android (prebuild + Gradle + install)
```

Rebuild the development build after adding native modules or changing `app.config.ts`; JavaScript changes reload
instantly.

---

## Testing

```bash
npm run typecheck   # TypeScript (strict)
npm run lint        # ESLint (expo config, React Compiler rules)
npm test            # Jest unit tests: trip action state machine, time zones, formatting, validation, error mapping
npm run test:db     # migrations + pgTAP tests on a throwaway local PostgreSQL (needs PostgreSQL 15+ with PostGIS and pgTAP)
```

With Docker you can instead run the real Supabase stack: `npx supabase start && npx supabase test db`.

The database test (`supabase/tests/database/core_flow.test.sql`) runs the acceptance flow at the database level —
sign-up → vehicle → trip → search → request → notification → accept → chat → start → live location → complete →
ratings — and checks overbooking, RLS isolation between users, hidden columns, blocking, cancellation incidents,
recurring generation/pause and push dispatch. `scripts/test-db-concurrency.sh` makes two sessions accept the **last
seat at the same time** and asserts exactly one succeeds.

**On-device acceptance checklist** (two phones, two accounts, real services):
1. A: sign up (code from email), add name/photo, add a vehicle (≥6 seats for a 5-seat trip).
2. A: create *Greatwall Gardens → Nairobi CBD*, tomorrow 07:00, 5 seats.
3. B: sign up, search the same route/time → A’s trip appears → open → *Request seat*.
4. A: receives push + notification → *Requests* → *Accept*. B sees *Seat confirmed*.
5. A and B chat (messages appear live on both phones).
6. Trip day (within 60 min of departure): A → *Start trip* → location explanation → OS permission → live map. B opens
   *Open live trip* and sees A moving.
7. A → *End trip* → both rate each other. Try: rating twice (refused), flight mode (offline banner, friendly errors),
   declining, cancelling, a recurring schedule, blocking and reporting.

---

## Building Android

```bash
npx eas-cli build --profile preview --platform android      # installable APK for testers
npx eas-cli build --profile production --platform android   # AAB for Google Play
```

Local alternative: `npx expo prebuild --platform android --clean && cd android && ./gradlew assembleRelease`
(configure your own signing key first; never commit keystores — `*.jks`/`*.keystore` are git-ignored).

---

## Production and deployment

1. Supabase: `npx supabase db push`, deploy functions, set secrets, Vault secrets, SMTP, email templates.
2. Verify and activate pilot locations; set `support` links in configuration.
3. Expo dashboard: production environment variables; FCM credentials.
4. `npx eas-cli build --profile production --platform android`, then `npx eas-cli submit --platform android`
   (Play Console account required). Play Store listing must declare location use (foreground service: “location
   sharing during an active trip”); CASS does not request background (“all the time”) location.
5. Monitor: Supabase *Logs* (Postgres, Edge Functions), *Database → Cron jobs* for `cass-trip-maintenance`,
   and the `analytics_events` table. Key metric — completed shared trips:
   ```sql
   select date_trunc('week', created_at) wk, count(*) from analytics_events
   where event = 'trip_completed' and (properties->>'shared')::boolean group by 1 order by 1;
   ```

---

## Configuration reference

All runtime configuration lives in `public.configuration` (edit in the Table Editor or with SQL; the app reloads it
on launch and caches it for slow networks):

| Key | Meaning |
| --- | --- |
| `currency`, `timezone` | `KES`, `Africa/Nairobi`. All user-entered times are interpreted in this zone. |
| `contribution` | Pilot reference ranges per seat (`normal` 100–120, `expressway` 150–170 KES) for `reference_distance_km`, scaled by route distance, rounded to `rounding_step`, floor `minimum_amount`. `max_multiplier` caps what a creator may ask (prevents commercial pricing). |
| `matching` | Per trip type: origin/destination radius (m), time tolerance (min); `corridor_buffer_m` for joining along the route; `default_window_hours` for “nearby”. |
| `trip_rules` | Max seats per request, advance days, start window, late-cancellation threshold, expiry, auto-complete, rating window. |
| `location` | Update interval (s), min distance (m), “poor accuracy” threshold (m), retention safety net (h). |
| `recurring` | `generation_days` — how far ahead commute instances are created. |
| `notifications` | `reminder_minutes_before` departure. |
| `features` | `intercity`, `recurring`, `expressway` flags. |
| `corridors`, `map`, `support` | Corridor list, default map viewport, help/terms/privacy links (null = hidden). |

---

## Security model

- The app ships only the Supabase URL + publishable key and a public map-style URL.
- RLS on every table; no “allow all” policies. Other users can read public profile columns only; phone numbers,
  number plates (until a seat is confirmed), requests, members, conversations, notifications and live locations are
  visible only to the people involved.
- All state transitions are validated in the database (trip: DRAFT→OPEN→FULL⇄OPEN→IN_PROGRESS→COMPLETED, with
  CANCELLED/EXPIRED; request: PENDING→ACCEPTED/DECLINED/CANCELLED/EXPIRED, ACCEPTED→CANCELLED). `COMPLETED → OPEN`
  is rejected even for the database owner.
- Seat acceptance locks the trip row; a CHECK constraint makes overbooking impossible.
- Live location: one latest row per traveller, only during `in_progress`, visible only to participants, deleted
  when the trip ends (and by the cron safety net). Nothing is tracked outside an active trip.
- Sessions are stored encrypted (AES key in the Android Keystore/iOS Keychain via SecureStore).
- Errors shown to users are mapped to friendly messages; raw database errors are only logged in development.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| “App not configured” screen | `.env` values missing/invalid. For EAS builds, set them in the Expo dashboard and rebuild. |
| Changed `.env` but the app still uses old values | `EXPO_PUBLIC_*` values are compiled into the JS bundle and Metro caches it: restart with `npx expo start --dev-client --clear`. |
| Map shows “Map not configured” / “could not load” | Set `EXPO_PUBLIC_MAP_STYLE_URL`; check the key and its restrictions; check network. |
| “Location search is not set up yet” | Vault secret `cass_ors_api_key` missing, or the `geo` function not deployed. |
| `Invariant Violation: … MLRN…` / native module not found | You are in Expo Go. Install the development build. |
| Sign-up email has a link but no code | Add `{{ .Token }}` to the *Confirm signup* / *Reset Password* templates. |
| Emails stop arriving | Built-in Supabase email is rate-limited; configure custom SMTP. |
| No push notifications | Physical device? Permission granted in Settings? `EAS_PROJECT_ID` set and app rebuilt? FCM V1 key uploaded? Vault secrets `cass_project_url` and `cass_push_webhook_secret` present? Check *Edge Functions → send-push → Logs*. |
| `permission denied for function …` | A new RPC was added without `grant execute … to authenticated`. |
| Trips never expire / recurring trips not generated | Check *Database → Cron jobs* for `cass-trip-maintenance` and its run history. |
| Location sharing stops when the screen is off (some Android brands) | Disable battery optimisation for CASS (*Settings → Apps → CASS → Battery → Unrestricted*). |
| `npm run test:db` cannot find PostGIS/pgTAP | `sudo apt install postgresql-16-postgis-3 postgresql-16-pgtap` (or use `npx supabase test db` with Docker). |

---

## Known platform limitations

- **Expo Go is not supported** (MapLibre, foreground-service location). Always use a development build.
- **Location while the screen is off** works through a visible foreground-service notification on Android and the
  background location indicator on iOS, started when the user starts/joins sharing with the app open. Android cannot
  start it from the background, and some manufacturers kill background services aggressively. CASS does not ask for
  “Allow all the time” location.
- **Push** needs a physical device, notification permission, FCM credentials (Android) and the Vault secrets.
- **Realtime** needs connectivity; screens reload on focus and on pull-to-refresh after reconnecting. The app is
  not an offline app: writes fail with a clear message while offline and unsent chat text is kept.
- **Routing** quality depends on OpenStreetMap data in Kenya; the expressway is detected as a toll road.
- **Emergency**: CASS is not an emergency service. Screens that mention safety point users to 999/112.
- iOS is configured but has not been the pilot target; building it needs an Apple developer account.

---

## Future expansion

The schema already separates trips, participants and configuration so these can be added without rewriting the
core: more estates/corridors (data only), Nairobi-wide and national intercity routes (same trip system),
corporate/verified communities, women-only trip options, identity verification, better matching (e.g. partial route
overlap scoring), no-show reliability scores built on `trip_incidents`, M-Pesa contributions (new
`payments`/`transactions` tables referencing `trip_members`), referrals and an admin console for configuration and
reports. None of these are implemented yet by design.

Legal: CASS is positioned as cost-sharing between people already travelling. Kenyan transport and data-protection
requirements (e.g. NTSA rules, Data Protection Act 2019) should be reviewed before any commercial launch.
