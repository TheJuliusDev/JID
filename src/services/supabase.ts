import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasSupabaseConfig, isDemoMode } from '../config/env';

/**
 * Supabase Client Instance
 * Automatically switches between real Supabase client and graceful null/demo handler.
 */
let supabaseClient: SupabaseClient | null = null;

if (hasSupabaseConfig) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    console.info('[JID Supabase] Connected to live Supabase project:', SUPABASE_URL);
  } catch (error) {
    console.warn('[JID Supabase] Failed to initialize Supabase client. Running in Demo Mode.', error);
    supabaseClient = null;
  }
} else {
  console.info('[JID Environment] Supabase credentials not found. Application running in DEMO MODE.');
}

export const supabase = supabaseClient;
export { isDemoMode, hasSupabaseConfig };
