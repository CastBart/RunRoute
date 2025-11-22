import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants';
import { socialService } from '../../services/socialService';
import { SocialStackParamList } from '../../types';
import UserListItem from '../../components/UserListItem';
import { useAuthStore } from '../../store/authStore';

type SearchNavigationProp = StackNavigationProp<SocialStackParamList, 'Search'>;

interface SearchUser {
  id: string;
  name: string;
  avatar_url: string | null;
  is_following: boolean;
}

interface SuggestedUser {
  id: string;
  name: string;
  avatar_url: string | null;
  mutual_count: number;
}

const UserSearchScreen = () => {
  const navigation = useNavigation<SearchNavigationProp>();
  const currentUser = useAuthStore((state) => state.user);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [followLoadingIds, setFollowLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSuggestions();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchSuggestions = async () => {
    try {
      const data = await socialService.getSuggestedUsers(10);
      setSuggestions(data);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      const data = await socialService.searchUsers(searchQuery.trim());
      setSearchResults(data);
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const handleFollowPress = async (targetUserId: string, isCurrentlyFollowing: boolean) => {
    setFollowLoadingIds((prev) => new Set(prev).add(targetUserId));
    try {
      if (isCurrentlyFollowing) {
        await socialService.unfollowUser(targetUserId);
      } else {
        await socialService.followUser(targetUserId);
      }
      // Update search results
      setSearchResults((prev) =>
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

  const handleSuggestionFollowPress = async (targetUserId: string) => {
    setFollowLoadingIds((prev) => new Set(prev).add(targetUserId));
    try {
      await socialService.followUser(targetUserId);
      // Remove from suggestions after following
      setSuggestions((prev) => prev.filter((user) => user.id !== targetUserId));
    } catch (err) {
      console.error('Error following user:', err);
    } finally {
      setFollowLoadingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
    }
  };

  const renderSearchItem = useCallback(
    ({ item }: { item: SearchUser }) => (
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

  const renderSuggestionItem = useCallback(
    ({ item }: { item: SuggestedUser }) => (
      <UserListItem
        id={item.id}
        name={item.name}
        avatarUrl={item.avatar_url}
        subtitle={item.mutual_count > 0 ? `${item.mutual_count} mutual` : undefined}
        isFollowing={false}
        isCurrentUser={item.id === currentUser?.id}
        onPress={() => handleUserPress(item.id)}
        onFollowPress={() => handleSuggestionFollowPress(item.id)}
        followLoading={followLoadingIds.has(item.id)}
      />
    ),
    [followLoadingIds, currentUser]
  );

  const showSearchResults = searchQuery.trim().length >= 2;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {showSearchResults ? (
        // Search Results
        <>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchItem}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>No users found</Text>
                </View>
              }
              contentContainerStyle={searchResults.length === 0 ? styles.emptyList : undefined}
            />
          )}
        </>
      ) : (
        // Suggestions
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Suggested for you</Text>
          </View>

          {loadingSuggestions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              renderItem={renderSuggestionItem}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>No suggestions available</Text>
                  <Text style={styles.emptySubtext}>
                    Follow some users to get personalized suggestions
                  </Text>
                </View>
              }
              contentContainerStyle={suggestions.length === 0 ? styles.emptyList : undefined}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyList: {
    flexGrow: 1,
  },
});

export default UserSearchScreen;
