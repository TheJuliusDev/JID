import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasSupabaseConfig } from '../config/env';

/**
 * Supabase client. Created only when valid credentials are present.
 * The app gates rendering on `hasSupabaseConfig` (see App.tsx / ConfigError),
 * so within the running app this is always non-null — use `requireSupabase()`
 * from service code to get a guaranteed client with a clear error otherwise.
 */
let client: SupabaseClient | null = null;

if (hasSupabaseConfig) {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'jid-auth',
    },
  });
}

export const supabase = client;

export function requireSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'JID backend is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return client;
}

export { hasSupabaseConfig };
