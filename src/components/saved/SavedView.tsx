import React, { useEffect, useMemo, useState } from 'react';
import { MarketplaceItem, PropertyListing } from '../../types';
import { useData } from '../../context/DataContext';
import { getMarketplace, getProperty } from '../../services/database';
import { MarketplaceCard } from '../marketplace/MarketplaceCard';
import { PropertyCard } from '../accommodation/PropertyCard';
import { Heart, Loader2, BellRing, Bell, BellOff, Trash2, ArrowRight } from 'lucide-react';

interface SavedViewProps {
  onSelectItem: (item: MarketplaceItem) => void;
  onSelectProperty: (prop: PropertyListing) => void;
  onExploreMarketplace: () => void;
  onRunSearch: (type: 'marketplace' | 'property', filters: Record<string, string | number | boolean>) => void;
}

type SavedEntry =
  | { type: 'marketplace'; data: MarketplaceItem }
  | { type: 'property'; data: PropertyListing };

export const SavedView: React.FC<SavedViewProps> = ({
  onSelectItem,
  onSelectProperty,
  onExploreMarketplace,
  onRunSearch,
}) => {
  const { saved, savedSearches, deleteSavedSearch, toggleSavedSearchNotify } = useData();
  const [activeFilter, setActiveFilter] = useState<'all' | 'marketplace' | 'property'>('all');
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Hydrate the saved rows into their current listings (they may have changed or been removed).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const results = await Promise.all(
          saved.map(async (s): Promise<SavedEntry | null> => {
            if (s.listingType === 'marketplace') {
              const item = await getMarketplace(s.listingId);
              return item ? { type: 'marketplace', data: item } : null;
            }
            const prop = await getProperty(s.listingId);
            return prop ? { type: 'property', data: prop } : null;
          })
        );
        if (cancelled) return;
        setEntries(results.filter((e): e is SavedEntry => e !== null));
      } catch (err) {
        if (!cancelled) console.error('[saved] hydrate failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saved]);

  const savedItems = useMemo(
    () => (activeFilter === 'all' ? entries : entries.filter((e) => e.type === activeFilter)),
    [entries, activeFilter]
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display tracking-tight">
            Saved Listings
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Keep track of student laptops, gadgets, and off-campus lodges you want to inspect.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {(['all', 'marketplace', 'property'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                activeFilter === tab
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {tab === 'all' ? 'All Bookmarks' : tab === 'marketplace' ? 'Items' : 'Accommodations'}
            </button>
          ))}
        </div>
      </div>

      {/* Saved searches & alerts */}
      {savedSearches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-display tracking-tight">
              Saved Searches &amp; Alerts
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedSearches.map((s) => (
              <div
                key={s.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                      {s.listingType === 'marketplace' ? 'Marketplace' : 'Accommodation'}
                    </span>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1.5 break-words">
                      {s.label}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteSavedSearch(s.id)}
                    title="Delete saved search"
                    aria-label="Delete saved search"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRunSearch(s.listingType, s.filters)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                  >
                    Run search
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleSavedSearchNotify(s.id, !s.notify)}
                    aria-pressed={s.notify}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      s.notify
                        ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {s.notify ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    {s.notify ? 'Alerts on' : 'Alerts off'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-400">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
      ) : savedItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {savedItems.map((entry) => (
            <React.Fragment key={entry.data.id}>
              {entry.type === 'marketplace' ? (
                <MarketplaceCard item={entry.data} onClick={() => onSelectItem(entry.data)} />
              ) : (
                <PropertyCard property={entry.data} onClick={() => onSelectProperty(entry.data)} />
              )}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center">
            <Heart className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">No saved listings yet</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Tap the heart icon on any marketplace item or accommodation lodge to save it here for later.
            </p>
          </div>
          <button
            onClick={onExploreMarketplace}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
          >
            Explore Marketplace
          </button>
        </div>
      )}
    </div>
  );
};
