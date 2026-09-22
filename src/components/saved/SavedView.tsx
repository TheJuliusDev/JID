import React, { useState, useMemo } from 'react';
import { MarketplaceItem, PropertyListing } from '../../types';
import { useData } from '../../context/DataContext';
import { MarketplaceCard } from '../marketplace/MarketplaceCard';
import { PropertyCard } from '../accommodation/PropertyCard';
import { Heart, ShoppingBag, Building, Sparkles } from 'lucide-react';

interface SavedViewProps {
  onSelectItem: (item: MarketplaceItem) => void;
  onSelectProperty: (prop: PropertyListing) => void;
  onExploreMarketplace: () => void;
}

export const SavedView: React.FC<SavedViewProps> = ({
  onSelectItem,
  onSelectProperty,
  onExploreMarketplace
}) => {
  const { savedListings, marketplaceItems, propertyListings } = useData();
  const [activeFilter, setActiveFilter] = useState<'all' | 'marketplace' | 'property'>('all');

  // Hydrate saved items with current listings
  const savedItems = useMemo(() => {
    return savedListings
      .map(saved => {
        if (saved.listingType === 'marketplace') {
          const item = marketplaceItems.find(i => i.id === saved.listingId);
          return item ? { type: 'marketplace' as const, data: item } : null;
        } else {
          const prop = propertyListings.find(p => p.id === saved.listingId);
          return prop ? { type: 'property' as const, data: prop } : null;
        }
      })
      .filter((item): item is { type: 'marketplace'; data: MarketplaceItem } | { type: 'property'; data: PropertyListing } => item !== null)
      .filter(item => {
        if (activeFilter === 'all') return true;
        return item.type === activeFilter;
      });
  }, [savedListings, marketplaceItems, propertyListings, activeFilter]);

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

      {/* Grid */}
      {savedItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {savedItems.map((entry) => (
            <React.Fragment key={entry.data.id}>
              {entry.type === 'marketplace' ? (
                <MarketplaceCard
                  item={entry.data}
                  onClick={() => onSelectItem(entry.data)}
                />
              ) : (
                <PropertyCard
                  property={entry.data}
                  onClick={() => onSelectProperty(entry.data)}
                />
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
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              No saved listings yet
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Click the heart icon on any marketplace item or accommodation lodge to save it here for later.
            </p>
          </div>
          <button
            onClick={onExploreMarketplace}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
          >
            Explore Marketplace
          </button>
        </div>
      )}
    </div>
  );
};
