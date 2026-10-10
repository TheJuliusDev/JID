/**
 * Supabase client + session bootstrap.
 *
 * Ported from the website's `src/services/supabase.ts`. The mobile app talks to
 * exactly the same project with the same anon key, so all RLS, RPCs and
 * Realtime publications are shared. There is no server tier: the app is a
 * first-class Supabase client, not a proxy for one.
 */
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Session cache. AsyncStorage is the React Native equivalent of `localStorage`
 * and is what `@supabase/supabase-js` expects for persisted auth.
 */
const storage = {
  getItem: (key: string): Promise<string | null> => AsyncStorage.getItem(key),
  setItem: (key: string, value: string): Promise<void> => AsyncStorage.setItem(key, value),
  removeItem: (key: string): Promise<void> => AsyncStorage.removeItem(key),
};

let client: SupabaseClient | null = null;

/**
 * Lazily creates the shared client.
 *
 * Construction is deferred so that importing this module during the "not
 * configured" setup screen does not throw before the UI can explain why.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      // Supabase only refreshes tokens while the app is foregrounded on its own
      // schedule; we additionally refresh explicitly on foreground transitions.
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'X-Client-Info': 'jid-mobile' },
    },
    db: { schema: 'public' },
  });

  return client;
}

/**
 * Keeps the access token fresh across backgrounding.
 *
 * Supabase tokens expire after an hour. A user who leaves JID in the background
 * and comes back would otherwise be signed out mid-session; on every
 * foreground transition we refresh proactively so writes never fail with a
 * 401 the user cannot explain.
 */
if (AppState.addEventListener) {
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    if (!client) return;
    void client.auth.getSession().then(({ data }) => {
      const session: Session | null = data.session;
      if (!session) return;
      const expiresAt = session.expires_at ?? 0;
      const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);
      if (secondsLeft < 10 * 60) {
        void client?.auth.refreshSession();
      }
    });
  });
}

/**
 * Normalises a Supabase error into a message that is safe and useful to show a
 * student. Postgres messages like `duplicate key value violates unique
 * constraint "profiles_username_key"` are meaningless in context, so common
 * cases are translated.
 */
const FRIENDLY: Array<[RegExp, string]> = [
  [/duplicate key value violates unique constraint "?profiles_username/i, 'That username is already taken. Try another one.'],
  [/duplicate key/i, 'That already exists.'],
  [/violates row-level security/i, "You don't have permission to do that."],
  [/new row violates row-level security/i, "You don't have permission to do that."],
  [/JWT expired/i, 'Your session expired. Please sign in again.'],
  [/Invalid login credentials/i, 'Wrong email or password.'],
  [/Email not confirmed/i, 'Confirm your email address first, then sign in.'],
  [/rate limit/i, 'Too many attempts. Wait a moment and try again.'],
  [/Failed to fetch|NetworkError/i, "Can't reach JID right now. Check your connection."],
];

export function humanizeError(error: unknown): string {
  if (error == null) return 'Something went wrong.';
  if (typeof error === 'string') return error;

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);

  for (const [pattern, friendly] of FRIENDLY) {
    if (pattern.test(message)) return friendly;
  }
  return message;
}

/** Standard shape for a failed mutation, used by forms and toasts. */
export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export const failure = <T = void>(error: unknown): ActionResult<T> => ({
  ok: false,
  error: humanizeError(error),
});

export const success = <T>(data: T): ActionResult<T> => ({ ok: true, data });