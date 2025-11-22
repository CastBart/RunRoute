import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { SocialStackParamList } from '../types';
import { COLORS } from '../constants';

import SocialFeedScreen from '../screens/social/SocialFeedScreen';
import PostDetailScreen from '../screens/social/PostDetailScreen';
import CreatePostScreen from '../screens/social/CreatePostScreen';
import UserProfileScreen from '../screens/social/UserProfileScreen';
import FollowersListScreen from '../screens/social/FollowersListScreen';
import FollowingListScreen from '../screens/social/FollowingListScreen';
import UserSearchScreen from '../screens/social/UserSearchScreen';

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
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{
          title: 'Profile',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Followers"
        component={FollowersListScreen}
        options={{
          title: 'Followers',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Following"
        component={FollowingListScreen}
        options={{
          title: 'Following',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Search"
        component={UserSearchScreen}
        options={{
          title: 'Find People',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
};

export default SocialStackNavigator;
