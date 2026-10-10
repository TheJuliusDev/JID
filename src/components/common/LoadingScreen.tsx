import React from 'react';
import { motion } from 'motion/react';
import { BRAND_CONFIG } from '../../config/brand';

/**
 * Full-screen loading state shown while auth/session is resolving.
 *
 * A bare spinner here reads as "broken" on a cold cache, because the app has not
 * painted anything yet and there is nothing to look at. Showing the real brand
 * lockup immediately makes the wait feel like the start of the app rather than a
 * stalled tab.
 */
export const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="min-h-screen bg-sand-50 dark:bg-charcoal-950 flex flex-col items-center justify-center gap-5 px-6">
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-16 h-16"
    >
      <img
        src="/apple-touch-icon.png"
        alt=""
        draggable={false}
        className="w-full h-full rounded-2xl object-cover shadow-lg"
      />
      {/* Sweeping highlight, so the wait has motion without a spinner. */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl overflow-hidden"
        initial={{ opacity: 0.6 }}
        animate={{ opacity: [0.35, 0.9, 0.35] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="jid-skeleton absolute inset-0 rounded-2xl" />
      </motion.span>
    </motion.div>

    <div className="text-center space-y-1.5">
      <p className="font-display font-black text-xl tracking-tight text-zinc-950 dark:text-white">
        {BRAND_CONFIG.name}
      </p>
      <p role="status" aria-live="polite" className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
    </div>
  </div>
);