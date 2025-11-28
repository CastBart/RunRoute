import { create } from 'zustand';
import { Location, Route, Waypoint } from '../types';
import { getDirections, decodePolyline, calculateDistance } from '../services/googleMapsService';

// Seeded random number generator for reproducible randomization
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
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
  addWaypoint: (location: Location) => void;
  updateWaypoint: (waypointId: string, location: Location) => void;
  removeWaypoint: (waypointId: string) => void;
  setWaypoints: (waypoints: Waypoint[]) => void;
  generateRoute: () => Promise<void>;
  regenerateRoute: () => Promise<void>; // Generate new route with different seed
  updateRouteWithWaypoints: () => Promise<void>; // Update route with current waypoints
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

  addWaypoint: (location: Location) => {
    const waypoints = get().waypoints;
    const newWaypoint: Waypoint = {
      id: `waypoint_${Date.now()}`,
      latitude: location.latitude,
      longitude: location.longitude,
      order: waypoints.length,
    };
    set({ waypoints: [...waypoints, newWaypoint] });
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
    const waypoints = get().waypoints
      .filter((wp) => wp.id !== waypointId)
      .map((wp, index) => ({ ...wp, order: index }));
    set({ waypoints });
  },

  setWaypoints: (waypoints: Waypoint[]) => {
    set({ waypoints });
  },

  generateRoute: async () => {
    const { startLocation, endLocation, waypoints, targetDistance, isLoop } = get();

    console.log('🚀 Generate Route Called');
    console.log('Start:', startLocation);
    console.log('End:', endLocation);
    console.log('Is Loop:', isLoop);
    console.log('Target Distance:', targetDistance, 'km');

    if (!startLocation) {
      console.error('❌ No start location');
      set({ error: 'Please select a start location' });
      return;
    }

    if (!endLocation) {
      console.error('❌ No end location');
      set({ error: 'Please select an end location' });
      return;
    }

    if (targetDistance < 0.5) {
      console.error('❌ Target distance too small');
      set({ error: 'Please set a target distance of at least 0.5 km' });
      return;
    }

    set({ isGenerating: true, error: null });
    console.log('⏳ Generating route...');

    // For loop routes with same start/end, we need to generate waypoints to create an actual loop
    let actualEndLocation = endLocation;
    let generatedWaypoints = waypoints;

    if (isLoop && startLocation.latitude === endLocation.latitude && startLocation.longitude === endLocation.longitude) {
      console.log('🔄 Generating loop route with waypoints');
      console.log('Target distance for loop:', targetDistance, 'km');

      // Generate random seed for this route (or use existing for regeneration)
      const seed = Date.now();
      const rng = seededRandom(seed);

      // Calculate radius based on target distance
      // We create 4 waypoints in a SYMMETRIC SQUARE pattern
      // The route goes: Start -> WP1 -> WP2 -> WP3 -> WP4 -> Start (5 segments)
      // For a square with waypoints at North, East, South, West:
      // - Each segment is a diagonal: distance = radius * sqrt(2)
      // - Total straight-line distance = 4 * radius * sqrt(2) ≈ 5.657 * radius
      // - Account for roads not being straight: divide by efficiency factor
      const geometricCoefficient = 4 * Math.sqrt(2); // 5.657
      const roadEfficiencyFactor = 1.4; // Roads add ~40% to straight-line distance
      const radiusInKm = targetDistance / (geometricCoefficient * roadEfficiencyFactor);

      // Convert to degrees (at equator: 1 degree lat ≈ 111 km)
      // For longitude, we need to adjust for latitude: lng_dist = lat_dist * cos(latitude)
      const latRadiusInDegrees = radiusInKm / 111;
      const lonRadiusInDegrees = radiusInKm / (111 * Math.cos(startLocation.latitude * Math.PI / 180));

      console.log('Calculated radius:', radiusInKm.toFixed(2), 'km');
      console.log('Radius in degrees:', { lat: latRadiusInDegrees.toFixed(5), lon: lonRadiusInDegrees.toFixed(5) });

      // Generate random rotation angle for variety
      const rotationAngle = rng() * 2 * Math.PI; // 0 to 360 degrees
      console.log('Random rotation angle:', (rotationAngle * 180 / Math.PI).toFixed(1), 'degrees');

      // Base waypoints for symmetric square (North, East, South, West at 90° intervals)
      const baseAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];

      // Create 4 waypoints with rotation applied
      generatedWaypoints = baseAngles.map((baseAngle, index) => {
        const angle = baseAngle + rotationAngle;
        return {
          id: `temp_wp${index + 1}`,
          latitude: startLocation.latitude + latRadiusInDegrees * Math.sin(angle),
          longitude: startLocation.longitude + lonRadiusInDegrees * Math.cos(angle),
          order: index,
        };
      });

      console.log('Generated waypoints for loop:', generatedWaypoints.length);
      console.log('Waypoint coordinates:', generatedWaypoints.map(wp => `(${wp.latitude.toFixed(4)}, ${wp.longitude.toFixed(4)})`));

      // Store seed for regeneration
      set({ currentRouteSeed: seed });
    }

    try {
      // Prepare waypoints for API call
      const waypointLocations = generatedWaypoints
        .sort((a, b) => a.order - b.order)
        .map((wp) => ({ latitude: wp.latitude, longitude: wp.longitude }));

      console.log('📍 Calling Directions API...');
      console.log('Using waypoints:', waypointLocations.length);

      // Get directions from Google
      const { data, error } = await getDirections(
        startLocation,
        actualEndLocation,
        waypointLocations.length > 0 ? waypointLocations : undefined
      );

      console.log('📡 API Response:', { hasData: !!data, error });

      if (error || !data || data.routes.length === 0) {
        console.error('❌ API Error:', error);
        set({
          error: error || 'No route found. Please try different locations.',
          isGenerating: false,
        });
        return;
      }

      const route = data.routes[0];

      console.log('📊 Route data received from API');
      console.log('Encoded polyline:', route.overview_polyline.points.substring(0, 50) + '...');
      console.log('Number of legs:', route.legs.length);

      // DETAILED ROUTE ANALYSIS (Phase 7 - Debug routing behavior)
      console.log('\n📊 DETAILED ROUTE ANALYSIS:');
      console.log('═══════════════════════════════════════');
      console.log('Number of legs:', route.legs.length);
      console.log('Expected legs:', waypointLocations.length + 1); // waypoints + 1

      route.legs.forEach((leg, i) => {
        console.log(`\nLeg ${i + 1}:`);
        console.log('  From:', `(${leg.start_location.lat.toFixed(5)}, ${leg.start_location.lng.toFixed(5)})`);
        console.log('  To:', `(${leg.end_location.lat.toFixed(5)}, ${leg.end_location.lng.toFixed(5)})`);
        console.log('  Distance:', leg.distance.text);
        console.log('  Duration:', leg.duration.text);
        console.log('  Steps:', leg.steps.length);
      });

      // Check waypoint positions
      console.log('\n📍 WAYPOINT POSITIONS:');
      console.log('Start:', `(${startLocation.latitude.toFixed(5)}, ${startLocation.longitude.toFixed(5)})`);
      waypointLocations.forEach((wp, i) => {
        console.log(`WP${i + 1}:`, `(${wp.latitude.toFixed(5)}, ${wp.longitude.toFixed(5)})`);
      });
      console.log('End:', `(${actualEndLocation.latitude.toFixed(5)}, ${actualEndLocation.longitude.toFixed(5)})`);

      // Check if Google reordered waypoints (shouldn't happen without optimize:true)
      if ((data.routes[0] as any).waypoint_order && (data.routes[0] as any).waypoint_order.length > 0) {
        console.log('\n⚠️ WARNING: Google reordered waypoints!');
        console.log('Waypoint order:', (data.routes[0] as any).waypoint_order);
      }

      console.log('═══════════════════════════════════════\n');

      // Decode polyline to get all route points
      const polylinePoints = decodePolyline(route.overview_polyline.points);

      console.log('🔵 Decoded polyline points:', polylinePoints.length);
      if (polylinePoints.length > 0) {
        console.log('First point:', polylinePoints[0]);
        console.log('Last point:', polylinePoints[polylinePoints.length - 1]);
      } else {
        console.warn('⚠️ WARNING: Polyline is empty after decoding!');
      }

      // Calculate TOTAL distance and duration by summing ALL legs
      // When there are waypoints, Google returns multiple legs (one per segment)
      let totalDistanceInMeters = 0;
      let totalDurationInSeconds = 0;

      route.legs.forEach((leg, index) => {
        console.log(`Leg ${index + 1}:`, {
          distance: leg.distance.text,
          duration: leg.duration.text,
          distanceMeters: leg.distance.value,
          durationSeconds: leg.duration.value,
        });
        totalDistanceInMeters += leg.distance.value;
        totalDurationInSeconds += leg.duration.value;
      });

      const distanceInKm = totalDistanceInMeters / 1000;

      console.log('📏 Total distance calculation:', {
        totalDistanceInMeters,
        distanceInKm,
        totalDurationInSeconds,
        legs: route.legs.length,
      });

      // Create route object
      const newRoute: Route = {
        id: `route_${Date.now()}`,
        start_location: startLocation,
        end_location: endLocation,
        waypoints: generatedWaypoints, // Include auto-generated loop waypoints
        polyline: polylinePoints,
        distance: distanceInKm,
        estimated_duration: totalDurationInSeconds,
        is_loop: isLoop,
        target_distance: targetDistance,
      };

      console.log('✨ Setting currentRoute in store');
      console.log('Route ID:', newRoute.id);
      console.log('Polyline length in route:', newRoute.polyline.length);
      console.log('Total distance in route:', newRoute.distance, 'km');
      console.log('Total duration in route:', newRoute.estimated_duration, 'seconds', `(${Math.round((newRoute.estimated_duration || 0) / 60)}m)`);

      set({
        currentRoute: newRoute,
        waypoints: generatedWaypoints, // Update store waypoints
        isGenerating: false,
        error: null,
      });

      console.log('✅ Route generation complete!');
    } catch (error: any) {
      console.error('Error generating route:', error);
      set({
        error: error.message || 'Failed to generate route. Please try again.',
        isGenerating: false,
      });
    }
  },

  regenerateRoute: async () => {
    const { startLocation, endLocation, targetDistance, isLoop } = get();

    console.log('🔄 Regenerating route with new randomization');

    // Validate we have the necessary data to regenerate
    if (!startLocation || !endLocation) {
      set({ error: 'Cannot regenerate: missing location data' });
      return;
    }

    if (!isLoop) {
      // For non-loop routes, just call generateRoute again
      // (no randomization currently, but could add in future)
      console.log('Regenerating non-loop route (same route will be generated)');
      await get().generateRoute();
      return;
    }

    // For loop routes, generateRoute will use Date.now() as new seed
    // This automatically creates a different route
    await get().generateRoute();
  },

  updateRouteWithWaypoints: async () => {
    const { startLocation, endLocation, waypoints, targetDistance, isLoop } = get();

    console.log('🔄 Updating route with current waypoints');
    console.log('Current waypoints:', waypoints.length);

    if (!startLocation || !endLocation) {
      set({ error: 'Cannot update route: missing location data' });
      return;
    }

    set({ isGenerating: true, error: null });

    try {
      // Prepare waypoints for API call (use existing waypoints, not auto-generated)
      const waypointLocations = waypoints
        .sort((a, b) => a.order - b.order)
        .map((wp) => ({ latitude: wp.latitude, longitude: wp.longitude }));

      console.log('📍 Calling Directions API with user waypoints...');
      console.log('Using waypoints:', waypointLocations.length);

      // Get directions from Google using current waypoints
      const { data, error } = await getDirections(
        startLocation,
        endLocation,
        waypointLocations.length > 0 ? waypointLocations : undefined
      );

      console.log('📡 API Response:', { hasData: !!data, error });

      if (error || !data || data.routes.length === 0) {
        console.error('❌ API Error:', error);
        set({
          error: error || 'No route found. Please try different locations.',
          isGenerating: false,
        });
        return;
      }

      const route = data.routes[0];

      console.log('📊 Route data received from API');
      console.log('Encoded polyline:', route.overview_polyline.points.substring(0, 50) + '...');
      console.log('Number of legs:', route.legs.length);

      // DETAILED ROUTE ANALYSIS (Phase 7 - Debug routing behavior)
      console.log('\n📊 DETAILED ROUTE ANALYSIS:');
      console.log('═══════════════════════════════════════');
      console.log('Number of legs:', route.legs.length);
      console.log('Expected legs:', waypointLocations.length + 1); // waypoints + 1

      route.legs.forEach((leg, i) => {
        console.log(`\nLeg ${i + 1}:`);
        console.log('  From:', `(${leg.start_location.lat.toFixed(5)}, ${leg.start_location.lng.toFixed(5)})`);
        console.log('  To:', `(${leg.end_location.lat.toFixed(5)}, ${leg.end_location.lng.toFixed(5)})`);
        console.log('  Distance:', leg.distance.text);
        console.log('  Duration:', leg.duration.text);
        console.log('  Steps:', leg.steps.length);
      });

      // Check waypoint positions
      console.log('\n📍 WAYPOINT POSITIONS:');
      console.log('Start:', `(${startLocation.latitude.toFixed(5)}, ${startLocation.longitude.toFixed(5)})`);
      waypointLocations.forEach((wp, i) => {
        console.log(`WP${i + 1}:`, `(${wp.latitude.toFixed(5)}, ${wp.longitude.toFixed(5)})`);
      });
      console.log('End:', `(${endLocation.latitude.toFixed(5)}, ${endLocation.longitude.toFixed(5)})`);

      // Check if Google reordered waypoints (shouldn't happen without optimize:true)
      if ((data.routes[0] as any).waypoint_order && (data.routes[0] as any).waypoint_order.length > 0) {
        console.log('\n⚠️ WARNING: Google reordered waypoints!');
        console.log('Waypoint order:', (data.routes[0] as any).waypoint_order);
      }

      console.log('═══════════════════════════════════════\n');

      // Decode polyline to get all route points
      const polylinePoints = decodePolyline(route.overview_polyline.points);

      console.log('🔵 Decoded polyline points:', polylinePoints.length);

      // Calculate TOTAL distance and duration by summing ALL legs
      let totalDistanceInMeters = 0;
      let totalDurationInSeconds = 0;

      route.legs.forEach((leg, index) => {
        console.log(`Leg ${index + 1}:`, {
          distance: leg.distance.text,
          duration: leg.duration.text,
        });
        totalDistanceInMeters += leg.distance.value;
        totalDurationInSeconds += leg.duration.value;
      });

      const distanceInKm = totalDistanceInMeters / 1000;

      console.log('📏 Total distance:', distanceInKm, 'km');

      // Create updated route object with current waypoints
      const updatedRoute: Route = {
        id: `route_${Date.now()}`,
        start_location: startLocation,
        end_location: endLocation,
        waypoints: waypoints, // Keep user's current waypoints
        polyline: polylinePoints,
        distance: distanceInKm,
        estimated_duration: totalDurationInSeconds,
        is_loop: isLoop,
        target_distance: targetDistance,
      };

      console.log('✨ Setting updated route in store');

      set({
        currentRoute: updatedRoute,
        isGenerating: false,
        error: null,
      });

      console.log('✅ Route update complete!');
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
