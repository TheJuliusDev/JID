/**
 * Environment & Demo Mode Detection Configuration
 * Supports both Vite (VITE_) and Next.js (NEXT_PUBLIC_) style environment variables.
 * Automatically enables DEMO MODE when credentials are not configured.
 */

const getEnv = (key: string): string | undefined => {
  // Check import.meta.env (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env[key]) return import.meta.env[key];
    if (import.meta.env[`VITE_${key}`]) return import.meta.env[`VITE_${key}`];
    if (import.meta.env[`NEXT_PUBLIC_${key}`]) return import.meta.env[`NEXT_PUBLIC_${key}`];
  }
  return undefined;
};

export const SUPABASE_URL = 
  getEnv('SUPABASE_URL') || 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_URL) || 
  '';

export const SUPABASE_ANON_KEY = 
  getEnv('SUPABASE_ANON_KEY') || 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 
  '';

export const CLOUDINARY_CLOUD_NAME = 
  getEnv('CLOUDINARY_CLOUD_NAME') || 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 
  (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) || 
  '';

export const CLOUDINARY_UPLOAD_PRESET = 
  getEnv('CLOUDINARY_UPLOAD_PRESET') || 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) || 
  (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) || 
  '';

// Check if credentials exist and are not placeholder dummies
export const hasSupabaseConfig = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  !SUPABASE_URL.includes('your-supabase') && 
  !SUPABASE_URL.includes('placeholder')
);

export const hasCloudinaryConfig = Boolean(
  CLOUDINARY_CLOUD_NAME && 
  CLOUDINARY_UPLOAD_PRESET && 
  !CLOUDINARY_CLOUD_NAME.includes('your-cloud')
);

// When any primary service is missing, DEMO MODE is active
export const isDemoMode = !hasSupabaseConfig;
