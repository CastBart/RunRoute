import { create } from 'zustand';
import { Location, Route, Waypoint } from '../types';
import { getDirections, decodePolyline } from '../services/googleMapsService';

// Seeded random number generator for reproducible randomization
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// ---------------------------------------------------------------------------
// Round-trip (loop) configuration – similar spirit to GraphHopper's round_trip
// ---------------------------------------------------------------------------

const LOOP_WAYPOINT_COUNT = 6;          // more points -> smoother, more natural loop
const ROAD_EFFICIENCY_FACTOR = 1.3;     // roads ~30% longer than straight line
const DISTANCE_TOLERANCE = 0.10;        // accept ±10% around target distance
const MAX_GENERATION_ATTEMPTS = 4;      // how many times we adjust radius
const RADIUS_JITTER = 0.2;              // per-waypoint radius variation (±20%)

interface GeneratedLoopCore {
  waypoints: Waypoint[];
  polyline: Location[];
  distanceKm: number;
  durationSec: number;
  seed: number;
}

// Approximate "base" loop radius from target distance: C = 2πR, but
// roads are longer so we divide by ROAD_EFFICIENCY_FACTOR.
function computeBaseRadiusKm(targetDistanceKm: number): number {
  const effectiveCircumferenceKm = targetDistanceKm / ROAD_EFFICIENCY_FACTOR;
  return effectiveCircumferenceKm / (2 * Math.PI);
}

// Generate N circular waypoints around the start, with some jitter & rotation.
// This is the GraphHopper-like "via point" generation step.
function generateCircularWaypoints(
  startLocation: Location,
  baseRadiusKm: number,
  waypointCount: number,
  rng: () => number,
  radiusMultiplier = 1
): Waypoint[] {
  const radiusKm = baseRadiusKm * radiusMultiplier;

  // Convert radius (km) to lat/lng degrees
  const latRadiusDeg = radiusKm / 111;
  const lonRadiusDeg =
    radiusKm / (111 * Math.cos((startLocation.latitude * Math.PI) / 180));

  // Randomly rotate the whole loop so we don't always go north first
  const baseRotation = rng() * 2 * Math.PI;

  const waypoints: Waypoint[] = [];

  for (let i = 0; i < waypointCount; i++) {
    const angle = baseRotation + (2 * Math.PI * i) / waypointCount;

    // Jitter radius a bit so it's not a perfect circle
    const jitterFactor = 1 + (rng() * 2 - 1) * RADIUS_JITTER; // (1 - J) .. (1 + J)
    const effectiveLatRadius = latRadiusDeg * jitterFactor;
    const effectiveLonRadius = lonRadiusDeg * jitterFactor;

    waypoints.push({
      id: `temp_wp_${i}`,
      latitude:
        startLocation.latitude + effectiveLatRadius * Math.sin(angle),
      longitude:
        startLocation.longitude + effectiveLonRadius * Math.cos(angle),
      order: i,
    });
  }

  return waypoints;
}

// Call Google Directions for a loop: start -> waypoints -> start
// and return polyline + summed distance/duration.
async function requestLoopDirections(
  startLocation: Location,
  waypoints: Waypoint[]
): Promise<{ polyline: Location[]; distanceKm: number; durationSec: number }> {
  const waypointLocations = waypoints
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((wp) => ({ latitude: wp.latitude, longitude: wp.longitude }));

  const { data, error } = await getDirections(
    startLocation,
    startLocation,
    waypointLocations.length > 0 ? waypointLocations : undefined
  );

  if (error || !data || data.routes.length === 0) {
    throw new Error(error || 'No loop route found for generated waypoints');
  }

  const route = data.routes[0];

  // Decode polyline & sum all legs
  const polylinePoints = decodePolyline(route.overview_polyline.points);

  let totalDistanceInMeters = 0;
  let totalDurationInSeconds = 0;

  route.legs.forEach((leg) => {
    totalDistanceInMeters += leg.distance.value;
    totalDurationInSeconds += leg.duration.value;
  });

  return {
    polyline: polylinePoints,
    distanceKm: totalDistanceInMeters / 1000,
    durationSec: totalDurationInSeconds,
  };
}

