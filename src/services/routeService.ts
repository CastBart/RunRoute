import { supabase } from './supabase';
import { Route } from '../types';

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
}

export const routeService = new RouteService();
