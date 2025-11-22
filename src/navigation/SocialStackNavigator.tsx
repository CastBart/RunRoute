import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { SocialStackParamList } from '../types';
import { COLORS } from '../constants';

import SocialFeedScreen from '../screens/social/SocialFeedScreen';
import PostDetailScreen from '../screens/social/PostDetailScreen';
import CreatePostScreen from '../screens/social/CreatePostScreen';

const Stack = createStackNavigator<SocialStackParamList>();

const SocialStackNavigator = () => {
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
        name="Feed"
        component={SocialFeedScreen}
        options={{
          title: 'Social Feed',
        }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          title: 'Post',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{
          title: 'Share Run',
          headerShown: false, // CreatePostScreen has its own header
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
};

export default SocialStackNavigator;
