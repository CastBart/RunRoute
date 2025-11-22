import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants';
import { socialService } from '../../services/socialService';
import { SocialStackParamList } from '../../types';
import UserListItem from '../../components/UserListItem';
import { useAuthStore } from '../../store/authStore';

type FollowingRouteProp = RouteProp<SocialStackParamList, 'Following'>;
type FollowingNavigationProp = StackNavigationProp<SocialStackParamList, 'Following'>;

interface FollowingUser {
  id: string;
  name: string;
  avatar_url: string | null;
  is_following: boolean;
}

const FollowingListScreen = () => {
  const route = useRoute<FollowingRouteProp>();
  const navigation = useNavigation<FollowingNavigationProp>();
  const { userId } = route.params;
  const currentUser = useAuthStore((state) => state.user);

  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [filteredFollowing, setFilteredFollowing] = useState<FollowingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [followLoadingIds, setFollowLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFollowing();
  }, [userId]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFollowing(following);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredFollowing(
        following.filter((user) => user.name.toLowerCase().includes(query))
      );
    }
  }, [searchQuery, following]);

  const fetchFollowing = async () => {
    try {
      const data = await socialService.getFollowing(userId);
      setFollowing(data);
      setFilteredFollowing(data);
    } catch (err) {
      console.error('Error fetching following:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFollowing();
  };

  const handleUserPress = (userId: string) => {
    navigation.push('UserProfile', { userId });
  };

  const handleFollowPress = async (targetUserId: string, isCurrentlyFollowing: boolean) => {
    setFollowLoadingIds((prev) => new Set(prev).add(targetUserId));
    try {
      if (isCurrentlyFollowing) {
        await socialService.unfollowUser(targetUserId);
      } else {
        await socialService.followUser(targetUserId);
      }
      // Update local state
      setFollowing((prev) =>
        prev.map((user) =>
          user.id === targetUserId ? { ...user, is_following: !isCurrentlyFollowing } : user
        )
      );
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setFollowLoadingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: FollowingUser }) => (
      <UserListItem
        id={item.id}
        name={item.name}
        avatarUrl={item.avatar_url}
        isFollowing={item.is_following}
        isCurrentUser={item.id === currentUser?.id}
        onPress={() => handleUserPress(item.id)}
        onFollowPress={() => handleFollowPress(item.id, item.is_following)}
        followLoading={followLoadingIds.has(item.id)}
      />
    ),
    [followLoadingIds, currentUser]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search following"
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Ionicons
            name="close-circle"
            size={20}
            color={COLORS.textSecondary}
            onPress={() => setSearchQuery('')}
          />
        )}
      </View>

      <FlatList
        data={filteredFollowing}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No users found' : 'Not following anyone yet'}
            </Text>
          </View>
        }
        contentContainerStyle={filteredFollowing.length === 0 ? styles.emptyList : undefined}
      />
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    margin: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
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

export default FollowingListScreen;
