import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { RoutesStackParamList } from '../types';
import { COLORS } from '../constants';

import RoutesHubScreen from '../screens/routes/RoutesHubScreen';
import RoutePlannerScreen from '../screens/plan/RoutePlannerScreen';
import SavedRoutesScreen from '../screens/routes/SavedRoutesScreen';
import RouteDetailScreen from '../screens/routes/RouteDetailScreen';
import RunTrackerScreen from '../screens/track/RunTrackerScreen';

const Stack = createStackNavigator<RoutesStackParamList>();

const RoutesStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="RoutesHub"
        component={RoutesHubScreen}
        options={{
          title: 'Routes',
        }}
      />
      <Stack.Screen
        name="PlanRoute"
        component={RoutePlannerScreen}
        options={{
          title: 'Plan a Route',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="SavedRoutes"
        component={SavedRoutesScreen}
        options={{
          title: 'Saved Routes',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="RouteDetail"
        component={RouteDetailScreen}
        options={{
          title: 'Route Details',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="RunTracker"
        component={RunTrackerScreen}
        options={{
          title: 'Track Run',
          headerBackTitle: 'Routes',
        }}
      />
    </Stack.Navigator>
  );
};

export default RoutesStackNavigator;
