import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, SPACING } from '../constants';

interface FollowButtonProps {
  isFollowing: boolean;
  onPress: () => void;
  loading?: boolean;
  size?: 'small' | 'medium';
}

const FollowButton: React.FC<FollowButtonProps> = ({
  isFollowing,
  onPress,
  loading = false,
  size = 'medium',
}) => {
  const buttonStyle = [
    styles.button,
    size === 'small' ? styles.buttonSmall : styles.buttonMedium,
    isFollowing ? styles.buttonFollowing : styles.buttonFollow,
  ];

  const textStyle = [
    styles.text,
    size === 'small' ? styles.textSmall : styles.textMedium,
    isFollowing ? styles.textFollowing : styles.textFollow,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isFollowing ? COLORS.text : '#FFFFFF'}
        />
      ) : (
        <Text style={textStyle}>{isFollowing ? 'Following' : 'Follow'}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 80,
  },
  buttonMedium: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 100,
  },
  buttonFollow: {
    backgroundColor: COLORS.primary,
  },
  buttonFollowing: {
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  text: {
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 13,
  },
  textMedium: {
    fontSize: 14,
  },
  textFollow: {
    color: '#FFFFFF',
  },
  textFollowing: {
    color: COLORS.text,
  },
});

export default FollowButton;
