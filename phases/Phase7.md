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

## Future Enhancements (Phase 7.2+)
- [ ] User profile view (UserProfile screen)
- [ ] Follow/unfollow functionality
- [ ] Followers/following lists
- [ ] Post sharing (native share)
- [ ] Double-tap to like
- [ ] Image uploads for posts
- [ ] Real-time updates (Supabase Realtime)
- [ ] Infinite scroll pagination
- [ ] Post privacy settings
- [ ] Delete own posts