// Full "round_trip" style loop generator:
// - Guess radius from target
// - Generate circular waypoints
// - Get route & distance
// - Adjust radius multiplier until we're close to the target distance
async function generateLoopCore(
  startLocation: Location,
  targetDistanceKm: number
): Promise<GeneratedLoopCore> {
  const seed = Date.now();
  const rng = seededRandom(seed);
  const baseRadiusKm = computeBaseRadiusKm(targetDistanceKm);

  let radiusMultiplier = 1;
  let best: GeneratedLoopCore | null = null;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const waypoints = generateCircularWaypoints(
      startLocation,
      baseRadiusKm,
      LOOP_WAYPOINT_COUNT,
      rng,
      radiusMultiplier
    );

    const { polyline, distanceKm, durationSec } = await requestLoopDirections(
      startLocation,
      waypoints
    );

    const diff = distanceKm - targetDistanceKm;
    const ratio = distanceKm / targetDistanceKm;

    // Track best attempt so far
    if (!best || Math.abs(diff) < Math.abs(best.distanceKm - targetDistanceKm)) {
      best = {
        waypoints,
        polyline,
        distanceKm,
        durationSec,
        seed,
      };
    }

    // Close enough? Break early.
    if (Math.abs(diff) <= targetDistanceKm * DISTANCE_TOLERANCE) {
      break;
    }

    // Adjust radius: too long -> shrink, too short -> expand
    if (ratio !== 0) {
      radiusMultiplier /= ratio;
    } else {
      // safety fallback
      radiusMultiplier *= 1.1;
    }
  }

  if (!best) {
    throw new Error('Failed to generate loop route');
  }

  return best;
}

interface RouteState {
  currentRoute: Route | null;
  startLocation: Location | null;
  endLocation: Location | null;
  waypoints: Waypoint[];
  targetDistance: number;
  isLoop: boolean;
  isGenerating: boolean;
  error: string | null;
  currentRouteSeed: number | null; // Track randomization seed for regeneration

  // Actions
  setStartLocation: (location: Location) => void;
  setEndLocation: (location: Location) => void;
  setTargetDistance: (distance: number) => void;
  setIsLoop: (isLoop: boolean) => void;
  addWaypoint: (location: Location, insertOrder?: number) => void;
  updateWaypoint: (waypointId: string, location: Location) => void;
  removeWaypoint: (waypointId: string) => void;
  setWaypoints: (waypoints: Waypoint[]) => void;
  generateRoute: () => Promise<void>;
  regenerateRoute: () => Promise<void>;
  updateRouteWithWaypoints: () => Promise<void>;
  clearRoute: () => void;
  clearError: () => void;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  currentRoute: null,
  startLocation: null,
  endLocation: null,
  waypoints: [],
  targetDistance: 5, // Default 5km
  isLoop: true, // Default to loop
  isGenerating: false,
  error: null,
  currentRouteSeed: null,

  setStartLocation: (location: Location) => {
    set({ startLocation: location });
    // If loop mode and no end location, set end = start
    const { isLoop, endLocation } = get();
    if (isLoop && !endLocation) {
      set({ endLocation: location });
    }
  },

  setEndLocation: (location: Location) => {
    set({ endLocation: location });
  },

  setTargetDistance: (distance: number) => {
    set({ targetDistance: distance });
  },

  setIsLoop: (isLoop: boolean) => {
    set({ isLoop });
    // If switching to loop mode, set end = start
    const { startLocation } = get();
    if (isLoop && startLocation) {
      set({ endLocation: startLocation });
    }
  },

  addWaypoint: (location: Location, insertOrder?: number) => {
    const waypoints = get().waypoints;

    // Determine order: use provided order, or append to end
    const order = insertOrder !== undefined ? insertOrder : waypoints.length;

    const newWaypoint: Waypoint = {
      id: `waypoint_${Date.now()}`,
      latitude: location.latitude,
      longitude: location.longitude,
      order: order,
    };

    // If inserting in middle, shift all subsequent waypoints
    const updatedWaypoints = waypoints.map(wp => {
      if (wp.order >= order) {
        return { ...wp, order: wp.order + 1 };
      }
      return wp;
    });

    // Add new waypoint and sort by order
    const finalWaypoints = [...updatedWaypoints, newWaypoint]
      .sort((a, b) => a.order - b.order);

    set({ waypoints: finalWaypoints });
  },

  updateWaypoint: (waypointId: string, location: Location) => {
    const waypoints = get().waypoints.map((wp) =>
      wp.id === waypointId
        ? { ...wp, latitude: location.latitude, longitude: location.longitude }
        : wp
    );
    set({ waypoints });
  },

  removeWaypoint: (waypointId: string) => {
    const waypoints = get()
      .waypoints.filter((wp) => wp.id !== waypointId)
      .map((wp, index) => ({ ...wp, order: index }));
    set({ waypoints });
  },

  setWaypoints: (waypoints: Waypoint[]) => {
    set({ waypoints });
  },

