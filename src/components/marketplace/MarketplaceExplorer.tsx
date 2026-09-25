import React, { useState, useEffect, useCallback } from 'react';
import { MarketplaceItem } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { listMarketplace, MarketplaceQuery } from '../../services/database';
import { MarketplaceCard } from './MarketplaceCard';
import {
  Search,
  SlidersHorizontal,
  PlusCircle,
  X,
  Sparkles,
  Smartphone,
  Laptop,
  BookOpen,
  Shirt,
  Armchair,
  PenTool,
  Package,
  Tv,
  ArrowUpDown,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface MarketplaceExplorerProps {
  onOpenCreateListing: () => void;
  onSelectItem: (item: MarketplaceItem) => void;
  onOpenProfile: (username: string) => void;
}

type SortKey = 'boosted' | 'newest' | 'price-asc' | 'price-desc';
const PAGE_SIZE = 24;

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'Smartphone': return <Smartphone className="w-4 h-4" />;
    case 'Laptop': return <Laptop className="w-4 h-4" />;
    case 'BookOpen': return <BookOpen className="w-4 h-4" />;
    case 'Shirt': return <Shirt className="w-4 h-4" />;
    case 'Armchair': return <Armchair className="w-4 h-4" />;
    case 'PenTool': return <PenTool className="w-4 h-4" />;
    case 'Package': return <Package className="w-4 h-4" />;
    case 'Tv': return <Tv className="w-4 h-4" />;
    default: return <Sparkles className="w-4 h-4" />;
  }
};

const CardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden animate-pulse">
    <div className="aspect-[4/3] w-full bg-zinc-200 dark:bg-zinc-800" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
      <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
      <div className="h-8 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
    </div>
  </div>
);

export const MarketplaceExplorer: React.FC<MarketplaceExplorerProps> = ({
  onOpenCreateListing,
  onSelectItem,
  onOpenProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('boosted');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Debounce the free-text search so we don't hit the DB on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const buildQuery = useCallback(
    (offset: number): MarketplaceQuery => ({
      search: debouncedSearch || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      condition: selectedCondition !== 'all' ? selectedCondition : undefined,
      location: selectedLocation !== 'all' ? selectedLocation : undefined,
      sort: sortBy,
      limit: PAGE_SIZE,
      offset,
    }),
    [debouncedSearch, selectedCategory, selectedCondition, selectedLocation, sortBy]
  );

  // Reload the first page whenever the query changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listMarketplace(buildQuery(0))
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[marketplace] load failed', e);
        setError('We couldn’t load listings right now. Please check your connection and try again.');
        setItems([]);
        setHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildQuery, reloadNonce]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const rows = await listMarketplace(buildQuery(items.length));
      setItems((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      console.error('[marketplace] load more failed', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const activeFiltersCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedCondition !== 'all' ? 1 : 0) +
    (selectedLocation !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedCondition('all');
    setSelectedLocation('all');
    setSearchQuery('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-full mb-2">
            <span>Great Ife Campus Trade</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-white font-display tracking-tight">
            Student Marketplace
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl text-sm sm:text-base">
            Trade electronics, laptops, phones, past questions, and hostel gear directly with fellow OAU students without middleman markups.
          </p>
        </div>

        <button
          onClick={onOpenCreateListing}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all text-sm flex-shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-5 h-5" />
          Sell an Item
        </button>
      </div>

      {/* Search & controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search MacBooks, textbooks, fans, phones, Awo study desks..."
              className="w-full pl-12 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 dark:focus:ring-emerald-500/50 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-52">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="w-full appearance-none pl-4 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 cursor-pointer shadow-sm"
              >
                <option value="boosted">Featured / Boosted First</option>
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
              <ArrowUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            <button
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
              className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all ${
                activeFiltersCount > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {BRAND_CONFIG.categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm scale-[1.02]'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-700'
                }`}
              >
                {getCategoryIcon(cat.icon)}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filters drawer */}
        {isFilterDrawerOpen && (
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Item Condition
              </label>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">All Conditions</option>
                {BRAND_CONFIG.itemConditions.map((cond) => (
                  <option key={cond} value={cond}>{cond}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Campus Hall or Area
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">All Halls & Off-Campus</option>
                <optgroup label="Undergraduate Halls">
                  {BRAND_CONFIG.campusLocations.halls.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </optgroup>
                <optgroup label="Off-Campus Axis">
                  {BRAND_CONFIG.campusLocations.offCampusAreas.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full py-2.5 px-4 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl text-xs font-semibold transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Result meta */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <div>
          {loading ? (
            'Loading campus listings…'
          ) : (
            <>
              Showing <span className="font-bold text-zinc-900 dark:text-zinc-100">{items.length}</span> campus listing{items.length === 1 ? '' : 's'}
              {debouncedSearch && <span> for &ldquo;{debouncedSearch}&rdquo;</span>}
              {hasMore && <span> (scroll for more)</span>}
            </>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            Clear active filters
          </button>
        )}
      </div>

      {/* Grid / states */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Something went wrong</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setReloadNonce((n) => n + 1)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow transition-all"
          >
            Retry
          </button>
        </div>
      ) : items.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => (
              <MarketplaceCard
                key={item.id}
                item={item}
                onClick={() => onSelectItem(item)}
                onOpenProfile={onOpenProfile}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-700 text-zinc-800 dark:text-zinc-200 font-semibold text-sm rounded-2xl transition-all disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? 'Loading…' : 'Load more listings'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <Package className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {activeFiltersCount > 0 || debouncedSearch ? 'No items match your criteria' : 'No listings yet'}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {activeFiltersCount > 0 || debouncedSearch
                ? 'Try adjusting your search query, selecting another category, or clearing location filters.'
                : 'Be the first to list an item for fellow students on Great Ife campus.'}
            </p>
          </div>
          {activeFiltersCount > 0 || debouncedSearch ? (
            <button
              onClick={resetFilters}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow transition-all"
            >
              Reset Filters
            </button>
          ) : (
            <button
              onClick={onOpenCreateListing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow transition-all"
            >
              Post the first listing
            </button>
          )}
        </div>
      )}
    </div>
  );
};
