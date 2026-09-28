import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ScrollReveal } from '../ScrollReveal';

interface PageHeaderProps {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-hand column: primary actions, stats, badges. Hidden on mobile if empty. */
  aside?: React.ReactNode;
  /** Optional row of trust points rendered under the description. */
  highlights?: string[];
  tone?: 'emerald' | 'amber' | 'neutral';
}

const TONES = {
  emerald: {
    pill: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-850/60 text-emerald-700 dark:text-emerald-400',
    glow: 'bg-emerald-500/10 dark:bg-emerald-500/15',
  },
  amber: {
    pill: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-850/60 text-amber-800 dark:text-amber-400',
    glow: 'bg-amber-500/10 dark:bg-amber-500/15',
  },
  neutral: {
    pill: 'bg-zinc-100 dark:bg-zinc-850/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300',
    glow: 'bg-zinc-400/10 dark:bg-zinc-500/10',
  },
} as const;

/**
 * Shared masthead for every inner page. Keeps page identity consistent without
 * repeating a wall of marketing copy — the body of each page carries the detail.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  description,
  aside,
  highlights,
  tone = 'emerald',
}) => {
  const reduceMotion = useReducedMotion();
  const palette = TONES[tone];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-sand-50 to-sand-100 dark:from-charcoal-950 dark:via-charcoal-950 dark:to-charcoal-900 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="absolute inset-0 modern-grid-pattern pointer-events-none opacity-60 dark:opacity-40" />
      <div
        className={`absolute -top-24 right-0 w-[420px] h-[260px] ${palette.glow} blur-[110px] rounded-full pointer-events-none`}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10 sm:pt-16 sm:pb-14">
        <div className={`grid grid-cols-1 ${aside ? 'lg:grid-cols-12 gap-8 lg:gap-12 items-end' : ''}`}>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0.12 } : { duration: 0.45, ease: [0.21, 1, 0.36, 1] }}
            className={aside ? 'lg:col-span-7' : ''}
          >
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${palette.pill}`}
            >
              {eyebrow}
            </span>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-zinc-950 dark:text-white mt-4 leading-[1.08]">
              {title}
            </h1>

            {description && (
              <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                {description}
              </p>
            )}

            {highlights && highlights.length > 0 && (
              <ScrollReveal delay={0.1}>
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                  {highlights.map((point) => (
                    <li
                      key={point}
                      className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {point}
                    </li>
                  ))}
                </ul>
              </ScrollReveal>
            )}
          </motion.div>

          {aside && <div className="lg:col-span-5">{aside}</div>}
        </div>
      </div>
    </section>
  );
};
