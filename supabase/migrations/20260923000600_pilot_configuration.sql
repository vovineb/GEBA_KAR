-- CASS: initial configuration for the Athi River / Mombasa Road pilot.
-- This is configuration, not sample data. Change values with SQL (or the
-- Supabase Table Editor) without touching application code.

insert into public.configuration (key, value, description) values
  ('currency', '"KES"', 'ISO currency for contributions'),
  ('timezone', '"Africa/Nairobi"', 'Time zone used for schedules, search dates and messages'),
  ('contribution', '{
      "normal":     {"min": 100, "max": 120},
      "expressway": {"min": 150, "max": 170},
      "reference_distance_km": 30,
      "rounding_step": 10,
      "minimum_amount": 50,
      "max_multiplier": 1.5
    }', 'Pilot reference ranges per seat for a reference_distance_km trip; scaled by route distance. Not a fare. max_multiplier caps what a creator may ask.'),
  ('matching', '{
      "commute":   {"origin_radius_m": 3000,  "destination_radius_m": 5000,  "time_tolerance_minutes": 60},
      "intercity": {"origin_radius_m": 15000, "destination_radius_m": 20000, "time_tolerance_minutes": 240},
      "corridor_buffer_m": 1500,
      "default_window_hours": 24
    }', 'Deterministic trip matching tolerances'),
  ('trip_rules', '{
      "max_seats_per_request": 4,
      "min_minutes_before_departure": 15,
      "max_advance_days": 90,
      "start_window_minutes": 60,
      "late_cancellation_minutes": 60,
      "expire_after_minutes": 120,
      "auto_complete_after_hours": 6,
      "rating_window_days": 14
    }', 'Trip lifecycle rules'),
  ('location', '{
      "min_interval_seconds": 10,
      "min_distance_m": 25,
      "poor_accuracy_m": 100,
      "retention_hours": 12
    }', 'Live location sharing cadence and retention'),
  ('recurring', '{"generation_days": 7}', 'How many days ahead recurring commute instances are generated'),
  ('notifications', '{"reminder_minutes_before": 30}', 'Trip reminder timing'),
  ('features', '{"intercity": true, "recurring": true, "expressway": true}', 'Feature flags'),
  ('corridors', '[{"key": "athi_river_nairobi", "name": "Greatwall Gardens / Crystal Rivers ⇄ Nairobi"}]', 'Supported corridors'),
  ('map', '{"default_center": {"lat": -1.36, "lng": 36.89}, "default_zoom": 10.5}', 'Initial map viewport'),
  ('support', '{"email": null, "terms_url": null, "privacy_url": null}', 'Help and legal links shown in Settings (null = hidden)');

-- Places and meeting points.
-- Nairobi destinations are widely known locations. The pilot estate
-- coordinates below are approximate and are seeded INACTIVE: verify each
-- one on a map and activate it (README -> "Pilot locations") before launch.
insert into public.places (name, kind, corridor, lat, lng, sort_order, is_active) values
  ('Greatwall Gardens', 'estate', 'athi_river_nairobi', -1.4210, 36.9560, 10, false),
  ('Crystal Rivers', 'estate', 'athi_river_nairobi', -1.4440, 36.9770, 20, false),
  ('Nairobi CBD', 'neighbourhood', 'athi_river_nairobi', -1.2856, 36.8254, 30, true),
  ('Upper Hill', 'neighbourhood', 'athi_river_nairobi', -1.2986, 36.8163, 40, true),
  ('Westlands', 'neighbourhood', 'athi_river_nairobi', -1.2674, 36.8062, 50, true),
  ('Industrial Area', 'neighbourhood', 'athi_river_nairobi', -1.3060, 36.8531, 60, true);

insert into public.pickup_points (place_id, name, description, lat, lng, is_active)
select p.id, v.name, v.description, v.lat, v.lng, false
from (values
  ('Greatwall Gardens', 'Greatwall Gardens Main Gate', 'Estate main gate', -1.4205, 36.9555),
  ('Greatwall Gardens', 'Greatwall Gardens Shopping Centre', 'Shopping centre parking', -1.4215, 36.9565),
  ('Crystal Rivers', 'Crystal Rivers Main Gate', 'Estate main gate', -1.4445, 36.9775),
  ('Crystal Rivers', 'Crystal Rivers Mall', 'Mall entrance', -1.4435, 36.9765)
) as v(place, name, description, lat, lng)
join public.places p on p.name = v.place;
