import { z } from 'zod';

import { Constants } from '@/types/database';

const E = Constants.public.Enums;

const location = z.object({
  name: z.string().min(2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  pickupPointId: z.string().nullish(),
});

/** Client-side validation for the create-trip form (the database re-validates everything). */
export const createTripSchema = z
  .object({
    tripType: z.enum(E.trip_type),
    origin: location.nullable().refine((v) => v !== null, 'Choose where the trip starts'),
    destination: location.nullable().refine((v) => v !== null, 'Choose the destination'),
    pickupPointId: z.string().nullable(),
    dropoffPointId: z.string().nullable(),
    date: z.date({ error: 'Choose a date' }).nullable().refine((v) => v !== null, 'Choose a date'),
    time: z.date({ error: 'Choose a time' }).nullable().refine((v) => v !== null, 'Choose a departure time'),
    repeat: z.boolean(),
    weekdays: z.array(z.number().int().min(1).max(7)),
    addReturn: z.boolean(),
    returnTime: z.date().nullable(),
    seats: z.number().int().min(1).max(13),
    vehicleId: z.string({ error: 'Choose a vehicle' }).min(1, 'Choose a vehicle'),
    expressway: z.enum(E.expressway_option),
    luggage: z.enum(E.luggage_policy),
    contribution: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d{1,6}$/.test(v) && Number(v) >= 0), 'Enter a whole amount, e.g. 120'),
    notes: z.string().trim().max(500, 'Keep notes under 500 characters'),
    stops: z.array(location).max(5),
    womenOnly: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.origin && v.destination && v.origin.lat === v.destination.lat && v.origin.lng === v.destination.lng) {
      ctx.addIssue({ code: 'custom', path: ['destination'], message: 'Destination must differ from the start' });
    }
    if (v.repeat && v.weekdays.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['weekdays'], message: 'Choose at least one day' });
    }
    if (v.repeat && v.addReturn && !v.returnTime) {
      ctx.addIssue({ code: 'custom', path: ['returnTime'], message: 'Choose the return departure time' });
    }
  });

export type CreateTripForm = z.input<typeof createTripSchema>;
