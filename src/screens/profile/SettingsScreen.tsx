import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING } from '../../constants';
import { useAuthStore } from '../../store/authStore';
import { usePreferencesStore } from '../../store/preferencesStore';
import { profileService } from '../../services/profileService';
import { PrivacySettings } from '../../types';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { user, signOut } = useAuthStore();
  const distanceUnit = usePreferencesStore(s => s.distanceUnit);
  const setDistanceUnit = usePreferencesStore(s => s.setDistanceUnit);

  // Privacy settings from store (local cache)
  const showOnMap = usePreferencesStore(s => s.showOnMap);
  const allowComments = usePreferencesStore(s => s.allowComments);
  const publicProfile = usePreferencesStore(s => s.publicProfile);
  const setPrivacySettings = usePreferencesStore(s => s.setPrivacySettings);
  const privacySettingsLoaded = usePreferencesStore(s => s.privacySettingsLoaded);
  const setPrivacySettingsLoaded = usePreferencesStore(s => s.setPrivacySettingsLoaded);

  // Loading states
  const [isLoadingPrivacy, setIsLoadingPrivacy] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  // Load privacy settings from backend on mount
  useEffect(() => {
    const loadPrivacySettings = async () => {
      if (!user?.id || privacySettingsLoaded) return;

      setIsLoadingPrivacy(true);
      const { data, error } = await profileService.getPrivacySettings(user.id);

      if (data && !error) {
        setPrivacySettings(data);
        setPrivacySettingsLoaded(true);
      }
      setIsLoadingPrivacy(false);
    };

    loadPrivacySettings();
  }, [user?.id, privacySettingsLoaded, setPrivacySettings, setPrivacySettingsLoaded]);

  /**
   * Update a single privacy setting - syncs to both local store and backend
   */
  const updatePrivacySetting = useCallback(
    async (key: keyof PrivacySettings, value: boolean) => {
      if (!user?.id) return;

      // Optimistic update to local store
      setPrivacySettings({ [key]: value });
      setIsSavingPrivacy(true);

      // Sync to backend
      const { error } = await profileService.updatePrivacySettings(user.id, {
        [key]: value,
      });

      setIsSavingPrivacy(false);

      if (error) {
        // Revert on failure
        setPrivacySettings({ [key]: !value });
        Alert.alert(
          'Save Failed',
          'Could not save privacy setting. Please try again.',
          [{ text: 'OK' }]
        );
      }
    },
    [user?.id, setPrivacySettings]
  );

  const handleShowOnMapChange = (value: boolean) => {
    updatePrivacySetting('show_on_map', value);
  };

  const handleAllowCommentsChange = (value: boolean) => {
    updatePrivacySetting('allow_comments', value);
  };

  const handlePublicProfileChange = (value: boolean) => {
    updatePrivacySetting('public_profile', value);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Contact Support',
              'To delete your account, please contact support@runroute.app'
            );
          },
        },
      ]
    );
  };

  const renderSettingRow = (
    title: string,
    description: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    disabled: boolean = false
  ) => (
    <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.border, true: COLORS.primary }}
        thumbColor="#FFFFFF"
        disabled={disabled}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Units Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Units</Text>
          <View style={styles.sectionContent}>
            {renderSettingRow(
              'Use Metric Units',
              'Display distances in kilometers and pace in min/km',
              distanceUnit === 'km',
              (value) => setDistanceUnit(value ? 'km' : 'miles'),
              false
            )}
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.sectionContent}>
            {isLoadingPrivacy ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading privacy settings...</Text>
              </View>
            ) : (
              <>
                {renderSettingRow(
                  'Public Profile',
                  'Allow others to see your profile and runs',
                  publicProfile,
                  handlePublicProfileChange,
                  isSavingPrivacy
                )}
                {renderSettingRow(
                  'Show on Map',
                  'Display your runs on public maps',
                  showOnMap,
                  handleShowOnMapChange,
                  isSavingPrivacy
                )}
                {renderSettingRow(
                  'Allow Comments',
                  'Let others comment on your shared runs',
                  allowComments,
                  handleAllowCommentsChange,
                  isSavingPrivacy
                )}
              </>
            )}
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity style={styles.linkRow}>
              <Text style={styles.linkTitle}>Version</Text>
              <Text style={styles.linkValue}>1.0.0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkRow}>
              <Text style={styles.linkTitle}>Terms of Service</Text>
              <Text style={styles.linkArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkRow}>
              <Text style={styles.linkTitle}>Privacy Policy</Text>
              <Text style={styles.linkArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity style={styles.linkRow} onPress={handleLogout}>
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkRow} onPress={handleDeleteAccount}>
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
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
  section: {
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  sectionContent: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingRowDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    marginLeft: SPACING.sm,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingTitle: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  linkTitle: {
    fontSize: 16,
    color: COLORS.text,
  },
  linkValue: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  linkArrow: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  logoutText: {
    fontSize: 16,
    color: COLORS.primary,
  },
  deleteText: {
    fontSize: 16,
    color: COLORS.danger,
  },
  bottomPadding: {
    height: SPACING.xl,
  },
});

export default SettingsScreen;
