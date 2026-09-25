import React, { useState, useEffect, useCallback } from 'react';
import { PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { listProperties, PropertyQuery } from '../../services/database';
import { PropertyCard } from './PropertyCard';
import {
  Search,
  Home,
  SlidersHorizontal,
  X,
  MapPin,
  ArrowUpDown,
  Building,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface AccommodationExplorerProps {
  onOpenCreateListing: () => void;
  onSelectProperty: (property: PropertyListing) => void;
  onOpenProfile: (username: string) => void;
}

type SortKey = 'boosted' | 'newest' | 'price-asc' | 'price-desc';
const PAGE_SIZE = 24;

const CardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden animate-pulse">
    <div className="aspect-[16/10] w-full bg-zinc-200 dark:bg-zinc-800" />
    <div className="p-5 space-y-3">
      <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
      <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
      <div className="h-8 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
    </div>
  </div>
);

export const AccommodationExplorer: React.FC<AccommodationExplorerProps> = ({
  onOpenCreateListing,
  onSelectProperty,
  onOpenProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('boosted');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [items, setItems] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const buildQuery = useCallback(
    (offset: number): PropertyQuery => ({
      search: debouncedSearch || undefined,
      area: selectedArea !== 'all' ? selectedArea : undefined,
      roomType: selectedRoomType !== 'all' ? selectedRoomType : undefined,
      availability: selectedAvailability !== 'all' ? selectedAvailability : undefined,
      sort: sortBy,
      limit: PAGE_SIZE,
      offset,
    }),
    [debouncedSearch, selectedArea, selectedRoomType, selectedAvailability, sortBy]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listProperties(buildQuery(0))
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[accommodation] load failed', e);
        setError('We couldn’t load lodges right now. Please check your connection and try again.');
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
      const rows = await listProperties(buildQuery(items.length));
      setItems((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      console.error('[accommodation] load more failed', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const activeFiltersCount =
    (selectedArea !== 'all' ? 1 : 0) +
    (selectedRoomType !== 'all' ? 1 : 0) +
    (selectedAvailability !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setSelectedArea('all');
    setSelectedRoomType('all');
    setSelectedAvailability('all');
    setSearchQuery('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold uppercase tracking-wider rounded-full mb-2">
            <span>OAU Student Accommodations</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-white font-display tracking-tight">
            Off-Campus Lodges & Roommates
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl text-sm sm:text-base">
            Find self-con apartments, shared flats, and reliable roommates across Asherifa, Damico, Mayfair, and Ede Road without exorbitant agent exploitation.
          </p>
        </div>

        <button
          onClick={onOpenCreateListing}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-2xl shadow-lg transition-all text-sm flex-shrink-0 cursor-pointer"
        >
          <Building className="w-5 h-5" />
          List a Lodge / Room
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
              placeholder="Search Sunview Lodge, Damico Road 7, Asherifa self-con, roommate..."
              className="w-full pl-12 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm"
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
                className="w-full appearance-none pl-4 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm"
              >
                <option value="boosted">Featured Lodges First</option>
                <option value="newest">Recently Listed</option>
                <option value="price-asc">Rent: Low to High</option>
                <option value="price-desc">Rent: High to Low</option>
              </select>
              <ArrowUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all ${
                activeFiltersCount > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Area pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {['all', ...BRAND_CONFIG.campusLocations.offCampusAreas].map((area) => {
            const isSelected = selectedArea === area;
            return (
              <button
                key={area}
                onClick={() => setSelectedArea(area)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-700'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span>{area === 'all' ? 'All OAU Neighborhoods' : area}</span>
              </button>
            );
          })}
        </div>

        {/* Filter drawer */}
        {isFilterOpen && (
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Room / Property Type
              </label>
              <select
                value={selectedRoomType}
                onChange={(e) => setSelectedRoomType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">All Room Types</option>
                {BRAND_CONFIG.accommodationTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Availability Status
              </label>
              <select
                value={selectedAvailability}
                onChange={(e) => setSelectedAvailability(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">Any Availability</option>
                {BRAND_CONFIG.availabilityStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full py-2.5 px-4 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-amber-600 rounded-xl text-xs font-semibold transition-colors"
              >
                Reset Housing Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Result meta */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <div>
          {loading ? (
            'Loading lodges & rooms…'
          ) : (
            <>
              Showing <span className="font-bold text-zinc-900 dark:text-zinc-100">{items.length}</span> lodge{items.length === 1 ? '' : 's'} &amp; room{items.length === 1 ? '' : 's'}
              {selectedArea !== 'all' && <span> in {selectedArea}</span>}
            </>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid / states */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
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
            className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-xs rounded-xl shadow transition-all"
          >
            Retry
          </button>
        </div>
      ) : items.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((prop) => (
              <PropertyCard
                key={prop.id}
                property={prop}
                onClick={() => onSelectProperty(prop)}
                onOpenProfile={onOpenProfile}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-700 text-zinc-800 dark:text-zinc-200 font-semibold text-sm rounded-2xl transition-all disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? 'Loading…' : 'Load more lodges'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Home className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {activeFiltersCount > 0 || debouncedSearch ? 'No lodges found for this selection' : 'No lodges listed yet'}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {activeFiltersCount > 0 || debouncedSearch
                ? 'Try selecting another neighborhood like Asherifa or Damico, or clearing your room type filters.'
                : 'Be the first to list a lodge or find a roommate for fellow OAU students.'}
            </p>
          </div>
          {activeFiltersCount > 0 || debouncedSearch ? (
            <button
              onClick={resetFilters}
              className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-xs rounded-xl shadow transition-all"
            >
              Reset Filters
            </button>
          ) : (
            <button
              onClick={onOpenCreateListing}
              className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-xs rounded-xl shadow transition-all"
            >
              List the first lodge
            </button>
          )}
        </div>
      )}
    </div>
  );
};
