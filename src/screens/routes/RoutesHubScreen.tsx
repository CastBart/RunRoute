import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SPACING } from '../../constants';
import { RoutesStackParamList } from '../../types';
import { useTrackingStore } from '../../store/trackingStore';

type RoutesNavigationProp = StackNavigationProp<RoutesStackParamList, 'RoutesHub'>;

const RoutesHubScreen = () => {
  const navigation = useNavigation<RoutesNavigationProp>();
  const { setPlannedRoute } = useTrackingStore();

  const handlePlanRoute = () => {
    navigation.navigate('PlanRoute');
  };

  const handleSavedRoutes = () => {
    navigation.navigate('SavedRoutes');
  };

  const handleFreeRun = () => {
    // Clear any planned route and go directly to tracking
    setPlannedRoute(null);
    navigation.navigate('RunTracker');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Ready to Run?</Text>
        <Text style={styles.subtitle}>Choose how you want to start</Text>

        {/* Plan a Route Card */}
        <TouchableOpacity style={styles.card} onPress={handlePlanRoute} activeOpacity={0.8}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardEmoji}>🗺️</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Plan a Route</Text>
            <Text style={styles.cardDescription}>
              Create a custom route with your target distance. Set start point, choose loop or point-to-point, and generate the perfect path.
            </Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
        </TouchableOpacity>

        {/* Saved Routes Card */}
        <TouchableOpacity style={styles.card} onPress={handleSavedRoutes} activeOpacity={0.8}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardEmoji}>📍</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Saved Routes</Text>
            <Text style={styles.cardDescription}>
              Browse your saved routes and pick one to run. View route details and start tracking with a single tap.
            </Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
        </TouchableOpacity>

        {/* Free Run Card */}
        <TouchableOpacity
          style={[styles.card, styles.freeRunCard]}
          onPress={handleFreeRun}
          activeOpacity={0.8}
        >
          <View style={[styles.cardIcon, styles.freeRunIcon]}>
            <Text style={styles.cardEmoji}>🏃</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, styles.freeRunTitle]}>Start Free Run</Text>
            <Text style={[styles.cardDescription, styles.freeRunDescription]}>
              No plan needed! Just start running and track your progress. Perfect for spontaneous workouts.
            </Text>
          </View>
          <Text style={[styles.cardArrow, styles.freeRunArrow]}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  cardArrow: {
    fontSize: 24,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  freeRunCard: {
    backgroundColor: COLORS.primary,
  },
  freeRunIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  freeRunTitle: {
    color: '#FFFFFF',
  },
  freeRunDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  freeRunArrow: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default RoutesHubScreen;
