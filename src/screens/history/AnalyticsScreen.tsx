import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants';
import { runService, Run } from '../../services/runService';
import { HistoryStackParamList } from '../../types';

type AnalyticsNavigationProp = StackNavigationProp<HistoryStackParamList, 'Analytics'>;

type TimeFrame = 'week' | 'month';

interface WeeklyData {
  runs: Run[];
  totalDistance: number;
  totalDuration: number;
  avgPace: number;
  runCount: number;
}

interface MonthlyData extends WeeklyData {
  weeklyBreakdown: { week: number; distance: number; runs: number }[];
}

interface PersonalRecords {
  longestRun: Run | null;
  fastestPace: Run | null;
  longestDuration: Run | null;
  totalDistance: number;
  totalRuns: number;
}

const screenWidth = Dimensions.get('window').width;

const AnalyticsScreen = () => {
  const navigation = useNavigation<AnalyticsNavigationProp>();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [weekly, monthly, records] = await Promise.all([
        runService.getWeeklyAnalytics(),
        runService.getMonthlyAnalytics(),
        runService.getPersonalRecords(),
      ]);
      setWeeklyData(weekly);
      setMonthlyData(monthly);
      setPersonalRecords(records);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatPace = (secondsPerKm: number): string => {
    if (!secondsPerKm || secondsPerKm === 0 || !isFinite(secondsPerKm)) {
      return '--:--';
    }
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.floor(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const currentData = timeFrame === 'week' ? weeklyData : monthlyData;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  const maxWeeklyDistance = monthlyData?.weeklyBreakdown.reduce(
    (max, week) => Math.max(max, week.distance),
    0
  ) || 1;

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
      {/* Time Frame Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, timeFrame === 'week' && styles.toggleButtonActive]}
          onPress={() => setTimeFrame('week')}
        >
          <Text style={[styles.toggleText, timeFrame === 'week' && styles.toggleTextActive]}>
            This Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, timeFrame === 'month' && styles.toggleButtonActive]}
          onPress={() => setTimeFrame('month')}
        >
          <Text style={[styles.toggleText, timeFrame === 'month' && styles.toggleTextActive]}>
            This Month
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>
          {timeFrame === 'week' ? 'Weekly Summary' : 'Monthly Summary'}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currentData?.runCount || 0}</Text>
            <Text style={styles.statLabel}>Runs</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currentData?.totalDistance.toFixed(1) || '0'}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(currentData?.totalDuration || 0)}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatPace(currentData?.avgPace || 0)}</Text>
            <Text style={styles.statLabel}>Avg Pace</Text>
          </View>
        </View>
      </View>

      {/* Weekly Breakdown Chart (for month view) */}
      {timeFrame === 'month' && monthlyData && monthlyData.weeklyBreakdown.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Weekly Breakdown</Text>
          <View style={styles.barChart}>
            {[1, 2, 3, 4, 5].map((weekNum) => {
              const weekData = monthlyData.weeklyBreakdown.find((w) => w.week === weekNum);
              const barHeight = weekData
                ? (weekData.distance / maxWeeklyDistance) * 100
                : 0;
              return (
                <View key={weekNum} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${Math.max(barHeight, 5)}%` },
                        weekData ? {} : styles.barEmpty,
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>W{weekNum}</Text>
                  <Text style={styles.barValue}>
                    {weekData ? `${weekData.distance.toFixed(1)}km` : '-'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Daily Activity (for week view) */}
      {timeFrame === 'week' && weeklyData && weeklyData.runs.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>This Week's Runs</Text>
          {weeklyData.runs.map((run) => (
            <TouchableOpacity
              key={run.id}
              style={styles.runRow}
              onPress={() => navigation.navigate('RunDetail', { runId: run.id })}
            >
              <View style={styles.runInfo}>
                <Text style={styles.runDate}>{formatDate(run.start_time)}</Text>
                <Text style={styles.runDistance}>{run.distance.toFixed(2)} km</Text>
              </View>
              <View style={styles.runStats}>
                <Text style={styles.runPace}>{formatPace(run.average_pace)} /km</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Personal Records */}
      {personalRecords && (personalRecords.longestRun || personalRecords.fastestPace) && (
        <View style={styles.recordsCard}>
          <Text style={styles.cardTitle}>Personal Records</Text>

          {personalRecords.longestRun && (
            <TouchableOpacity
              style={styles.recordRow}
              onPress={() => navigation.navigate('RunDetail', { runId: personalRecords.longestRun!.id })}
            >
              <View style={styles.recordIcon}>
                <Ionicons name="trophy" size={24} color={COLORS.warning} />
              </View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordTitle}>Longest Run</Text>
                <Text style={styles.recordValue}>
                  {personalRecords.longestRun.distance.toFixed(2)} km
                </Text>
                <Text style={styles.recordDate}>
                  {formatDate(personalRecords.longestRun.start_time)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          {personalRecords.fastestPace && (
            <TouchableOpacity
              style={styles.recordRow}
              onPress={() => navigation.navigate('RunDetail', { runId: personalRecords.fastestPace!.id })}
            >
              <View style={styles.recordIcon}>
                <Ionicons name="flash" size={24} color={COLORS.secondary} />
              </View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordTitle}>Fastest Pace</Text>
                <Text style={styles.recordValue}>
                  {formatPace(personalRecords.fastestPace.average_pace)} /km
                </Text>
                <Text style={styles.recordDate}>
                  {formatDate(personalRecords.fastestPace.start_time)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          {personalRecords.longestDuration && (
            <TouchableOpacity
              style={styles.recordRow}
              onPress={() => navigation.navigate('RunDetail', { runId: personalRecords.longestDuration!.id })}
            >
              <View style={styles.recordIcon}>
                <Ionicons name="time" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordTitle}>Longest Duration</Text>
                <Text style={styles.recordValue}>
                  {formatDuration(personalRecords.longestDuration.duration)}
                </Text>
                <Text style={styles.recordDate}>
                  {formatDate(personalRecords.longestDuration.start_time)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Lifetime Stats */}
      {personalRecords && (
        <View style={styles.lifetimeCard}>
          <Text style={styles.cardTitle}>Lifetime Stats</Text>
          <View style={styles.lifetimeRow}>
            <View style={styles.lifetimeStat}>
              <Text style={styles.lifetimeValue}>{personalRecords.totalRuns}</Text>
              <Text style={styles.lifetimeLabel}>Total Runs</Text>
            </View>
            <View style={styles.lifetimeStat}>
              <Text style={styles.lifetimeValue}>{personalRecords.totalDistance.toFixed(1)}</Text>
              <Text style={styles.lifetimeLabel}>Total km</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    margin: SPACING.md,
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: COLORS.background,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: COLORS.background,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    height: 100,
    width: 30,
    justifyContent: 'flex-end',
  },
  bar: {
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    width: '100%',
  },
  barEmpty: {
    backgroundColor: COLORS.border,
  },
  barLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  barValue: {
    fontSize: 10,
    color: COLORS.text,
    fontWeight: '500',
  },
  runRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  runInfo: {
    flex: 1,
  },
  runDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  runDistance: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
  runStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  runPace: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  recordsCard: {
    backgroundColor: COLORS.background,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  recordInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  recordValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  recordDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  lifetimeCard: {
    backgroundColor: COLORS.background,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
  },
  lifetimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  lifetimeStat: {
    alignItems: 'center',
  },
  lifetimeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  lifetimeLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  bottomSpacer: {
    height: SPACING.xxl,
  },
});

export default AnalyticsScreen;
