import { supabase } from './supabase';

// Types for API responses (not extending base types to avoid user property conflicts)
export interface PostWithDetails {
  id: string;
  user_id: string;
  run_id: string;
  caption?: string;
  image_url?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
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

export interface CommentWithUser {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

export interface CreatePostParams {
  runId: string;
  caption?: string;
  imageUrl?: string;
}

class SocialService {
  /**
   * Get social feed posts with user and run details
   */
  async getFeedPosts(limit: number = 20, offset: number = 0): Promise<PostWithDetails[]> {
    const { data: session } = await supabase.auth.getSession();
    const currentUserId = session?.session?.user?.id;

    const { data, error } = await supabase
      .from('run_posts')
      .select(`
        *,
        user:profiles!user_id (
          id,
          name,
          avatar_url
        ),
        run:runs!run_id (
          id,
          distance,
          duration,
          average_pace,
          polyline,
          start_time
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching feed:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    const postIds = data.map((post: any) => post.id);

    // Fetch likes count, comments count, and current user's likes in parallel
    const [likesResult, commentsResult, userLikesResult] = await Promise.all([
      // Count likes per post
      supabase
        .from('likes')
        .select('post_id')
        .in('post_id', postIds),
      // Count comments per post
      supabase
        .from('comments')
        .select('post_id')
        .in('post_id', postIds),
      // Check which posts current user has liked
      currentUserId
        ? supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', currentUserId)
            .in('post_id', postIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Build counts maps
    const likesCountMap = new Map<string, number>();
    const commentsCountMap = new Map<string, number>();

    (likesResult.data || []).forEach((like: any) => {
      likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1);
    });

    (commentsResult.data || []).forEach((comment: any) => {
      commentsCountMap.set(comment.post_id, (commentsCountMap.get(comment.post_id) || 0) + 1);
    });

    const likedPostIds = new Set(
      (userLikesResult.data || []).map((like: any) => like.post_id)
    );

    return data.map((post: any) => ({
      ...post,
      likes_count: likesCountMap.get(post.id) || 0,
      comments_count: commentsCountMap.get(post.id) || 0,
      liked_by_current_user: likedPostIds.has(post.id),
    }));
  }

  /**
   * Get a single post by ID with all details
   */
  async getPostById(postId: string): Promise<PostWithDetails | null> {
    const { data: session } = await supabase.auth.getSession();
    const currentUserId = session?.session?.user?.id;

    const { data, error } = await supabase
      .from('run_posts')
      .select(`
        *,
        user:profiles!user_id (
          id,
          name,
          avatar_url
        ),
        run:runs!run_id (
          id,
          distance,
          duration,
          average_pace,
          polyline,
          start_time
        )
      `)
      .eq('id', postId)
      .single();

    if (error) {
      console.error('Error fetching post:', error);
      throw error;
    }

    // Fetch counts and user like status in parallel
    const [likesResult, commentsResult, userLikeResult] = await Promise.all([
      supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId),
      supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId),
      currentUserId
        ? supabase
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', currentUserId)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    return {
      ...data,
      likes_count: likesResult.count || 0,
      comments_count: commentsResult.count || 0,
      liked_by_current_user: !!userLikeResult.data,
    };
  }

  /**
   * Create a new post for a run
   */
  async createPost(params: CreatePostParams): Promise<PostWithDetails> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('run_posts')
      .insert({
        user_id: session.session.user.id,
        run_id: params.runId,
        caption: params.caption || null,
        image_url: params.imageUrl || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a post
   */
  async deletePost(postId: string): Promise<void> {
    const { error } = await supabase
      .from('run_posts')
      .delete()
      .eq('id', postId);

    if (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  /**
   * Like a post
   */
  async likePost(postId: string): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('likes')
      .insert({
        post_id: postId,
        user_id: session.session.user.id,
      });

    if (error) {
      // Ignore duplicate like errors
      if (error.code !== '23505') {
        console.error('Error liking post:', error);
        throw error;
      }
    }
  }

  /**
   * Unlike a post
   */
  async unlikePost(postId: string): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', session.session.user.id);

    if (error) {
      console.error('Error unliking post:', error);
      throw error;
    }
  }

  /**
   * Toggle like status on a post
   */
  async toggleLike(postId: string, currentlyLiked: boolean): Promise<boolean> {
    if (currentlyLiked) {
      await this.unlikePost(postId);
      return false;
    } else {
      await this.likePost(postId);
      return true;
    }
  }

  /**
   * Get comments for a post
   */
  async getComments(postId: string): Promise<CommentWithUser[]> {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:profiles!user_id (
          id,
          name,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Add a comment to a post
   */
  async addComment(postId: string, content: string): Promise<CommentWithUser> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: session.session.user.id,
        content,
      })
      .select(`
        *,
        user:profiles!user_id (
          id,
          name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }

  /**
   * Get user's own posts
   */
  async getUserPosts(userId: string, limit: number = 20): Promise<PostWithDetails[]> {
    const { data: session } = await supabase.auth.getSession();
    const currentUserId = session?.session?.user?.id;

    const { data, error } = await supabase
      .from('run_posts')
      .select(`
        *,
        user:profiles!user_id (
          id,
          name,
          avatar_url
        ),
        run:runs!run_id (
          id,
          distance,
          duration,
          average_pace,
          polyline,
          start_time
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user posts:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    const postIds = data.map((post: any) => post.id);

    // Fetch likes count, comments count, and current user's likes in parallel
    const [likesResult, commentsResult, userLikesResult] = await Promise.all([
      supabase
        .from('likes')
        .select('post_id')
        .in('post_id', postIds),
      supabase
        .from('comments')
        .select('post_id')
        .in('post_id', postIds),
      currentUserId
        ? supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', currentUserId)
            .in('post_id', postIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Build counts maps
    const likesCountMap = new Map<string, number>();
    const commentsCountMap = new Map<string, number>();

    (likesResult.data || []).forEach((like: any) => {
      likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1);
    });

    (commentsResult.data || []).forEach((comment: any) => {
      commentsCountMap.set(comment.post_id, (commentsCountMap.get(comment.post_id) || 0) + 1);
    });

    const likedPostIds = new Set(
      (userLikesResult.data || []).map((like: any) => like.post_id)
    );

    return data.map((post: any) => ({
      ...post,
      likes_count: likesCountMap.get(post.id) || 0,
      comments_count: commentsCountMap.get(post.id) || 0,
      liked_by_current_user: likedPostIds.has(post.id),
    }));
  }

  /**
   * Check if a run has already been posted
   */
  async hasRunBeenPosted(runId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('run_posts')
      .select('id')
      .eq('run_id', runId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is expected
      console.error('Error checking run post:', error);
    }

    return !!data;
  }

  // =============================================
  // FOLLOW SYSTEM METHODS
  // =============================================

  /**
   * Follow a user
   */
  async followUser(userId: string): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const currentUserId = session.session.user.id;
    if (currentUserId === userId) {
      throw new Error('Cannot follow yourself');
    }

    const { error } = await supabase.from('follows').insert({
      follower_id: currentUserId,
      following_id: userId,
    });

    if (error) {
      // Ignore duplicate follow errors
      if (error.code !== '23505') {
        console.error('Error following user:', error);
        throw error;
      }
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(userId: string): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', session.session.user.id)
      .eq('following_id', userId);

    if (error) {
      console.error('Error unfollowing user:', error);
      throw error;
    }
  }

  /**
   * Check if current user is following a specific user
   */
  async isFollowing(userId: string): Promise<boolean> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      return false;
    }

    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', session.session.user.id)
      .eq('following_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking follow status:', error);
    }

    return !!data;
  }

  /**
   * Get followers of a user
   */
  async getFollowers(
    userId: string,
    limit: number = 50
  ): Promise<Array<{ id: string; name: string; avatar_url: string | null; is_following: boolean }>> {
    const { data: session } = await supabase.auth.getSession();
    const currentUserId = session?.session?.user?.id;

    const { data, error } = await supabase
      .from('follows')
      .select(
        `
        follower:profiles!follower_id (
          id,
          name,
          avatar_url
        )
      `
      )
      .eq('following_id', userId)
      .limit(limit);

    if (error) {
      console.error('Error fetching followers:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Check which followers the current user is following
    const followerIds = data.map((f: any) => f.follower.id);
    let followingSet = new Set<string>();

    if (currentUserId) {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .in('following_id', followerIds);

      followingSet = new Set((followingData || []).map((f: any) => f.following_id));
    }

    return data.map((f: any) => ({
      id: f.follower.id,
      name: f.follower.name,
      avatar_url: f.follower.avatar_url,
      is_following: followingSet.has(f.follower.id),
    }));
  }

  /**
   * Get users that a user is following
   */
  async getFollowing(
    userId: string,
    limit: number = 50
  ): Promise<Array<{ id: string; name: string; avatar_url: string | null; is_following: boolean }>> {
    const { data: session } = await supabase.auth.getSession();
    const currentUserId = session?.session?.user?.id;

    const { data, error } = await supabase
      .from('follows')
      .select(
        `
        following:profiles!following_id (
          id,
          name,
          avatar_url
        )
      `
      )
      .eq('follower_id', userId)
      .limit(limit);

    if (error) {
      console.error('Error fetching following:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Check which users the current user is following
    const followingIds = data.map((f: any) => f.following.id);
    let followingSet = new Set<string>();

    if (currentUserId) {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .in('following_id', followingIds);

      followingSet = new Set((followingData || []).map((f: any) => f.following_id));
    }

    return data.map((f: any) => ({
      id: f.following.id,
      name: f.following.name,
      avatar_url: f.following.avatar_url,
      is_following: followingSet.has(f.following.id),
    }));
  }

  /**
   * Search users by name
   */
  async searchUsers(
    query: string,
    limit: number = 20
  ): Promise<Array<{ id: string; name: string; avatar_url: string | null; is_following: boolean }>> {
    const { data: session } = await supabase.auth.getSession();
    const currentUserId = session?.session?.user?.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .ilike('name', `%${query}%`)
      .neq('id', currentUserId || '')
      .limit(limit);

    if (error) {
      console.error('Error searching users:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Check which users the current user is following
    const userIds = data.map((u: any) => u.id);
    let followingSet = new Set<string>();

    if (currentUserId) {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .in('following_id', userIds);

      followingSet = new Set((followingData || []).map((f: any) => f.following_id));
    }

    return data.map((u: any) => ({
      id: u.id,
      name: u.name,
      avatar_url: u.avatar_url,
      is_following: followingSet.has(u.id),
    }));
  }

  /**
   * Get suggested users to follow (users followed by people you follow)
   */
  async getSuggestedUsers(
    limit: number = 10
  ): Promise<Array<{ id: string; name: string; avatar_url: string | null; mutual_count: number }>> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      return [];
    }

    const currentUserId = session.session.user.id;

    // Get users you're following
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    const followingIds = (followingData || []).map((f: any) => f.following_id);

    if (followingIds.length === 0) {
      // If not following anyone, return some users
      const { data: anyUsers } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .neq('id', currentUserId)
        .limit(limit);

      return (anyUsers || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        avatar_url: u.avatar_url,
        mutual_count: 0,
      }));
    }

    // Get users followed by people you follow (excluding yourself and people you already follow)
    const { data: suggestions, error } = await supabase
      .from('follows')
      .select(
        `
        following:profiles!following_id (
          id,
          name,
          avatar_url
        )
      `
      )
      .in('follower_id', followingIds)
      .not('following_id', 'in', `(${[currentUserId, ...followingIds].join(',')})`)
      .limit(limit * 3); // Get more to dedupe

    if (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }

    // Count mutual follows and dedupe
    const suggestionMap = new Map<
      string,
      { id: string; name: string; avatar_url: string | null; mutual_count: number }
    >();

    (suggestions || []).forEach((s: any) => {
      const userId = s.following.id;
      if (suggestionMap.has(userId)) {
        suggestionMap.get(userId)!.mutual_count += 1;
      } else {
        suggestionMap.set(userId, {
          id: userId,
          name: s.following.name,
          avatar_url: s.following.avatar_url,
          mutual_count: 1,
        });
      }
    });

    // Sort by mutual count and return top N
    return Array.from(suggestionMap.values())
      .sort((a, b) => b.mutual_count - a.mutual_count)
      .slice(0, limit);
  }

  /**
   * Get user profile with stats
   */
  async getUserProfile(userId: string): Promise<{
    id: string;
    name: string;
    avatar_url: string | null;
    followers_count: number;
    following_count: number;
    total_runs: number;
    total_distance: number;
    is_following: boolean;
    created_at: string;
  }> {
    const { data: session } = await supabase.auth.getSession();
    const currentUserId = session?.session?.user?.id;

    // Fetch profile, run stats, and follow status in parallel
    const [profileResult, runsResult, followResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, avatar_url, followers_count, following_count, created_at')
        .eq('id', userId)
        .single(),
      supabase.from('runs').select('distance').eq('user_id', userId),
      currentUserId && currentUserId !== userId
        ? supabase
            .from('follows')
            .select('id')
            .eq('follower_id', currentUserId)
            .eq('following_id', userId)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    if (profileResult.error) {
      console.error('Error fetching user profile:', profileResult.error);
      throw profileResult.error;
    }

    const runs = runsResult.data || [];
    const totalDistance = runs.reduce((sum: number, run: any) => sum + (run.distance || 0), 0);

    return {
      id: profileResult.data.id,
      name: profileResult.data.name,
      avatar_url: profileResult.data.avatar_url,
      followers_count: profileResult.data.followers_count || 0,
      following_count: profileResult.data.following_count || 0,
      total_runs: runs.length,
      total_distance: totalDistance,
      is_following: !!followResult.data,
      created_at: profileResult.data.created_at,
    };
  }

  /**
   * Get feed posts from users you follow
   */
  async getFollowingFeedPosts(limit: number = 20, offset: number = 0): Promise<PostWithDetails[]> {
    const { data: session } = await supabase.auth.getSession();
    const currentUserId = session?.session?.user?.id;

    if (!currentUserId) {
      return [];
    }

    // Get users the current user is following
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    const followingIds = (followingData || []).map((f: any) => f.following_id);

    // Include own posts too
    const userIds = [currentUserId, ...followingIds];

    if (userIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('run_posts')
      .select(
        `
        *,
        user:profiles!user_id (
          id,
          name,
          avatar_url
        ),
        run:runs!run_id (
          id,
          distance,
          duration,
          average_pace,
          polyline,
          start_time
        )
      `
      )
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching following feed:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    const postIds = data.map((post: any) => post.id);

    // Fetch likes count, comments count, and current user's likes in parallel
    const [likesResult, commentsResult, userLikesResult] = await Promise.all([
      supabase.from('likes').select('post_id').in('post_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
      supabase.from('likes').select('post_id').eq('user_id', currentUserId).in('post_id', postIds),
    ]);

    // Build counts maps
    const likesCountMap = new Map<string, number>();
    const commentsCountMap = new Map<string, number>();

    (likesResult.data || []).forEach((like: any) => {
      likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1);
    });

    (commentsResult.data || []).forEach((comment: any) => {
      commentsCountMap.set(comment.post_id, (commentsCountMap.get(comment.post_id) || 0) + 1);
    });

    const likedPostIds = new Set((userLikesResult.data || []).map((like: any) => like.post_id));

    return data.map((post: any) => ({
      ...post,
      likes_count: likesCountMap.get(post.id) || 0,
      comments_count: commentsCountMap.get(post.id) || 0,
      liked_by_current_user: likedPostIds.has(post.id),
    }));
  }
}

export const socialService = new SocialService();
