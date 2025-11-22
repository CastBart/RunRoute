import { supabase } from './supabase';
import { RunPost, Comment, Like } from '../types';

// Types for API responses
export interface PostWithDetails extends RunPost {
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

export interface CommentWithUser extends Comment {
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
  async createPost(params: CreatePostParams): Promise<RunPost> {
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
}

export const socialService = new SocialService();
