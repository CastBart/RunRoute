# Phase 7: Social Features

## Overview
This phase implements core social functionality, allowing users to share their runs, view a social feed, like and comment on posts, and engage with the running community.

## Completed Features

### 1. Social Service (socialService.ts)
- **getFeedPosts()**: Fetch paginated feed with user and run details
- **getPostById()**: Get single post with full details
- **createPost()**: Share a run to the social feed
- **deletePost()**: Remove a post
- **likePost() / unlikePost()**: Like interactions
- **toggleLike()**: Toggle like status with return value
- **getComments()**: Fetch comments for a post
- **addComment()**: Add a new comment
- **deleteComment()**: Remove a comment
- **getUserPosts()**: Get posts by a specific user
- **hasRunBeenPosted()**: Check if a run has already been shared

### 2. Post Card Component (PostCard.tsx)
- **User Header**: Avatar, name, and relative timestamp
- **Map Preview**: MapView with route polyline
- **Run Statistics**: Distance, duration, average pace
- **Caption Display**: Optional user caption
- **Action Buttons**: Like (with count) and comment (with count)
- **Interactive Elements**: Tap handlers for navigation

### 3. Social Feed Screen (SocialFeedScreen.tsx)
- **FlatList Implementation**: Efficient scrollable list of posts
- **Pull-to-Refresh**: Manual refresh capability
- **Empty State**: Friendly message when no posts exist
- **Loading State**: Activity indicator while fetching
- **Error Handling**: Error message with retry option
- **Optimistic Like Updates**: Instant UI feedback on like/unlike
- **Create Post FAB**: Floating action button to create new post
- **Focus Refresh**: Auto-refresh when screen comes into focus

### 4. Post Detail Screen (PostDetailScreen.tsx)
- **Full Post View**: Expanded view of post content
- **Map with Markers**: Start (green) and finish (red) markers
- **Run Statistics**: Distance, duration, pace
- **Caption Display**: Full caption text
- **Like Functionality**: Toggle like with count
- **Comments Section**:
  - List of all comments with user info
  - Comment input with keyboard handling
  - Submit button with loading state
  - Empty comments state

### 5. Create Post Screen (CreatePostScreen.tsx)
- **Two-Step Flow**:
  1. **Select Run**: List of available runs (not yet posted)
  2. **Compose Post**: Add caption and preview
- **Run Selection**:
  - Shows date, distance, duration, pace
  - Filters out already-posted runs
- **Post Composition**:
  - Map preview of selected run
  - Run statistics summary
  - Caption input (500 char limit)
  - Character count display
- **Submission**: Creates post and navigates back

### 6. Navigation
- **SocialStackNavigator**: Stack navigator for Social tab
  - Feed screen (main)
  - PostDetail screen
  - CreatePost screen (modal presentation)
- **Typed Navigation**: Full TypeScript support with SocialStackParamList

## File Structure

```
src/
├── components/
│   └── PostCard.tsx              # Reusable post card component
├── screens/
│   └── social/
│       ├── SocialFeedScreen.tsx  # Main feed view
│       ├── PostDetailScreen.tsx  # Individual post with comments
│       └── CreatePostScreen.tsx  # Share a run flow
├── navigation/
│   └── SocialStackNavigator.tsx  # Social tab stack navigator
├── services/
│   └── socialService.ts          # Social API operations
└── types/
    └── index.ts                  # Updated SocialStackParamList
```

## API Integration

### socialService Methods
```typescript
// Feed operations
getFeedPosts(limit: number, offset: number): Promise<PostWithDetails[]>
getPostById(postId: string): Promise<PostWithDetails | null>
getUserPosts(userId: string, limit: number): Promise<PostWithDetails[]>

// Post CRUD
createPost(params: CreatePostParams): Promise<RunPost>
deletePost(postId: string): Promise<void>
hasRunBeenPosted(runId: string): Promise<boolean>

// Likes
likePost(postId: string): Promise<void>
unlikePost(postId: string): Promise<void>
toggleLike(postId: string, currentlyLiked: boolean): Promise<boolean>

// Comments
getComments(postId: string): Promise<CommentWithUser[]>
addComment(postId: string, content: string): Promise<CommentWithUser>
deleteComment(commentId: string): Promise<void>
```

## Database Tables Used

- **run_posts**: Social posts linked to runs
- **likes**: Like records with unique constraint (user can only like once)
- **comments**: Comment records with user reference
- **profiles**: User information for display
- **runs**: Run data for statistics and map

## Data Flow

1. **Social Feed**:
   - Fetch posts with joined user and run data
   - Check like status for current user
   - Display in FlatList

2. **Like Interaction**:
   - Optimistic UI update
   - API call to toggle like
   - Update like count

3. **Creating a Post**:
   - Fetch user's runs
   - Filter already-posted runs
   - User selects run
   - User adds caption
   - Create post in database
   - Navigate back to feed

4. **Comments**:
   - Fetch comments with user info
   - Display in scrollable list
   - Submit new comment
   - Instant UI update

## Type Definitions

### PostWithDetails
```typescript
interface PostWithDetails extends RunPost {
  user: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  run: {
    id: string;
    distance: number;
    duration: number;
    average_pace: number;
    polyline: Array<{ latitude: number; longitude: number }>;
    start_time: string;
  };
  liked_by_current_user: boolean;
}
```

### CommentWithUser
```typescript
interface CommentWithUser extends Comment {
  user: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}
```

## UI Components

### PostCard Features
- Relative time formatting (2m ago, 3h ago, 5d ago)
- Avatar with initial fallback
- Map with auto-calculated region
- Formatted stats (km, duration, pace)
- Like/comment action buttons

