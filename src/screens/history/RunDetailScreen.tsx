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
import { HistoryStackParamList } from '../../types';

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
}

const RunDetailScreen = () => {
  const route = useRoute<RouteProp<HistoryStackParamList, 'RunDetail'>>();
  const navigation = useNavigation<DetailNavigationProp>();
  const { runId } = route.params;

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
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={deleting}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <Text style={styles.deleteButtonText}>
            {deleting ? '...' : 'Delete'}
          </Text>
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
});

export default RunDetailScreen;
