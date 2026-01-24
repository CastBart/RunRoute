/**
 * Preferences Store
 * Manages user preferences like distance unit (km vs miles)
 * Persists to AsyncStorage using Zustand persist middleware
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DistanceUnit } from '../utils/unitConversions';

interface PreferencesState {
  distanceUnit: DistanceUnit;
  setDistanceUnit: (unit: DistanceUnit) => void;
}

/**
 * Preferences store using Zustand with persist middleware
 * Automatically syncs to AsyncStorage on every state change
 */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      distanceUnit: 'km',
      setDistanceUnit: (unit: DistanceUnit) => set({ distanceUnit: unit }),
    }),
    {
      name: '@runroute/preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
