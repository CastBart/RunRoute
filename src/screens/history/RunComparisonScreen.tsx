import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants';
import { runService, Run } from '../../services/runService';
import { HistoryStackParamList } from '../../types';

type ComparisonRouteProp = RouteProp<HistoryStackParamList, 'RunComparison'>;

const RunComparisonScreen = () => {
  const route = useRoute<ComparisonRouteProp>();
  const { runIds } = route.params;
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuns();
  }, [runIds]);

  const fetchRuns = async () => {
    try {
      const runData = await Promise.all(
        runIds.map((id) => runService.getRunById(id))
      );
      setRuns(runData);
    } catch (err) {
      console.error('Error fetching runs for comparison:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getComparisonIcon = (value1: number, value2: number, lowerIsBetter: boolean = false) => {
    if (value1 === value2) {
      return <Ionicons name="remove" size={16} color={COLORS.textSecondary} />;
    }
    const isBetter = lowerIsBetter ? value1 < value2 : value1 > value2;
    return (
      <Ionicons
        name={isBetter ? 'arrow-up' : 'arrow-down'}
        size={16}
        color={isBetter ? COLORS.success : COLORS.danger}
      />
    );
  };

  const getDifference = (value1: number, value2: number, format: 'distance' | 'duration' | 'pace') => {
    const diff = value1 - value2;
    const sign = diff > 0 ? '+' : '';

    switch (format) {
      case 'distance':
        return `${sign}${diff.toFixed(2)} km`;
      case 'duration':
        const mins = Math.floor(Math.abs(diff) / 60);
        const secs = Math.abs(diff) % 60;
        return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
      case 'pace':
        const pMins = Math.floor(Math.abs(diff) / 60);
        const pSecs = Math.floor(Math.abs(diff) % 60);
        return `${sign}${pMins}:${pSecs.toString().padStart(2, '0')} /km`;
      default:
        return `${sign}${diff.toFixed(2)}`;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading comparison...</Text>
      </View>
    );
  }

  if (runs.length < 2) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Need at least 2 runs to compare</Text>
      </View>
    );
  }

  const [run1, run2] = runs;

  return (
    <ScrollView style={styles.container}>
      {/* Header with dates */}
      <View style={styles.headerRow}>
        <View style={styles.headerCell}>
          <Text style={styles.headerDate}>{formatDate(run1.start_time)}</Text>
          <Text style={styles.headerLabel}>Run 1</Text>
        </View>
        <View style={styles.headerVs}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <View style={styles.headerCell}>
          <Text style={styles.headerDate}>{formatDate(run2.start_time)}</Text>
          <Text style={styles.headerLabel}>Run 2</Text>
        </View>
      </View>

      {/* Distance Comparison */}
      <View style={styles.comparisonCard}>
        <Text style={styles.metricTitle}>Distance</Text>
        <View style={styles.comparisonRow}>
          <View style={styles.valueCell}>
            <Text style={styles.valueText}>{run1.distance.toFixed(2)} km</Text>
            {getComparisonIcon(run1.distance, run2.distance)}
          </View>
          <View style={styles.diffCell}>
            <Text style={styles.diffText}>
              {getDifference(run1.distance, run2.distance, 'distance')}
            </Text>
          </View>
          <View style={styles.valueCell}>
            <Text style={styles.valueText}>{run2.distance.toFixed(2)} km</Text>
            {getComparisonIcon(run2.distance, run1.distance)}
          </View>
        </View>
      </View>

      {/* Duration Comparison */}
      <View style={styles.comparisonCard}>
        <Text style={styles.metricTitle}>Duration</Text>
        <View style={styles.comparisonRow}>
          <View style={styles.valueCell}>
            <Text style={styles.valueText}>{formatDuration(run1.duration)}</Text>
            {getComparisonIcon(run1.duration, run2.duration)}
          </View>
          <View style={styles.diffCell}>
            <Text style={styles.diffText}>
              {getDifference(run1.duration, run2.duration, 'duration')}
            </Text>
          </View>
          <View style={styles.valueCell}>
            <Text style={styles.valueText}>{formatDuration(run2.duration)}</Text>
            {getComparisonIcon(run2.duration, run1.duration)}
          </View>
        </View>
      </View>

      {/* Pace Comparison */}
      <View style={styles.comparisonCard}>
        <Text style={styles.metricTitle}>Average Pace</Text>
        <View style={styles.comparisonRow}>
          <View style={styles.valueCell}>
            <Text style={styles.valueText}>{formatPace(run1.average_pace)} /km</Text>
            {getComparisonIcon(run1.average_pace, run2.average_pace, true)}
          </View>
          <View style={styles.diffCell}>
            <Text style={styles.diffText}>
              {getDifference(run1.average_pace, run2.average_pace, 'pace')}
            </Text>
          </View>
          <View style={styles.valueCell}>
            <Text style={styles.valueText}>{formatPace(run2.average_pace)} /km</Text>
            {getComparisonIcon(run2.average_pace, run1.average_pace, true)}
          </View>
        </View>
      </View>

      {/* Speed Comparison */}
      <View style={styles.comparisonCard}>
        <Text style={styles.metricTitle}>Average Speed</Text>
        <View style={styles.comparisonRow}>
          <View style={styles.valueCell}>
            <Text style={styles.valueText}>{run1.average_speed.toFixed(1)} km/h</Text>
            {getComparisonIcon(run1.average_speed, run2.average_speed)}
          </View>
          <View style={styles.diffCell}>
            <Text style={styles.diffText}>
              {(run1.average_speed - run2.average_speed) > 0 ? '+' : ''}
              {(run1.average_speed - run2.average_speed).toFixed(1)} km/h
            </Text>
          </View>
          <View style={styles.valueCell}>
            <Text style={styles.valueText}>{run2.average_speed.toFixed(1)} km/h</Text>
            {getComparisonIcon(run2.average_speed, run1.average_speed)}
          </View>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Summary</Text>
        <Text style={styles.summaryText}>
          {run1.distance > run2.distance
            ? `Run 1 was ${(run1.distance - run2.distance).toFixed(2)} km longer`
            : run2.distance > run1.distance
            ? `Run 2 was ${(run2.distance - run1.distance).toFixed(2)} km longer`
            : 'Both runs covered the same distance'}
        </Text>
        <Text style={styles.summaryText}>
          {run1.average_pace < run2.average_pace
            ? `Run 1 was faster by ${formatPace(run2.average_pace - run1.average_pace)} /km`
            : run2.average_pace < run1.average_pace
            ? `Run 2 was faster by ${formatPace(run1.average_pace - run2.average_pace)} /km`
            : 'Both runs had the same pace'}
        </Text>
      </View>

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
  errorText: {
    fontSize: 16,
    color: COLORS.danger,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerVs: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDate: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  comparisonCard: {
    backgroundColor: COLORS.background,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 12,
    padding: SPACING.md,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueCell: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  valueText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  diffCell: {
    width: 100,
    alignItems: 'center',
  },
  diffText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  summaryCard: {
    backgroundColor: COLORS.background,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: 12,
    padding: SPACING.md,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  bottomSpacer: {
    height: SPACING.xxl,
  },
});

export default RunComparisonScreen;
