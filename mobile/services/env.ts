/**
 * Typed access to the public Expo environment.
 *
 * Every value here is inlined into the client bundle by Metro, so this module
 * only ever holds *public* credentials. Reading them through a single typed
 * object means a missing or malformed variable fails loudly at startup with a
 * useful message instead of surfacing as an opaque 401 much later.
 *
 * IMPORTANT: Expo's build-time inlining only rewrites *static* member
 * expressions such as `process.env.EXPO_PUBLIC_SUPABASE_URL`. A dynamic lookup
 * like `process.env[key]` is left untouched and evaluates to `undefined` on the
 * device, which makes the whole app throw at startup. That is why every raw
 * value is read once, below, through a literal member expression and then
 * cleaned.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Static reads. Do not refactor these into a loop or an indexed lookup — the
 * bundler can only substitute the literal `process.env.EXPO_PUBLIC_*` form.
 */
const RAW = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
  cloudinaryUploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  adsProvider: process.env.EXPO_PUBLIC_ADS_PROVIDER,
} as const;

/**
 * Strips wrapping quotes so `.env` entries copied as `KEY="value"` behave the
 * same as bare `KEY=value`, and tolerates the stray BOM Windows editors add.
 */
const unquote = (value: string): string => value.replace(/^[\s"']+|[\s"']+$/g, '');

/** Trims and unquotes a raw value, tolerating `undefined`/non-strings. */
const clean = (value: string | undefined): string =>
  unquote(typeof value === 'string' ? value.trim() : '');

const requireVar = (key: string, value: string): string => {
  if (!value) {
    throw new ConfigError(
      `Missing required environment variable ${key}.\n\n` +
        `Copy mobile/.env.example to mobile/.env and fill it in.\n` +
        `The JID mobile app reads the same Supabase project and Cloudinary ` +
        `account as the JID website.`,
    );
  }
  return value;
};

const supabaseUrl = clean(RAW.supabaseUrl);
const supabaseAnonKey = clean(RAW.supabaseAnonKey);
const cloudinaryCloudName = clean(RAW.cloudinaryCloudName);
const cloudinaryUploadPreset = clean(RAW.cloudinaryUploadPreset);

/**
 * True when the app has enough configuration to talk to the backend.
 *
 * Used by the root layout to render a helpful setup screen rather than
 * letting every query fail with a confusing network error.
 */
export const isConfigured: boolean =
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  /^https?:\/\//.test(supabaseUrl);

/** Names of the variables still missing, for the setup screen. */
export const missingVariables: string[] = [
  ...(supabaseUrl ? [] : ['EXPO_PUBLIC_SUPABASE_URL']),
  ...(supabaseAnonKey ? [] : ['EXPO_PUBLIC_SUPABASE_ANON_KEY']),
  ...(cloudinaryCloudName ? [] : ['EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME']),
  ...(cloudinaryUploadPreset ? [] : ['EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET']),
];

export const env = {
  get supabaseUrl(): string {
    return requireVar('EXPO_PUBLIC_SUPABASE_URL', supabaseUrl);
  },
  get supabaseAnonKey(): string {
    return requireVar('EXPO_PUBLIC_SUPABASE_ANON_KEY', supabaseAnonKey);
  },
  get cloudinaryCloudName(): string {
    return requireVar('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME', cloudinaryCloudName);
  },
  get cloudinaryUploadPreset(): string {
    return requireVar('EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET', cloudinaryUploadPreset);
  },
  /** Which rewarded-ad provider to install. Unset in production. */
  get adsProvider(): 'test' | undefined {
    return clean(RAW.adsProvider) === 'test' ? 'test' : undefined;
  },
} as const;
