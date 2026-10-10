/**
 * Authentication provider.
 *
 * Ported from the website's `src/context/AuthContext.tsx`, with the parts that
 * only make sense in a browser removed and the parts that matter more on a
 * device added:
 *
 *  - `initialising` distinguishes "we haven't asked Supabase yet" from
 *    "signed out". Without it, a cold start flashes the login screen before the
 *    persisted session is restored, which is the classic RN auth flicker.
 *  - The session is observed for the app's lifetime, so a token refresh or a
 *    sign-out in another tab/refresh takes effect immediately.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, humanizeError } from '@/services/supabase';
import { fetchProfileRow, updateMyProfile } from '@/services/database';
import type { UserProfile } from '@/types';
import { USERNAME_PATTERN } from '@/constants/brand';

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  username: string;
  department: string;
  level: string;
  hallOrArea: string;
}

export interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  /** True until the persisted session has been restored. Never flash login. */
  initialising: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (input: SignUpInput) => Promise<string | null>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveProfile: (
    updates: Partial<
      Pick<
        UserProfile,
        'fullName' | 'username' | 'department' | 'level' | 'hallOrArea' | 'bio' | 'avatarUrl'
      >
    >,
  ) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Shared email shape check, used by sign-in, sign-up and reset. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (value: string): boolean => EMAIL_PATTERN.test(value.trim());

/**
 * Password policy, mirrored from the website. Enforced client-side for instant
 * feedback; the same rule is a CHECK constraint in Postgres, so this is a
 * courtesy rather than the enforcement point.
 */
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number', test: (v: string) => /[0-9]/.test(v) },
] as const;

export const validatePassword = (value: string): string | null => {
  const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
  return failed ? `Password needs ${failed.label.toLowerCase()}.` : null;
};

export const validateUsername = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return 'Pick a username.';
  if (!USERNAME_PATTERN.test(trimmed)) {
    return 'Use 3–20 letters, numbers or underscores.';
  }
  return null;
};

/** Maps a `profiles` row onto the app's `UserProfile`. */
const toUserProfile = (row: Record<string, unknown> | null, email: string): UserProfile | null => {
  if (!row) return null;
  return {
    id: String(row.id),
    email,
    username: String(row.username ?? ''),
    fullName: String(row.full_name ?? ''),
    department: (row.department as string) || undefined,
    level: (row.level as string) || undefined,
    hallOrArea: (row.hall_or_area as string) || undefined,
    avatarUrl: (row.avatar_url as string) || undefined,
    bio: (row.bio as string) || undefined,
    isSuspended: row.is_suspended === true,
    // Presence columns arrive with the messaging migration. Defaulting to
    // visible keeps a pre-migration account behaving as it always has, and
    // `false` from the database is what actually hides someone.
    lastSeenAt: (row.last_seen_at as string) || undefined,
    lastSeenVisible: row.last_seen_visible !== false,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);

  // The user id we have already loaded a profile for, so an onAuthStateChange
  // event for an unchanged session does not re-query the database.
  const loadedForUser = useRef<string | null>(null);

  const loadProfile = useCallback(async (activeSession: Session) => {
    const userId = activeSession.user.id;
    const email = activeSession.user.email ?? '';
    try {
      const row = await fetchProfileRow(userId);
      // A brand-new signup can land here before the `handle_new_user` trigger
      // has committed its profile row. Returning null lets the caller render a
      // "finishing setup" state instead of an error.
      const next = toUserProfile(row, email);
      setProfile(next);
      loadedForUser.current = next ? userId : null;
    } catch (error) {
      setProfile(null);
      loadedForUser.current = null;
      void humanizeError(error);
    }
  }, []);

  // Boot: restore the persisted session before declaring ourselves ready.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setSession(data.session);
          await loadProfile(data.session);
        }
      } catch {
        // A failure here is not fatal; the observer below will recover if a
        // session does exist.
      } finally {
        if (!cancelled) setInitialising(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  // Observe the session for the app's lifetime.
  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((event, next) => {
      if (event === 'TOKEN_REFRESHED') {
        // Same user, new token: no profile reload needed.
        setSession(next);
        return;
      }

      setSession(next);

      if (event === 'SIGNED_OUT' || !next) {
        setProfile(null);
        loadedForUser.current = null;
        return;
      }

      if (next.user?.id && next.user.id !== loadedForUser.current) {
        void loadProfile(next);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      return error ? humanizeError(error) : null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sign-up.
   *
   * The four profile fields (full name, username, level, hall) plus department
   * are passed as `options.data`; the `handle_new_user` database trigger reads
   * them to build the `profiles` row and the default `user_roles` row. That is
   * the only place these values are trusted, and it runs server-side so a
   * tampered client cannot grant itself a role.
   */
  const signUp = useCallback(async (input: SignUpInput): Promise<string | null> => {
    setLoading(true);
    try {
      const { data, error } = await getSupabase().auth.signUp({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        options: {
          data: {
            full_name: input.fullName.trim(),
            username: input.username.trim(),
            department: input.department,
            level: input.level,
            hall_or_area: input.hallOrArea,
          },
        },
      });

      if (error) return humanizeError(error);

      // When email confirmation is enabled there is no session yet. Returning a
      // marker lets the UI show the "check your inbox" screen rather than
      // pretending the user is signed in.
      if (!data.session) {
        return 'CHECK_EMAIL';
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<string | null> => {
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: 'jid://reset-password',
      });
      return error ? humanizeError(error) : null;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await getSupabase().auth.signOut();
      setProfile(null);
      setSession(null);
      loadedForUser.current = null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    await loadProfile(session);
  }, [session, loadProfile]);

  const saveProfile = useCallback(
    async (
      updates: Partial<
        Pick<
          UserProfile,
          'fullName' | 'username' | 'department' | 'level' | 'hallOrArea' | 'bio' | 'avatarUrl'
        >
      >,
    ): Promise<string | null> => {
      if (!session) return 'You are not signed in.';
      setLoading(true);
      try {
        await updateMyProfile(session.user.id, updates);
        await loadProfile(session);
        return null;
      } catch (error) {
        return humanizeError(error);
      } finally {
        setLoading(false);
      }
    },
    [session, loadProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      initialising,
      signIn,
      signUp,
      sendPasswordReset,
      signOut,
      refreshProfile,
      saveProfile,
    }),
    [
      session,
      profile,
      loading,
      initialising,
      signIn,
      signUp,
      sendPasswordReset,
      signOut,
      refreshProfile,
      saveProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}