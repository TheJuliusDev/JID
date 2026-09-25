import React from 'react';
import { Loader2 } from 'lucide-react';

/** Full-screen loading state shown while auth/session is resolving. */
export const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="min-h-screen bg-sand-50 dark:bg-charcoal-950 flex flex-col items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400">
    <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
    <p className="text-sm font-medium">{label}</p>
  </div>
);
