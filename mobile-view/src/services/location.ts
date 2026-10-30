import * as Location from 'expo-location';
import { apiService } from './api';

export interface LocationData {
  latitude: number;
  longitude: number;
}

export class LocationPermissionError extends Error {
  constructor() {
    super('Location permission is off. Allow location access for this app in your phone settings, then try again.');
    this.name = 'LocationPermissionError';
  }
}

export const getCurrentLocation = async (
  { requestPermission = true }: { requestPermission?: boolean } = {},
): Promise<LocationData> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted' && requestPermission && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }

    if (permission.status !== 'granted') {
      throw new LocationPermissionError();
    }

    // A GPS fix can stall indoors on some Android phones and never resolve, so give up after
    // 20 seconds and fall back to the phone's last known position.
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), 20000);
      }),
    ]) ?? await Location.getLastKnownPositionAsync();

    if (!location) {
      throw new Error('Could not get your location. Turn on GPS / Location, move near a window and try again.');
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    if (!(error instanceof LocationPermissionError)) {
      console.error('Error getting location:', error);
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
};

/**
 * Pincode (and town) for a GPS point: the phone's own address lookup first, then the server
 * (some phones return no postal code). Returns '' for pincode when neither knows it.
 */
export const getPincodeFromLocation = async (loc: LocationData): Promise<{ pincode: string; town: string }> => {
  let pincode = '';
  let town = '';
  try {
    const [place] = await Location.reverseGeocodeAsync(loc);
    const code = String(place?.postalCode || '').replace(/\D/g, '');
    if (code.length === 6) pincode = code;
    town = place?.city || place?.subregion || place?.district || '';
  } catch {
    // fall through to the server lookup
  }
  if (!pincode) {
    try {
      const res: any = await apiService.get(`/location/pincode-from-coords?lat=${loc.latitude}&lng=${loc.longitude}`);
      if (res?.pincode) pincode = String(res.pincode);
      if (!town && res?.town) town = String(res.town);
    } catch {
      // caller shows "could not detect"
    }
  }
  return { pincode, town };
};

export const getTownFromPincode = async (pincode: string): Promise<{ town: string; district?: string; state?: string }> => {
  try {
    if (!pincode || pincode.length !== 6) {
      throw new Error('Valid 6-digit pincode is required');
    }

    const response = await apiService.get(`/location/get-town?pincode=${pincode}`);
    return response;
  } catch (error: any) {
    console.error('Error getting town from pincode:', error);
    throw new Error(error.message || 'Failed to get town from pincode');
  }
};

