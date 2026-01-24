import { supabase } from './supabase';
import { User, PrivacySettings } from '../types';

export interface UserStats {
  totalRuns: number;
  totalDistance: number; // in km
  totalDuration: number; // in seconds
  averagePace: number; // seconds per km
  longestRun: number; // in km
  fastestPace: number; // seconds per km (lowest is fastest)
}

export interface ProfileData extends User {
  stats: UserStats;
}

class ProfileService {
  /**
   * Get user profile with stats
   */
  async getProfile(userId: string): Promise<ProfileData | null> {
    // Get profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw profileError;
    }

    // Get user stats from runs
    const stats = await this.getUserStats(userId);

    return {
      ...profile,
      stats,
    };
  }

  /**
   * Get user statistics from their runs
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const { data: runs, error } = await supabase
      .from('runs')
      .select('distance, duration, average_pace')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user stats:', error);
      return {
        totalRuns: 0,
        totalDistance: 0,
        totalDuration: 0,
        averagePace: 0,
        longestRun: 0,
        fastestPace: 0,
      };
    }

    if (!runs || runs.length === 0) {
      return {
        totalRuns: 0,
        totalDistance: 0,
        totalDuration: 0,
        averagePace: 0,
        longestRun: 0,
        fastestPace: 0,
      };
    }

    const totalRuns = runs.length;
    const totalDistance = runs.reduce((sum, run) => sum + (run.distance || 0), 0);
    const totalDuration = runs.reduce((sum, run) => sum + (run.duration || 0), 0);
    const longestRun = Math.max(...runs.map((run) => run.distance || 0));
    const fastestPace = Math.min(...runs.filter((run) => run.average_pace > 0).map((run) => run.average_pace));
    const averagePace = totalDistance > 0 ? totalDuration / totalDistance : 0;

    return {
      totalRuns,
      totalDistance,
      totalDuration,
      averagePace,
      longestRun,
      fastestPace: fastestPace === Infinity ? 0 : fastestPace,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        name: updates.name,
        avatar_url: updates.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get recent runs for profile display
   */
  async getRecentRuns(userId: string, limit: number = 5): Promise<any[]> {
    const { data, error } = await supabase
      .from('runs')
      .select('id, distance, duration, average_pace, start_time')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent runs:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get privacy settings for a user
   */
  async getPrivacySettings(userId: string): Promise<{ data: PrivacySettings | null; error: string | null }> {
    const { data, error } = await supabase
      .from('profiles')
      .select('show_on_map, allow_comments, public_profile')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching privacy settings:', error);
      return { data: null, error: error.message };
    }

    return {
      data: {
        show_on_map: data.show_on_map ?? true,
        allow_comments: data.allow_comments ?? true,
        public_profile: data.public_profile ?? true,
      },
      error: null,
    };
  }

  /**
   * Update privacy settings for a user
   */
  async updatePrivacySettings(
    userId: string,
    settings: Partial<PrivacySettings>
  ): Promise<{ data: PrivacySettings | null; error: string | null }> {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields that are explicitly provided
    if (settings.show_on_map !== undefined) {
      updatePayload.show_on_map = settings.show_on_map;
    }
    if (settings.allow_comments !== undefined) {
      updatePayload.allow_comments = settings.allow_comments;
    }
    if (settings.public_profile !== undefined) {
      updatePayload.public_profile = settings.public_profile;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select('show_on_map, allow_comments, public_profile')
      .single();

    if (error) {
      console.error('Error updating privacy settings:', error);
      return { data: null, error: error.message };
    }

    return {
      data: {
        show_on_map: data.show_on_map ?? true,
        allow_comments: data.allow_comments ?? true,
        public_profile: data.public_profile ?? true,
      },
      error: null,
    };
  }
}

export const profileService = new ProfileService();
