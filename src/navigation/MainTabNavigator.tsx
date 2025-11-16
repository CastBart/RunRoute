import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types';
import { COLORS } from '../constants';

// Placeholder screens - will be created later
import RoutePlannerScreen from '../screens/plan/RoutePlannerScreen';
import RunTrackerScreen from '../screens/track/RunTrackerScreen';
import RunHistoryScreen from '../screens/history/RunHistoryScreen';
import SocialFeedScreen from '../screens/social/SocialFeedScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tab.Screen
        name="Plan"
        component={RoutePlannerScreen}
        options={{
          title: 'Plan Route',
          tabBarLabel: 'Plan',
        }}
      />
      <Tab.Screen
        name="Track"
        component={RunTrackerScreen}
        options={{
          title: 'Track Run',
          tabBarLabel: 'Track',
        }}
      />
      <Tab.Screen
        name="History"
        component={RunHistoryScreen}
        options={{
          title: 'Run History',
          tabBarLabel: 'History',
        }}
      />
      <Tab.Screen
        name="Social"
        component={SocialFeedScreen}
        options={{
          title: 'Social Feed',
          tabBarLabel: 'Social',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
