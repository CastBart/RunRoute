### 4.4 Route Planning Hooks
```typescript
// hooks/useRoutes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useRouteStore } from '../stores/routeStore';

interface PlannedRoute {
  id: string;
  name: string;
  targetDistanceMeters: number;
  actualDistanceMeters: number;
  isLoop: boolean;
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude?: number;
  waypoints: any[];
  polyline: string;
  elevationGainMeters: number;
  createdAt: string;
}

export const useGenerateRoute = () => {
  const { setGenerating, setCurrentRoute, setError } = useRouteStore();
  
  return useMutation({
    mutationFn: (params: {
      startLatitude: number;
      startLongitude: number;
      endLatitude?: number;
      endLongitude?: number;
      targetDistanceMeters: number;
      isLoop: boolean;
    }) => {
      setGenerating(true);
      return api.post<PlannedRoute>('/rpc/generate_route', params);
    },
    
    onSuccess: (route) => {
      setCurrentRoute(route);
      setGenerating(false);
    },
    
    onError: (error: Error) => {
      setError(error.message);
      setGenerating(false);
    },
  });
};

export const usePlannedRoutes = (limit = 20, offset = 0) => {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: ['routes', 'planned', user?.id, limit, offset],
    queryFn: () => api.get<PlannedRoute[]>(
      `/planned_routes?user_id=eq.${user?.id}&order=created_at.desc&limit=${limit}&offset=${offset}`
    ),
    enabled: !!user?.id,
  });
};

export const useSaveRoute = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: (route: Omit<PlannedRoute, 'id' | 'createdAt'>) =>
      api.post<PlannedRoute>('/planned_routes', { ...route, user_id: user?.id }),
    
    onSuccess: (newRoute) => {
      // Update cached routes list
      queryClient.setQueryData(
        ['routes', 'planned', user?.id],
        (old: PlannedRoute[] | undefined) => 
          old ? [newRoute, ...old] : [newRoute]
      );
    },
  });
};

export const useDeleteRoute = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: (routeId: string) =>
      api.delete(`/planned_routes?id=eq.${routeId}`),
    
    onSuccess: (_, routeId) => {
      // Remove from cache
      queryClient.setQueryData(
        ['routes', 'planned', user?.id],
        (old: PlannedRoute[] | undefined) =>
          old?.filter(route => route.id !== routeId) || []
      );
    },
  });
};
```

### 4.5 Run History Hooks
```typescript
// hooks/useRuns.ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';

interface CompletedRun {
  id: string;
  title: string;
  notes?: string;
  distanceMeters: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number;
  routePolyline: string;
  startedAt: string;
  completedAt: string;
  // ... other run fields
}

export const useRuns = () => {
  const { user } = useAuthStore();
  
  return useInfiniteQuery({
    queryKey: ['runs', user?.id],
    queryFn: ({ pageParam = 0 }) =>
      api.get<CompletedRun[]>(`/runs?user_id=eq.${user?.id}&order=started_at.desc&limit=20&offset=${pageParam}`),
    
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length * 20 : undefined;
    },
    enabled: !!user?.id,
  });
};

export const useRunDetails = (runId: string) => {
  return useQuery({
    queryKey: ['runs', 'details', runId],
    queryFn: () => api.get<CompletedRun[]>(`/runs?id=eq.${runId}`).then(data => data[0]),
    enabled: !!runId,
  });
};

export const useSaveRun = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const addNotification = useUIStore(state => state.addNotification);
  
  return useMutation({
    mutationFn: (run: Omit<CompletedRun, 'id'>) =>
      api.post<CompletedRun>('/runs', { ...run, user_id: user?.id }),
    
    onSuccess: (newRun) => {
      // Add to runs cache
      queryClient.setQueryData(['runs', user?.id], (old: any) => {
        if (!old) return { pages: [[newRun]], pageParams: [0] };
        
        const newPages = [...old.pages];
        newPages[0] = [newRun, ...newPages[0]];
        return { ...old, pages: newPages };
      });
      
      // Invalidate user statistics
      queryClient.invalidateQueries({ queryKey: ['user', 'statistics', user?.id] });
      
      addNotification({
        type: 'success',
        title: 'Run Saved!',
        message: 'Your run has been saved successfully',
        duration: 3000,
      });
    },
    
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: error.message,
        duration: 5000,
      });
    },
  });
};

export const useUpdateRun = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<CompletedRun> & { id: string }) =>
      api.patch<CompletedRun>(`/runs?id=eq.${id}`, updates),
    
    onMutate: async ({ id, ...updates }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['runs', 'details', id] });
      
      const previousRun = queryClient.getQueryData(['runs', 'details', id]);
      
      queryClient.setQueryData(['runs', 'details', id], (old: CompletedRun | undefined) =>
        old ? { ...old, ...updates } : undefined
      );
      
      return { previousRun };
    },
    
    onError: (err, { id }, context) => {
      queryClient.setQueryData(['runs', 'details', id], context?.previousRun);
    },
    
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['runs', 'details', id] });
      queryClient.invalidateQueries({ queryKey: ['runs', user?.id] });
    },
  });
};

export const useDeleteRun = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: (runId: string) =>
      api.delete(`/runs?id=eq.${runId}`),
    
    onSuccess: (_, runId) => {
      // Remove from runs cache
      queryClient.setQueryData(['runs', user?.id], (old: any) => {
        if (!old) return old;
        
        const newPages = old.pages.map((page: CompletedRun[]) =>
          page.filter(run => run.id !== runId)
        );
        
        return { ...old, pages: newPages };
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user', 'statistics', user?.id] });
    },
  });
};
```

