import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[`${variant}Button`],
        styles[`${size}Button`],
        isDisabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? COLORS.primary : COLORS.background}
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`${variant}Text`],
            styles[`${size}Text`],
            isDisabled && styles.disabledText,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  // Variants
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  dangerButton: {
    backgroundColor: COLORS.danger,
  },

  // Sizes
  smallButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  mediumButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  largeButton: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },

  // Text styles
  text: {
    fontWeight: '600',
  },
  primaryText: {
    color: COLORS.background,
  },
  secondaryText: {
    color: COLORS.background,
  },
  outlineText: {
    color: COLORS.primary,
  },
  dangerText: {
    color: COLORS.background,
  },

  // Text sizes
  smallText: {
    fontSize: FONT_SIZES.sm,
  },
  mediumText: {
    fontSize: FONT_SIZES.md,
  },
  largeText: {
    fontSize: FONT_SIZES.lg,
  },

  // Disabled state
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
});

export default Button;
