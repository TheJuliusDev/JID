/**
 * Environment configuration for JID.
 *
 * The app is a real, live product — there is NO demo/offline fallback.
 * Required credentials are read from EXPO_PUBLIC_* variables (the production
 * convention), with VITE_* accepted as a fallback. Both prefixes are exposed
 * to the client bundle via `envPrefix` in vite.config.ts.
 *
 * If required variables are missing, `configStatus` reports it and the app
 * renders a clear configuration screen (see ConfigError) instead of starting.
 */

export const readEnv = (name: string): string => {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) || ({} as Record<string, string>);
  const value =
    env[`EXPO_PUBLIC_${name}`] ??
    env[`VITE_${name}`] ??
    env[name] ??
    '';
  return typeof value === 'string' ? value.trim() : '';
};

const isPlaceholder = (value: string): boolean =>
  !value ||
  value.includes('YOUR-') ||
  value.includes('your-') ||
  value.includes('placeholder') ||
  value.includes('example');

export const SUPABASE_URL = readEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = readEnv('SUPABASE_ANON_KEY');
export const CLOUDINARY_CLOUD_NAME = readEnv('CLOUDINARY_CLOUD_NAME');
export const CLOUDINARY_UPLOAD_PRESET = readEnv('CLOUDINARY_UPLOAD_PRESET');

export const hasSupabaseConfig = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !isPlaceholder(SUPABASE_URL) &&
  !isPlaceholder(SUPABASE_ANON_KEY) &&
  /^https?:\/\//.test(SUPABASE_URL)
);

export const hasCloudinaryConfig = Boolean(
  CLOUDINARY_CLOUD_NAME &&
  CLOUDINARY_UPLOAD_PRESET &&
  !isPlaceholder(CLOUDINARY_CLOUD_NAME) &&
  !isPlaceholder(CLOUDINARY_UPLOAD_PRESET)
);

export interface ConfigStatus {
  ok: boolean;
  missing: string[];
}

/**
 * Which required variables are missing. Supabase is mandatory to run at all;
 * Cloudinary is required for image uploads (listing creation) and reported
 * separately so the config screen can explain exactly what to add.
 */
export const configStatus: ConfigStatus = (() => {
  const missing: string[] = [];
  if (!SUPABASE_URL || isPlaceholder(SUPABASE_URL)) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_ANON_KEY || isPlaceholder(SUPABASE_ANON_KEY)) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!CLOUDINARY_CLOUD_NAME || isPlaceholder(CLOUDINARY_CLOUD_NAME)) missing.push('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME');
  if (!CLOUDINARY_UPLOAD_PRESET || isPlaceholder(CLOUDINARY_UPLOAD_PRESET)) missing.push('EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET');
  return { ok: hasSupabaseConfig, missing };
})();
