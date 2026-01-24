import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SPACING } from '../../constants';
import { routeService } from '../../services/routeService';
import { Route, RoutesStackParamList } from '../../types';
import { usePreferencesStore } from '../../store/preferencesStore';
import { formatDistance as formatDistanceUtil } from '../../utils/unitConversions';

type SavedRoutesNavigationProp = StackNavigationProp<RoutesStackParamList, 'SavedRoutes'>;

const SavedRoutesScreen = () => {
  const navigation = useNavigation<SavedRoutesNavigationProp>();
  const { distanceUnit } = usePreferencesStore();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    try {
      setError(null);
      const data = await routeService.getUserRoutes(50, 0);
      setRoutes(data);
    } catch (err: any) {
      console.error('Error fetching routes:', err);
      setError('Failed to load your routes. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  // Refresh when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchRoutes();
    });
    return unsubscribe;
  }, [navigation, fetchRoutes]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRoutes();
  };

  const handleRoutePress = (route: Route) => {
    if (route.id) {
      navigation.navigate('RouteDetail', { routeId: route.id });
    }
  };

  const formatDistance = (km: number): string => {
    return formatDistanceUtil(km, distanceUnit);
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderRouteCard = ({ item }: { item: Route }) => (
    <TouchableOpacity
      style={styles.routeCard}
      onPress={() => handleRoutePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.routeName} numberOfLines={1}>
          {item.name || `${formatDistance(item.distance)} Route`}
        </Text>
        <View style={[styles.typeBadge, item.is_loop ? styles.loopBadge : styles.pointBadge]}>
          <Text style={styles.typeText}>{item.is_loop ? 'Loop' : 'Point-to-Point'}</Text>
        </View>
      </View>

      <View style={styles.cardStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDistance(item.distance)}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        {item.estimated_duration && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(item.estimated_duration)}</Text>
            <Text style={styles.statLabel}>Est. Time</Text>
          </View>
        )}
        {item.created_at && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDate(item.created_at)}</Text>
            <Text style={styles.statLabel}>Created</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.tapHint}>Tap to view route</Text>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📍</Text>
      <Text style={styles.emptyTitle}>No Saved Routes</Text>
      <Text style={styles.emptyText}>
        Plan a route and save it for later. Your saved routes will appear here.
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('PlanRoute')}
      >
        <Text style={styles.createButtonText}>Plan a Route</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading routes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchRoutes}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={routes}
        renderItem={renderRouteCard}
        keyExtractor={(item) => item.id || String(Math.random())}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.md,
    flexGrow: 1,
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
    color: COLORS.danger,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  routeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  routeName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  typeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  loopBadge: {
    backgroundColor: COLORS.primary + '20',
  },
  pointBadge: {
    backgroundColor: COLORS.textSecondary + '20',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
  },
  cardStats: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  statItem: {
    marginRight: SPACING.lg,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  tapHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  arrow: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SavedRoutesScreen;