### 4.6 Social Features Hooks
```typescript
// hooks/useSocial.ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface RunPost {
  id: string;
  runId: string;
  userId: string;
  user: {
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  run: {
    distanceMeters: number;
    durationSeconds: number;
    routePolyline: string;
    startedAt: string;
  };
  caption?: string;
  imageUrls: string[];
  likesCount: number;
  commentsCount: number;
  isLikedByUser: boolean;
  createdAt: string;
}

interface Comment {
  id: string;
  userId: string;
  user: {
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  commentText: string;
  createdAt: string;
}

export const useSocialFeed = () => {
  return useInfiniteQuery({
    queryKey: ['social', 'feed'],
    queryFn: ({ pageParam = 0 }) =>
      api.post<RunPost[]>('/rpc/get_social_feed', {
        limit: 20,
        offset: pageParam,
      }),
    
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length * 20 : undefined;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (post: {
      runId: string;
      caption?: string;
      imageUrls?: string[];
    }) => api.post<RunPost>('/run_posts', post),
    
    onSuccess: (newPost) => {
      // Add to feed cache
      queryClient.setQueryData(['social', 'feed'], (old: any) => {
        if (!old) return { pages: [[newPost]], pageParams: [0] };
        
        const newPages = [...old.pages];
        newPages[0] = [newPost, ...newPages[0]];
        return { ...old, pages: newPages };
      });
    },
  });
};

export const useLikePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
      if (isLiked) {
        return api.delete(`/post_likes?post_id=eq.${postId}&user_id=eq.${useAuthStore.getState().user?.id}`);
      } else {
        return api.post('/post_likes', { post_id: postId });
      }
    },
    
    onMutate: async ({ postId, isLiked }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['social', 'feed'] });
      
      const previousData = queryClient.getQueryData(['social', 'feed']);
      
      queryClient.setQueryData(['social', 'feed'], (old: any) => {
        if (!old) return old;
        
        const newPages = old.pages.map((page: RunPost[]) =>
          page.map((post: RunPost) =>
            post.id === postId
              ? {
                  ...post,
                  isLikedByUser: !isLiked,
                  likesCount: isLiked ? post.likesCount - 1 : post.likesCount + 1,
                }
              : post
          )
        );
        
        return { ...old, pages: newPages };
      });
      
      return { previousData };
    },
    
    onError: (err, variables, context) => {
      // Revert optimistic update
      queryClient.setQueryData(['social', 'feed'], context?.previousData);
    },
  });
};

export const usePostComments = (postId: string) => {
  return useQuery({
    queryKey: ['social', 'comments', postId],
    queryFn: () => api.post<Comment[]>('/rpc/get_post_comments', { post_id: postId }),
    enabled: !!postId,
  });
};

export const useAddComment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ postId, commentText }: { postId: string; commentText: string }) =>
      api.post<Comment>('/post_comments', {
        post_id: postId,
        comment_text: commentText,
      }),
    
    onSuccess: (newComment, { postId }) => {
      // Add to comments cache
      queryClient.setQueryData(['social', 'comments', postId], (old: Comment[] | undefined) =>
        old ? [...old, newComment] : [newComment]
      );
      
      // Update comments count in feed
      queryClient.setQueryData(['social', 'feed'], (old: any) => {
        if (!old) return old;
        
        const newPages = old.pages.map((page: RunPost[]) =>
          page.map((post: RunPost) =>
            post.id === postId
              ? { ...post, commentsCount: post.commentsCount + 1 }
              : post
          )
        );
        
        return { ...old, pages: newPages };
      });
    },
  });
};

export const useUserConnections = (userId: string) => {
  return useQuery({
    queryKey: ['social', 'connections', userId],
    queryFn: () => Promise.all([
      api.post('/rpc/get_user_followers', { user_id: userId }),
      api.post('/rpc/get_user_following', { user_id: userId }),
    ]).then(([followers, following]) => ({ followers, following })),
    enabled: !!userId,
  });
};

export const useFollowUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => {
      if (isFollowing) {
        return api.delete(`/user_follows?follower_id=eq.${useAuthStore.getState().user?.id}&following_id=eq.${userId}`);
      } else {
        return api.post('/user_follows', { following_id: userId });
      }
    },
    
    onSuccess: (_, { userId }) => {
      // Invalidate connections cache
      queryClient.invalidateQueries({ queryKey: ['social', 'connections', userId] });
      queryClient.invalidateQueries({ queryKey: ['social', 'connections', useAuthStore.getState().user?.id] });
    },
  });
};
```

