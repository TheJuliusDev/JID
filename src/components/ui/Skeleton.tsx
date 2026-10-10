/**
 * Skeleton placeholders.
 *
 * A spinner tells the user something is happening; a skeleton tells them what
 * is about to arrive and stops the page from jumping when it does. The shimmer
 * is transform-based (see `.jid-skeleton`) so it stays on the compositor, and
 * it is disabled entirely under `prefers-reduced-motion`.
 */

import React from 'react';

type SkeletonProps = {
  className?: string;
  children?: React.ReactNode;
};

export const SkeletonBlock: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`jid-skeleton rounded-lg ${className}`} aria-hidden="true" />
);

export const SkeletonCircle: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`jid-skeleton rounded-full ${className}`} aria-hidden="true" />
);

/** One to three muted bars, standing in for a heading plus body copy. */
export const SkeletonText: React.FC<SkeletonProps & { lines?: number }> = ({
  className = '',
  lines = 2,
}) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonBlock
        key={i}
        className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
      />
    ))}
  </div>
);

/**
 * Listing tile placeholder. Mirrors the real card's proportions so the grid
 * does not reflow when results land.
 */
export const ListingCardSkeleton: React.FC = () => (
  <div
    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden"
    aria-hidden="true"
  >
    <SkeletonBlock className="aspect-[4/3] w-full rounded-none" />
    <div className="p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <SkeletonBlock className="h-5 w-24" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-4/5" />
      </div>
      <div className="pt-3 mt-1 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2">
        <SkeletonCircle className="w-6 h-6" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
    </div>
  </div>
);

/** Row placeholder for lists: conversations, notifications, saved searches. */
export const ListRowSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`flex items-center gap-3 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${className}`}
    aria-hidden="true"
  >
    <SkeletonCircle className="w-11 h-11 flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <SkeletonBlock className="h-3.5 w-1/3" />
      <SkeletonBlock className="h-3 w-4/5" />
    </div>
  </div>
);

/** Wraps a group of skeletons and announces that content is loading. */
export const SkeletonGroup: React.FC<SkeletonProps & { label: string }> = ({
  label,
  className = '',
  children,
}) => (
  <div role="status" aria-busy="true" aria-live="polite" aria-label={label} className={className}>
    <span className="sr-only">{label}</span>
    {children}
  </div>
);
