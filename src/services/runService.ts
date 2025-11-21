import { supabase } from './supabase';
import { GPSPoint, TrackingMetrics } from '../store/trackingStore';

export interface SaveRunParams {
  routeId?: string;
  startTime: string;
  endTime: string;
  duration: number; // seconds
  distance: number; // kilometers
  averagePace: number; // seconds per km
  averageSpeed: number; // km/h
  polyline: GPSPoint[]; // GPS trail coordinates
  elevationGain?: number; // meters
  caloriesBurned?: number;
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

    // Convert GPSPoint[] to JSONB format for database
    const polylineJson = runData.polyline.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      accuracy: point.accuracy,
      speed: point.speed,
      timestamp: point.timestamp,
    }));

    const { data, error } = await supabase
      .from('runs')
      .insert([
        {
          user_id: user.id,
          route_id: runData.routeId || null,
          start_time: runData.startTime,
          end_time: runData.endTime,
          duration: runData.duration,
          distance: runData.distance,
          average_pace: runData.averagePace,
          average_speed: runData.averageSpeed,
          polyline: polylineJson,
          elevation_gain: runData.elevationGain || null,
          calories_burned: runData.caloriesBurned || null,
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
      .order('start_time', { ascending: false })
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
}

export const runService = new RunService();