## 5. Real-time Integration

### 5.1 Supabase Real-time Setup
```typescript
// hooks/useRealtime.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export const useRealtimeSubscriptions = () => {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    // Subscribe to social feed updates
    const feedSubscription = supabase
      .channel('social_feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'run_posts',
        },
        (payload) => {
          // Add new post to feed cache
          queryClient.setQueryData(['social', 'feed'], (old: any) => {
            if (!old) return { pages: [[payload.new]], pageParams: [0] };
            
            const newPages = [...old.pages];
            newPages[0] = [payload.new, ...newPages[0]];
            return { ...old, pages: newPages };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'run_posts',
        },
        (payload) => {
          // Update post in feed cache
          queryClient.setQueryData(['social', 'feed'], (old: any) => {
            if (!old) return old;
            
            const newPages = old.pages.map((page: any[]) =>
              page.map((post: any) =>
                post.id === payload.new.id ? payload.new : post
              )
            );
            
            return { ...old, pages: newPages };
          });
        }
      )
      .subscribe();
    
    // Subscribe to likes on your posts
    const likesSubscription = supabase
      .channel('post_likes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes',
        },
        () => {
          // Invalidate feed to refresh like counts
          queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
        }
      )
      .subscribe();
    
    return () => {
      feedSubscription.unsubscribe();
      likesSubscription.unsubscribe();
    };
  }, [isAuthenticated, user, queryClient]);
};
```

### 5.2 GPS Tracking Integration
```typescript
// hooks/useGPSTracking.ts
import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useTrackingStore } from '../stores/trackingStore';

export const useGPSTracking = () => {
  const {
    isTracking,
    isPaused,
    gpsSettings,
    updatePosition,
    setGPSStatus,
    setError,
  } = useTrackingStore();
  
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    
    const startGPSTracking = async () => {
      try {
        // Request permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied');
          return;
        }
        
        setGPSStatus('searching');
        
        // Start watching position
        subscription = await Location.watchPositionAsync(
          {
            accuracy: gpsSettings.accuracy === 'high' 
              ? Location.Accuracy.BestForNavigation 
              : Location.Accuracy.Balanced,
            timeInterval: gpsSettings.updateInterval,
            distanceInterval: gpsSettings.minimumDistance,
          },
          (location) => {
            if (!isPaused) {
              setGPSStatus('active');
              updatePosition({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                altitude: location.coords.altitude || undefined,
                accuracy: location.coords.accuracy || 0,
                speed: location.coords.speed || undefined,
                timestamp: location.timestamp,
              });
            }
          }
        );
      } catch (error) {
        setError(error.message);
        setGPSStatus('lost');
      }
    };
    
    if (isTracking) {
      startGPSTracking();
    }
    
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isTracking, isPaused, gpsSettings]);
  
  // Background location tracking
  useEffect(() => {
    const requestBackgroundPermission = async () => {
      if (isTracking) {
        await Location.requestBackgroundPermissionsAsync();
      }
    };
    
    requestBackgroundPermission();
  }, [isTracking]);
};
```

## 6. Provider Setup

### 6.1 App Root Provider
```typescript
// providers/AppProviders.tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useRealtimeSubscriptions } from '../hooks/useRealtime';
import { useGPSTracking } from '../hooks/useGPSTracking';

const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent>{children}</AppContent>
    </QueryClientProvider>
  );
};

const AppContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize real-time subscriptions
  useRealtimeSubscriptions();
  
  // Initialize GPS tracking
  useGPSTracking();
  
  return <>{children}</>;
};

export default AppProviders;
```

### 6.2 Usage in App.tsx
```typescript
// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppProviders from './providers/AppProviders';
import RootNavigator from './navigation/RootNavigator';

export default function App() {
  return (
    <AppProviders>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AppProviders>
  );
}
```

## 7. Usage Examples

