import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { COLORS, SPACING } from '../../constants';
import { socialService, PostWithDetails, CommentWithUser } from '../../services/socialService';
import { SocialStackParamList } from '../../types';

type PostDetailRouteProp = RouteProp<SocialStackParamList, 'PostDetail'>;

const PostDetailScreen = () => {
  const route = useRoute<PostDetailRouteProp>();
  const navigation = useNavigation();
  const { postId } = route.params;

  const [post, setPost] = useState<PostWithDetails | null>(null);
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [postData, commentsData] = await Promise.all([
        socialService.getPostById(postId),
        socialService.getComments(postId),
      ]);
      setPost(postData);
      setComments(commentsData);
    } catch (err: any) {
      console.error('Error fetching post details:', err);
      setError('Failed to load post. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLikePress = async () => {
    if (!post) return;

    try {
      const newLikedStatus = await socialService.toggleLike(post.id, post.liked_by_current_user);
      setPost({
        ...post,
        liked_by_current_user: newLikedStatus,
        likes_count: newLikedStatus ? post.likes_count + 1 : post.likes_count - 1,
      });
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const newComment = await socialService.addComment(postId, commentText.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentText('');
      if (post) {
        setPost({ ...post, comments_count: post.comments_count + 1 });
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await socialService.deleteComment(commentId);
              setComments((prev) => prev.filter((c) => c.id !== commentId));
              if (post) {
                setPost({ ...post, comments_count: post.comments_count - 1 });
              }
            } catch (err) {
              console.error('Error deleting comment:', err);
            }
          },
        },
      ]
    );
  };

  // Format helpers
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDistance = (km: number): string => km.toFixed(2) + ' km';

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (secondsPerKm: number): string => {
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.round(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
  };

  const getMapRegion = () => {
    const polyline = post?.run?.polyline || [];
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Post not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const polylineCoords = post.run?.polyline || [];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Header */}
        <View style={styles.header}>
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
        </View>

        {/* Map */}
        {polylineCoords.length > 0 && (
          <View style={styles.mapContainer}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              region={getMapRegion()}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Polyline coordinates={polylineCoords} strokeColor={COLORS.primary} strokeWidth={4} />
              <Marker coordinate={polylineCoords[0]} pinColor="green" title="Start" />
              <Marker
                coordinate={polylineCoords[polylineCoords.length - 1]}
                pinColor="red"
                title="Finish"
              />
            </MapView>
          </View>
        )}

        {/* Run Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance(post.run?.distance || 0)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(post.run?.duration || 0)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatPace(post.run?.average_pace || 0)}</Text>
            <Text style={styles.statLabel}>Avg Pace</Text>
          </View>
        </View>

        {/* Caption */}
        {post.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption}>{post.caption}</Text>
          </View>
        )}

        {/* Like Button */}
        <TouchableOpacity style={styles.likeSection} onPress={handleLikePress}>
          <Text style={[styles.likeIcon, post.liked_by_current_user && styles.liked]}>
            {post.liked_by_current_user ? '♥' : '♡'}
          </Text>
          <Text style={styles.likeCount}>
            {post.likes_count} {post.likes_count === 1 ? 'like' : 'likes'}
          </Text>
        </TouchableOpacity>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Comments ({comments.length})
          </Text>

          {comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet. Be the first to comment!</Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentItem}>
                <View style={styles.commentAvatar}>
                  {comment.user?.avatar_url ? (
                    <Image source={{ uri: comment.user.avatar_url }} style={styles.commentAvatarImage} />
                  ) : (
                    <Text style={styles.commentAvatarText}>
                      {comment.user?.name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  )}
                </View>
                <View style={styles.commentContent}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentUserName}>{comment.user?.name || 'Unknown'}</Text>
                    <Text style={styles.commentTime}>{formatDate(comment.created_at)}</Text>
                  </View>
                  <Text style={styles.commentText}>{comment.content}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Comment Input */}
      <View style={styles.commentInputContainer}>
        <TextInput
          style={styles.commentInput}
          placeholder="Write a comment..."
          placeholderTextColor={COLORS.textSecondary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
          onPress={handleSubmitComment}
          disabled={!commentText.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  headerInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mapContainer: {
    height: 250,
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  },
  caption: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 22,
  },
  likeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  likeIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  liked: {
    color: COLORS.danger,
  },
  likeCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  commentsSection: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    marginTop: SPACING.sm,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  noComments: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  commentAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  commentContent: {
    flex: 1,
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  commentTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.text,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginLeft: SPACING.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PostDetailScreen;
