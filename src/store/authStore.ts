import { create } from 'zustand';
import { User } from '../types';
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  getCurrentUser,
  getCurrentSession,
  updateProfile as authUpdateProfile,
  onAuthStateChange,
} from '../services/authService';

interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  initialize: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  /**
   * Initialize auth state by checking for existing session
   */
  initialize: async () => {
    try {
      set({ isLoading: true });

      const { data: session } = await getCurrentSession();

      if (session) {
        const { data: user } = await getCurrentUser();
        set({
          user,
          session,
          isAuthenticated: !!user,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }

      // Listen to auth state changes
      onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && session) {
          const { data: user } = await getCurrentUser();
          set({
            user,
            session,
            isAuthenticated: !!user,
          });
        } else if (event === 'SIGNED_OUT') {
          set({
            user: null,
            session: null,
            isAuthenticated: false,
          });
        }
      });
    } catch (error: any) {
      console.error('Failed to initialize auth:', error);
      set({
        isLoading: false,
        error: error.message,
      });
    }
  },

  /**
   * Sign in with email and password
   */
  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await authSignIn({ email, password });

      if (error) {
        set({ error, isLoading: false });
        return { success: false, error };
      }

      if (data?.user) {
        const { data: user } = await getCurrentUser();
        set({
          user,
          session: data.session,
          isAuthenticated: true,
          isLoading: false,
        });
        return { success: true };
      }

      return { success: false, error: 'Failed to sign in' };
    } catch (error: any) {
      const errorMsg = error.message || 'An error occurred during sign in';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Sign up with email, password, and name
   */
  signUp: async (email: string, password: string, name: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await authSignUp({ email, password, name });

      if (error) {
        set({ error, isLoading: false });
        return { success: false, error };
      }

      if (data?.user) {
        const { data: user } = await getCurrentUser();
        set({
          user,
          session: data.session,
          isAuthenticated: true,
          isLoading: false,
        });
        return { success: true };
      }

      return { success: false, error: 'Failed to sign up' };
    } catch (error: any) {
      const errorMsg = error.message || 'An error occurred during sign up';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Sign out the current user
   */
  signOut: async () => {
    try {
      set({ isLoading: true });

      const { error } = await authSignOut();

      if (error) {
        console.error('Sign out error:', error);
      }

      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Failed to sign out:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Update user profile
   */
  updateProfile: async (updates: Partial<User>) => {
    try {
      const { user } = get();
      if (!user) {
        return { success: false, error: 'No user logged in' };
      }

      set({ isLoading: true, error: null });

      const { data, error } = await authUpdateProfile(user.id, updates);

      if (error) {
        set({ error, isLoading: false });
        return { success: false, error };
      }

      set({
        user: { ...user, ...data },
        isLoading: false,
      });

      return { success: true };
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to update profile';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Clear error message
   */
  clearError: () => set({ error: null }),
}));
