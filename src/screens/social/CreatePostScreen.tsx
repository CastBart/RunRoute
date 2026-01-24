import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { COLORS, SPACING } from '../../constants';
import { socialService } from '../../services/socialService';
import { runService } from '../../services/runService';
import { Run } from '../../types';
import { usePreferencesStore } from '../../store/preferencesStore';
import {
  formatDistance as formatDistanceUtil,
  formatPace as formatPaceUtil,
} from '../../utils/unitConversions';

interface RunData {
  id: string;
  distance: number;
  duration: number;
  average_pace: number;
  start_time: string;
  polyline: Array<{ latitude: number; longitude: number }>;
}

const CreatePostScreen = () => {
  const navigation = useNavigation();
  const { distanceUnit } = usePreferencesStore();
  const [runs, setRuns] = useState<RunData[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunData | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'select' | 'compose'>('select');

  const fetchRuns = useCallback(async () => {
    try {
      const data = await runService.getUserRuns(50, 0);

      // Filter out runs that have already been posted
      const runsWithPostStatus = await Promise.all(
        data.map(async (run: any) => {
          const hasBeenPosted = await socialService.hasRunBeenPosted(run.id);
          return { ...run, hasBeenPosted };
        })
      );

      const availableRuns = runsWithPostStatus.filter((run: any) => !run.hasBeenPosted);
      setRuns(availableRuns);
    } catch (err) {
      console.error('Error fetching runs:', err);
      Alert.alert('Error', 'Failed to load your runs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleSelectRun = (run: RunData) => {
    setSelectedRun(run);
    setStep('compose');
  };

  const handleBack = () => {
    if (step === 'compose') {
      setStep('select');
      setSelectedRun(null);
      setCaption('');
    } else {
      navigation.goBack();
    }
  };

  const handlePost = async () => {
    if (!selectedRun) return;

    setSubmitting(true);
    try {
      await socialService.createPost({
        runId: selectedRun.id,
        caption: caption.trim() || undefined,
      });

      Alert.alert('Success', 'Your run has been shared!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      console.error('Error creating post:', err);
      Alert.alert('Error', 'Failed to share your run. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Format helpers
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDistance = (km: number): string => formatDistanceUtil(km, distanceUnit);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (secondsPerKm: number): string => formatPaceUtil(secondsPerKm, distanceUnit);

  const getMapRegion = (polyline: Array<{ latitude: number; longitude: number }>) => {
    if (polyline.length === 0) {
      return { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }
    const lats = polyline.map((p) => p.latitude);
    const lngs = polyline.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.005),
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.005),
    };
  };

  const renderRunItem = ({ item }: { item: RunData }) => (
    <TouchableOpacity style={styles.runItem} onPress={() => handleSelectRun(item)}>
      <View style={styles.runInfo}>
        <Text style={styles.runDate}>{formatDate(item.start_time)}</Text>
        <View style={styles.runStats}>
          <Text style={styles.runStat}>{formatDistance(item.distance)}</Text>
          <Text style={styles.statDot}>•</Text>
          <Text style={styles.runStat}>{formatDuration(item.duration)}</Text>
          <Text style={styles.statDot}>•</Text>
          <Text style={styles.runStat}>{formatPace(item.average_pace)}</Text>
        </View>
      </View>
      <Text style={styles.selectIcon}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your runs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Step 1: Select a run
  if (step === 'select') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.headerButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select a Run</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {runs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏃</Text>
            <Text style={styles.emptyTitle}>No runs to share</Text>
            <Text style={styles.emptyText}>
              Complete a run first, or all your runs have already been shared.
            </Text>
          </View>
        ) : (
          <FlatList
            data={runs}
            renderItem={renderRunItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    );
  }

  // Step 2: Compose post
  const polylineCoords = selectedRun?.polyline || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.headerButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Run</Text>
        <TouchableOpacity onPress={handlePost} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.headerButtonPrimary}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Map Preview */}
        {polylineCoords.length > 0 && (
          <View style={styles.mapContainer}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              region={getMapRegion(polylineCoords)}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Polyline
                coordinates={polylineCoords}
                strokeColor={COLORS.primary}
                strokeWidth={3}
              />
            </MapView>
          </View>
        )}

        {/* Run Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance(selectedRun?.distance || 0)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(selectedRun?.duration || 0)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatPace(selectedRun?.average_pace || 0)}</Text>
            <Text style={styles.statLabel}>Avg Pace</Text>
          </View>
        </View>

        {/* Caption Input */}
        <View style={styles.captionContainer}>
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption (optional)..."
            placeholderTextColor={COLORS.textSecondary}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{caption.length}/500</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerButton: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  headerButtonPrimary: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerPlaceholder: {
    width: 50,
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
  listContent: {
    padding: SPACING.md,
  },
  runItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  runInfo: {
    flex: 1,
  },
  runDate: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  runStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runStat: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statDot: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.xs,
  },
  selectIcon: {
    fontSize: 24,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
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
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  mapContainer: {
    height: 200,
    backgroundColor: COLORS.border,
  },
  map: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  captionContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    marginTop: SPACING.sm,
  },
  captionInput: {
    fontSize: 16,
    color: COLORS.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
});

export default CreatePostScreen;
