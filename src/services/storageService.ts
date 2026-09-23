import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';

import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type ImageBucket = 'avatars' | 'vehicle-photos';

export function publicImageUrl(bucket: ImageBucket, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Resizes/compresses a picked image (max 1024px, JPEG) and uploads it to
 * `<bucket>/<userId>/<timestamp>.jpg`. Returns the storage path.
 */
export async function uploadImage(bucket: ImageBucket, userId: string, localUri: string): Promise<string> {
  const context = ImageManipulator.manipulate(localUri);
  context.resize({ width: 1024 });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) throw toAppError(new Error('image_encoding_failed'));
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, base64ToBytes(result.base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw toAppError(error, 'Could not upload the photo. Try again.');
  return path;
}

export async function removeImage(bucket: ImageBucket, path: string) {
  await supabase.storage.from(bucket).remove([path]);
}
