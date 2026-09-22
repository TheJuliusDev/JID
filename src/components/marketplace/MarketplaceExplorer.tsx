import React, { useState, useMemo } from 'react';
import { MarketplaceItem, ListingCategory } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useData } from '../../context/DataContext';
import { MarketplaceCard } from './MarketplaceCard';
import { ListingDetailModal } from './ListingDetailModal';
import { 
  Search, 
  Filter, 
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
  ArrowUpDown
} from 'lucide-react';

interface MarketplaceExplorerProps {
  onOpenCreateListing: () => void;
  onStartChat: (seller: any, item: MarketplaceItem) => void;
  onOpenReport: (item: MarketplaceItem) => void;
  onOpenBoost: (item: MarketplaceItem) => void;
}

export const MarketplaceExplorer: React.FC<MarketplaceExplorerProps> = ({
  onOpenCreateListing,
  onStartChat,
  onOpenReport,
  onOpenBoost
}) => {
  const { marketplaceItems } = useData();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'boosted' | 'newest' | 'price-asc' | 'price-desc'>('boosted');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Active detail modal item
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);

  // Category icons mapper
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

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return marketplaceItems
      .filter(item => {
        if (item.status !== 'active') return false;

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchDesc = item.description.toLowerCase().includes(q);
          const matchLocation = item.location.toLowerCase().includes(q);
          const matchSeller = item.seller.name.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchLocation && !matchSeller) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory !== 'all' && item.category !== selectedCategory) {
          return false;
        }

        // Condition filter
        if (selectedCondition !== 'all' && item.condition !== selectedCondition) {
          return false;
        }

        // Location filter
        if (selectedLocation !== 'all' && !item.location.toLowerCase().includes(selectedLocation.toLowerCase())) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'boosted') {
          if (a.isBoosted && !b.isBoosted) return -1;
          if (!a.isBoosted && b.isBoosted) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'price-asc') {
          return a.price - b.price;
        }
        if (sortBy === 'price-desc') {
          return b.price - a.price;
        }
        return 0;
      });
  }, [marketplaceItems, searchQuery, selectedCategory, selectedCondition, selectedLocation, sortBy]);

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
      {/* Header section with Editorial Campus Vibe */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-xs font-bold uppercase tracking-wider rounded-full mb-2">
            <span>Great Ife Campus Trade</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-white font-display tracking-tight">
            Student Marketplace
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl text-sm sm:text-base">
            Trade electronics, laptops, phones, past questions, and hostel gear directly with verified OAU students without middleman markups.
          </p>
        </div>

        <button
          onClick={onOpenCreateListing}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-600/25 transition-all text-sm flex-shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-5 h-5" />
          Sell an Item
        </button>
      </div>

      {/* Search Bar & Category Navigation */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search MacBooks, textbooks, fans, phones, Awo study desks..."
              className="w-full pl-12 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-600/50 dark:focus:ring-orange-500/50 shadow-sm"
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

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-52">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full appearance-none pl-4 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-600/50 cursor-pointer shadow-sm"
              >
                <option value="boosted">Featured / Boosted First</option>
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
              <ArrowUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            {/* Filter Toggle Mobile */}
            <button
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
              className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all ${
                activeFiltersCount > 0
                  ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category Pill Bar */}
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

        {/* Expanded Filters Drawer / Panel */}
        {isFilterDrawerOpen && (
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
            {/* Condition Filter */}
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

            {/* Hall / Location Filter */}
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

            {/* Clear Filter Action */}
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full py-2.5 px-4 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 rounded-xl text-xs font-semibold transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Count & Active Tags */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <div>
          Showing <span className="font-bold text-zinc-900 dark:text-zinc-100">{filteredItems.length}</span> campus listings
          {searchQuery && <span> for &ldquo;{searchQuery}&rdquo;</span>}
        </div>
        {activeFiltersCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-orange-600 dark:text-orange-400 font-semibold hover:underline"
          >
            Clear active filters
          </button>
        )}
      </div>

      {/* Listings Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <MarketplaceCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
            <Package className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              No items match your criteria
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Try adjusting your search query, selecting another category, or clearing location filters.
            </p>
          </div>
          <button
            onClick={resetFilters}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs rounded-xl shadow transition-all"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <ListingDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onStartChat={onStartChat}
          onOpenReport={onOpenReport}
          onOpenBoost={onOpenBoost}
        />
      )}
    </div>
  );
};