### 7.1 Component Using Multiple Stores
```typescript
// screens/LiveTrackingScreen.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useTrackingStore } from '../stores/trackingStore';
import { useUIStore } from '../stores/uiStore';
import { useSaveRun } from '../hooks/useRuns';

const LiveTrackingScreen = () => {
  const {
    isTracking,
    metrics,
    currentPosition,
    pauseTracking,
    resumeTracking,
    stopTracking,
  } = useTrackingStore();
  
  const { mapRegion, updateMapRegion } = useUIStore();
  const saveRunMutation = useSaveRun();
  
  const handleStopRun = async () => {
    try {
      stopTracking();
      
      // Save the completed run
      await saveRunMutation.mutateAsync({
        title: 'Morning Run',
        distanceMeters: metrics.distanceMeters,
        durationSeconds: metrics.durationSeconds,
        averagePaceSecondsPerKm: metrics.averagePaceSecondsPerKm,
        // ... other run data
      });
    } catch (error) {
      console.error('Failed to save run:', error);
    }
  };
  
  return (
    <View>
      <Text>Distance: {(metrics.distanceMeters / 1000).toFixed(2)} km</Text>
      <Text>Duration: {Math.floor(metrics.durationSeconds / 60)}:{metrics.durationSeconds % 60}</Text>
      <Text>Pace: {Math.floor(metrics.currentPaceSecondsPerKm / 60)}:{Math.floor(metrics.currentPaceSecondsPerKm % 60)}/km</Text>
      
      {/* Control buttons */}
      {isTracking && (
        <>
          <button onClick={pauseTracking}>Pause</button>
          <button onClick={handleStopRun}>Stop</button>
        </>
      )}
    </View>
  );
};

export default LiveTrackingScreen;
```

### 7.2 Social Feed Component
```typescript
// components/SocialFeed.tsx
import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useSocialFeed, useLikePost } from '../hooks/useSocial';
import PostCard from './PostCard';

const SocialFeed = () => {
  const {
    data,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useSocialFeed();
  
  const likeMutation = useLikePost();
  
  const posts = data?.pages.flat() || [];
  
  const handleLike = (postId: string, isLiked: boolean) => {
    likeMutation.mutate({ postId, isLiked });
  };
  
  const handleLoadMore = () => {
    if (hasNextPage && !isLoading) {
      fetchNextPage();
    }
  };
  
  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          onLike={(isLiked) => handleLike(item.id, isLiked)}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
    />
  );
};

export default SocialFeed;
```

## 8. Performance Optimizations

### 8.1 Query Optimization
```typescript
// Prefetch related data
export const usePrefetchUserData = (userId: string) => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // Prefetch user profile when hovering or navigating
    queryClient.prefetchQuery({
      queryKey: ['user', 'profile', userId],
      queryFn: () => api.get(`/users?id=eq.${userId}`),
      staleTime: 5 * 60 * 1000,
    });
  }, [userId, queryClient]);
};

// Background refetch for important data
export const useBackgroundSync = () => {
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(() => {
      // Refetch critical data in background
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['user', 'statistics'], refetchType: 'active' });
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [isAuthenticated, queryClient]);
};
```

### 8.2 Memory Management
```typescript
// Cleanup old cache data
export const useCacheCleanup = () => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const cleanup = () => {
      // Remove old run data beyond 100 runs
      const runData = queryClient.getQueryData(['runs']) as any;
      if (runData?.pages.flat().length > 100) {
        queryClient.setQueryData(['runs'], (old: any) => ({
          ...old,
          pages: old.pages.slice(0, 5), // Keep first 5 pages
        }));
      }
    };
    
    const interval = setInterval(cleanup, 60000); // Every minute
    return () => clearInterval(interval);
  }, [queryClient]);
};
```

This comprehensive state management architecture using Zustand + React Query provides:

- **90% less boilerplate** than Redux
- **Excellent TypeScript** support
- **Optimistic updates** for better UX
- **Automatic background sync** and caching
- **Real-time features** via Supabase
- **Memory efficient** with smart cache management
- **Easy testing** and debugging
- **Scalable architecture** for future features# RunRoute - State Management with Zustand & React Query

## 1. Overview

This document defines the state management architecture for RunRoute using Zustand for global client state and React Query (TanStack Query) for server state management. This approach provides 90% less boilerplate than Redux while maintaining excellent performance and developer experience.

## 2. Architecture Overview

### 2.1 State Management Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                    RunRoute State Architecture               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │   Zustand       │  │         React Query              │  │
│  │ (Client State)  │  │      (Server State)              │  │
│  │                 │  │                                  │  │
│  │ • Auth Status   │  │ • User Profile                   │  │
│  │ • GPS Tracking  │  │ • Run History                    │  │
│  │ • Route Planning│  │ • Social Feed                    │  │
│  │ • UI State      │  │ • Planned Routes                 │  │
│  │ • Map State     │  │ • User Connections               │  │
│  └─────────────────┘  └──────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐  │
│  │            React Native AsyncStorage                    │  │
│  │         (Persistence for Auth & Preferences)           │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Installation & Setup
```bash
npm install zustand @tanstack/react-query @react-native-async-storage/async-storage
npm install @supabase/supabase-js # For API client
```

