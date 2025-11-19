import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  isPassword?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  isPassword = false,
  leftIcon,
  rightIcon,
  style,
  ...props
}) => {
  const [secureTextEntry, setSecureTextEntry] = useState(isPassword);
  const [isFocused, setIsFocused] = useState(false);

  const toggleSecureEntry = () => {
    setSecureTextEntry(!secureTextEntry);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={COLORS.textSecondary}
          secureTextEntry={secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={toggleSecureEntry}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.eyeIconText}>
              {secureTextEntry ? '👁️' : '👁️‍🗨️'}
            </Text>
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
  },
  inputContainerFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: COLORS.danger,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  leftIcon: {
    marginRight: SPACING.sm,
  },
  rightIcon: {
    marginLeft: SPACING.sm,
  },
  eyeIcon: {
    marginLeft: SPACING.sm,
    padding: SPACING.xs,
  },
  eyeIconText: {
    fontSize: FONT_SIZES.lg,
  },
  errorText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.danger,
    marginTop: SPACING.xs,
  },
});

export default Input;
