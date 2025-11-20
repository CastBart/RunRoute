import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, MAP_CONFIG } from '../../constants';
import { getCurrentLocation } from '../../services/locationService';
import { useRouteStore } from '../../store/routeStore';
import { useTrackingStore } from '../../store/trackingStore';
import { formatDistance, formatDuration } from '../../services/googleMapsService';
import Button from '../../components/Button';

const RoutePlannerScreen = () => {
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

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
    generateRoute,
    regenerateRoute,
    clearRoute,
    clearError,
  } = useRouteStore();

  // Debug: Log when currentRoute changes
  useEffect(() => {
    if (currentRoute) {
      console.log('🗺️ RoutePlannerScreen: currentRoute updated');
      console.log('Route ID:', currentRoute.id);
      console.log('Polyline length:', currentRoute.polyline?.length || 0);
      if (currentRoute.polyline && currentRoute.polyline.length > 0) {
        console.log('Sample coordinates:', currentRoute.polyline.slice(0, 3));
      } else {
        console.warn('⚠️ currentRoute.polyline is empty or undefined');
      }
    } else {
      console.log('🗺️ RoutePlannerScreen: currentRoute is null');
    }
  }, [currentRoute]);

  // Get user's current location on mount
  useEffect(() => {
    loadCurrentLocation();
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

  // Handle start run with this route
  const handleStartRun = () => {
    if (!currentRoute) {
      Alert.alert('No Route', 'Please generate a route first.');
      return;
    }

    // Set the planned route in tracking store
    useTrackingStore.getState().setPlannedRoute(currentRoute);

    // Navigate to tracking screen
    navigation.navigate('Track' as never);

    // Show user feedback
    Alert.alert(
      'Route Loaded',
      'Your planned route is ready. Press "Start Run" to begin tracking.',
      [{ text: 'OK' }]
    );
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
          />
        )}

        {/* End Marker */}
        {endLocation && !isLoop && (
          <Marker
            coordinate={endLocation}
            pinColor={COLORS.endMarker}
            title="End"
            description="End point"
          />
        )}

        {/* Waypoint Markers */}
        {waypoints.map((waypoint) => (
          <Marker
            key={waypoint.id}
            coordinate={{
              latitude: waypoint.latitude,
              longitude: waypoint.longitude,
            }}
            pinColor={COLORS.waypointMarker}
            draggable
            onDragEnd={(e) => updateWaypoint(waypoint.id, e.nativeEvent.coordinate)}
          />
        ))}

        {/* Route Polyline */}
        {currentRoute && currentRoute.polyline.length > 0 && (
          <>
            {console.log('🔵 Rendering Polyline component with', currentRoute.polyline.length, 'points')}
            <Polyline
              coordinates={currentRoute.polyline}
              strokeColor={COLORS.plannedRoute}
              strokeWidth={4}
            />
          </>
        )}
      </MapView>

      {/* Controls Panel */}
      <View style={styles.controlsPanel}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Distance Input */}
          <View style={styles.controlGroup}>
            <Text style={styles.label}>Target Distance (km)</Text>
            <TextInput
              style={styles.input}
              value={targetDistance.toString()}
              onChangeText={(text) => {
                // Allow empty string for clearing
                if (text === '') {
                  setTargetDistance(0);
                  return;
                }
                const num = parseFloat(text);
                if (!isNaN(num) && num >= 0 && num <= 100) {
                  setTargetDistance(num);
                }
              }}
              keyboardType="decimal-pad"
              placeholder="5.0"
            />
          </View>

          {/* Loop Toggle */}
          <View style={styles.controlGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Loop Route</Text>
              <Switch
                value={isLoop}
                onValueChange={(value) => setIsLoop(value)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            </View>
            <Text style={styles.helpText}>
              {isLoop
                ? 'Route will return to starting point'
                : 'Route will end at a different location'}
            </Text>
          </View>

          {/* Route Info */}
          {currentRoute && (
            <>
              {(() => {
                console.log('📊 Route Summary Data:', {
                  distance: currentRoute.distance,
                  estimated_duration: currentRoute.estimated_duration,
                  formatted_distance: formatDistance(currentRoute.distance),
                  formatted_duration: formatDuration(currentRoute.estimated_duration || 0),
                });
                return null;
              })()}
              <View style={styles.routeInfo}>
                <Text style={styles.routeInfoTitle}>Route Summary</Text>
                <View style={styles.routeInfoRow}>
                  <Text style={styles.routeInfoLabel}>Distance:</Text>
                  <Text style={styles.routeInfoValue}>
                    {formatDistance(currentRoute.distance)}
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
    padding: SPACING.lg,
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  controlGroup: {
    marginBottom: SPACING.lg,
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
});

export default RoutePlannerScreen;