## 3. Zustand Stores (Client State)

### 3.1 Authentication Store
```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface AuthUser {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
}

interface AuthState {
  // State
  isAuthenticated: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, userData: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial State
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      loading: false,
      error: null,

      // Actions
      login: async (email: string, password: string) => {
        set({ loading: true, error: null });
        
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (error) throw error;
          
          set({
            isAuthenticated: true,
            user: {
              id: data.user.id,
              email: data.user.email!,
              username: data.user.user_metadata?.username,
              fullName: data.user.user_metadata?.full_name,
              avatarUrl: data.user.user_metadata?.avatar_url,
            },
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: Date.now() + (data.session.expires_in * 1000),
            loading: false,
          });
        } catch (error) {
          set({
            error: error.message,
            loading: false,
            isAuthenticated: false,
          });
        }
      },

      register: async (email: string, password: string, userData: any) => {
        set({ loading: true, error: null });
        
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: userData,
            },
          });
          
          if (error) throw error;
          
          if (data.session) {
            set({
              isAuthenticated: true,
              user: {
                id: data.user.id,
                email: data.user.email!,
                ...userData,
              },
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token,
              expiresAt: Date.now() + (data.session.expires_in * 1000),
              loading: false,
            });
          } else {
            // Email confirmation required
            set({ loading: false });
          }
        } catch (error) {
          set({
            error: error.message,
            loading: false,
            isAuthenticated: false,
          });
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          error: null,
        });
      },

      refreshAuth: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;
        
        try {
          const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken,
          });
          
          if (error) throw error;
          
          set({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: Date.now() + (data.session.expires_in * 1000),
          });
        } catch (error) {
          // Refresh failed, logout user
          get().logout();
        }
      },

      clearError: () => set({ error: null }),
      
      setUser: (user: AuthUser) => set({ user }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      }),
    }
  )
);
```

