import { supabase } from './supabase';
import { Route, RouteAttributionData, Location } from '../types';
import { arePolylinesEqual } from '../utils/routeConverter';

// Route with guaranteed ID after being saved to database
export interface SavedRoute extends Route {
  id: string;
  user_id: string;
  created_at: string;
}

class RouteService {
  /**
   * Save a planned route to the database
   * Returns the route with a real UUID from the database
   */
  async saveRoute(route: Route): Promise<SavedRoute> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Convert waypoints to match database format
    const waypointsJson = route.waypoints.map((wp) => ({
      latitude: wp.latitude,
      longitude: wp.longitude,
    }));

    // Convert polyline to match database format
    const polylineJson = route.polyline.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    }));

    const { data, error } = await supabase
      .from('routes')
      .insert([
        {
          user_id: user.id,
          name: route.name || null,
          start_location: {
            latitude: route.start_location.latitude,
            longitude: route.start_location.longitude,
          },
          end_location: {
            latitude: route.end_location.latitude,
            longitude: route.end_location.longitude,
          },
          waypoints: waypointsJson,
          polyline: polylineJson,
          distance: route.distance,
          estimated_duration: route.estimated_duration || null,
          is_loop: route.is_loop,
          target_distance: route.target_distance || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error saving route:', error);
      throw error;
    }

    // Return route with database ID (guaranteed to be present after insert)
    const savedRoute: SavedRoute = {
      ...route,
      id: data.id,
      user_id: data.user_id,
      created_at: data.created_at,
    };
    return savedRoute;
  }

  /**
   * Get user's saved routes
   */
  async getUserRoutes(limit: number = 20, offset: number = 0): Promise<Route[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching routes:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get a specific route by ID
   */
  async getRouteById(routeId: string): Promise<Route> {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .single();

    if (error) {
      console.error('Error fetching route:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a route
   */
  async deleteRoute(routeId: string): Promise<void> {
    const { error } = await supabase.from('routes').delete().eq('id', routeId);

    if (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
  }

  /**
   * Check if a route ID is a temporary ID (not saved to database yet)
   */
  isTemporaryRouteId(routeId: string | undefined | null): boolean {
    if (!routeId) return true;
    // Temporary IDs start with "route_" followed by timestamp
    return routeId.startsWith('route_');
  }

  /**
   * Save a route converted from a run
   * Creates both the route and a route_saves entry for tracking
   * @param routeData - Route data (without id and created_at)
   * @param sourcePostId - Optional post ID if saving from social feed
   * @returns The saved route with database ID
   */
  async saveRouteFromRun(
    routeData: Omit<Route, 'id' | 'created_at'>,
    sourcePostId?: string
  ): Promise<SavedRoute> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Convert waypoints to match database format
    const waypointsJson = routeData.waypoints.map((wp) => ({
      latitude: wp.latitude,
      longitude: wp.longitude,
    }));

    // Convert polyline to match database format
    const polylineJson = routeData.polyline.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    }));

    // Save route with community metadata
    const { data: savedRoute, error: routeError } = await supabase
      .from('routes')
      .insert([
        {
          user_id: user.id,
          name: routeData.name || null,
          start_location: {
            latitude: routeData.start_location.latitude,
            longitude: routeData.start_location.longitude,
          },
          end_location: {
            latitude: routeData.end_location.latitude,
            longitude: routeData.end_location.longitude,
          },
          waypoints: waypointsJson,
          polyline: polylineJson,
          distance: routeData.distance,
          estimated_duration: routeData.estimated_duration || null,
          is_loop: routeData.is_loop,
          target_distance: routeData.target_distance || null,
          is_community_route: (routeData as any).is_community_route || false,
          save_count: 0,
          original_run_id: (routeData as any).original_run_id || null,
          original_user_id: (routeData as any).original_user_id || null,
          source_type: (routeData as any).source_type || 'manual',
        },
      ])
      .select()
      .single();

    if (routeError) {
      console.error('Error saving route:', routeError);
      throw routeError;
    }

    // Create route_saves entry for tracking
    const { error: saveError } = await supabase.from('route_saves').insert([
      {
        route_id: savedRoute.id,
        saved_by_user_id: user.id,
        original_run_id: (routeData as any).original_run_id || null,
        source_post_id: sourcePostId || null,
        source_type: sourcePostId ? 'social_post' : 'own_run',
      },
    ]);

    if (saveError) {
      console.error('Error creating route save entry:', saveError);
      throw saveError;
    }

    // Return route with database ID
    const result: SavedRoute = {
      ...routeData,
      id: savedRoute.id,
      user_id: savedRoute.user_id,
      created_at: savedRoute.created_at,
    };

    return result;
  }

  /**
   * Check if a polyline duplicates any of the user's existing routes
   * @param polyline - The polyline to check
   * @returns Object with isDuplicate flag and optionally the existing route
   */
  async checkForDuplicate(
    polyline: Location[]
  ): Promise<{ isDuplicate: boolean; existingRoute?: Route }> {
    const existingRoutes = await this.getUserRoutes(100); // Check last 100 routes

    for (const route of existingRoutes) {
      if (arePolylinesEqual(polyline, route.polyline)) {
        return { isDuplicate: true, existingRoute: route };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Get a route with attribution data (original user, save count, etc.)
   * @param routeId - The route ID
   * @returns Route with attribution data
   */
  async getRouteWithAttribution(routeId: string): Promise<RouteAttributionData> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fetch route with original user info
    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .select(
        `
        *,
        originalUser:profiles!original_user_id(id, name, avatar_url)
      `
      )
      .eq('id', routeId)
      .single();

    if (routeError) {
      console.error('Error fetching route with attribution:', routeError);
      throw routeError;
    }

    // Check if current user saved it
    let savedByCurrentUser = false;
    if (user) {
      const { data: saveData } = await supabase
        .from('route_saves')
        .select('id')
        .eq('route_id', routeId)
        .eq('saved_by_user_id', user.id)
        .single();

      savedByCurrentUser = !!saveData;
    }

    return {
      route: routeData,
      originalUser: routeData.originalUser || undefined,
      saveCount: routeData.save_count || 0,
      savedByCurrentUser,
    };
  }

  /**
   * Get popular community routes
   * @param limit - Number of routes to fetch
   * @returns Array of popular routes
   */
  async getPopularRoutes(limit: number = 20): Promise<Route[]> {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('is_community_route', true)
      .order('save_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching popular routes:', error);
      throw error;
    }

    return data || [];
  }
}

export const routeService = new RouteService();
