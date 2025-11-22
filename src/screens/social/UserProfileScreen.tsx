import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants';
import { socialService, PostWithDetails } from '../../services/socialService';
import { SocialStackParamList } from '../../types';
import FollowButton from '../../components/FollowButton';
import PostCard from '../../components/PostCard';
import { useAuthStore } from '../../store/authStore';

type UserProfileRouteProp = RouteProp<SocialStackParamList, 'UserProfile'>;
type UserProfileNavigationProp = StackNavigationProp<SocialStackParamList, 'UserProfile'>;

interface UserProfileData {
  id: string;
  name: string;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  total_runs: number;
  total_distance: number;
  is_following: boolean;
  created_at: string;
}

const UserProfileScreen = () => {
  const route = useRoute<UserProfileRouteProp>();
  const navigation = useNavigation<UserProfileNavigationProp>();
  const { userId } = route.params;
  const currentUser = useAuthStore((state) => state.user);
  const isOwnProfile = currentUser?.id === userId;

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const [profileData, postsData] = await Promise.all([
        socialService.getUserProfile(userId),
        socialService.getUserPosts(userId, 20),
      ]);
      setProfile(profileData);
      setPosts(postsData);
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleFollowPress = async () => {
    if (!profile) return;
    setFollowLoading(true);
    try {
      if (profile.is_following) {
        await socialService.unfollowUser(userId);
        setProfile({
          ...profile,
          is_following: false,
          followers_count: profile.followers_count - 1,
        });
      } else {
        await socialService.followUser(userId);
        setProfile({
          ...profile,
          is_following: true,
          followers_count: profile.followers_count + 1,
        });
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleFollowersPress = () => {
    navigation.navigate('Followers', { userId });
  };

  const handleFollowingPress = () => {
    navigation.navigate('Following', { userId });
  };

  const handlePostPress = (postId: string) => {
    navigation.navigate('PostDetail', { postId });
  };

  const handleLikeToggle = async (postId: string, currentlyLiked: boolean) => {
    try {
      await socialService.toggleLike(postId, currentlyLiked);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                liked_by_current_user: !currentlyLiked,
                likes_count: currentlyLiked ? post.likes_count - 1 : post.likes_count + 1,
              }
            : post
        )
      );
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={50} color={COLORS.textSecondary} />
          </View>
        )}
      </View>

      {/* Name */}
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.joinDate}>Joined {formatDate(profile.created_at)}</Text>

      {/* Follow Button */}
      {!isOwnProfile && (
        <View style={styles.followButtonContainer}>
          <FollowButton
            isFollowing={profile.is_following}
            onPress={handleFollowPress}
            loading={followLoading}
            size="medium"
          />
        </View>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statItem} onPress={handleFollowersPress}>
          <Text style={styles.statValue}>{profile.followers_count}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statItem} onPress={handleFollowingPress}>
          <Text style={styles.statValue}>{profile.following_count}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.total_runs}</Text>
          <Text style={styles.statLabel}>Runs</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.total_distance.toFixed(1)}</Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
      </View>

      {/* Posts Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Posts</Text>
      </View>
    </View>
  );

  const renderEmptyPosts = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="images-outline" size={48} color={COLORS.textSecondary} />
      <Text style={styles.emptyText}>No posts yet</Text>
    </View>
  );

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          onPress={() => handlePostPress(item.id)}
          onLikePress={() => handleLikeToggle(item.id, item.liked_by_current_user)}
          onCommentPress={() => handlePostPress(item.id)}
          onUserPress={() => {}}
        />
      )}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmptyPosts}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
        />
      }
      contentContainerStyle={posts.length === 0 ? styles.emptyList : undefined}
    />
  );
};

const styles = StyleSheet.create({
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
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  header: {
    backgroundColor: COLORS.background,
    paddingBottom: SPACING.md,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.backgroundSecondary,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  joinDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  followButtonContainer: {
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  emptyList: {
    flexGrow: 1,
  },
});

export default UserProfileScreen;