### 3.2 GPS Tracking Store
```typescript
// stores/trackingStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  speed?: number;
  timestamp: number;
}

interface TrackingMetrics {
  distanceMeters: number;
  durationSeconds: number;
  currentPaceSecondsPerKm: number;
  averagePaceSecondsPerKm: number;
  elevationGainMeters: number;
  calories: number;
}

interface TrackingState {
  // Tracking Status
  isTracking: boolean;
  isPaused: boolean;
  sessionId: string | null;
  plannedRouteId: string | null;
  
  // Timing
  startedAt: number | null;
  pausedAt: number | null;
  totalPausedTime: number;
  
  // GPS Data
  currentPosition: GPSPoint | null;
  gpsTrail: GPSPoint[];
  
  // Metrics
  metrics: TrackingMetrics;
  
  // Goals
  targetDistanceMeters?: number;
  
  // GPS Settings
  gpsSettings: {
    accuracy: 'high' | 'balanced' | 'low';
    updateInterval: number;
    minimumDistance: number;
  };
  
  // Status
  gpsStatus: 'disabled' | 'searching' | 'active' | 'lost';
  error: string | null;
  
  // Actions
  startTracking: (params: {
    plannedRouteId?: string;
    targetDistanceMeters?: number;
    startPosition: GPSPoint;
  }) => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: () => void;
  updatePosition: (position: GPSPoint) => void;
  setGPSStatus: (status: TrackingState['gpsStatus']) => void;
  updateSettings: (settings: Partial<TrackingState['gpsSettings']>) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialMetrics: TrackingMetrics = {
  distanceMeters: 0,
  durationSeconds: 0,
  currentPaceSecondsPerKm: 0,
  averagePaceSecondsPerKm: 0,
  elevationGainMeters: 0,
  calories: 0,
};

export const useTrackingStore = create<TrackingState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    isTracking: false,
    isPaused: false,
    sessionId: null,
    plannedRouteId: null,
    
    startedAt: null,
    pausedAt: null,
    totalPausedTime: 0,
    
    currentPosition: null,
    gpsTrail: [],
    
    metrics: initialMetrics,
    
    gpsSettings: {
      accuracy: 'high',
      updateInterval: 5000,
      minimumDistance: 5,
    },
    
    gpsStatus: 'disabled',
    error: null,
    
    // Actions
    startTracking: (params) => {
      const sessionId = `session_${Date.now()}`;
      set({
        isTracking: true,
        isPaused: false,
        sessionId,
        plannedRouteId: params.plannedRouteId || null,
        targetDistanceMeters: params.targetDistanceMeters,
        startedAt: Date.now(),
        currentPosition: params.startPosition,
        gpsTrail: [params.startPosition],
        metrics: initialMetrics,
        totalPausedTime: 0,
        error: null,
      });
    },
    
    pauseTracking: () => {
      set({
        isPaused: true,
        pausedAt: Date.now(),
      });
    },
    
    resumeTracking: () => {
      const state = get();
      if (state.isPaused && state.pausedAt) {
        const pauseDuration = Date.now() - state.pausedAt;
        set({
          isPaused: false,
          pausedAt: null,
          totalPausedTime: state.totalPausedTime + pauseDuration,
        });
      }
    },
    
    stopTracking: () => {
      set({
        isTracking: false,
        isPaused: false,
        gpsStatus: 'disabled',
      });
    },
    
    updatePosition: (newPosition) => {
      const state = get();
      if (!state.isTracking || state.isPaused) return;
      
      const newTrail = [...state.gpsTrail, newPosition];
      const newMetrics = calculateMetrics(newTrail, state.startedAt!, state.totalPausedTime);
      
      set({
        currentPosition: newPosition,
        gpsTrail: newTrail,
        metrics: newMetrics,
      });
    },
    
    setGPSStatus: (status) => set({ gpsStatus: status }),
    
    updateSettings: (settings) => set((state) => ({
      gpsSettings: { ...state.gpsSettings, ...settings }
    })),
    
    setError: (error) => set({ error }),
    
    reset: () => set({
      isTracking: false,
      isPaused: false,
      sessionId: null,
      plannedRouteId: null,
      startedAt: null,
      pausedAt: null,
      totalPausedTime: 0,
      currentPosition: null,
      gpsTrail: [],
      metrics: initialMetrics,
      gpsStatus: 'disabled',
      error: null,
    }),
  }))
);

// Helper function to calculate metrics
function calculateMetrics(gpsTrail: GPSPoint[], startTime: number, pausedTime: number): TrackingMetrics {
  if (gpsTrail.length < 2) return initialMetrics;
  
  let totalDistance = 0;
  let elevationGain = 0;
  
  for (let i = 1; i < gpsTrail.length; i++) {
    const prev = gpsTrail[i - 1];
    const curr = gpsTrail[i];
    
    // Calculate distance using Haversine formula
    totalDistance += calculateDistance(prev, curr);
    
    // Calculate elevation gain
    if (prev.altitude && curr.altitude && curr.altitude > prev.altitude) {
      elevationGain += curr.altitude - prev.altitude;
    }
  }
  
  const totalTime = Date.now() - startTime - pausedTime;
  const durationSeconds = Math.floor(totalTime / 1000);
  
  let averagePace = 0;
  let currentPace = 0;
  
  if (totalDistance > 0 && durationSeconds > 0) {
    averagePace = (durationSeconds / totalDistance) * 1000; // seconds per km
    
    // Current pace based on last 30 seconds of data
    const recent = gpsTrail.slice(-6); // Last 30 seconds assuming 5s intervals
    if (recent.length >= 2) {
      let recentDistance = 0;
      for (let i = 1; i < recent.length; i++) {
        recentDistance += calculateDistance(recent[i - 1], recent[i]);
      }
      if (recentDistance > 0) {
        currentPace = (30 / recentDistance) * 1000;
      }
    }
  }
  
  // Simple calorie estimation (very rough)
  const calories = Math.round(totalDistance * 0.05); // 50 cal per km
  
  return {
    distanceMeters: totalDistance,
    durationSeconds,
    currentPaceSecondsPerKm: currentPace,
    averagePaceSecondsPerKm: averagePace,
    elevationGainMeters: elevationGain,
    calories,
  };
}

function calculateDistance(p1: GPSPoint, p2: GPSPoint): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = p1.latitude * Math.PI / 180;
  const φ2 = p2.latitude * Math.PI / 180;
  const Δφ = (p2.latitude - p1.latitude) * Math.PI / 180;
  const Δλ = (p2.longitude - p1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}
```

