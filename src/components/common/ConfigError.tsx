import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { configStatus } from '../../config/env';
import { BRAND_CONFIG } from '../../config/brand';

/**
 * Shown when required environment variables are missing. The app never silently
 * falls back to fake data — it explains exactly what to configure.
 */
export const ConfigError: React.FC = () => {
  return (
    <div className="min-h-screen bg-sand-50 dark:bg-charcoal-950 text-zinc-950 dark:text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 flex items-center justify-center mb-5">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-display font-bold mb-2">{BRAND_CONFIG.name} isn’t configured yet</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          The app is missing required environment variables, so it can’t connect to its backend. Add the
          following to your <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm">.env</code> file
          and restart the dev server.
        </p>

        <ul className="space-y-2 mb-6">
          {configStatus.missing.map((name) => (
            <li
              key={name}
              className="flex items-center gap-2 text-sm font-mono bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {name}
            </li>
          ))}
        </ul>

        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          See <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">supabase/README.md</code> for the
          full setup guide, including creating your Supabase project and Cloudinary upload preset.
        </p>
      </div>
    </div>
  );
};
