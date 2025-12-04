import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { COLORS, SPACING } from '../../constants';
import { useTrackingStore, GPSPoint } from '../../store/trackingStore';
import { runService } from '../../services/runService';
import { routeService } from '../../services/routeService';
import Button from '../../components/Button';
import { usePreferencesStore } from '../../store/preferencesStore';
import {
  formatDistance as formatDistanceUtil,
  formatPace as formatPaceUtil,
  convertDistance,
} from '../../utils/unitConversions';
import { calculateIntervals } from '../../utils/intervalCalculator';

const RunTrackerScreen = () => {
  const {
    isTracking,
    isPaused,
    currentPosition,
    gpsTrail,
    metrics,
    targetDistanceMeters,
    gpsStatus,
    plannedRoute,
    plannedRouteId,
    startedAt,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    updatePosition,
    setGPSStatus,
    setError,
    reset,
  } = useTrackingStore();

  const { distanceUnit } = usePreferencesStore();

  const [locationSubscription, setLocationSubscription] =
    useState<Location.LocationSubscription | null>(null);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Request location permissions and start tracking
  const handleStartRun = async () => {
    try {
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to track your run.'
        );
        return;
      }

      setGPSStatus('searching');

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const startPosition: GPSPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude || undefined,
        accuracy: location.coords.accuracy || 0,
        speed: location.coords.speed || undefined,
        timestamp: Date.now(),
      };

      startTracking({ startPosition });

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        (newLocation) => {
          const newPosition: GPSPoint = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            altitude: newLocation.coords.altitude || undefined,
            accuracy: newLocation.coords.accuracy || 0,
            speed: newLocation.coords.speed || undefined,
            timestamp: Date.now(),
          };

          updatePosition(newPosition);

          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: newPosition.latitude,
              longitude: newPosition.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            });
          }
        }
      );

      setLocationSubscription(subscription);
      setGPSStatus('active');
    } catch (err: any) {
      console.error('Error starting run:', err);
      setError(err.message || 'Failed to start GPS tracking');
      Alert.alert('Error', 'Failed to start GPS tracking');
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeTracking();
    } else {
      pauseTracking();
    }
  };

  const handleStopRun = () => {
    
    Alert.alert(
      'Stop Run?',
      'Are you sure you want to stop tracking this run?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            if (locationSubscription) {
              locationSubscription.remove();
              setLocationSubscription(null);
            }
            stopTracking();

            if (gpsTrail.length > 1) {
              handleSaveRun();
            } else {
              reset();
            }
          },
        },
      ]
    );
  };

  const handleSaveRun = async () => {
    if (gpsTrail.length < 2) {
      Alert.alert('No Data', 'Not enough GPS data to save this run.');
      reset();
      return;
    }

    setSaving(true);
    try {
      // Step 1: Save the planned route first (if it exists and hasn't been saved yet)
      let finalRouteId: string | null = plannedRouteId;

      if (plannedRoute && routeService.isTemporaryRouteId(plannedRouteId)) {
        console.log('Saving planned route to database first...');
        // Add default name if not already set
        const routeWithName = {
          ...plannedRoute,
          name: plannedRoute.name || `${plannedRoute.distance.toFixed(1)}km ${plannedRoute.is_loop ? 'Loop' : 'Route'}`,
        };
        const savedRoute = await routeService.saveRoute(routeWithName);
        finalRouteId = savedRoute.id;
        console.log('Route saved with UUID:', finalRouteId);
      }

      // Step 2: Calculate average speed (km/h) from distance and duration
      const distanceKm = metrics.distanceMeters / 1000;
      const durationHours = metrics.durationSeconds / 3600;
      const averageSpeed = durationHours > 0 ? distanceKm / durationHours : 0;

      // Step 3: Calculate pace intervals
      const timestamps = gpsTrail.map(point => point.timestamp);
      const elevations = gpsTrail.map(point => point.altitude).filter((alt): alt is number => alt !== undefined);
      const intervals = calculateIntervals(
        gpsTrail,
        timestamps,
        elevations.length === gpsTrail.length ? elevations : undefined,
        distanceUnit
      );
      console.log(`Calculated ${intervals.length} pace intervals`);

      // Step 4: Save the run with the route UUID and intervals
      await runService.saveRun({
        routeId: finalRouteId || undefined,
        startTime: new Date(startedAt || gpsTrail[0].timestamp).toISOString(),
        endTime: new Date().toISOString(),
        duration: metrics.durationSeconds,
        distance: distanceKm,
        averagePace: metrics.averagePaceSecondsPerKm,
        averageSpeed: averageSpeed,
        polyline: gpsTrail,
        elevationGain: metrics.elevationGainMeters,
        caloriesBurned: metrics.calories,
        intervals: intervals, // NEW: Include calculated intervals
      });

      Alert.alert('Success!', 'Your run has been saved.', [
        { text: 'OK', onPress: () => reset() },
      ]);
    } catch (err: any) {
      console.error('Error saving run:', err);
      Alert.alert('Error', 'Failed to save your run. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Fit map to show planned route on mount
  useEffect(() => {
    if (plannedRoute && plannedRoute.polyline.length > 0 && mapRef.current) {
      const coordinates = plannedRoute.polyline.map(point => ({
        latitude: point.latitude,
        longitude: point.longitude,
      }));

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
          animated: true,
        });
      }, 500);
    }
  }, [plannedRoute]);

  useEffect(() => {
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [locationSubscription]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (secondsPerKm: number) => {
    if (!secondsPerKm || secondsPerKm === 0 || !isFinite(secondsPerKm)) {
      return '--:--';
    }
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.floor(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = targetDistanceMeters
    ? Math.min((metrics.distanceMeters / targetDistanceMeters) * 100, 100)
    : 0;

  if (saving) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.savingText}>Saving your run...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: currentPosition?.latitude || plannedRoute?.start_location.latitude || 37.78825,
            longitude: currentPosition?.longitude || plannedRoute?.start_location.longitude || -122.4324,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          followsUserLocation={isTracking && !isPaused}
        >
          {/* Planned Route Polyline (Blue, Dashed, Behind) */}
          {plannedRoute && plannedRoute.polyline.length > 1 && (
            <Polyline
              coordinates={plannedRoute.polyline.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              }))}
              strokeColor={COLORS.plannedRouteOverlay}
              strokeWidth={3}
              lineDashPattern={[10, 5]}
              zIndex={1}
            />
          )}

          {/* Live GPS Trail Polyline (Green, Solid, On Top) */}
          {gpsTrail.length > 1 && (
            <Polyline
              coordinates={gpsTrail.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              }))}
              strokeColor={COLORS.liveTrailActive}
              strokeWidth={5}
              zIndex={2}
            />
          )}

          {/* Start Marker (from planned route or GPS trail) */}
          {(plannedRoute?.start_location || gpsTrail.length > 0) && (
            <Marker
              coordinate={{
                latitude: plannedRoute?.start_location.latitude || gpsTrail[0].latitude,
                longitude: plannedRoute?.start_location.longitude || gpsTrail[0].longitude,
              }}
              title="Start"
              pinColor={COLORS.startMarker}
            />
          )}

          {/* End Marker (from planned route) */}
          {plannedRoute?.end_location && (
            <Marker
              coordinate={{
                latitude: plannedRoute.end_location.latitude,
                longitude: plannedRoute.end_location.longitude,
              }}
              title="Finish"
              pinColor={COLORS.endMarker}
            />
          )}

          {/* Waypoint Markers (from planned route) */}
          {plannedRoute?.waypoints && plannedRoute.waypoints.length > 0 &&
            plannedRoute.waypoints.map((waypoint, index) => (
              <Marker
                key={`waypoint-${index}`}
                coordinate={{
                  latitude: waypoint.latitude,
                  longitude: waypoint.longitude,
                }}
                title={`Waypoint ${index + 1}`}
                pinColor={COLORS.waypointMarker}
              />
            ))}
        </MapView>

        {isTracking && (
          <View style={styles.gpsStatusContainer}>
            <View
              style={[
                styles.gpsIndicator,
                gpsStatus === 'active' && styles.gpsActive,
                gpsStatus === 'searching' && styles.gpsSearching,
              ]}
            />
            <Text style={styles.gpsStatusText}>
              {gpsStatus === 'active' && '● LIVE'}
              {gpsStatus === 'searching' && '● SEARCHING'}
              {gpsStatus === 'lost' && '● LOST'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.metricsContainer}>
        {isTracking ? (
          <>
            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>⏱️ TIME</Text>
                <Text style={styles.metricValue}>
                  {formatTime(metrics.durationSeconds)}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>📏 DISTANCE</Text>
                <Text style={styles.metricValue}>
                  {formatDistanceUtil(metrics.distanceMeters / 1000, distanceUnit)}
                </Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>🏃 CURRENT PACE</Text>
                <Text style={styles.metricValue}>
                  {formatPaceUtil(metrics.currentPaceSecondsPerKm, distanceUnit)}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>⚡ AVG PACE</Text>
                <Text style={styles.metricValue}>
                  {formatPaceUtil(metrics.averagePaceSecondsPerKm, distanceUnit)}
                </Text>
              </View>
            </View>

            {targetDistanceMeters && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressLabel}>
                  Target: {formatDistanceUtil(targetDistanceMeters / 1000, distanceUnit, 1)} •{' '}
                  {progressPercentage.toFixed(0)}% Complete
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressPercentage}%` },
                    ]}
                  />
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.startPrompt}>
            <Text style={styles.startTitle}>Ready to Run?</Text>
            <Text style={styles.startSubtitle}>
              Start tracking your run with GPS
            </Text>
          </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        {!isTracking ? (
          <Button title="START RUN" onPress={handleStartRun} />
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.controlButton, styles.pauseButton]}
              onPress={handlePauseResume}
            >
              <Text style={styles.controlButtonText}>
                {isPaused ? '▶️ RESUME' : '⏸️ PAUSE'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton]}
              onPress={handleStopRun}
            >
              <Text style={styles.controlButtonText}>⏹️ STOP</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  savingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  gpsStatusContainer: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  gpsActive: {
    backgroundColor: '#00FF00',
  },
  gpsSearching: {
    backgroundColor: '#FFA500',
  },
  gpsStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricsContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  progressContainer: {
    marginTop: SPACING.sm,
  },
  progressLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  startPrompt: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  startTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  startSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  controlsContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  controlButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButton: {
    backgroundColor: COLORS.warning || '#FFA500',
  },
  stopButton: {
    backgroundColor: COLORS.danger,
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RunTrackerScreen;
