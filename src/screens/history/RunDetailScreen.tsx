import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { COLORS, SPACING } from '../../constants';
import { runService } from '../../services/runService';

type RouteParams = {
  RunDetail: { runId: string };
};

interface RunDetail {
  id: string;
  distance: number;
  duration: number;
  average_pace: number;
  average_speed: number;
  start_time: string;
  end_time: string;
  elevation_gain?: number;
  calories_burned?: number;
  polyline: Array<{ latitude: number; longitude: number }>;
  route_id?: string;
}

const RunDetailScreen = () => {
  const route = useRoute<RouteProp<RouteParams, 'RunDetail'>>();
  const navigation = useNavigation();
  const { runId } = route.params;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchRunDetails();
  }, [runId]);

  const fetchRunDetails = async () => {
    try {
      const data = await runService.getRunById(runId);
      setRun(data);
    } catch (err) {
      console.error('Error fetching run details:', err);
      Alert.alert('Error', 'Failed to load run details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Run',
      'Are you sure you want to delete this run? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await runService.deleteRun(runId);
              Alert.alert('Deleted', 'Run has been deleted.');
              navigation.goBack();
            } catch (err) {
              console.error('Error deleting run:', err);
              Alert.alert('Error', 'Failed to delete run.');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Format duration as hh:mm:ss or mm:ss
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format pace as m:ss /km
  const formatPace = (secondsPerKm: number): string => {
    if (!secondsPerKm || secondsPerKm === 0 || !isFinite(secondsPerKm)) {
      return '--:--';
    }
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.floor(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading run details...</Text>
      </View>
    );
  }

  if (!run) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Run not found</Text>
      </View>
    );
  }

  // Calculate map region from polyline
  const getMapRegion = () => {
    if (!run.polyline || run.polyline.length === 0) {
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    const lats = run.polyline.map((p) => p.latitude);
    const lngs = run.polyline.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) * 1.3 || 0.01,
      longitudeDelta: (maxLng - minLng) * 1.3 || 0.01,
    };
  };

  return (
    <ScrollView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView style={styles.map} region={getMapRegion()}>
          {run.polyline && run.polyline.length > 1 && (
            <Polyline
              coordinates={run.polyline}
              strokeColor={COLORS.primary}
              strokeWidth={4}
            />
          )}
          {run.polyline && run.polyline.length > 0 && (
            <>
              <Marker
                coordinate={run.polyline[0]}
                title="Start"
                pinColor={COLORS.success}
              />
              <Marker
                coordinate={run.polyline[run.polyline.length - 1]}
                title="Finish"
                pinColor={COLORS.danger}
              />
            </>
          )}
        </MapView>
      </View>

      {/* Date Header */}
      <View style={styles.dateHeader}>
        <Text style={styles.dateText}>{formatDate(run.start_time)}</Text>
        <Text style={styles.timeText}>
          {formatTime(run.start_time)} - {formatTime(run.end_time)}
        </Text>
      </View>

      {/* Main Stats */}
      <View style={styles.mainStatsContainer}>
        <View style={styles.mainStat}>
          <Text style={styles.mainStatValue}>{run.distance.toFixed(2)}</Text>
          <Text style={styles.mainStatLabel}>Kilometers</Text>
        </View>
        <View style={styles.mainStat}>
          <Text style={styles.mainStatValue}>{formatDuration(run.duration)}</Text>
          <Text style={styles.mainStatLabel}>Duration</Text>
        </View>
        <View style={styles.mainStat}>
          <Text style={styles.mainStatValue}>{formatPace(run.average_pace)}</Text>
          <Text style={styles.mainStatLabel}>Avg Pace /km</Text>
        </View>
      </View>

      {/* Additional Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.statsCardTitle}>Run Details</Text>

        <View style={styles.statRow}>
          <Text style={styles.statRowLabel}>Average Speed</Text>
          <Text style={styles.statRowValue}>{run.average_speed.toFixed(1)} km/h</Text>
        </View>

        {run.elevation_gain !== undefined && run.elevation_gain !== null && (
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Elevation Gain</Text>
            <Text style={styles.statRowValue}>{run.elevation_gain.toFixed(0)} m</Text>
          </View>
        )}

        {run.calories_burned !== undefined && run.calories_burned !== null && (
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Calories Burned</Text>
            <Text style={styles.statRowValue}>{run.calories_burned} cal</Text>
          </View>
        )}

        {run.route_id && (
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Planned Route</Text>
            <Text style={[styles.statRowValue, { color: COLORS.primary }]}>Linked</Text>
          </View>
        )}
      </View>

      {/* Delete Button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        disabled={deleting}
      >
        <Text style={styles.deleteButtonText}>
          {deleting ? 'Deleting...' : 'Delete Run'}
        </Text>
      </TouchableOpacity>

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
  mapContainer: {
    height: 250,
    backgroundColor: COLORS.border,
  },
  map: {
    flex: 1,
  },
  dateHeader: {
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  timeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  mainStatsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    marginTop: 1,
  },
  mainStat: {
    flex: 1,
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  mainStatLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: COLORS.background,
    margin: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
  },
  statsCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statRowLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  statRowValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: SPACING.xxl,
  },
});

export default RunDetailScreen;
