import type { Enums } from '@/types/domain';

export type Gender = Enums<'gender'>;

export const genderOptions: readonly { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

export const genderLabel: Record<Gender, string> = { female: 'Female', male: 'Male' };

/** "Female" / "Male", or null when the person has not set it. */
export function formatGender(g: Gender | null | undefined): string | null {
  return g ? genderLabel[g] : null;
}
