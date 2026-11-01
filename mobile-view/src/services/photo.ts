import * as ImagePicker from 'expo-image-picker';

/**
 * Take a live photo with the camera (never the gallery) and return it as a JPEG data URI,
 * or null when the user cancels. Used for check-out and school entry / exit photos.
 */
export async function takeLivePhoto({ front = false }: { front?: boolean } = {}): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission is needed. Allow camera access for this app in your phone settings.');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    cameraType: front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    allowsEditing: false,
    quality: 0.4,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  return `data:image/jpeg;base64,${result.assets[0].base64}`;
}
