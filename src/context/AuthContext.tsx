import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { UserProfile } from '../types';
import { supabase, hasSupabaseConfig } from '../services/supabase';
import { fetchProfileRow, fetchMyRole, updateMyProfile, isUsernameAvailable } from '../services/database';

interface SignupInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
  department?: string;
  level?: string;
  hallOrArea?: string;
}

interface AuthResult {
  success: boolean;
  error?: string;
  needsConfirmation?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (data: SignupInput) => Promise<AuthResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  changePassword: (newPassword: string) => Promise<AuthResult>;
  deleteAccount: () => Promise<AuthResult>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
  checkUsername: (username: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Convert raw Supabase auth errors into friendly, non-technical messages. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect email or password. Please try again.';
  if (m.includes('email not confirmed')) return 'Please confirm your email address first — check your inbox.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'An account with this email already exists. Try logging in instead.';
  if (m.includes('password should be at least')) return 'Your password is too short — use at least 6 characters.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'That email address looks invalid.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('network')) return 'Network error. Check your connection and try again.';
  return message || 'Something went wrong. Please try again.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const mounted = useRef(true);

  const buildProfile = useCallback(async (userId: string, email: string): Promise<UserProfile | null> => {
    const [row, role] = await Promise.all([fetchProfileRow(userId), fetchMyRole(userId)]);
    if (!row) return null;
    return {
      id: row.id,
      email,
      username: row.username,
      fullName: row.full_name,
      department: row.department || undefined,
      level: row.level || undefined,
      hallOrArea: row.hall_or_area || undefined,
      avatarUrl: row.avatar_url || undefined,
      bio: row.bio || undefined,
      isAdmin: role === 'admin',
      createdAt: row.created_at,
    };
  }, []);

  const loadSession = useCallback(async () => {
    if (!hasSupabaseConfig || !supabase) {
      setIsLoading(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await buildProfile(session.user.id, session.user.email || '');
        if (mounted.current) setUser(profile);
      } else if (mounted.current) {
        setUser(null);
      }
    } catch (err) {
      console.error('[auth] session load failed', err);
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [buildProfile]);

  useEffect(() => {
    mounted.current = true;
    loadSession();

    if (!hasSupabaseConfig || !supabase) return;
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        if (mounted.current) setUser(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const profile = await buildProfile(session.user.id, session.user.email || '');
        if (mounted.current && profile) setUser(profile);
      }
    });

    return () => {
      mounted.current = false;
      authListener.subscription.unsubscribe();
    };
  }, [buildProfile, loadSession]);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { success: false, error: 'Backend is not configured.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { success: false, error: friendlyAuthError(error.message) };
    if (data.user) {
      const profile = await buildProfile(data.user.id, data.user.email || '');
      if (mounted.current) setUser(profile);
    }
    return { success: true };
  }, [buildProfile]);

  const signup = useCallback(async (input: SignupInput): Promise<AuthResult> => {
    if (!supabase) return { success: false, error: 'Backend is not configured.' };
    const username = input.username.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
          username,
          department: input.department?.trim() || '',
          level: input.level?.trim() || '',
          hall_or_area: input.hallOrArea?.trim() || '',
        },
      },
    });
    if (error) return { success: false, error: friendlyAuthError(error.message) };

    if (data.session && data.user) {
      const profile = await buildProfile(data.user.id, data.user.email || '');
      if (mounted.current) setUser(profile);
      return { success: true };
    }
    // Email confirmation required — no session yet.
    return { success: true, needsConfirmation: true };
  }, [buildProfile]);

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    if (mounted.current) setUser(null);
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: 'Backend is not configured.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}`,
    });
    if (error) return { success: false, message: friendlyAuthError(error.message) };
    return { success: true, message: 'If an account exists for that email, a reset link is on its way.' };
  }, []);

  const changePassword = useCallback(async (newPassword: string): Promise<AuthResult> => {
    if (!supabase) return { success: false, error: 'Backend is not configured.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: friendlyAuthError(error.message) };
    return { success: true };
  }, []);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!supabase || !user) return { success: false, error: 'Not signed in.' };
    // Deletion of the auth user requires a privileged server function; we remove
    // the user's own data (RLS-scoped) and sign out. Full auth-row deletion is
    // handled by an admin/edge function server-side.
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return { success: false, error: friendlyAuthError(error.message) };
    await logout();
    return { success: true };
  }, [user, logout]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<AuthResult> => {
    if (!user) return { success: false, error: 'Not signed in.' };
    try {
      await updateMyProfile(user.id, updates);
      if (mounted.current) setUser((prev) => (prev ? { ...prev, ...updates } : prev));
      return { success: true };
    } catch (err: any) {
      const msg = `${err?.message || ''}`.toLowerCase().includes('duplicate')
        ? 'That username is already taken.'
        : friendlyAuthError(err?.message || 'Could not update your profile.');
      return { success: false, error: msg };
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profile = await buildProfile(user.id, user.email);
    if (mounted.current && profile) setUser(profile);
  }, [user, buildProfile]);

  const checkUsername = useCallback(async (username: string) => {
    try {
      return await isUsernameAvailable(username.trim().toLowerCase());
    } catch {
      return true;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        isAdmin: Boolean(user?.isAdmin),
        login,
        signup,
        logout,
        resetPassword,
        changePassword,
        deleteAccount,
        updateProfile,
        refreshProfile,
        checkUsername,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
