import { supabase } from './supabase';
import { GPSPoint, TrackingMetrics } from '../store/trackingStore';
import { PaceInterval } from '../types';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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
  intervals?: PaceInterval[]; // NEW: Pace intervals
}

// Database returns snake_case columns
export interface Run {
  id: string;
  user_id: string;
  route_id?: string;
  start_time: string;
  end_time: string;
  duration: number;
  distance: number;
  average_pace: number;
  average_speed: number;
  polyline: GPSPoint[];
  elevation_gain?: number;
  calories_burned?: number;
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
          intervals: runData.intervals || null, // NEW: Save intervals
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

  /**
   * Get weekly analytics for the current week
   */
  async getWeeklyAnalytics(): Promise<{
    runs: Run[];
    totalDistance: number;
    totalDuration: number;
    avgPace: number;
    runCount: number;
  }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for Monday start
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', weekStart.toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching weekly analytics:', error);
      throw error;
    }

    const runs = data || [];
    const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
    const totalDuration = runs.reduce((sum, run) => sum + run.duration, 0);
    const avgPace = runs.length > 0
      ? runs.reduce((sum, run) => sum + run.average_pace, 0) / runs.length
      : 0;

    return {
      runs,
      totalDistance,
      totalDuration,
      avgPace,
      runCount: runs.length,
    };
  }

  /**
   * Get monthly analytics for the current month
   */
  async getMonthlyAnalytics(): Promise<{
    runs: Run[];
    totalDistance: number;
    totalDuration: number;
    avgPace: number;
    runCount: number;
    weeklyBreakdown: { week: number; distance: number; runs: number }[];
  }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get start of current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', monthStart.toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching monthly analytics:', error);
      throw error;
    }

    const runs = data || [];
    const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
    const totalDuration = runs.reduce((sum, run) => sum + run.duration, 0);
    const avgPace = runs.length > 0
      ? runs.reduce((sum, run) => sum + run.average_pace, 0) / runs.length
      : 0;

    // Calculate weekly breakdown within the month
    const weeklyBreakdown: { week: number; distance: number; runs: number }[] = [];
    runs.forEach((run) => {
      const runDate = new Date(run.start_time);
      const weekOfMonth = Math.ceil(runDate.getDate() / 7);
      const existingWeek = weeklyBreakdown.find((w) => w.week === weekOfMonth);
      if (existingWeek) {
        existingWeek.distance += run.distance;
        existingWeek.runs += 1;
      } else {
        weeklyBreakdown.push({ week: weekOfMonth, distance: run.distance, runs: 1 });
      }
    });

    return {
      runs,
      totalDistance,
      totalDuration,
      avgPace,
      runCount: runs.length,
      weeklyBreakdown: weeklyBreakdown.sort((a, b) => a.week - b.week),
    };
  }

  /**
   * Get personal records
   */
  async getPersonalRecords(): Promise<{
    longestRun: Run | null;
    fastestPace: Run | null;
    longestDuration: Run | null;
    totalDistance: number;
    totalRuns: number;
  }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching personal records:', error);
      throw error;
    }

    const runs = data || [];

    if (runs.length === 0) {
      return {
        longestRun: null,
        fastestPace: null,
        longestDuration: null,
        totalDistance: 0,
        totalRuns: 0,
      };
    }

    // Find records
    const longestRun = runs.reduce((max, run) =>
      run.distance > max.distance ? run : max
    );

    // Filter out runs with invalid pace (0 or very high values)
    const validPaceRuns = runs.filter(
      (run) => run.average_pace > 0 && run.average_pace < 1800 // Less than 30 min/km
    );
    const fastestPace = validPaceRuns.length > 0
      ? validPaceRuns.reduce((min, run) =>
          run.average_pace < min.average_pace ? run : min
        )
      : null;

    const longestDuration = runs.reduce((max, run) =>
      run.duration > max.duration ? run : max
    );

    const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);

    return {
      longestRun,
      fastestPace,
      longestDuration,
      totalDistance,
      totalRuns: runs.length,
    };
  }

  /**
   * Export run as GPX file
   */
  async exportToGPX(run: Run): Promise<string> {
    const polyline = run.polyline || [];
    const startTime = new Date(run.start_time);

    // Build GPX XML
    let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunRoute App" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Run on ${startTime.toLocaleDateString()}</name>
    <time>${run.start_time}</time>
  </metadata>
  <trk>
    <name>Run - ${run.distance.toFixed(2)} km</name>
    <trkseg>
`;

    polyline.forEach((point: any, index: number) => {
      const pointTime = new Date(startTime.getTime() + (index * (run.duration * 1000 / polyline.length)));
      gpxContent += `      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        <ele>${point.altitude || 0}</ele>
        <time>${pointTime.toISOString()}</time>
      </trkpt>
`;
    });

    gpxContent += `    </trkseg>
  </trk>
</gpx>`;

    // Save file
    const fileName = `run_${run.id.substring(0, 8)}_${startTime.toISOString().split('T')[0]}.gpx`;
    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, gpxContent);

    return filePath;
  }

  /**
   * Export run as CSV file
   */
  async exportToCSV(run: Run): Promise<string> {
    const polyline = run.polyline || [];
    const startTime = new Date(run.start_time);

    // Build CSV content
    let csvContent = 'Timestamp,Latitude,Longitude,Altitude,Speed\n';

    polyline.forEach((point: any, index: number) => {
      const pointTime = new Date(startTime.getTime() + (index * (run.duration * 1000 / polyline.length)));
      csvContent += `${pointTime.toISOString()},${point.latitude},${point.longitude},${point.altitude || 0},${point.speed || 0}\n`;
    });

    // Add summary row
    csvContent += '\nSummary\n';
    csvContent += `Distance (km),${run.distance}\n`;
    csvContent += `Duration (seconds),${run.duration}\n`;
    csvContent += `Average Pace (sec/km),${run.average_pace}\n`;
    csvContent += `Average Speed (km/h),${run.average_speed}\n`;
    csvContent += `Elevation Gain (m),${run.elevation_gain || 0}\n`;
    csvContent += `Calories Burned,${run.calories_burned || 0}\n`;

    // Save file
    const fileName = `run_${run.id.substring(0, 8)}_${startTime.toISOString().split('T')[0]}.csv`;
    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, csvContent);

    return filePath;
  }

  /**
   * Share a file
   */
  async shareFile(filePath: string): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath);
    } else {
      throw new Error('Sharing is not available on this device');
    }
  }
}

export const runService = new RunService();
