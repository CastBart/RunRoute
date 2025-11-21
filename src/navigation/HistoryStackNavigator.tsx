import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { HistoryStackParamList } from '../types';
import { COLORS } from '../constants';

import RunHistoryScreen from '../screens/history/RunHistoryScreen';
import RunDetailScreen from '../screens/history/RunDetailScreen';

const Stack = createStackNavigator<HistoryStackParamList>();

const HistoryStackNavigator = () => {
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
        name="RunHistory"
        component={RunHistoryScreen}
        options={{
          title: 'Run History',
        }}
      />
      <Stack.Screen
        name="RunDetail"
        component={RunDetailScreen}
        options={{
          title: 'Run Details',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
};

export default HistoryStackNavigator;
