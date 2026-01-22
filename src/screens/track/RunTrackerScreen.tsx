import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING } from '../../constants';

// Start run state machine
type StartRunState =
  | 'idle'           // Initial state
  | 'gps_searching'  // Acquiring GPS on mount
  | 'gps_ready'      // Good GPS signal acquired (accuracy < 20m)
  | 'requesting'     // Requesting permissions
  | 'countdown'      // 3-2-1 countdown active
  | 'starting';      // Starting background service

// GPS signal quality thresholds (in meters)
const GPS_READY_THRESHOLD = 20;
const GPS_FAIR_THRESHOLD = 50;

// GPS signal quality type
type GPSQuality = 'searching' | 'fair' | 'ready';
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
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from '../../services/backgroundLocationService';

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

  // Enhanced start run UX state
  const [startRunState, setStartRunState] = useState<StartRunState>('idle');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preAcquisitionWatcherRef = useRef<Location.LocationSubscription | null>(null);

  // Derive GPS quality from accuracy
  const getGPSQuality = useCallback((accuracy: number | null): GPSQuality => {
    if (accuracy === null || accuracy > GPS_FAIR_THRESHOLD) return 'searching';
    if (accuracy > GPS_READY_THRESHOLD) return 'fair';
    return 'ready';
  }, []);

  const gpsQuality = getGPSQuality(gpsAccuracy);

  // Trigger haptic feedback safely
  const triggerHaptic = useCallback(async (style: Haptics.ImpactFeedbackStyle) => {
    try {
      await Haptics.impactAsync(style);
    } catch (error) {
      // Haptics not available on this device, silently ignore
      console.log('Haptics not available:', error);
    }
  }, []);

  // GPS Pre-Acquisition: Start acquiring GPS when screen mounts (before user clicks START)
  useEffect(() => {
    // Only run pre-acquisition when not tracking
    if (isTracking) {
      // Clean up pre-acquisition watcher when tracking starts
      if (preAcquisitionWatcherRef.current) {
        preAcquisitionWatcherRef.current.remove();
        preAcquisitionWatcherRef.current = null;
      }
      return;
    }

    const startGPSPreAcquisition = async () => {
      try {
        // Check if we already have foreground permissions
        const { status } = await Location.getForegroundPermissionsAsync();

        if (status !== 'granted') {
          // Don't have permissions yet, show idle state
          // User will need to grant permission when they tap START
          setStartRunState('idle');
          setGpsAccuracy(null);
          return;
        }

        // We have permissions, start pre-acquiring GPS
        setStartRunState('gps_searching');

        // Start watching location with balanced accuracy (saves battery vs BestForNavigation)
        preAcquisitionWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 10,
            timeInterval: 2000, // Update every 2 seconds
          },
          (location) => {
            const accuracy = location.coords.accuracy ?? 999;
            setGpsAccuracy(accuracy);

            if (accuracy < GPS_READY_THRESHOLD) {
              setStartRunState('gps_ready');
            } else if (accuracy < GPS_FAIR_THRESHOLD) {
              // Fair signal, still searching for better
              setStartRunState('gps_searching');
            } else {
              setStartRunState('gps_searching');
            }
          }
        );
      } catch (error) {
        console.log('GPS pre-acquisition error:', error);
        setStartRunState('idle');
        setGpsAccuracy(null);
      }
    };

    startGPSPreAcquisition();

    // Cleanup function: remove watcher when component unmounts or tracking starts
    return () => {
      if (preAcquisitionWatcherRef.current) {
        preAcquisitionWatcherRef.current.remove();
        preAcquisitionWatcherRef.current = null;
      }
    };
  }, [isTracking]);

  // Countdown logic
  const startCountdown = useCallback(() => {
    setShowCountdown(true);
    setCountdownValue(3);
    setStartRunState('countdown');

    // Initial haptic for countdown start
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    countdownTimerRef.current = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev <= 1) {
          // Countdown finished, start the run
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setShowCountdown(false);
          actuallyStartTracking();
          return 0;
        }
        // Haptic feedback on each count
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        return prev - 1;
      });
    }, 1000);
  }, [triggerHaptic]);

  // Skip countdown and start immediately
  const skipCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setShowCountdown(false);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    actuallyStartTracking();
  }, [triggerHaptic]);

  // The actual tracking start logic (extracted from original handleStartRun)
  const actuallyStartTracking = async () => {
    try {
      setStartRunState('starting');

      // Get initial GPS position with high accuracy
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

      // Start background location tracking
      console.log('Starting background location tracking...');
      const started = await startBackgroundLocationTracking((newPosition: GPSPoint) => {
        updatePosition(newPosition);
      });

      if (started) {
        setGPSStatus('active');
        console.log('Background location tracking started successfully');
        // Strong haptic feedback for successful start
        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        throw new Error('Failed to start background location tracking.');
      }
    } catch (err: any) {
      console.error('Error starting tracking:', err);
      setStartRunState('gps_ready'); // Go back to ready state
      setError(err.message || 'Unable to start GPS tracking.');
      Alert.alert('GPS Tracking Error', err.message || 'Unable to start GPS tracking. Please try again.');
    }
  };

  // Request location permissions and start tracking (enhanced flow with countdown)
  const handleStartRun = async () => {
    try {
      // Step 1: Check and request foreground location permission
      setStartRunState('requesting');
      console.log('Checking foreground location permission...');
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      console.log('Foreground permission status:', foregroundStatus);

      if (foregroundStatus !== 'granted') {
        setStartRunState('idle');
        Alert.alert(
          'Location Permission Required',
          'RunRoute needs access to your location to track your run. Please grant location permission.'
        );
        return;
      }

      // Step 2: Request background location permission (Android shows 2-step dialog)
      console.log('Requesting background location permission...');
      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();

      console.log('Background permission status:', backgroundStatus);

      if (backgroundStatus !== 'granted') {
        setStartRunState('idle');
        Alert.alert(
          'Background Location Permission Required',
          'RunRoute needs background location access to track your run even when your phone is locked. Please grant "Allow all the time" permission.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Try Again',
              onPress: () => handleStartRun(),
            },
          ]
        );
        return;
      }

      setGPSStatus('searching');

      // Step 3: Check GPS accuracy - if we don't have a good signal yet, try to acquire one
      if (gpsAccuracy === null || gpsAccuracy > GPS_READY_THRESHOLD) {
        // Try to get a quick position fix
        try {
          const quickLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const quickAccuracy = quickLocation.coords.accuracy ?? 999;
          setGpsAccuracy(quickAccuracy);

          // If GPS accuracy is really bad (> 100m), warn user but allow them to continue
          if (quickAccuracy > 100) {
            Alert.alert(
              'Poor GPS Signal',
              'GPS accuracy is currently low. Your tracking may be less accurate. Would you like to wait for a better signal?',
              [
                {
                  text: 'Wait',
                  style: 'cancel',
                  onPress: () => setStartRunState('gps_searching'),
                },
                {
                  text: 'Start Anyway',
                  onPress: () => startCountdown(),
                },
              ]
            );
            return;
          }
        } catch (error) {
          console.log('Quick GPS fix failed, continuing anyway:', error);
        }
      }

      // Step 4: Start the countdown
      startCountdown();
    } catch (err: any) {
      console.error('Error starting run:', err);
      const errorMessage = err.message || 'Unable to start GPS tracking. Please try again.';
      setError(errorMessage);
      setStartRunState('idle');

      Alert.alert(
        'GPS Tracking Error',
        errorMessage,
        [
          {
            text: 'OK',
            style: 'default',
          },
          {
            text: 'Try Again',
            onPress: () => handleStartRun(),
          },
        ]
      );
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
            // Stop background location tracking
            await stopBackgroundLocationTracking();

            // Remove old foreground subscription if it exists (legacy)
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
      // Cleanup: stop background tracking when component unmounts
      stopBackgroundLocationTracking();

      // Remove old foreground subscription if it exists (legacy)
      if (locationSubscription) {
        locationSubscription.remove();
      }

      // Cleanup countdown timer if running
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }

      // Cleanup GPS pre-acquisition watcher
      if (preAcquisitionWatcherRef.current) {
        preAcquisitionWatcherRef.current.remove();
        preAcquisitionWatcherRef.current = null;
      }
    };
  }, [locationSubscription]);

  // Independent timer for duration display (updates every 1 second)
  useEffect(() => {
    if (!isTracking || isPaused || !startedAt) return;

    const timer = setInterval(() => {
      // Force duration metric update without waiting for GPS
      // This makes the timer feel smooth and real-time
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);

      // Only update if duration has actually changed
      if (elapsed !== metrics.durationSeconds) {
        // Update just the duration metric without triggering full recalculation
        const updatedMetrics = { ...metrics, durationSeconds: elapsed };
        useTrackingStore.setState({ metrics: updatedMetrics });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isTracking, isPaused, startedAt, metrics]);

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
              {startRunState === 'gps_searching' && 'Acquiring GPS signal...'}
              {startRunState === 'gps_ready' && 'GPS signal acquired - ready to start!'}
              {startRunState === 'idle' && 'Tap START to begin tracking'}
              {startRunState === 'requesting' && 'Setting up location...'}
              {startRunState === 'starting' && 'Starting your run...'}
              {startRunState === 'countdown' && 'Get ready...'}
            </Text>
            {/* GPS accuracy display when pre-acquiring */}
            {!isTracking && gpsAccuracy !== null && (
              <Text style={styles.gpsAccuracyText}>
                GPS Accuracy: {Math.round(gpsAccuracy)}m
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        {!isTracking ? (
          <View style={styles.startButtonContainer}>
            {/* GPS Signal Strength Indicator */}
            <View style={styles.gpsSignalRow}>
              <View
                style={[
                  styles.gpsSignalDot,
                  gpsQuality === 'searching' && styles.gpsSignalSearching,
                  gpsQuality === 'fair' && styles.gpsSignalFair,
                  gpsQuality === 'ready' && styles.gpsSignalReady,
                ]}
              />
              <Text style={styles.gpsSignalText}>
                {gpsQuality === 'searching' && 'Searching for GPS...'}
                {gpsQuality === 'fair' && 'Fair GPS signal'}
                {gpsQuality === 'ready' && 'GPS Ready'}
              </Text>
            </View>
            {/* Start Run Button */}
            <Button
              title={
                startRunState === 'gps_searching'
                  ? 'SEARCHING GPS...'
                  : startRunState === 'requesting'
                    ? 'PREPARING...'
                    : startRunState === 'starting'
                      ? 'STARTING...'
                      : 'START RUN'
              }
              onPress={handleStartRun}
              disabled={startRunState === 'starting' || startRunState === 'countdown'}
              loading={startRunState === 'requesting' || startRunState === 'starting'}
            />
          </View>
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

      {/* Countdown Overlay Modal */}
      <Modal
        visible={showCountdown}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <Pressable style={styles.countdownOverlay} onPress={skipCountdown}>
          <View style={styles.countdownContent}>
            <Text style={styles.countdownNumber}>
              {countdownValue === 0 ? 'GO!' : countdownValue}
            </Text>
            <Text style={styles.countdownHint}>Tap anywhere to skip</Text>
          </View>
        </Pressable>
      </Modal>
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
  // GPS accuracy text in start prompt
  gpsAccuracyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  // Start button container with GPS indicator
  startButtonContainer: {
    width: '100%',
  },
  gpsSignalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  gpsSignalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING.sm,
  },
  gpsSignalSearching: {
    backgroundColor: COLORS.danger,
  },
  gpsSignalFair: {
    backgroundColor: COLORS.warning,
  },
  gpsSignalReady: {
    backgroundColor: COLORS.success,
  },
  gpsSignalText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  // Countdown overlay styles
  countdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownContent: {
    alignItems: 'center',
  },
  countdownNumber: {
    fontSize: 150,
    fontWeight: 'bold',
    color: COLORS.primary,
    textShadowColor: 'rgba(255, 107, 53, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  countdownHint: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: SPACING.xl,
  },
});

export default RunTrackerScreen;
