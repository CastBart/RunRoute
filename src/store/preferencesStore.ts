/**
 * Preferences Store
 * Manages user preferences like distance unit (km vs miles) and privacy settings
 * Persists to AsyncStorage using Zustand persist middleware
 * Privacy settings are also synced to the backend for multi-user enforcement
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DistanceUnit } from '../utils/unitConversions';
import { PrivacySettings } from '../types';

interface PreferencesState {
  // Display preferences
  distanceUnit: DistanceUnit;
  setDistanceUnit: (unit: DistanceUnit) => void;

  // Privacy settings (cached locally, synced to backend)
  showOnMap: boolean;
  allowComments: boolean;
  publicProfile: boolean;
  setPrivacySettings: (settings: Partial<PrivacySettings>) => void;

  // Hydration flag for privacy settings from backend
  privacySettingsLoaded: boolean;
  setPrivacySettingsLoaded: (loaded: boolean) => void;
}

/**
 * Preferences store using Zustand with persist middleware
 * Automatically syncs to AsyncStorage on every state change
 */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      // Display preferences
      distanceUnit: 'km',
      setDistanceUnit: (unit: DistanceUnit) => set({ distanceUnit: unit }),

      // Privacy settings - default to true (public)
      showOnMap: true,
      allowComments: true,
      publicProfile: true,
      setPrivacySettings: (settings: Partial<PrivacySettings>) =>
        set((state) => ({
          showOnMap: settings.show_on_map ?? state.showOnMap,
          allowComments: settings.allow_comments ?? state.allowComments,
          publicProfile: settings.public_profile ?? state.publicProfile,
        })),

      // Hydration tracking
      privacySettingsLoaded: false,
      setPrivacySettingsLoaded: (loaded: boolean) => set({ privacySettingsLoaded: loaded }),
    }),
    {
      name: '@runroute/preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
