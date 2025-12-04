/**
 * Preferences Store
 * Manages user preferences like distance unit (km vs miles)
 * Persists to AsyncStorage for cross-session persistence
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DistanceUnit } from '../utils/unitConversions';

const PREFERENCES_STORAGE_KEY = '@runroute/preferences';

interface PreferencesState {
  distanceUnit: DistanceUnit;
  isLoaded: boolean;
  setDistanceUnit: (unit: DistanceUnit) => Promise<void>;
  loadPreferences: () => Promise<void>;
}

/**
 * Default preferences
 */
const DEFAULT_PREFERENCES = {
  distanceUnit: 'km' as DistanceUnit,
};

/**
 * Preferences store using Zustand
 */
export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  distanceUnit: DEFAULT_PREFERENCES.distanceUnit,
  isLoaded: false,

  /**
   * Set distance unit preference and persist to AsyncStorage
   */
  setDistanceUnit: async (unit: DistanceUnit) => {
    try {
      // Update state
      set({ distanceUnit: unit });

      // Persist to AsyncStorage
      const preferences = {
        distanceUnit: unit,
      };
      await AsyncStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences)
      );
    } catch (error) {
      console.error('Failed to save distance unit preference:', error);
    }
  },

  /**
   * Load preferences from AsyncStorage
   * Should be called on app startup
   */
  loadPreferences: async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);

      if (stored) {
        const preferences = JSON.parse(stored);
        set({
          distanceUnit: preferences.distanceUnit || DEFAULT_PREFERENCES.distanceUnit,
          isLoaded: true,
        });
      } else {
        // No stored preferences, use defaults
        set({
          distanceUnit: DEFAULT_PREFERENCES.distanceUnit,
          isLoaded: true,
        });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      // On error, use defaults
      set({
        distanceUnit: DEFAULT_PREFERENCES.distanceUnit,
        isLoaded: true,
      });
    }
  },
}));
