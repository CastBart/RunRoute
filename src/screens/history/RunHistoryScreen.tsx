import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants';
import { runService } from '../../services/runService';
import RunListItem from '../../components/RunListItem';
import { HistoryStackParamList } from '../../types';

type HistoryNavigationProp = StackNavigationProp<HistoryStackParamList, 'RunHistory'>;

// Database returns snake_case column names
interface RunData {
  id: string;
  distance: number;
  duration: number;
  average_pace: number;
  start_time: string;
}

const RunHistoryScreen = () => {
  const navigation = useNavigation<HistoryNavigationProp>();
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Analytics')}
        >
          <Ionicons name="stats-chart" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const fetchRuns = useCallback(async () => {
    try {
      setError(null);
      const data = await runService.getUserRuns(50, 0);
      setRuns(data);
    } catch (err: any) {
      console.error('Error fetching runs:', err);
      setError('Failed to load your runs. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRuns();
  };

  const handleRunPress = (runId: string) => {
    navigation.navigate('RunDetail', { runId });
  };

  // Calculate summary stats
  const totalRuns = runs.length;
  const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
  const totalDuration = runs.reduce((sum, run) => sum + run.duration, 0);

  const formatTotalDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Your Runs</Text>
      {totalRuns > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalRuns}</Text>
            <Text style={styles.statLabel}>Runs</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Total km</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatTotalDuration(totalDuration)}</Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No runs yet</Text>
      <Text style={styles.emptySubtitle}>
        Complete your first run to see it here!
      </Text>
    </View>
  );

  const renderItem = ({ item }: { item: RunData }) => (
    <RunListItem
      id={item.id}
      distance={item.distance}
      duration={item.duration}
      averagePace={item.average_pace}
      startTime={item.start_time}
      onPress={handleRunPress}
    />
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your runs...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={runs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={runs.length === 0 ? styles.emptyList : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  headerButton: {
    marginRight: SPACING.md,
    padding: SPACING.xs,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.danger,
    textAlign: 'center',
  },
  header: {
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: SPACING.md,
  },
  statBox: {
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
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
});

export default RunHistoryScreen;
