import { create } from 'zustand';
import { Route } from '../types';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  speed?: number;
  timestamp: number;
}

export interface TrackingMetrics {
  distanceMeters: number;
  durationSeconds: number;
  currentPaceSecondsPerKm: number;
  averagePaceSecondsPerKm: number;
  elevationGainMeters: number;
  calories: number;
}

interface TrackingState {
  // Tracking Status
  isTracking: boolean;
  isPaused: boolean;
  sessionId: string | null;
  plannedRouteId: string | null;
  plannedRoute: Route | null;

  // Timing
  startedAt: number | null;
  pausedAt: number | null;
  totalPausedTime: number;

  // GPS Data
  currentPosition: GPSPoint | null;
  gpsTrail: GPSPoint[];

  // Metrics
  metrics: TrackingMetrics;

  // Goals
  targetDistanceMeters?: number;

  // GPS Status
  gpsStatus: 'disabled' | 'searching' | 'active' | 'lost';
  error: string | null;

  // Actions
  startTracking: (params: {
    plannedRouteId?: string;
    targetDistanceMeters?: number;
    startPosition: GPSPoint;
  }) => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: () => void;
  updatePosition: (position: GPSPoint) => void;
  setGPSStatus: (status: TrackingState['gpsStatus']) => void;
  setError: (error: string | null) => void;
  setPlannedRoute: (route: Route | null) => void;
  reset: () => void;
}

const initialMetrics: TrackingMetrics = {
  distanceMeters: 0,
  durationSeconds: 0,
  currentPaceSecondsPerKm: 0,
  averagePaceSecondsPerKm: 0,
  elevationGainMeters: 0,
  calories: 0,
};

// Haversine formula to calculate distance between two GPS points
function calculateDistance(p1: GPSPoint, p2: GPSPoint): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (p1.latitude * Math.PI) / 180;
  const φ2 = (p2.latitude * Math.PI) / 180;
  const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate metrics from GPS trail
function calculateMetrics(
  gpsTrail: GPSPoint[],
  startTime: number,
  pausedTime: number
): TrackingMetrics {
  if (gpsTrail.length < 2) return initialMetrics;

  let totalDistance = 0;
  let elevationGain = 0;

  for (let i = 1; i < gpsTrail.length; i++) {
    const prev = gpsTrail[i - 1];
    const curr = gpsTrail[i];

    // Calculate distance
    totalDistance += calculateDistance(prev, curr);

    // Calculate elevation gain
    if (prev.altitude && curr.altitude && curr.altitude > prev.altitude) {
      elevationGain += curr.altitude - prev.altitude;
    }
  }

  const totalTime = Date.now() - startTime - pausedTime;
  const durationSeconds = Math.floor(totalTime / 1000);

  let averagePace = 0;
  let currentPace = 0;

  if (totalDistance > 0 && durationSeconds > 0) {
    averagePace = (durationSeconds / totalDistance) * 1000; // seconds per km

    // Current pace based on last 30 seconds of data
    const recent = gpsTrail.slice(-6); // Last 30 seconds assuming 5s intervals
    if (recent.length >= 2) {
      let recentDistance = 0;
      for (let i = 1; i < recent.length; i++) {
        recentDistance += calculateDistance(recent[i - 1], recent[i]);
      }
      if (recentDistance > 0) {
        currentPace = (30 / recentDistance) * 1000;
      }
    }
  }

  // Simple calorie estimation (50 cal per km)
  const calories = Math.round(totalDistance * 0.05);

  return {
    distanceMeters: totalDistance,
    durationSeconds,
    currentPaceSecondsPerKm: currentPace,
    averagePaceSecondsPerKm: averagePace,
    elevationGainMeters: elevationGain,
    calories,
  };
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  // Initial State
  isTracking: false,
  isPaused: false,
  sessionId: null,
  plannedRouteId: null,
  plannedRoute: null,

  startedAt: null,
  pausedAt: null,
  totalPausedTime: 0,

  currentPosition: null,
  gpsTrail: [],

  metrics: initialMetrics,

  gpsStatus: 'disabled',
  error: null,

  // Actions
  startTracking: (params) => {
    const state = get();
    const sessionId = `session_${Date.now()}`;

    // Use planned route distance if available and no explicit target is provided
    const targetDistance = params.targetDistanceMeters ||
      (state.plannedRoute?.distance ? state.plannedRoute.distance * 1000 : undefined);

    set({
      isTracking: true,
      isPaused: false,
      sessionId,
      plannedRouteId: params.plannedRouteId || state.plannedRoute?.id || null,
      targetDistanceMeters: targetDistance,
      startedAt: Date.now(),
      currentPosition: params.startPosition,
      gpsTrail: [params.startPosition],
      metrics: initialMetrics,
      totalPausedTime: 0,
      error: null,
      gpsStatus: 'active',
    });
  },

  pauseTracking: () => {
    set({
      isPaused: true,
      pausedAt: Date.now(),
    });
  },

  resumeTracking: () => {
    const state = get();
    if (state.isPaused && state.pausedAt) {
      const pauseDuration = Date.now() - state.pausedAt;
      set({
        isPaused: false,
        pausedAt: null,
        totalPausedTime: state.totalPausedTime + pauseDuration,
      });
    }
  },

  stopTracking: () => {
    set({
      isTracking: false,
      isPaused: false,
      gpsStatus: 'disabled',
    });
  },

  updatePosition: (newPosition) => {
    const state = get();
    if (!state.isTracking || state.isPaused) return;

    const newTrail = [...state.gpsTrail, newPosition];
    const newMetrics = calculateMetrics(
      newTrail,
      state.startedAt!,
      state.totalPausedTime
    );

    set({
      currentPosition: newPosition,
      gpsTrail: newTrail,
      metrics: newMetrics,
    });
  },

  setGPSStatus: (status) => set({ gpsStatus: status }),

  setError: (error) => set({ error }),

  setPlannedRoute: (route) => set({ plannedRoute: route }),

  reset: () =>
    set({
      isTracking: false,
      isPaused: false,
      sessionId: null,
      plannedRouteId: null,
      plannedRoute: null,
      startedAt: null,
      pausedAt: null,
      totalPausedTime: 0,
      currentPosition: null,
      gpsTrail: [],
      metrics: initialMetrics,
      gpsStatus: 'disabled',
      error: null,
    }),
}));
