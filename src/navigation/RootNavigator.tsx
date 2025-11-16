import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';

// Import auth store (will be created later)
// import { useAuthStore } from '../store/authStore';

const Stack = createStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  // TODO: Uncomment when auth store is created
  // const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthenticated = false; // Placeholder

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
