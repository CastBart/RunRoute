import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SPACING, MAP_CONFIG } from '../../constants';
import { routeService } from '../../services/routeService';
import { useTrackingStore } from '../../store/trackingStore';
import { Route, RoutesStackParamList } from '../../types';
import Button from '../../components/Button';

type RouteDetailRouteProp = RouteProp<RoutesStackParamList, 'RouteDetail'>;
type RouteDetailNavigationProp = StackNavigationProp<RoutesStackParamList, 'RouteDetail'>;

const RouteDetailScreen = () => {
  const navigation = useNavigation<RouteDetailNavigationProp>();
  const route = useRoute<RouteDetailRouteProp>();
  const { routeId } = route.params;
  const mapRef = useRef<MapView>(null);

  const [routeData, setRouteData] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { setPlannedRoute } = useTrackingStore();

  useEffect(() => {
    fetchRoute();
  }, [routeId]);

  const fetchRoute = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await routeService.getRouteById(routeId);
      setRouteData(data);

      // Fit map to show the route
      if (data.polyline && data.polyline.length > 0 && mapRef.current) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(data.polyline, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
        }, 500);
      }
    } catch (err: any) {
      console.error('Error fetching route:', err);
      setError('Failed to load route details.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRun = () => {
    if (!routeData) return;

    // Set the route in tracking store
    setPlannedRoute(routeData);

    // Navigate to run tracker
    navigation.navigate('RunTracker');

    Alert.alert(
      'Route Loaded',
      'Your route is ready. Press "Start Run" to begin tracking.',
      [{ text: 'OK' }]
    );
  };

  const handleDeleteRoute = () => {
    Alert.alert(
      'Delete Route',
      'Are you sure you want to delete this route? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await routeService.deleteRoute(routeId);
              Alert.alert('Success', 'Route deleted successfully.');
              navigation.goBack();
            } catch (err: any) {
              console.error('Error deleting route:', err);
              Alert.alert('Error', 'Failed to delete route. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const formatDistance = (km: number): string => {
    return km.toFixed(2) + ' km';
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading route...</Text>
      </View>
    );
  }

  if (error || !routeData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Route not found'}</Text>
        <Button title="Go Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const initialRegion = routeData.polyline.length > 0
    ? {
        latitude: routeData.polyline[0].latitude,
        longitude: routeData.polyline[0].longitude,
        latitudeDelta: MAP_CONFIG.defaultLatitudeDelta,
        longitudeDelta: MAP_CONFIG.defaultLongitudeDelta,
      }
    : {
        latitude: routeData.start_location.latitude,
        longitude: routeData.start_location.longitude,
        latitudeDelta: MAP_CONFIG.defaultLatitudeDelta,
        longitudeDelta: MAP_CONFIG.defaultLongitudeDelta,
      };

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={initialRegion}
        >
          {/* Start Marker */}
          <Marker
            coordinate={routeData.start_location}
            pinColor={COLORS.startMarker}
            title="Start"
          />

          {/* End Marker (only for non-loop routes) */}
          {!routeData.is_loop && (
            <Marker
              coordinate={routeData.end_location}
              pinColor={COLORS.endMarker}
              title="End"
            />
          )}

          {/* Route Polyline */}
          {routeData.polyline && routeData.polyline.length > 0 && (
            <Polyline
              coordinates={routeData.polyline}
              strokeColor={COLORS.plannedRoute}
              strokeWidth={4}
            />
          )}
        </MapView>
      </View>

      {/* Route Details */}
      <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
        {/* Route Name */}
        <Text style={styles.routeName}>
          {routeData.name || `${formatDistance(routeData.distance)} Route`}
        </Text>

        {/* Type Badge */}
        <View style={[styles.typeBadge, routeData.is_loop ? styles.loopBadge : styles.pointBadge]}>
          <Text style={styles.typeText}>
            {routeData.is_loop ? 'Loop Route' : 'Point-to-Point'}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDistance(routeData.distance)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          {routeData.estimated_duration && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatDuration(routeData.estimated_duration)}</Text>
              <Text style={styles.statLabel}>Est. Time</Text>
            </View>
          )}
          {routeData.target_distance && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{routeData.target_distance.toFixed(1)} km</Text>
              <Text style={styles.statLabel}>Target</Text>
            </View>
          )}
        </View>

        {/* Created Date */}
        {routeData.created_at && (
          <View style={styles.dateContainer}>
            <Text style={styles.dateLabel}>Created</Text>
            <Text style={styles.dateValue}>{formatDate(routeData.created_at)}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title="Start This Route"
            onPress={handleStartRun}
            style={styles.startButton}
          />
          <Button
            title="Delete Route"
            onPress={handleDeleteRoute}
            variant="outline"
            loading={isDeleting}
            style={styles.deleteButton}
          />
        </View>
      </ScrollView>
    </View>
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
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  mapContainer: {
    height: '45%',
    backgroundColor: COLORS.border,
  },
  map: {
    flex: 1,
  },
  detailsContainer: {
    flex: 1,
    padding: SPACING.lg,
  },
  routeName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    marginBottom: SPACING.lg,
  },
  loopBadge: {
    backgroundColor: COLORS.primary + '20',
  },
  pointBadge: {
    backgroundColor: COLORS.textSecondary + '20',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginRight: SPACING.sm,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  dateContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  dateLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    color: COLORS.text,
  },
  buttonContainer: {
    marginBottom: SPACING.xl,
  },
  startButton: {
    marginBottom: SPACING.sm,
  },
  deleteButton: {
    borderColor: COLORS.error,
  },
});

export default RouteDetailScreen;
