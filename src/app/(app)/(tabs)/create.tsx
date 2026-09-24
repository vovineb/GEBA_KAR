import { zodResolver } from '@hookform/resolvers/zod';
import { router, useFocusEffect } from 'expo-router';
import { Car, Plus, X } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ChipSelect } from '@/components/form/ChipSelect';
import { DateTimeField } from '@/components/form/DateTimeField';
import { LocationField } from '@/components/form/LocationField';
import { Stepper } from '@/components/form/Stepper';
import { CassMap } from '@/components/map/CassMap';
import { Pin, RouteLine } from '@/components/map/MapLayers';
import { Button, EmptyState, ErrorState, LoadingState, Screen, Section, Segmented, Text, TextField } from '@/components/ui';
import { createTripSchema, type CreateTripForm } from '@/features/trips/createTripSchema';
import { expresswayOptions, luggageOptions, tripTypeOptions } from '@/features/trips/labels';
import { useRoutePreview } from '@/features/trips/useRoutePreview';
import { useAction } from '@/hooks/useAction';
import { useAsync } from '@/hooks/useAsync';
import { formatDistance, formatDuration, WEEKDAYS } from '@/lib/format';
import { nearest } from '@/lib/geo';
import { addDays, toDateString, toTimeString, zonedTimestamp } from '@/lib/time';
import { getRoute, listPickupPoints } from '@/services/geoService';
import { createRecurringTrip, createTrip, type TripPayload } from '@/services/tripService';
import { listMyVehicles } from '@/services/vehicleService';
import { useAppConfig } from '@/store/configStore';
import { useLocationPickerStore } from '@/store/locationPickerStore';
import type { ChosenLocation, PickupPoint } from '@/types/domain';
import { colors, radius, space } from '@/theme';

const MEETING_POINT_RADIUS_M = 5000;

const defaults: CreateTripForm = {
  tripType: 'commute',
  origin: null,
  destination: null,
  pickupPointId: null,
  dropoffPointId: null,
  date: new Date(),
  time: null,
  repeat: false,
  weekdays: [1, 2, 3, 4, 5],
  addReturn: false,
  returnTime: null,
  seats: 3,
  vehicleId: '',
  expressway: 'either',
  luggage: 'small',
  contribution: '',
  notes: '',
  stops: [],
};

export default function CreateTripScreen() {
  const vehicles = useAsync(listMyVehicles, []);
  const points = useAsync(listPickupPoints, []);
  const { reload } = vehicles;
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  if (vehicles.loading) return <LoadingState />;
  if (vehicles.error) return <ErrorState message={vehicles.error.message} onRetry={reload} />;
  if (!vehicles.data?.length) {
    return (
      <Screen>
        <Text variant="title">Create a trip</Text>
        <EmptyState
          icon={<Car size={40} color={colors.textSubtle} />}
          title="Add a vehicle to create a trip."
          body="Passengers see your vehicle’s make, model and colour. The registration number is shown only to confirmed passengers."
          actions={[{ label: 'Add a vehicle', onPress: () => router.push('/vehicles/edit') }]}
        />
      </Screen>
    );
  }
  return <CreateTripFormView vehicles={vehicles.data} pickupPoints={points.data ?? []} />;
}

