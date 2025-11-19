import { supabase } from './supabase';
import { User } from '../types';

export interface SignUpData {
  email: string;
  password: string;
  name: string;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Sign up a new user with email and password
 */
export const signUp = async ({ email, password, name }: SignUpData) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || 'Failed to sign up' };
  }
};

/**
 * Sign in an existing user with email and password
 */
export const signIn = async ({ email, password }: SignInData) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || 'Failed to sign in' };
  }
};

/**
 * Sign out the current user
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message || 'Failed to sign out' };
  }
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'runroute://reset-password',
    });

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error: error.message || 'Failed to send reset email' };
  }
};

/**
 * Get the current user session
 */
export const getCurrentSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { data: data.session, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
};

/**
 * Get the current user profile
 */
export const getCurrentUser = async (): Promise<{ data: User | null; error: string | null }> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) return { data: null, error: null };

    // Fetch profile from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    return { data: profile as User, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (userId: string, updates: Partial<User>) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || 'Failed to update profile' };
  }
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};
