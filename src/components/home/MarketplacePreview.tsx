import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, PackageOpen, ShoppingBag, Store } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { BRAND_CONFIG } from '../../config/brand';
import { listMarketplace } from '../../services/database';
import type { MarketplaceItem } from '../../types';
import { MarketplaceCard } from '../marketplace/MarketplaceCard';
import { ScrollReveal } from '../ScrollReveal';

interface MarketplacePreviewProps {
  onOpenMarketplace: () => void;
  onOpenCreateListing: () => void;
  onOpenProfile: (username: string) => void;
}

/** Shared skeleton so the preview never flashes a half-built grid. */
const SkeletonGrid: React.FC<{ count: number }> = ({ count }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden animate-pulse"
      >
        <div className="aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-800" />
        <div className="p-4 space-y-3">
          <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2" />
          <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4" />
          <div className="h-5 bg-zinc-50 dark:bg-zinc-800/60 rounded w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Home page preview of the Marketplace. Shows real, live listings only — if the
 * feed is empty it says so rather than rendering placeholder products.
 */
export const MarketplacePreview: React.FC<MarketplacePreviewProps> = ({
  onOpenMarketplace,
  onOpenCreateListing,
  onOpenProfile,
}) => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMarketplace({ limit: 12, sort: 'newest' });
        if (!cancelled) setItems(rows);
      } catch (err) {
        if (!cancelled) console.error('[home] marketplace preview failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (category === 'all' ? items : items.filter((i) => i.category === category)).slice(0, 6),
    [items, category]
  );

  return (
    <section className="py-16 sm:py-20 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-sand-50 dark:bg-charcoal-950 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                <ShoppingBag className="w-3.5 h-3.5" />
                Marketplace
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-black text-zinc-950 dark:text-white tracking-tight mt-3">
                Fresh from the campus feed
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 max-w-xl">
                Newest student listings, priced in naira and ready to inspect in person.
              </p>
            </div>
            <button
              onClick={onOpenMarketplace}
              className="group inline-flex items-center gap-2 self-start md:self-auto px-5 py-3 bg-zinc-950 dark:bg-white hover:bg-emerald-600 dark:hover:bg-emerald-600 text-white dark:text-zinc-950 dark:hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-[0.98] cursor-pointer shadow-sm"
            >
              Browse all listings
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
            {BRAND_CONFIG.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-full shrink-0 transition-all cursor-pointer ${
                  category === cat.id
                    ? 'bg-zinc-950 dark:bg-emerald-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </ScrollReveal>

        {loading ? (
          <SkeletonGrid count={6} />
        ) : visible.length === 0 ? (
          <div className="text-center py-14 px-6 bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-3xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <PackageOpen className="w-7 h-7" />
            </div>
            <h3 className="font-display text-xl font-bold text-zinc-950 dark:text-white mb-1.5">
              {items.length === 0 ? 'No live listings yet' : 'Nothing in this category yet'}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-5">
              {items.length === 0
                ? 'The marketplace is empty right now. Post the first item and reach verified students across OAU.'
                : 'No live listings match this category at the moment. Browse everything or check back soon.'}
            </p>
            <button
              onClick={items.length === 0 ? onOpenCreateListing : onOpenMarketplace}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow cursor-pointer"
            >
              {items.length === 0 ? 'Post an item' : 'View all listings'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((item, index) => (
              <motion.div
                key={item.id}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={
                  reduceMotion
                    ? { duration: 0.12 }
                    : { duration: 0.45, delay: (index % 3) * 0.06, ease: [0.21, 1, 0.36, 1] }
                }
              >
                <MarketplaceCard item={item} onClick={onOpenMarketplace} onOpenProfile={onOpenProfile} />
              </motion.div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                Selling something? Anyone can list an item on JID.
              </span>
            </div>
            <button
              onClick={onOpenCreateListing}
              className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              Start selling
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
