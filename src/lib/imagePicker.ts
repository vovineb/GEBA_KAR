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
