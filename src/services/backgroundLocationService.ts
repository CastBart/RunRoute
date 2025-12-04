/**
 * Background Location Service
 * Handles background location tracking when the app is not in the foreground or screen is locked
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { GPSPoint } from '../store/trackingStore';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Store the callback to be called when location updates are received
let locationUpdateCallback: ((location: GPSPoint) => void) | null = null;

/**
 * Register the background location task
 * This must be called at the top level of the app (in App.tsx or index.js)
 */
export const registerBackgroundLocationTask = () => {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    if (error) {
      console.error('Background location task error:', error);
      return;
    }

    if (data) {
      const { locations } = data;
      if (locations && locations.length > 0) {
        const location = locations[0];

        const gpsPoint: GPSPoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude || undefined,
          accuracy: location.coords.accuracy || 0,
          speed: location.coords.speed || undefined,
          timestamp: Date.now(),
        };

        // Call the registered callback if it exists
        if (locationUpdateCallback) {
          locationUpdateCallback(gpsPoint);
        }

        // Store in AsyncStorage as backup (in case app is killed)
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const existingData = await AsyncStorage.getItem('background_gps_trail');
          const trail = existingData ? JSON.parse(existingData) : [];
          trail.push(gpsPoint);

          // Keep only last 10000 points to prevent storage overflow
          if (trail.length > 10000) {
            trail.shift();
          }

          await AsyncStorage.setItem('background_gps_trail', JSON.stringify(trail));
        } catch (err) {
          console.error('Error storing background GPS data:', err);
        }
      }
    }
  });
};

/**
 * Check if background location task is registered
 */
export const isBackgroundTaskRegistered = async (): Promise<boolean> => {
  return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
};

/**
 * Start background location tracking
 */
export const startBackgroundLocationTracking = async (
  callback: (location: GPSPoint) => void
): Promise<boolean> => {
  try {
    // Check permissions
    const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.error('Foreground location permission not granted');
      return false;
    }

    // Request background permissions
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission not granted, tracking may stop when app is backgrounded');
    }

    // Register the callback
    locationUpdateCallback = callback;

    // Check if already registered
    const isRegistered = await isBackgroundTaskRegistered();
    if (isRegistered) {
      console.log('Background task already registered, stopping first...');
      await stopBackgroundLocationTracking();
    }

    // Start background location updates
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 5000, // Update every 5 seconds
      distanceInterval: 5, // Update every 5 meters
      foregroundService: {
        notificationTitle: 'RunRoute is tracking your run',
        notificationBody: 'Tap to return to your run',
        notificationColor: '#007AFF',
      },
      pausesUpdatesAutomatically: false, // Keep updating even when stationary
      showsBackgroundLocationIndicator: true, // iOS: show blue bar
    });

    console.log('Background location tracking started');
    return true;
  } catch (error) {
    console.error('Error starting background location tracking:', error);
    return false;
  }
};

/**
 * Stop background location tracking
 */
export const stopBackgroundLocationTracking = async (): Promise<void> => {
  try {
    const isRegistered = await isBackgroundTaskRegistered();
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('Background location tracking stopped');
    }

    // Clear the callback
    locationUpdateCallback = null;

    // Clear stored backup data
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('background_gps_trail');
    } catch (err) {
      console.error('Error clearing background GPS data:', err);
    }
  } catch (error) {
    console.error('Error stopping background location tracking:', error);
  }
};

/**
 * Get stored background GPS trail (backup in case app was killed)
 */
export const getStoredBackgroundTrail = async (): Promise<GPSPoint[]> => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const existingData = await AsyncStorage.getItem('background_gps_trail');
    return existingData ? JSON.parse(existingData) : [];
  } catch (err) {
    console.error('Error retrieving background GPS trail:', err);
    return [];
  }
};

/**
 * Check if background location tracking is active
 */
export const isBackgroundTrackingActive = async (): Promise<boolean> => {
  try {
    const isRegistered = await isBackgroundTaskRegistered();
    if (!isRegistered) return false;

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    return hasStarted;
  } catch (error) {
    console.error('Error checking background tracking status:', error);
    return false;
  }
};