### 3.3 Route Planning Store
```typescript
// stores/routeStore.ts
import { create } from 'zustand';

interface RouteWaypoint {
  latitude: number;
  longitude: number;
  order: number;
}

interface PlannedRoute {
  id?: string;
  name?: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude: number;
  targetDistanceMeters: number;
  actualDistanceMeters?: number;
  isLoop: boolean;
  waypoints: RouteWaypoint[];
  polyline?: string;
  elevationGainMeters?: number;
  estimatedDurationSeconds?: number;
}

interface RouteState {
  // Current Planning Session
  currentRoute: PlannedRoute | null;
  routeAlternatives: PlannedRoute[];
  
  // UI State
  isGenerating: boolean;
  isModifying: boolean;
  selectedStartPoint: { latitude: number; longitude: number } | null;
  selectedEndPoint: { latitude: number; longitude: number } | null;
  
  // Preferences
  routePreferences: {
    avoidHighways: boolean;
    preferParks: boolean;
    surfaceType: 'road' | 'trail' | 'mixed';
  };
  
  // Error State
  error: string | null;
  
  // Actions
  setStartPoint: (point: { latitude: number; longitude: number }) => void;
  setEndPoint: (point: { latitude: number; longitude: number } | null) => void;
  setCurrentRoute: (route: PlannedRoute) => void;
  updateRoute: (updates: Partial<PlannedRoute>) => void;
  addWaypoint: (waypoint: RouteWaypoint) => void;
  removeWaypoint: (index: number) => void;
  updateWaypoint: (index: number, waypoint: RouteWaypoint) => void;
  setAlternatives: (alternatives: PlannedRoute[]) => void;
  setPreferences: (prefs: Partial<RouteState['routePreferences']>) => void;
  setGenerating: (loading: boolean) => void;
  setModifying: (modifying: boolean) => void;
  setError: (error: string | null) => void;
  clearRoute: () => void;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  // Initial State
  currentRoute: null,
  routeAlternatives: [],
  
  isGenerating: false,
  isModifying: false,
  selectedStartPoint: null,
  selectedEndPoint: null,
  
  routePreferences: {
    avoidHighways: true,
    preferParks: true,
    surfaceType: 'mixed',
  },
  
  error: null,
  
  // Actions
  setStartPoint: (point) => set({ selectedStartPoint: point }),
  
  setEndPoint: (point) => set({ selectedEndPoint: point }),
  
  setCurrentRoute: (route) => set({ currentRoute: route }),
  
  updateRoute: (updates) => set((state) => ({
    currentRoute: state.currentRoute ? { ...state.currentRoute, ...updates } : null
  })),
  
  addWaypoint: (waypoint) => set((state) => ({
    currentRoute: state.currentRoute ? {
      ...state.currentRoute,
      waypoints: [...state.currentRoute.waypoints, waypoint].sort((a, b) => a.order - b.order)
    } : null
  })),
  
  removeWaypoint: (index) => set((state) => ({
    currentRoute: state.currentRoute ? {
      ...state.currentRoute,
      waypoints: state.currentRoute.waypoints.filter((_, i) => i !== index)
    } : null
  })),
  
  updateWaypoint: (index, waypoint) => set((state) => {
    if (!state.currentRoute) return state;
    
    const newWaypoints = [...state.currentRoute.waypoints];
    newWaypoints[index] = waypoint;
    
    return {
      currentRoute: {
        ...state.currentRoute,
        waypoints: newWaypoints
      }
    };
  }),
  
  setAlternatives: (alternatives) => set({ routeAlternatives: alternatives }),
  
  setPreferences: (prefs) => set((state) => ({
    routePreferences: { ...state.routePreferences, ...prefs }
  })),
  
  setGenerating: (loading) => set({ 
    isGenerating: loading,
    error: loading ? null : get().error 
  }),
  
  setModifying: (modifying) => set({ isModifying: modifying }),
  
  setError: (error) => set({ error }),
  
  clearRoute: () => set({
    currentRoute: null,
    routeAlternatives: [],
    selectedStartPoint: null,
    selectedEndPoint: null,
    error: null,
  }),
}));
```

### 3.4 UI State Store
```typescript
// stores/uiStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UINotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

interface UIState {
  // Navigation
  activeTab: 'home' | 'plan' | 'track' | 'feed' | 'profile';
  
  // Modals
  modals: {
    routePreview: boolean;
    runSummary: boolean;
    postCreation: boolean;
    settings: boolean;
  };
  
  // Map State
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  mapType: 'standard' | 'satellite' | 'hybrid';
  showUserLocation: boolean;
  followUserLocation: boolean;
  
  // Notifications
  notifications: UINotification[];
  
  // Theme & Preferences
  theme: 'light' | 'dark' | 'system';
  units: 'metric' | 'imperial';
  
  // Connectivity
  isOnline: boolean;
  
  // Onboarding
  hasCompletedOnboarding: boolean;
  
  // Actions
  setActiveTab: (tab: UIState['activeTab']) => void;
  showModal: (modal: keyof UIState['modals']) => void;
  hideModal: (modal: keyof UIState['modals']) => void;
  updateMapRegion: (region: Partial<UIState['mapRegion']>) => void;
  setMapType: (type: UIState['mapType']) => void;
  toggleUserLocation: () => void;
  setFollowUserLocation: (follow: boolean) => void;
  addNotification: (notification: Omit<UINotification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setTheme: (theme: UIState['theme']) => void;
  setUnits: (units: UIState['units']) => void;
  setOnlineStatus: (isOnline: boolean) => void;
  completeOnboarding: () => void;
}

const defaultMapRegion = {
  latitude: 40.7128,
  longitude: -74.0060,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial State
      activeTab: 'home',
      
      modals: {
        routePreview: false,
        runSummary: false,
        postCreation: false,
        settings: false,
      },
      
      mapRegion: defaultMapRegion,
      mapType: 'standard',
      showUserLocation: true,
      followUserLocation: false,
      
      notifications: [],
      
      theme: 'system',
      units: 'metric',
      
      isOnline: true,
      hasCompletedOnboarding: false,
      
      // Actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      showModal: (modal) => set((state) => ({
        modals: { ...state.modals, [modal]: true }
      })),
      
      hideModal: (modal) => set((state) => ({
        modals: { ...state.modals, [modal]: false }
      })),
      
      updateMapRegion: (region) => set((state) => ({
        mapRegion: { ...state.mapRegion, ...region }
      })),
      
      setMapType: (type) => set({ mapType: type }),
      
      toggleUserLocation: () => set((state) => ({
        showUserLocation: !state.showUserLocation
      })),
      
      setFollowUserLocation: (follow) => set({ followUserLocation: follow }),
      
      addNotification: (notification) => {
        const id = Date.now().toString();
        set((state) => ({
          notifications: [{ ...notification, id }, ...state.notifications].slice(0, 10)
        }));
        
        // Auto-remove after duration
        if (notification.duration) {
          setTimeout(() => {
            get().removeNotification(id);
          }, notification.duration);
        }
      },
      
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      })),
      
      clearNotifications: () => set({ notifications: [] }),
      
      setTheme: (theme) => set({ theme }),
      
      setUnits: (units) => set({ units }),
      
      setOnlineStatus: (isOnline) => set({ isOnline }),
      
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        units: state.units,
        mapType: state.mapType,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);
```

