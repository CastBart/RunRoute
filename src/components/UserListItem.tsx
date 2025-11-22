import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants';
import FollowButton from './FollowButton';

interface UserListItemProps {
  id: string;
  name: string;
  avatarUrl?: string | null;
  subtitle?: string;
  isFollowing: boolean;
  showFollowButton?: boolean;
  isCurrentUser?: boolean;
  onPress: () => void;
  onFollowPress?: () => void;
  followLoading?: boolean;
}

const UserListItem: React.FC<UserListItemProps> = ({
  id,
  name,
  avatarUrl,
  subtitle,
  isFollowing,
  showFollowButton = true,
  isCurrentUser = false,
  onPress,
  onFollowPress,
  followLoading = false,
}) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.leftSection}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color={COLORS.textSecondary} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {showFollowButton && !isCurrentUser && onFollowPress && (
        <FollowButton
          isFollowing={isFollowing}
          onPress={onFollowPress}
          loading={followLoading}
          size="small"
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.backgroundSecondary,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

export default UserListItem;
