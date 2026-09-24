import { ensureOk, unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Vehicle } from '@/types/domain';

export type VehicleInput = Pick<Vehicle, 'make' | 'model' | 'colour' | 'registration_number' | 'seat_capacity'> & {
  year: number | null;
  photo_path: string | null;
};

export async function listMyVehicles(): Promise<Vehicle[]> {
  return unwrap(await supabase.rpc('my_vehicles'));
}

export async function createVehicle(ownerId: string, input: VehicleInput) {
  ensureOk(await supabase.from('vehicles').insert({ ...input, owner_id: ownerId }));
}

export async function updateVehicle(id: string, input: VehicleInput) {
  ensureOk(await supabase.from('vehicles').update(input).eq('id', id));
}

/** Soft delete: past trips still reference the vehicle. */
export async function deactivateVehicle(id: string) {
  ensureOk(await supabase.from('vehicles').update({ status: 'inactive' }).eq('id', id));
}
