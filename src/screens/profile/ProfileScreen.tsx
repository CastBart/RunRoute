import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SPACING } from '../../constants';
import { useAuthStore } from '../../store/authStore';
import { profileService, UserStats } from '../../services/profileService';
import { ProfileStackParamList } from '../../types';

type ProfileNavigationProp = StackNavigationProp<ProfileStackParamList, 'UserProfile'>;

interface RecentRun {
  id: string;
  distance: number;
  duration: number;
  average_pace: number;
  start_time: string;
}

const ProfileScreen = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const { user, signOut } = useAuthStore();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [userStats, runs] = await Promise.all([
        profileService.getUserStats(user.id),
        profileService.getRecentRuns(user.id, 5),
      ]);
      setStats(userStats);
      setRecentRuns(runs);
    } catch (err) {
      console.error('Error fetching profile data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation, fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  const handleLogout = async () => {
    await signOut();
  };

  // Format helpers
  const formatDistance = (km: number): string => {
    if (km >= 1000) {
      return (km / 1000).toFixed(1) + 'k';
    }
    return km.toFixed(1);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatPace = (secondsPerKm: number): string => {
    if (secondsPerKm === 0) return '--:--';
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.round(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatRunDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{user?.name || 'Runner'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
            <Text style={styles.settingsButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalRuns || 0}</Text>
            <Text style={styles.statLabel}>Total Runs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDistance(stats?.totalDistance || 0)}</Text>
            <Text style={styles.statLabel}>Total km</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDuration(stats?.totalDuration || 0)}</Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatPace(stats?.averagePace || 0)}</Text>
            <Text style={styles.statLabel}>Avg Pace</Text>
          </View>
        </View>

        {/* Personal Records */}
        {(stats?.longestRun || 0) > 0 && (
          <View style={styles.recordsContainer}>
            <Text style={styles.recordsTitle}>Personal Records</Text>
            <View style={styles.recordRow}>
              <Text style={styles.recordLabel}>Longest Run</Text>
              <Text style={styles.recordValue}>{stats?.longestRun.toFixed(2)} km</Text>
            </View>
            {(stats?.fastestPace || 0) > 0 && (
              <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Fastest Pace</Text>
                <Text style={styles.recordValue}>{formatPace(stats?.fastestPace || 0)} /km</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Recent Runs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Runs</Text>
        {recentRuns.length === 0 ? (
          <View style={styles.emptyRuns}>
            <Text style={styles.emptyText}>No runs yet. Start tracking!</Text>
          </View>
        ) : (
          recentRuns.map((run) => (
            <View key={run.id} style={styles.runItem}>
              <View style={styles.runDate}>
                <Text style={styles.runDateText}>{formatDate(run.start_time)}</Text>
              </View>
              <View style={styles.runStats}>
                <Text style={styles.runStat}>{run.distance.toFixed(2)} km</Text>
                <Text style={styles.runStatDivider}>•</Text>
                <Text style={styles.runStat}>{formatRunDuration(run.duration)}</Text>
                <Text style={styles.runStatDivider}>•</Text>
                <Text style={styles.runStat}>{formatPace(run.average_pace)} /km</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Logout Button */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  editButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsButton: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingsButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  recordsContainer: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  recordsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  recordLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  recordValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyRuns: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  runItem: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  runDate: {
    marginRight: SPACING.md,
  },
  runDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  runStats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  runStat: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  runStatDivider: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.xs,
  },
  logoutButton: {
    backgroundColor: COLORS.error,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: SPACING.xl,
  },
});

export default ProfileScreen;
