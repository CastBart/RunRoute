import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants';
import { runService, Run } from '../../services/runService';
import { socialService } from '../../services/socialService';
import { routeService } from '../../services/routeService';
import { HistoryStackParamList, PaceInterval } from '../../types';
import {
  simplifyPolyline,
  generateRouteName,
  convertRunToRoute,
} from '../../utils/routeConverter';
import { usePreferencesStore } from '../../store/preferencesStore';
import {
  formatDistance,
  formatPace as formatPaceUtil,
  formatSpeed,
  formatElevation,
  getUnitLabel,
} from '../../utils/unitConversions';

type DetailNavigationProp = StackNavigationProp<HistoryStackParamList, 'RunDetail'>;

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
  intervals?: PaceInterval[]; // NEW: Pace intervals
}

const RunDetailScreen = () => {
  const route = useRoute<RouteProp<HistoryStackParamList, 'RunDetail'>>();
  const navigation = useNavigation<DetailNavigationProp>();
  const { runId } = route.params;
  const { distanceUnit } = usePreferencesStore();

  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [otherRuns, setOtherRuns] = useState<Run[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [sharing, setSharing] = useState(false);
  const [isAlreadyShared, setIsAlreadyShared] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRunDetails();
    checkIfShared();
  }, [runId]);

  const checkIfShared = async () => {
    try {
      const shared = await socialService.hasRunBeenPosted(runId);
      setIsAlreadyShared(shared);
    } catch (err) {
      console.error('Error checking share status:', err);
    }
  };

  const handleShare = () => {
    if (isAlreadyShared) {
      Alert.alert('Already Shared', 'This run has already been shared to your feed.');
      return;
    }
    setShowShareModal(true);
  };

  const handleConfirmShare = async () => {
    if (!run) return;
    setSharing(true);
    try {
      await socialService.createPost({
        runId: runId,
        caption: shareCaption.trim() || undefined,
      });
      setShowShareModal(false);
      setShareCaption('');
      setIsAlreadyShared(true);
      Alert.alert('Success', 'Your run has been shared to your feed!');
    } catch (err) {
      console.error('Error sharing run:', err);
      Alert.alert('Error', 'Failed to share run');
    } finally {
      setSharing(false);
    }
  };

  const handleCompare = async () => {
    setLoadingRuns(true);
    setShowCompareModal(true);
    try {
      const runs = await runService.getUserRuns(50, 0);
      // Filter out the current run
      setOtherRuns(runs.filter((r) => r.id !== runId));
    } catch (err) {
      console.error('Error fetching runs:', err);
    } finally {
      setLoadingRuns(false);
    }
  };

  const selectRunForComparison = (otherRunId: string) => {
    setShowCompareModal(false);
    navigation.navigate('RunComparison', { runIds: [runId, otherRunId] });
  };

  const handleExport = () => {
    Alert.alert(
      'Export Run',
      'Choose export format',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'GPX',
          onPress: async () => {
            try {
              if (!run) return;
              const filePath = await runService.exportToGPX(run as any);
              await runService.shareFile(filePath);
            } catch (err) {
              console.error('Error exporting GPX:', err);
              Alert.alert('Error', 'Failed to export as GPX');
            }
          },
        },
        {
          text: 'CSV',
          onPress: async () => {
            try {
              if (!run) return;
              const filePath = await runService.exportToCSV(run as any);
              await runService.shareFile(filePath);
            } catch (err) {
              console.error('Error exporting CSV:', err);
              Alert.alert('Error', 'Failed to export as CSV');
            }
          },
        },
      ]
    );
  };

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
    const message = isAlreadyShared
      ? 'Are you sure you want to delete this run? This will also delete the associated post from your feed. This action cannot be undone.'
      : 'Are you sure you want to delete this run? This action cannot be undone.';

    Alert.alert(
      'Delete Run',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await runService.deleteRun(runId);
              const successMessage = isAlreadyShared
                ? 'Run and associated post have been deleted.'
                : 'Run has been deleted.';
              Alert.alert('Deleted', successMessage);
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

  const handleSaveAsRoute = async () => {
    setShowMoreMenu(false);

    if (!run) return;

    // Check for insufficient GPS data
    if (!run.polyline || run.polyline.length < 10) {
      Alert.alert('Error', 'This run has insufficient GPS data to create a route.');
      return;
    }

    try {
      // Check for duplicates
      const simplifiedPolyline = simplifyPolyline(run.polyline, 0.00005);
      const { isDuplicate, existingRoute } = await routeService.checkForDuplicate(simplifiedPolyline);

      if (isDuplicate) {
        Alert.alert(
          'Duplicate Route',
          `You already have this route saved as "${existingRoute?.name}".`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Generate suggested name and show modal
      const suggestedName = generateRouteName(
        {
          distance: run.distance,
          polyline: run.polyline,
          start_time: run.start_time,
        },
        distanceUnit
      );
      setRouteName(suggestedName);
      setShowSaveModal(true);
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      Alert.alert('Error', 'Failed to check for duplicates.');
    }
  };

  const confirmSaveRoute = async () => {
    if (!run || !routeName.trim()) return;

    setSaving(true);

    try {
      // Convert run to route
      const routeData = convertRunToRoute(
        run as any,
        routeName.trim(),
        'own_run',
        false // not a community route
      );

      // Save to database
      const savedRoute = await routeService.saveRouteFromRun(routeData);

      setSaving(false);
      setShowSaveModal(false);
      setRouteName('');

      // Show success with navigation option
      Alert.alert(
        'Route Saved!',
        `"${routeName}" has been added to your routes.`,
        [
          { text: 'OK' },
          {
            text: 'View Route',
            onPress: () => {
              // Navigate to SavedRoutes screen (RoutesHub -> SavedRoutes)
              navigation.navigate('RunHistory' as any);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving route:', error);
      setSaving(false);
      Alert.alert('Error', 'Failed to save route. Please try again.');
    }
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
          <Text style={styles.mainStatValue}>{formatDistance(run.distance, distanceUnit).split(' ')[0]}</Text>
          <Text style={styles.mainStatLabel}>{getUnitLabel(distanceUnit, false)}s</Text>
        </View>
        <View style={styles.mainStat}>
          <Text style={styles.mainStatValue}>{formatDuration(run.duration)}</Text>
          <Text style={styles.mainStatLabel}>Duration</Text>
        </View>
        <View style={styles.mainStat}>
          <Text style={styles.mainStatValue}>{formatPaceUtil(run.average_pace, distanceUnit).split(' ')[0]}</Text>
          <Text style={styles.mainStatLabel}>Avg Pace {formatPaceUtil(run.average_pace, distanceUnit).split(' ')[1]}</Text>
        </View>
      </View>

      {/* Additional Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.statsCardTitle}>Run Details</Text>

        <View style={styles.statRow}>
          <Text style={styles.statRowLabel}>Average Speed</Text>
          <Text style={styles.statRowValue}>{formatSpeed(run.average_speed, distanceUnit)}</Text>
        </View>

        {run.elevation_gain !== undefined && run.elevation_gain !== null && (
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Elevation Gain</Text>
            <Text style={styles.statRowValue}>{formatElevation(run.elevation_gain, distanceUnit)}</Text>
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

      {/* Pace Intervals Section */}
      {run.intervals && run.intervals.length > 0 && (
        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>Pace Intervals</Text>
          <View style={styles.intervalsHeader}>
            <Text style={[styles.intervalHeaderText, { flex: 1 }]}>#</Text>
            <Text style={[styles.intervalHeaderText, { flex: 2 }]}>Distance</Text>
            <Text style={[styles.intervalHeaderText, { flex: 2 }]}>Pace</Text>
            <Text style={[styles.intervalHeaderText, { flex: 2 }]}>Time</Text>
          </View>
          {run.intervals.map((interval, index) => (
            <View key={index} style={styles.intervalRow}>
              <Text style={[styles.intervalText, { flex: 1 }]}>{index + 1}</Text>
              <Text style={[styles.intervalText, { flex: 2 }]}>
                {formatDistance(interval.distance, distanceUnit)}
              </Text>
              <Text style={[styles.intervalText, { flex: 2 }]}>
                {formatPaceUtil(interval.pace, distanceUnit)}
              </Text>
              <Text style={[styles.intervalText, { flex: 2 }]}>
                {formatDuration(interval.duration)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, isAlreadyShared && styles.actionButtonDisabled]}
          onPress={handleShare}
        >
          <Ionicons
            name={isAlreadyShared ? 'checkmark-circle' : 'share-social-outline'}
            size={20}
            color={isAlreadyShared ? COLORS.success : COLORS.primary}
          />
          <Text style={[styles.actionButtonText, isAlreadyShared && styles.actionButtonTextDisabled]}>
            {isAlreadyShared ? 'Shared' : 'Share'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCompare}
        >
          <Ionicons name="git-compare-outline" size={20} color={COLORS.primary} />
          <Text style={styles.actionButtonText}>Compare</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleExport}
        >
          <Ionicons name="download-outline" size={20} color={COLORS.primary} />
          <Text style={styles.actionButtonText}>Export</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowMoreMenu(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.primary} />
          <Text style={styles.actionButtonText}>More</Text>
        </TouchableOpacity>
      </View>

      {/* Compare Modal */}
      <Modal
        visible={showCompareModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCompareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a run to compare</Text>
              <TouchableOpacity onPress={() => setShowCompareModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {loadingRuns ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={styles.modalLoader} />
            ) : otherRuns.length === 0 ? (
              <Text style={styles.noRunsText}>No other runs to compare with</Text>
            ) : (
              <FlatList
                data={otherRuns}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.runItem}
                    onPress={() => selectRunForComparison(item.id)}
                  >
                    <View>
                      <Text style={styles.runItemDate}>
                        {new Date(item.start_time).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.runItemStats}>
                        {item.distance.toFixed(2)} km • {formatDuration(item.duration)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowShareModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.shareModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share to Feed</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.sharePreview}>
              <Text style={styles.sharePreviewText}>
                {run?.distance.toFixed(2)} km • {formatDuration(run?.duration || 0)}
              </Text>
            </View>

            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption (optional)"
              placeholderTextColor={COLORS.textSecondary}
              value={shareCaption}
              onChangeText={setShareCaption}
              multiline
              maxLength={280}
            />

            <TouchableOpacity
              style={[styles.shareButton, sharing && styles.shareButtonDisabled]}
              onPress={handleConfirmShare}
              disabled={sharing}
            >
              <Text style={styles.shareButtonText}>
                {sharing ? 'Sharing...' : 'Share Run'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* More Menu Modal */}
      <Modal
        visible={showMoreMenu}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity
          style={styles.moreMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
        >
          <View style={styles.moreMenu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleSaveAsRoute}
            >
              <Ionicons name="bookmark-outline" size={20} color={COLORS.primary} />
              <Text style={styles.menuItemText}>Save as Route</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMoreMenu(false);
                handleDelete();
              }}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
              <Text style={[styles.menuItemText, { color: COLORS.danger }]}>
                Delete Run
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Save Route Modal */}
      <Modal
        visible={showSaveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSaveModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.saveModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Save as Route</Text>
              <TouchableOpacity onPress={() => setShowSaveModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Create a reusable route from this run
            </Text>

            <TextInput
              style={styles.routeNameInput}
              placeholder="Enter route name"
              placeholderTextColor={COLORS.textSecondary}
              value={routeName}
              onChangeText={setRouteName}
              maxLength={100}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButtonSave,
                  (!routeName.trim() || saving) && styles.modalButtonSaveDisabled,
                ]}
                onPress={confirmSaveRoute}
                disabled={saving || !routeName.trim()}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalButtonSaveText}>Save Route</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  actionButtonsContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonDisabled: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.backgroundSecondary,
  },
  actionButtonTextDisabled: {
    color: COLORS.success,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: COLORS.danger,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalLoader: {
    padding: SPACING.xl,
  },
  noRunsText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    padding: SPACING.xl,
    fontSize: 16,
  },
  runItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  runItemDate: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  runItemStats: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  shareModalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  sharePreview: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  sharePreviewText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  captionInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: SPACING.md,
  },
  shareButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: SPACING.xxl,
  },
  // Pace Intervals Styles
  intervalsHeader: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  intervalHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  intervalRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  intervalText: {
    fontSize: 14,
    color: COLORS.text,
  },
  // More Menu Styles
  moreMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreMenu: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    width: '70%',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  // Save Route Modal Styles
  saveModalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  routeNameInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtonCancelText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
  },
  modalButtonSave: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  modalButtonSaveDisabled: {
    opacity: 0.6,
  },
  modalButtonSaveText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default RunDetailScreen;
