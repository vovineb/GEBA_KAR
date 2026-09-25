import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/** Lets the user pick a photo from the library. Returns the local URI or null. */
export async function pickImage(aspect: [number, number]): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos not available', 'Allow photo access in your phone settings to choose a picture.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.8,
  });
  return res.canceled ? null : (res.assets[0]?.uri ?? null);
}

/** Lets the user pick several photos from the library. Returns local URIs (may be empty). */
export async function pickImages(limit: number): Promise<string[]> {
  if (limit < 1) return [];
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos not available', 'Allow photo access in your phone settings to choose pictures.');
    return [];
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 0.8,
  });
  return res.canceled ? [] : res.assets.map((a) => a.uri).slice(0, limit);
}
