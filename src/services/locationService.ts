import * as Location from 'expo-location';
import { Location as LocationType } from '../types';

/**
 * Request location permissions from the user
 */
export const requestLocationPermissions = async (): Promise<{
  granted: boolean;
  error?: string;
}> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      return {
        granted: false,
        error: 'Location permission was denied. Please enable it in your device settings.',
      };
    }

    return { granted: true };
  } catch (error: any) {
    console.error('Error requesting location permissions:', error);
    return {
      granted: false,
      error: error.message || 'Failed to request location permissions',
    };
  }
};

/**
 * Get the user's current location
 */
export const getCurrentLocation = async (): Promise<{
  location: LocationType | null;
  error?: string;
}> => {
  try {
    const { granted } = await requestLocationPermissions();

    if (!granted) {
      return {
        location: null,
        error: 'Location permission is required to get your current location',
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch (error: any) {
    console.error('Error getting current location:', error);
    return {
      location: null,
      error: error.message || 'Failed to get current location',
    };
  }
};

/**
 * Check if location services are enabled
 */
export const checkLocationServicesEnabled = async (): Promise<boolean> => {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch (error) {
    console.error('Error checking location services:', error);
    return false;
  }
};
