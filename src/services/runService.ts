import { supabase } from './supabase';
import { GPSPoint, TrackingMetrics } from '../store/trackingStore';

export interface SaveRunParams {
  title?: string;
  notes?: string;
  plannedRouteId?: string;
  distanceMeters: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  routePolyline: string;
  waypoints: GPSPoint[];
  elevationGainMeters: number;
  startedAt: string;
  completedAt: string;
}

export interface Run extends SaveRunParams {
  id: string;
  user_id: string;
  created_at: string;
}

class RunService {
  /**
   * Save a completed run to the database
   */
  async saveRun(runData: SaveRunParams): Promise<Run> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('runs')
      .insert([
        {
          user_id: user.id,
          title: runData.title || 'Run',
          notes: runData.notes,
          planned_route_id: runData.plannedRouteId,
          distance_meters: runData.distanceMeters,
          duration_seconds: runData.durationSeconds,
          average_pace_seconds_per_km: runData.averagePaceSecondsPerKm,
          start_latitude: runData.startLatitude,
          start_longitude: runData.startLongitude,
          end_latitude: runData.endLatitude,
          end_longitude: runData.endLongitude,
          route_polyline: runData.routePolyline,
          waypoints: runData.waypoints,
          elevation_gain_meters: runData.elevationGainMeters,
          started_at: runData.startedAt,
          completed_at: runData.completedAt,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error saving run:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get user's run history
   */
  async getUserRuns(limit: number = 20, offset: number = 0): Promise<Run[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching runs:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get a specific run by ID
   */
  async getRunById(runId: string): Promise<Run> {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error) {
      console.error('Error fetching run:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update a run
   */
  async updateRun(runId: string, updates: Partial<SaveRunParams>): Promise<Run> {
    const { data, error } = await supabase
      .from('runs')
      .update(updates)
      .eq('id', runId)
      .select()
      .single();

    if (error) {
      console.error('Error updating run:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a run
   */
  async deleteRun(runId: string): Promise<void> {
    const { error } = await supabase.from('runs').delete().eq('id', runId);

    if (error) {
      console.error('Error deleting run:', error);
      throw error;
    }
  }

  /**
   * Encode GPS waypoints into a polyline string
   * Simplified version - in production, use a proper polyline encoding library
   */
  encodePolyline(waypoints: GPSPoint[]): string {
    return JSON.stringify(
      waypoints.map((wp) => ({
        lat: wp.latitude,
        lng: wp.longitude,
        alt: wp.altitude,
        timestamp: wp.timestamp,
      }))
    );
  }

  /**
   * Decode polyline string back to GPS waypoints
   */
  decodePolyline(polyline: string): GPSPoint[] {
    const decoded = JSON.parse(polyline);
    return decoded.map((point: any) => ({
      latitude: point.lat,
      longitude: point.lng,
      altitude: point.alt,
      accuracy: 0,
      timestamp: point.timestamp,
    }));
  }
}

export const runService = new RunService();
