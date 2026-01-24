import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { COLORS, SPACING } from '../constants';
import { PostWithDetails } from '../services/socialService';
import { simplifyPolyline } from '../utils/routeConverter';

interface PostCardProps {
  post: PostWithDetails;
  onPress: () => void;
  onLikePress: () => void;
  onCommentPress: () => void;
  onUserPress?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 180;

const PostCard: React.FC<PostCardProps> = React.memo(({
  post,
  onPress,
  onLikePress,
  onCommentPress,
  onUserPress,
}) => {
  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Format distance
  const formatDistance = (km: number): string => {
    return km.toFixed(2) + ' km';
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format pace
  const formatPace = (secondsPerKm: number): string => {
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.round(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
  };

  // Memoize simplified polyline to avoid recalculating on every render
  const simplifiedPolyline = useMemo(() => {
    const polyline = post.run?.polyline || [];
    if (polyline.length === 0) return [];

    // For feed display, use more aggressive simplification (0.0002 km = 20cm tolerance)
    // This reduces 3000+ points to ~100-200 points while maintaining visual accuracy
    return simplifyPolyline(polyline, 0.0002);
  }, [post.run?.polyline]);

  // Memoize map region calculation
  const mapRegion = useMemo(() => {
    if (simplifiedPolyline.length === 0) {
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    const lats = simplifiedPolyline.map((p) => p.latitude);
    const lngs = simplifiedPolyline.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = (maxLat - minLat) * 1.4 || 0.01;
    const lngDelta = (maxLng - minLng) * 1.4 || 0.01;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.005),
      longitudeDelta: Math.max(lngDelta, 0.005),
    };
  }, [simplifiedPolyline]);

  const hasPolyline = simplifiedPolyline.length > 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.95}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={onUserPress} activeOpacity={0.7}>
        <View style={styles.avatar}>
          {post.user?.avatar_url ? (
            <Image source={{ uri: post.user.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {post.user?.name?.charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{post.user?.name || 'Unknown'}</Text>
          <Text style={styles.timestamp}>{formatDate(post.created_at)}</Text>
        </View>
      </TouchableOpacity>

      {/* Map Preview */}
      {hasPolyline && (
        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            liteMode={true}
          >
            <Polyline
              coordinates={simplifiedPolyline}
              strokeColor={COLORS.primary}
              strokeWidth={3}
            />
          </MapView>
        </View>
      )}

      {/* Run Stats or Run Deleted Notice */}
      {post.run ? (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance(post.run.distance || 0)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(post.run.duration || 0)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatPace(post.run.average_pace || 0)}</Text>
            <Text style={styles.statLabel}>Avg Pace</Text>
          </View>
        </View>
      ) : (
        <View style={styles.runDeletedContainer}>
          <Text style={styles.runDeletedText}>Run deleted</Text>
        </View>
      )}

      {/* Caption */}
      {post.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>{post.caption}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={onLikePress}>
          <Text style={[styles.actionIcon, post.liked_by_current_user && styles.liked]}>
            {post.liked_by_current_user ? '♥' : '♡'}
          </Text>
          <Text style={[styles.actionText, post.liked_by_current_user && styles.liked]}>
            {post.likes_count}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onCommentPress}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionText}>{post.comments_count}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

PostCard.displayName = 'PostCard';

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerInfo: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mapContainer: {
    height: MAP_HEIGHT,
    backgroundColor: COLORS.border,
  },
  map: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  runDeletedContainer: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  runDeletedText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  captionContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  caption: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: SPACING.xs,
  },
  actionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  liked: {
    color: COLORS.danger,
  },
});

export default PostCard;
