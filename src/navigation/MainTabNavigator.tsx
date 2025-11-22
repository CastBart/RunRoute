import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types';
import { COLORS } from '../constants';

// Screen imports
import RoutePlannerScreen from '../screens/plan/RoutePlannerScreen';
import RunTrackerScreen from '../screens/track/RunTrackerScreen';

// Stack navigators for tabs with nested screens
import HistoryStackNavigator from './HistoryStackNavigator';
import SocialStackNavigator from './SocialStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';

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
        component={HistoryStackNavigator}
        options={{
          title: 'Run History',
          tabBarLabel: 'History',
          headerShown: false, // Stack navigator handles its own headers
        }}
      />
      <Tab.Screen
        name="Social"
        component={SocialStackNavigator}
        options={{
          title: 'Social Feed',
          tabBarLabel: 'Social',
          headerShown: false, // Stack navigator handles its own headers
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          headerShown: false, // Stack navigator handles its own headers
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