  generateRoute: async () => {
    const { startLocation, endLocation, waypoints, targetDistance, isLoop } = get();

    if (!startLocation) {
      set({ error: 'Please select a start location' });
      return;
    }

    if (!endLocation) {
      set({ error: 'Please select an end location' });
      return;
    }

    if (targetDistance < 0.5) {
      set({ error: 'Please set a target distance of at least 0.5 km' });
      return;
    }

    set({ isGenerating: true, error: null });

    try {
      // -----------------------------------------------------------------------
      // 1) LOOPED ROUTE: GraphHopper-like round_trip behaviour
      // -----------------------------------------------------------------------
      if (
        isLoop &&
        startLocation.latitude === endLocation.latitude &&
        startLocation.longitude === endLocation.longitude
      ) {
        const loopCore = await generateLoopCore(startLocation, targetDistance);

        const newRoute: Route = {
          id: `route_${Date.now()}`,
          start_location: startLocation,
          end_location: startLocation,
          waypoints: loopCore.waypoints,
          polyline: loopCore.polyline,
          distance: loopCore.distanceKm,
          estimated_duration: loopCore.durationSec,
          is_loop: isLoop,
          target_distance: targetDistance,
        };

        set({
          currentRoute: newRoute,
          waypoints: loopCore.waypoints,
          isGenerating: false,
          error: null,
          currentRouteSeed: loopCore.seed,
        });

        return;
      }

      // -----------------------------------------------------------------------
      // 2) NON-LOOP / MANUAL WAYPOINT ROUTE: original behaviour
      // -----------------------------------------------------------------------

      const waypointLocations = waypoints
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((wp) => ({ latitude: wp.latitude, longitude: wp.longitude }));

      const { data, error } = await getDirections(
        startLocation,
        endLocation,
        waypointLocations.length > 0 ? waypointLocations : undefined
      );

      if (error || !data || data.routes.length === 0) {
        set({
          error: error || 'No route found. Please try different locations.',
          isGenerating: false,
        });
        return;
      }

      const route = data.routes[0];

      const polylinePoints = decodePolyline(route.overview_polyline.points);

      let totalDistanceInMeters = 0;
      let totalDurationInSeconds = 0;

      route.legs.forEach((leg) => {
        totalDistanceInMeters += leg.distance.value;
        totalDurationInSeconds += leg.duration.value;
      });

      const distanceInKm = totalDistanceInMeters / 1000;

      const newRoute: Route = {
        id: `route_${Date.now()}`,
        start_location: startLocation,
        end_location: endLocation,
        waypoints,
        polyline: polylinePoints,
        distance: distanceInKm,
        estimated_duration: totalDurationInSeconds,
        is_loop: isLoop,
        target_distance: targetDistance,
      };

      set({
        currentRoute: newRoute,
        waypoints: newRoute.waypoints,  // Sync waypoints with route to prevent flickering
        isGenerating: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error generating route:', error);
      set({
        error: error.message || 'Failed to generate route. Please try again.',
        isGenerating: false,
      });
    }
  },

  regenerateRoute: async () => {
    const { startLocation, endLocation, isLoop } = get();

    if (!startLocation || !endLocation) {
      set({ error: 'Cannot regenerate: missing location data' });
      return;
    }

    if (!isLoop) {
      await get().generateRoute();
      return;
    }

    // For loop routes, generateRoute will use Date.now() as new seed
    await get().generateRoute();
  },

  updateRouteWithWaypoints: async () => {
    const { startLocation, endLocation, waypoints, targetDistance, isLoop } = get();

    if (!startLocation || !endLocation) {
      set({ error: 'Cannot update route: missing location data' });
      return;
    }

    set({ isGenerating: true, error: null });

    try {
      const waypointLocations = waypoints
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((wp) => ({ latitude: wp.latitude, longitude: wp.longitude }));

      const { data, error } = await getDirections(
        startLocation,
        endLocation,
        waypointLocations.length > 0 ? waypointLocations : undefined
      );

      if (error || !data || data.routes.length === 0) {
        set({
          error: error || 'No route found. Please try different locations.',
          isGenerating: false,
        });
        return;
      }

      const route = data.routes[0];

      const polylinePoints = decodePolyline(route.overview_polyline.points);

      let totalDistanceInMeters = 0;
      let totalDurationInSeconds = 0;

      route.legs.forEach((leg) => {
        totalDistanceInMeters += leg.distance.value;
        totalDurationInSeconds += leg.duration.value;
      });

      const distanceInKm = totalDistanceInMeters / 1000;

      const updatedRoute: Route = {
        id: `route_${Date.now()}`,
        start_location: startLocation,
        end_location: endLocation,
        waypoints,
        polyline: polylinePoints,
        distance: distanceInKm,
        estimated_duration: totalDurationInSeconds,
        is_loop: isLoop,
        target_distance: targetDistance,
      };

      set({
        currentRoute: updatedRoute,
        waypoints: updatedRoute.waypoints,  // Sync waypoints with route to prevent flickering
        isGenerating: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error updating route:', error);
      set({
        error: error.message || 'Failed to update route. Please try again.',
        isGenerating: false,
      });
    }
  },

  clearRoute: () => {
    set({
      currentRoute: null,
      startLocation: null,
      endLocation: null,
      waypoints: [],
      error: null,
      currentRouteSeed: null,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
