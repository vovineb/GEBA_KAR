-- CASS: Greatwall Gardens area position from OpenStreetMap (midpoint of the
-- "Greatwall Gardens 1" and "Greatwall Gardens 2" features, via the
-- OpenRouteService geocoder). Area-level only: it powers search suggestions.
-- Gate/meeting pickup points stay inactive until verified on the ground.
update public.places set lat = -1.42778, lng = 36.97822, is_active = true where name = 'Greatwall Gardens';