### Feed Features
- Pull-to-refresh
- Empty state with icon
- Loading spinner
- Error state with retry
- Floating action button

## Sub-Phase 7.4: User Connections ✅ COMPLETED

### Overview
Implemented a complete follow system modeled after Instagram and Strava, allowing users to follow other runners, discover new users, and filter their feed by following.

### Database Changes
- **Dropped `friendships` table**: Removed mutual friendship model
- **Created `follows` table**: One-way following system (follower_id, following_id)
- **Added to `profiles` table**:
  - `followers_count` (integer, default 0)
  - `following_count` (integer, default 0)
- **PostgreSQL Triggers**: Auto-update follower/following counts with row-level locking for race condition safety

### New Components

#### FollowButton.tsx
- Reusable follow/unfollow button
- Two states: "Follow" (solid) and "Following" (outline)
- Loading state support
- Size variants (small, medium)
- Optimistic UI updates

#### UserListItem.tsx
- Reusable user list item
- Shows avatar (with fallback), name, subtitle
- Optional follow button
- Used in followers/following lists and search results

### New Screens

#### UserProfileScreen.tsx
- Public profile view for other users
- **Header Section**:
  - Avatar with fallback initial
  - User name
  - Follow/unfollow button
  - Tappable follower/following counts → navigate to lists
- **Stats Section**:
  - Total runs
  - Total distance
- **Posts Section**:
  - User's posts displayed with PostCard
  - Empty state when no posts

#### FollowersListScreen.tsx
- List of users following the profile owner
- Search functionality (debounced)
- Each user shown with UserListItem
- Follow/unfollow directly from list
- Empty state

#### FollowingListScreen.tsx
- List of users the profile owner is following
- Same features as FollowersListScreen
- Unfollow capability

#### UserSearchScreen.tsx
- **Search Mode**: Debounced search input (300ms delay)
- **Discovery Mode**: Suggested users when no query
  - Shows users followed by people you follow
  - Helps discover new runners
- Results shown with UserListItem
- Empty states for both modes

### Updated Screens

#### SocialFeedScreen.tsx
- **Feed Toggle**: "For You" / "Following" tabs
  - "For You": All public posts
  - "Following": Posts only from users you follow
- **Search Icon**: Header button → navigates to UserSearchScreen
- State management for feed mode

#### ProfileScreen.tsx (own profile)
- **Follow Counts Display**:
  - Shows followers_count and following_count
  - Tappable counts navigate to Social tab's Followers/Following lists
  - Uses cross-tab navigation (CommonActions)
- Fetches profile data from socialService

### Enhanced socialService Methods

```typescript
// Follow operations
followUser(userId: string): Promise<void>
unfollowUser(userId: string): Promise<void>
isFollowing(userId: string): Promise<boolean>

// User discovery
getFollowers(userId: string): Promise<UserWithFollowStatus[]>
getFollowing(userId: string): Promise<UserWithFollowStatus[]>
searchUsers(query: string): Promise<UserWithFollowStatus[]>
getSuggestedUsers(): Promise<UserWithFollowStatus[]>

// Profile viewing
getUserProfile(userId: string): Promise<UserProfile | null>

// Feed filtering
getFollowingFeedPosts(limit: number, offset: number): Promise<PostWithDetails[]>
```

### Updated Type Definitions

```typescript
// Follow relationship
interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

// User profile with follow counts
interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  followers_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

// User with follow status (for lists)
interface UserWithFollowStatus extends UserProfile {
  is_following: boolean;
}

// Updated navigation
type SocialStackParamList = {
  Feed: undefined;
  PostDetail: { postId: string };
  UserProfile: { userId: string };
  CreatePost: undefined;
  Followers: { userId: string };
  Following: { userId: string };
  Search: undefined;
};
```

### Key Features

1. **One-Way Following Model**:
   - Like Instagram/Strava, not mutual friendship
   - Can follow without being followed back

2. **User Discovery**:
   - Search by name
   - Suggested users (second-degree connections)
   - Debounced search for performance

3. **Feed Filtering**:
   - Toggle between "For You" (all posts) and "Following" (filtered feed)
   - Separate API methods for different feeds

4. **Optimistic UI**:
   - Instant follow/unfollow feedback
   - Counts update immediately

5. **Cross-Tab Navigation**:
   - Profile screen can navigate to Social tab's Followers/Following screens
   - Uses React Navigation's CommonActions

### File Changes Summary

**New Files** (6):
- `src/components/FollowButton.tsx`
- `src/components/UserListItem.tsx`
- `src/screens/social/UserProfileScreen.tsx`
- `src/screens/social/FollowersListScreen.tsx`
- `src/screens/social/FollowingListScreen.tsx`
- `src/screens/social/UserSearchScreen.tsx`

**Updated Files** (5):
- `src/services/socialService.ts` - Added 10 new methods
- `src/types/index.ts` - Added Follow, UserProfile, UserWithFollowStatus
- `src/navigation/SocialStackNavigator.tsx` - Added 4 new routes
- `src/screens/social/SocialFeedScreen.tsx` - Feed toggle and search
- `src/screens/profile/ProfileScreen.tsx` - Follow counts display

## Future Enhancements
- [ ] Post sharing (native share)
- [ ] Double-tap to like
- [ ] Image uploads for posts
- [ ] Real-time updates (Supabase Realtime)
- [ ] Infinite scroll pagination
- [ ] Post privacy settings
- [ ] Delete own posts
- [ ] Mutual follow suggestions
- [ ] Follow notifications