function CreateTripFormView({
  vehicles,
  pickupPoints,
}: {
  vehicles: { id: string; make: string; model: string; colour: string; seat_capacity: number }[];
  pickupPoints: PickupPoint[];
}) {
  const config = useAppConfig();
  const take = useLocationPickerStore((s) => s.take);
  const form = useForm<CreateTripForm>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { ...defaults, vehicleId: vehicles[0]!.id },
  });
  const { control, setValue, handleSubmit, formState, reset } = form;
  const v = useWatch({ control });
  const errors = formState.errors;

  const vehicle = vehicles.find((x) => x.id === v.vehicleId) ?? vehicles[0]!;
  const maxSeats = Math.max(1, vehicle.seat_capacity - 1);
  const isCommute = v.tripType === 'commute';
  const recurring = isCommute && !!v.repeat && config.features.recurring;

  const stops = (v.stops ?? []) as ChosenLocation[];
  const preview = useRoutePreview(
    [(v.origin as ChosenLocation | null) ?? null, ...stops, (v.destination as ChosenLocation | null) ?? null],
    v.expressway ?? 'either',
  );

  // Receive an added stop from the location picker.
  useFocusEffect(
    useCallback(() => {
      const stop = take('create-stop');
      if (stop) setValue('stops', [...(form.getValues('stops') ?? []), stop]);
    }, [take, setValue, form]),
  );

  const nearOrigin = useMemo(
    () => (v.origin ? nearest(pickupPoints, v.origin as ChosenLocation, MEETING_POINT_RADIUS_M, 6) : []),
    [pickupPoints, v.origin],
  );
  const nearDestination = useMemo(
    () => (v.destination ? nearest(pickupPoints, v.destination as ChosenLocation, MEETING_POINT_RADIUS_M, 6) : []),
    [pickupPoints, v.destination],
  );

  const submit = useAction(async (values: CreateTripForm) => {
    const origin = values.origin!;
    const destination = values.destination!;
    const base: TripPayload = {
      vehicle_id: values.vehicleId,
      trip_type: values.tripType,
      origin_name: origin.name,
      origin_lat: origin.lat,
      origin_lng: origin.lng,
      destination_name: destination.name,
      destination_lat: destination.lat,
      destination_lng: destination.lng,
      pickup_point_id: values.pickupPointId,
      dropoff_point_id: values.dropoffPointId,
      route_geojson: preview.route?.geometry ?? null,
      distance_m: preview.route?.distance_m ?? null,
      duration_s: preview.route?.duration_s ?? null,
      total_seats: Math.min(values.seats, maxSeats),
      suggested_contribution: values.contribution ? Number(values.contribution) : null,
      expressway_option: values.expressway,
      luggage_policy: values.luggage,
      notes: values.notes.trim() || null,
    };

    if (recurring) {
      await createRecurringTrip({
        ...base,
        weekdays: values.weekdays,
        departure_local_time: toTimeString(values.time!),
        start_date: toDateString(values.date!),
        end_date: null,
      });
      if (values.addReturn && values.returnTime) {
        const back = await getRoute([destination, origin], values.expressway === 'avoid').catch(() => null);
        await createRecurringTrip({
          ...base,
          origin_name: destination.name,
          origin_lat: destination.lat,
          origin_lng: destination.lng,
          destination_name: origin.name,
          destination_lat: origin.lat,
          destination_lng: origin.lng,
          pickup_point_id: values.dropoffPointId,
          dropoff_point_id: values.pickupPointId,
          route_geojson: back?.geometry ?? null,
          distance_m: back?.distance_m ?? null,
          duration_s: back?.duration_s ?? null,
          weekdays: values.weekdays,
          departure_local_time: toTimeString(values.returnTime),
          start_date: toDateString(values.date!),
          end_date: null,
        });
      }
      reset({ ...defaults, vehicleId: values.vehicleId });
      Alert.alert('Schedule created', 'Your upcoming commute trips are now open for requests.');
      router.push('/recurring');
      return;
    }

    const id = await createTrip({
      ...base,
      departure_time: zonedTimestamp(values.date!, values.time!, config.timezone),
      stops: values.tripType === 'intercity' ? stops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng })) : [],
    });
    reset({ ...defaults, vehicleId: values.vehicleId });
    router.push(`/trip/${id}`);
  }, { errorTitle: 'Trip not created' });

  const setLocation = (field: 'origin' | 'destination') => (loc: ChosenLocation) => {
    setValue(field, loc, { shouldValidate: formState.isSubmitted });
    setValue(field === 'origin' ? 'pickupPointId' : 'dropoffPointId', loc.pickupPointId ?? null);
  };

  const pointOptions = (list: PickupPoint[]) => list.map((p) => ({ value: p.id, label: p.name }));

  return (
    <Screen
      footer={<Button title={recurring ? 'Create commute schedule' : 'Post trip'} loading={submit.busy} onPress={handleSubmit(submit.run)} />}
    >
      <Text variant="title" accessibilityRole="header">
        Create a trip
      </Text>
      <Text tone="muted">Share the empty seats on a journey you are already making.</Text>

      {config.features.intercity ? (
        <Controller
          control={control}
          name="tripType"
          render={({ field }) => <Segmented label="Trip type" options={tripTypeOptions} value={field.value} onChange={field.onChange} />}
        />
      ) : null}

      <LocationField pickerKey="create-origin" label="From" value={(v.origin as ChosenLocation) ?? null} onChange={setLocation('origin')} placeholder="Where do you start?" error={errors.origin?.message} />
      {nearOrigin.length ? (
        <Controller
          control={control}
          name="pickupPointId"
          render={({ field }) => (
            <ChipSelect label="Pickup point (approved)" options={pointOptions(nearOrigin)} value={field.value} onChange={field.onChange} allowNone />
          )}
        />
      ) : null}

      <LocationField pickerKey="create-destination" label="To" value={(v.destination as ChosenLocation) ?? null} onChange={setLocation('destination')} placeholder="Where are you going?" error={errors.destination?.message} />
      {nearDestination.length ? (
        <Controller
          control={control}
          name="dropoffPointId"
          render={({ field }) => (
            <ChipSelect label="Drop-off point" options={pointOptions(nearDestination)} value={field.value} onChange={field.onChange} allowNone />
          )}
        />
      ) : null}

      {v.tripType === 'intercity' ? (
        <Section title="Planned stops">
          {stops.map((s, i) => (
            <View key={`${s.lat},${s.lng},${i}`} style={styles.stop}>
              <Text style={styles.flex}>
                {i + 1}. {s.name}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove stop ${s.name}`} hitSlop={8} onPress={() => setValue('stops', stops.filter((_, j) => j !== i))}>
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          {stops.length < 5 ? (
            <Button title="Add a stop" variant="secondary" compact icon={<Plus size={16} color={colors.text} />} onPress={() => router.push({ pathname: '/location-picker', params: { key: 'create-stop', title: 'Add a stop' } })} />
          ) : null}
        </Section>
      ) : null}

      <View style={styles.row}>
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DateTimeField label={recurring ? 'Starting from' : 'Date'} mode="date" value={field.value ?? null} onChange={field.onChange} minimumDate={new Date()} maximumDate={addDays(new Date(), config.trip_rules.max_advance_days)} error={errors.date?.message} />
          )}
        />
        <Controller
          control={control}
          name="time"
          render={({ field }) => <DateTimeField label="Departure" mode="time" value={field.value ?? null} onChange={field.onChange} error={errors.time?.message} />}
        />
      </View>

      {isCommute && config.features.recurring ? (
        <View style={styles.box}>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">Repeat every week</Text>
              <Text variant="caption" tone="muted">
                Trips are opened a few days ahead automatically.
              </Text>
            </View>
            <Controller
              control={control}
              name="repeat"
              render={({ field }) => <Switch value={field.value} onValueChange={field.onChange} accessibilityLabel="Repeat every week" trackColor={{ true: colors.brand }} />}
            />
          </View>
          {recurring ? (
            <>
              <Controller
                control={control}
                name="weekdays"
                render={({ field }) => (
                  <ChipSelect
                    label="Days"
                    multi
                    options={WEEKDAYS.map((d) => ({ value: d.value, label: d.short }))}
                    values={field.value}
                    onToggle={(d) => field.onChange(field.value.includes(d) ? field.value.filter((x) => x !== d) : [...field.value, d].sort())}
                  />
                )}
              />
              {errors.weekdays?.message ? <Text variant="small" tone="danger">{errors.weekdays.message}</Text> : null}
              <View style={styles.switchRow}>
                <Text style={styles.flex}>Add the return trip</Text>
                <Controller
                  control={control}
                  name="addReturn"
                  render={({ field }) => <Switch value={field.value} onValueChange={field.onChange} accessibilityLabel="Add the return trip" trackColor={{ true: colors.brand }} />}
                />
              </View>
              {v.addReturn ? (
                <Controller
                  control={control}
                  name="returnTime"
                  render={({ field }) => (
                    <DateTimeField label={`Return departure (${(v.destination as ChosenLocation | null)?.name ?? 'destination'} → ${(v.origin as ChosenLocation | null)?.name ?? 'start'})`} mode="time" value={field.value ?? null} onChange={field.onChange} error={errors.returnTime?.message} />
                  )}
                />
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      <Controller
        control={control}
        name="vehicleId"
        render={({ field }) => (
          <ChipSelect label="Vehicle" options={vehicles.map((x) => ({ value: x.id, label: `${x.colour} ${x.make} ${x.model}` }))} value={field.value} onChange={(val) => val && field.onChange(val)} />
        )}
      />
      <Controller
        control={control}
        name="seats"
        render={({ field }) => <Stepper label="Seats offered" value={Math.min(field.value, maxSeats)} min={1} max={maxSeats} onChange={field.onChange} />}
      />

      {config.features.expressway ? (
        <Controller
          control={control}
          name="expressway"
          render={({ field }) => <ChipSelect label="Nairobi Expressway" options={expresswayOptions} value={field.value} onChange={(val) => field.onChange(val ?? 'either')} />}
        />
      ) : null}

      <RoutePreview preview={preview} origin={(v.origin as ChosenLocation) ?? null} destination={(v.destination as ChosenLocation) ?? null} />

      <Controller
        control={control}
        name="contribution"
        render={({ field }) => (
          <TextField
            label={`Suggested trip contribution per seat (${config.currency}, optional)`}
            keyboardType="number-pad"
            value={field.value}
            onChangeText={field.onChange}
            placeholder={preview.suggestion ? `${preview.suggestion.min}–${preview.suggestion.max}` : 'e.g. 120'}
            hint={
              preview.suggestion
                ? `Reference range for this route: ${preview.suggestion.currency} ${preview.suggestion.min}–${preview.suggestion.max}. This is cost sharing, not a fare.`
                : 'Cost sharing agreed between travellers, not a fare.'
            }
            error={errors.contribution?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="luggage"
        render={({ field }) => <ChipSelect label="Luggage" options={luggageOptions} value={field.value} onChange={(val) => val && field.onChange(val)} />}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextField label="Notes (optional)" value={field.value} onChangeText={field.onChange} multiline maxLength={500} placeholder="e.g. I leave on time; no smoking" error={errors.notes?.message} />
        )}
      />
    </Screen>
  );
}

function RoutePreview({
  preview,
  origin,
  destination,
}: {
  preview: ReturnType<typeof useRoutePreview>;
  origin: ChosenLocation | null;
  destination: ChosenLocation | null;
}) {
  if (!origin || !destination) return null;
  return (
    <View style={styles.preview}>
      <View style={styles.previewMap}>
        <CassMap fitPoints={[origin, destination]} interactive={false}>
          {preview.route ? <RouteLine route={preview.route.geometry} /> : null}
          <Pin id="o" point={origin} kind="origin" />
          <Pin id="d" point={destination} kind="destination" />
        </CassMap>
      </View>
      <View style={styles.previewText}>
        {preview.loading ? (
          <Text variant="caption" tone="muted">
            Calculating the road route…
          </Text>
        ) : preview.route ? (
          <Text variant="caption">
            {formatDistance(preview.route.distance_m)} · about {formatDuration(preview.route.duration_s)} by road
            {preview.route.uses_tollways ? ' · uses a toll road' : ''}
          </Text>
        ) : preview.error ? (
          <Text variant="caption" tone="warning">
            Route unavailable: {preview.error} The trip can still be posted; matching will use the start and end points.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  box: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  stop: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  preview: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  previewMap: { height: 160 },
  previewText: { padding: space.md },
});