## 4. React Query Setup & Hooks

### 4.1 Query Client Configuration
```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 401/403 errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        // Show global error notification
        useUIStore.getState().addNotification({
          type: 'error',
          title: 'Something went wrong',
          message: error.message || 'An unexpected error occurred',
          duration: 5000,
        });
      },
    },
  },
});

// Global error handling
queryClient.setMutationDefaults(['optimistic'], {
  mutationFn: async ({ optimisticUpdate, actualUpdate, revertUpdate }) => {
    // Apply optimistic update
    optimisticUpdate();
    
    try {
      // Perform actual API call
      const result = await actualUpdate();
      return result;
    } catch (error) {
      // Revert on error
      revertUpdate();
      throw error;
    }
  },
});
```

### 4.2 API Client Setup
```typescript
// lib/api.ts
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = 'https://your-project.supabase.co/rest/v1';

class ApiClient {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const { accessToken } = useAuthStore.getState();
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        ...options.headers,
      },
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    // Handle auth errors
    if (response.status === 401) {
      await useAuthStore.getState().refreshAuth();
      // Retry with new token
      const newToken = useAuthStore.getState().accessToken;
      if (newToken) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${newToken}`,
        };
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, config);
        if (!retryResponse.ok) {
          throw new Error(`API Error: ${retryResponse.status}`);
        }
        return retryResponse.json();
      } else {
        useAuthStore.getState().logout();
        throw new Error('Authentication required');
      }
    }
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  }
  
  // HTTP Methods
  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }
  
  post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  patch<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  
  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
```

### 4.3 User Profile Hooks
```typescript
// hooks/useUserProfile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  totalRuns: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  // ... other profile fields
}

export const useUserProfile = (userId?: string) => {
  const { user } = useAuthStore();
  const targetUserId = userId || user?.id;
  
  return useQuery({
    queryKey: ['user', 'profile', targetUserId],
    queryFn: () => api.get<UserProfile[]>(`/users?id=eq.${targetUserId}`).then(data => data[0]),
    enabled: !!targetUserId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useUpdateUserProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: (updates: Partial<UserProfile>) =>
      api.patch<UserProfile>(`/users?id=eq.${user?.id}`, updates),
    
    onMutate: async (updates) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['user', 'profile', user?.id] });
      
      const previousProfile = queryClient.getQueryData(['user', 'profile', user?.id]);
      
      queryClient.setQueryData(['user', 'profile', user?.id], (old: UserProfile | undefined) =>
        old ? { ...old, ...updates } : undefined
      );
      
      return { previousProfile };
    },
    
    onError: (err, variables, context) => {
      // Revert optimistic update
      queryClient.setQueryData(['user', 'profile', user?.id], context?.previousProfile);
    },
    
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['user', 'profile', user?.id] });
    },
  });
};

export const useUserStatistics = (userId?: string, dateRange?: { from: string; to: string }) => {
  const { user } = useAuthStore();
  const targetUserId = userId || user?.id;
  
  return useQuery({
    queryKey: ['user', 'statistics', targetUserId, dateRange],
    queryFn: () => api.post('/rpc/get_user_statistics', {
      user_id: targetUserId,
      date_from: dateRange?.from,
      date_to: dateRange?.to,
    }),
    enabled: !!targetUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};