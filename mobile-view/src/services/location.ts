import * as Location from 'expo-location';
import { apiService } from './api';

export interface LocationData {
  latitude: number;
  longitude: number;
}

export const getCurrentLocation = async (): Promise<LocationData> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    // A GPS fix can stall indoors on some Android phones and never resolve, so give up after
    // 20 seconds and fall back to the phone's last known position.
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000)),
    ]) ?? await Location.getLastKnownPositionAsync();

    if (!location) {
      throw new Error('Could not get your location. Turn on GPS / Location, move near a window and try again.');
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    throw error;
  }
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

