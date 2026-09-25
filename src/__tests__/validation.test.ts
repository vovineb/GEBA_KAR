import { parseAppConfig } from "@/config/appConfig";
import { signUpSchema } from "@/features/auth/schemas";
import { createTripSchema } from "@/features/trips/createTripSchema";
import { toAppError } from "@/lib/errors";

describe("error mapping", () => {
  it("maps database rule codes to friendly text", () => {
    expect(toAppError({ message: "not_enough_seats" }).message).toMatch(
      /not enough free seats/,
    );
    expect(toAppError({ code: "invalid_credentials", message: "x" }).code).toBe(
      "invalid_credentials",
    );
  });
  it("never exposes raw database errors", () => {
    const e = toAppError({
      message: 'duplicate key value violates unique constraint "x"',
      code: "XX000",
    });
    expect(e.message).not.toMatch(/constraint/);
  });
  it("detects network failures", () => {
    expect(toAppError(new TypeError("Network request failed")).code).toBe(
      "network",
    );
  });
});

describe("sign-up validation", () => {
  const valid = {
    fullName: "Amina W",
    gender: "female",
    email: "A@B.co ",
    password: "longenough",
    confirm: "longenough",
    acceptTerms: true,
  };
  it("requires matching passwords of at least 8 characters", () => {
    expect(
      signUpSchema.safeParse({
        fullName: "A B",
        email: "a@b.co",
        password: "short",
        confirm: "short",
      }).success,
    ).toBe(false);
    expect(signUpSchema.safeParse({ ...valid }).success).toBe(true);
  });
  it("requires gender and accepted terms", () => {
    expect(
      signUpSchema.safeParse({ ...valid, gender: undefined }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ ...valid, acceptTerms: false }).success,
    ).toBe(false);
  });
});

describe("create trip validation", () => {
  const base = {
    tripType: "commute" as const,
    origin: { name: "Greatwall Gardens", lat: -1.42, lng: 36.95 },
    destination: { name: "Nairobi CBD", lat: -1.28, lng: 36.82 },
    pickupPointId: null,
    dropoffPointId: null,
    date: new Date(),
    time: new Date(),
    repeat: false,
    weekdays: [1, 2, 3, 4, 5],
    addReturn: false,
    returnTime: null,
    seats: 3,
    vehicleId: "v1",
    expressway: "either" as const,
    luggage: "small" as const,
    contribution: "120",
    notes: "",
    womenOnly: false,
    stops: [],
  };
  it("accepts a complete trip", () => {
    expect(createTripSchema.safeParse(base).success).toBe(true);
  });
  it("rejects missing places, same start/end and bad contributions", () => {
    expect(createTripSchema.safeParse({ ...base, origin: null }).success).toBe(
      false,
    );
    expect(
      createTripSchema.safeParse({ ...base, destination: base.origin }).success,
    ).toBe(false);
    expect(
      createTripSchema.safeParse({ ...base, contribution: "12.5x" }).success,
    ).toBe(false);
  });
  it("requires weekdays and return time for recurring commutes", () => {
    expect(
      createTripSchema.safeParse({ ...base, repeat: true, weekdays: [] })
        .success,
    ).toBe(false);
    expect(
      createTripSchema.safeParse({ ...base, repeat: true, addReturn: true })
        .success,
    ).toBe(false);
  });
});

describe("remote configuration", () => {
  it("parses the configuration rows seeded by the pilot migration", () => {
    const rows = [
      { key: "currency", value: "KES" },
      { key: "timezone", value: "Africa/Nairobi" },
      {
        key: "trip_rules",
        value: {
          max_seats_per_request: 4,
          max_advance_days: 90,
          start_window_minutes: 60,
          rating_window_days: 14,
          late_cancellation_minutes: 60,
        },
      },
      {
        key: "location",
        value: {
          min_interval_seconds: 10,
          min_distance_m: 25,
          poor_accuracy_m: 100,
          retention_hours: 12,
        },
      },
      {
        key: "features",
        value: { intercity: true, recurring: true, expressway: true },
      },
      {
        key: "map",
        value: {
          default_center: { lat: -1.36, lng: 36.89 },
          default_zoom: 10.5,
        },
      },
      {
        key: "support",
        value: { email: null, terms_url: null, privacy_url: null },
      },
      {
        key: "corridors",
        value: [{ key: "athi_river_nairobi", name: "Pilot" }],
      },
    ];
    expect(parseAppConfig(rows).currency).toBe("KES");
    expect(() =>
      parseAppConfig(rows.filter((r) => r.key !== "timezone")),
    ).toThrow();
  });
});
