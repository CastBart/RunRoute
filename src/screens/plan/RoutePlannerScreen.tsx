import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, MAP_CONFIG } from '../../constants';
import { getCurrentLocation } from '../../services/locationService';
import { useRouteStore } from '../../store/routeStore';
import { useTrackingStore } from '../../store/trackingStore';
import { formatDistance as formatDistanceService, formatDuration } from '../../services/googleMapsService';
import { routeService } from '../../services/routeService';
import Button from '../../components/Button';
import { usePreferencesStore } from '../../store/preferencesStore';
import {
  formatDistance as formatDistanceUtil,
  convertMilesToKm,
  convertDistance,
  getUnitLabel,
} from '../../utils/unitConversions';

const RoutePlannerScreen = () => {
  const navigation = useNavigation();
  const { distanceUnit } = usePreferencesStore();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeUpdatePending, setRouteUpdatePending] = useState(false);
  const regenerationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    currentRoute,
    startLocation,
    endLocation,
    waypoints,
    targetDistance,
    isLoop,
    isGenerating,
    error,
    setStartLocation,
    setEndLocation,
    setTargetDistance,
    setIsLoop,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    generateRoute,
    regenerateRoute,
    updateRouteWithWaypoints,
    clearRoute,
    clearError,
  } = useRouteStore();


  // Get user's current location on mount
  useEffect(() => {
    loadCurrentLocation();
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (regenerationTimerRef.current) {
        clearTimeout(regenerationTimerRef.current);
      }
    };
  }, []);

  const loadCurrentLocation = async () => {
    setIsLoadingLocation(true);
    const { location, error } = await getCurrentLocation();

    if (error) {
      Alert.alert('Location Error', error);
      // Use default location if permission denied
      setUserLocation({
        latitude: MAP_CONFIG.defaultLatitude,
        longitude: MAP_CONFIG.defaultLongitude,
      });
    } else if (location) {
      setUserLocation(location);
    }

    setIsLoadingLocation(false);
  };

  // Handle map press to set start/end points
  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;

    if (!startLocation) {
      setStartLocation(coordinate);
      if (isLoop) {
        setEndLocation(coordinate);
      }
    } else if (!endLocation && !isLoop) {
      setEndLocation(coordinate);
    } else {
      // If both are set, replace start location
      setStartLocation(coordinate);
      if (isLoop) {
        setEndLocation(coordinate);
      }
    }
  };

  // Handle route generation
  const handleGenerateRoute = async () => {
    clearError();
    // If route already exists, regenerate with new randomization
    if (currentRoute) {
      await regenerateRoute();
    } else {
      await generateRoute();
    }
  };

  // Handle clear route
  const handleClearRoute = () => {
    clearRoute();
  };

  // Debounced route regeneration
  const scheduleRouteRegeneration = useCallback(() => {
    setRouteUpdatePending(true);

    // Clear existing timer
    if (regenerationTimerRef.current) {
      clearTimeout(regenerationTimerRef.current);
    }

    // Set new 500ms timer
    regenerationTimerRef.current = setTimeout(async () => {
      try {
        await updateRouteWithWaypoints();
        setRouteUpdatePending(false);
      } catch (error) {
        setRouteUpdatePending(false);
        Alert.alert('Error', 'Failed to update route. Please try again.');
      }
    }, 500);
  }, [updateRouteWithWaypoints]);

  // Memoized handler for waypoint drag
  const handleWaypointDragEnd = useCallback((waypointId: string, coordinate: any) => {
    updateWaypoint(waypointId, coordinate);
    scheduleRouteRegeneration();
  }, [updateWaypoint, scheduleRouteRegeneration]);

  // Memoized handler for start marker drag
  const handleStartMarkerDrag = useCallback((coordinate: any) => {
    setStartLocation(coordinate);
    if (currentRoute && !isLoop) {
      scheduleRouteRegeneration();
    }
  }, [setStartLocation, currentRoute, isLoop, scheduleRouteRegeneration]);

  // Memoized handler for end marker drag
  const handleEndMarkerDrag = useCallback((coordinate: any) => {
    setEndLocation(coordinate);
    if (currentRoute && !isLoop) {
      scheduleRouteRegeneration();
    }
  }, [setEndLocation, currentRoute, isLoop, scheduleRouteRegeneration]);

  // Handle delete waypoint
  const handleDeleteWaypoint = useCallback((waypointId: string) => {
    Alert.alert(
      'Remove Waypoint',
      'Remove this waypoint from the route?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeWaypoint(waypointId);
            if (currentRoute) {
              scheduleRouteRegeneration();
            }
          },
        },
      ]
    );
  }, [removeWaypoint, currentRoute, scheduleRouteRegeneration]);

  // Helper function to determine insertion order based on polyline position
  const calculateInsertionOrder = (tappedPolylineIndex: number): number => {
    if (!currentRoute) return waypoints.length;

    // Find polyline index for each existing waypoint
    const waypointsWithIndices = waypoints.map(wp => {
      let minDistance = Infinity;
      let wpPolylineIndex = 0;

      currentRoute.polyline.forEach((point, index) => {
        const distance = Math.sqrt(
          Math.pow(point.latitude - wp.latitude, 2) +
          Math.pow(point.longitude - wp.longitude, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          wpPolylineIndex = index;
        }
      });

      return { order: wp.order, polylineIndex: wpPolylineIndex };
    });

    // Count waypoints that appear before the tapped location
    const waypointsBefore = waypointsWithIndices.filter(
      wp => wp.polylineIndex < tappedPolylineIndex
    ).length;

    return waypointsBefore;
  };

  // Handle add waypoint by tapping route
  const handlePolylinePress = (event: any) => {
    if (!currentRoute) return;
    if (waypoints.length >= 20) {
      Alert.alert('Limit Reached', 'Maximum 20 waypoints allowed');
      return;
    }

    const tappedLocation = event.nativeEvent.coordinate;

    // Find nearest polyline point AND its index
    let minDistance = Infinity;
    let nearestPoint = tappedLocation;
    let nearestIndex = 0;

    currentRoute.polyline.forEach((point, index) => {
      const distance = Math.sqrt(
        Math.pow(point.latitude - tappedLocation.latitude, 2) +
        Math.pow(point.longitude - tappedLocation.longitude, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
        nearestIndex = index;
      }
    });

    // Calculate insertion order based on polyline position
    const insertionOrder = calculateInsertionOrder(nearestIndex);

    // Show confirmation dialog before adding waypoint
    Alert.alert(
      'Add Waypoint',
      `Add waypoint ${insertionOrder + 1} at this location?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add',
          onPress: () => {
            addWaypoint(nearestPoint, insertionOrder);
            scheduleRouteRegeneration();
          },
        },
      ]
    );
  };

  // Handle start run with this route
  const handleStartRun = () => {
    if (!currentRoute) {
      Alert.alert('No Route', 'Please generate a route first.');
      return;
    }

    // Set the planned route in tracking store
    useTrackingStore.getState().setPlannedRoute(currentRoute);

    // Navigate to tracking screen
    navigation.navigate('RunTracker' as never);

    // Show user feedback
    Alert.alert(
      'Route Loaded',
      'Your planned route is ready. Press "Start Run" to begin tracking.',
      [{ text: 'OK' }]
    );
  };

  // Handle save route for later - opens modal
  const handleSaveRoute = () => {
    if (!currentRoute) {
      Alert.alert('No Route', 'Please generate a route first.');
      return;
    }

    // Set default name and show modal
    const unitLabel = getUnitLabel(distanceUnit, true);
    const distanceValue = convertDistance(currentRoute.distance, distanceUnit).toFixed(1);
    const defaultName = `${distanceValue}${unitLabel} ${currentRoute.is_loop ? 'Loop' : 'Route'}`;
    setRouteName(defaultName);
    setShowSaveModal(true);
  };

  // Confirm save route from modal
  const handleConfirmSave = async () => {
    if (!routeName?.trim()) {
      Alert.alert('Error', 'Please enter a route name.');
      return;
    }

    if (!currentRoute) {
      return;
    }

    setIsSaving(true);
    setShowSaveModal(false);

    try {
      const routeWithName = {
        ...currentRoute,
        name: routeName.trim(),
      };
      await routeService.saveRoute(routeWithName);
      Alert.alert('Success', 'Route saved successfully!', [
        { text: 'OK', onPress: () => clearRoute() },
      ]);
      setRouteName('');
    } catch (err: any) {
      console.error('Error saving route:', err);
      Alert.alert('Error', 'Failed to save route. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel save route modal
  const handleCancelSave = () => {
    setShowSaveModal(false);
    setRouteName('');
  };

  // Center map on user location
  const centerOnUserLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: MAP_CONFIG.defaultLatitudeDelta,
        longitudeDelta: MAP_CONFIG.defaultLongitudeDelta,
      });
    }
  };

  // Calculate distance variance
  const distanceVariance = currentRoute
    ? ((currentRoute.distance - targetDistance) / targetDistance) * 100
    : 0;

  if (isLoadingLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: userLocation?.latitude || MAP_CONFIG.defaultLatitude,
          longitude: userLocation?.longitude || MAP_CONFIG.defaultLongitude,
          latitudeDelta: MAP_CONFIG.defaultLatitudeDelta,
          longitudeDelta: MAP_CONFIG.defaultLongitudeDelta,
        }}
        onPress={handleMapPress}
        onMapReady={() => setMapReady(true)}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Start Marker */}
        {startLocation && (
          <Marker
            coordinate={startLocation}
            pinColor={COLORS.startMarker}
            title="Start"
            description="Starting point"
            draggable={!isLoop}
            onDragEnd={(e) => handleStartMarkerDrag(e.nativeEvent.coordinate)}
          />
        )}

        {/* End Marker */}
        {endLocation && !isLoop && (
          <Marker
            coordinate={endLocation}
            pinColor={COLORS.endMarker}
            title="End"
            description="End point"
            draggable
            onDragEnd={(e) => handleEndMarkerDrag(e.nativeEvent.coordinate)}
          />
        )}

        {/* Waypoint Markers */}
        {waypoints.map((waypoint, index) => (
          <Marker
            key={waypoint.id}
            coordinate={{
              latitude: waypoint.latitude,
              longitude: waypoint.longitude,
            }}
            draggable
            onDragEnd={(e) => handleWaypointDragEnd(waypoint.id, e.nativeEvent.coordinate)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.waypointMarker}>
              <Text style={styles.waypointNumber}>{index + 1}</Text>
            </View>
            <Callout onPress={() => handleDeleteWaypoint(waypoint.id)}>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>Waypoint {index + 1}</Text>
                <TouchableOpacity style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>🗑️ Remove</Text>
                </TouchableOpacity>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Route Polyline */}
        {currentRoute && currentRoute.polyline.length > 0 && (
          <Polyline
            coordinates={currentRoute.polyline}
            strokeColor={COLORS.plannedRoute}
            strokeWidth={4}
            tappable={true}
            onPress={handlePolylinePress}
          />
        )}
      </MapView>

      {/* Controls Panel */}
      <View style={styles.controlsPanel}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Compact Controls Row */}
          <View style={styles.compactControls}>
            {/* Distance Input */}
            <View style={styles.distanceControl}>
              <Text style={styles.labelSmall}>Distance ({getUnitLabel(distanceUnit, true)})</Text>
              <TextInput
                style={styles.inputCompact}
                value={convertDistance(targetDistance, distanceUnit).toFixed(1)}
                onChangeText={(text) => {
                  if (text === '') {
                    setTargetDistance(0);
                    return;
                  }
                  const num = parseFloat(text);
                  // Convert input to km for storage (targetDistance is always in km)
                  const minDistance = distanceUnit === 'km' ? 0.5 : 0.3;
                  const maxDistance = distanceUnit === 'km' ? 100 : 62;

                  if (!isNaN(num) && num >= 0 && num <= maxDistance) {
                    const distanceInKm = distanceUnit === 'miles' ? convertMilesToKm(num) : num;
                    setTargetDistance(distanceInKm);
                  }
                }}
                keyboardType="decimal-pad"
                placeholder={distanceUnit === 'km' ? '5.0' : '3.1'}
              />
            </View>

            {/* Loop Toggle */}
            <View style={styles.loopControl}>
              <Text style={styles.labelSmall}>Loop</Text>
              <Switch
                value={isLoop}
                onValueChange={(value) => setIsLoop(value)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            </View>
          </View>

          {/* Update Indicator */}
          {routeUpdatePending && (
            <View style={styles.updateIndicator}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.updateText}>Updating route...</Text>
            </View>
          )}

          {/* Route Info */}
          {currentRoute && (
            <>
              <View style={styles.routeInfo}>
                <Text style={styles.routeInfoTitle}>Route Summary</Text>
                <View style={styles.routeInfoRow}>
                  <Text style={styles.routeInfoLabel}>Distance:</Text>
                  <Text style={styles.routeInfoValue}>
                    {formatDistanceUtil(currentRoute.distance, distanceUnit)}
                  </Text>
                </View>
                <View style={styles.routeInfoRow}>
                  <Text style={styles.routeInfoLabel}>Est. Time:</Text>
                  <Text style={styles.routeInfoValue}>
                    {formatDuration(currentRoute.estimated_duration || 0)}
                  </Text>
                </View>
                {Math.abs(distanceVariance) > 10 && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      ⚠️ Route is {distanceVariance > 0 ? 'longer' : 'shorter'} than target by{' '}
                      {Math.abs(distanceVariance).toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <Button
              title={currentRoute ? 'Regenerate Route' : 'Generate Route'}
              onPress={handleGenerateRoute}
              loading={isGenerating}
              disabled={!startLocation || (!endLocation && !isLoop)}
            />
            {currentRoute && (
              <>
                <Button
                  title="Start Run with This Route"
                  onPress={handleStartRun}
                  style={styles.startRunButton}
                />
                <Button
                  title="Save Route for Later"
                  onPress={handleSaveRoute}
                  loading={isSaving}
                  variant="outline"
                  style={styles.saveRouteButton}
                />
                <Button
                  title="Clear Route"
                  onPress={handleClearRoute}
                  variant="outline"
                  style={styles.clearButton}
                />
              </>
            )}
          </View>

          {/* Help Text */}
          <Text style={styles.helpText}>
            {!startLocation
              ? '📍 Tap on the map to set your starting point'
              : !endLocation && !isLoop
              ? '📍 Tap again to set your end point'
              : '✅ Ready to generate route!'}
          </Text>
        </ScrollView>
      </View>

      {/* Floating My Location Button */}
      <TouchableOpacity style={styles.myLocationButton} onPress={centerOnUserLocation}>
        <Text style={styles.myLocationIcon}>📍</Text>
      </TouchableOpacity>

      {/* Save Route Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelSave}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Route</Text>
            <Text style={styles.modalSubtitle}>Enter a name for this route:</Text>
            <TextInput
              style={styles.modalInput}
              value={routeName}
              onChangeText={setRouteName}
              placeholder="Route name"
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleCancelSave}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={handleConfirmSave}
                disabled={isSaving}
              >
                <Text style={styles.modalSaveText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  map: {
    flex: 1,
  },
  controlsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.md,
    maxHeight: '40%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  controlGroup: {
    marginBottom: SPACING.md,
  },
  compactControls: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  distanceControl: {
    flex: 1,
  },
  loopControl: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  labelSmall: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  inputCompact: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  label: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  helpText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  routeInfo: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  routeInfoTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  routeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  routeInfoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  routeInfoValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  warningBox: {
    backgroundColor: COLORS.warning + '20',
    borderRadius: 8,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  warningText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
  },
  errorBox: {
    backgroundColor: COLORS.danger + '20',
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.danger,
  },
  buttonGroup: {
    marginBottom: SPACING.md,
  },
  startRunButton: {
    marginTop: SPACING.sm,
  },
  saveRouteButton: {
    marginTop: SPACING.sm,
  },
  clearButton: {
    marginTop: SPACING.sm,
  },
  myLocationButton: {
    position: 'absolute',
    top: SPACING.xl,
    right: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  myLocationIcon: {
    fontSize: 24,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    marginLeft: SPACING.sm,
  },
  modalCancelButton: {
    backgroundColor: COLORS.surface,
  },
  modalCancelText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  modalSaveButton: {
    backgroundColor: COLORS.primary,
  },
  modalSaveText: {
    fontSize: FONT_SIZES.md,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Waypoint marker styles
  waypointMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.info, // Blue
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  waypointNumber: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Callout styles
  calloutContainer: {
    padding: SPACING.sm,
    minWidth: 120,
  },
  calloutTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    padding: SPACING.xs,
    borderRadius: 4,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  // Update indicator styles
  updateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  updateText: {
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
});

export default RoutePlannerScreen;
