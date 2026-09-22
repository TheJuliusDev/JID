import React, { useState, useMemo } from 'react';
import { MarketplaceItem, PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { 
  PlusCircle, 
  Eye, 
  Heart, 
  Zap, 
  Trash2, 
  PauseCircle, 
  PlayCircle, 
  ExternalLink, 
  Clock, 
  Package, 
  Building 
} from 'lucide-react';

interface MyListingsViewProps {
  onOpenCreate: () => void;
  onOpenBoost: (item: MarketplaceItem | PropertyListing) => void;
  onSelectItem: (item: MarketplaceItem) => void;
  onSelectProperty: (property: PropertyListing) => void;
}

export const MyListingsView: React.FC<MyListingsViewProps> = ({
  onOpenCreate,
  onOpenBoost,
  onSelectItem,
  onSelectProperty
}) => {
  const { 
    marketplaceItems, 
    propertyListings, 
    togglePauseListing, 
    deleteListing 
  } = useData();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paused'>('all');

  // Filter items owned by current user
  const userItems = useMemo(() => {
    const userId = user?.id || 'user-julius-adeyemi';
    return marketplaceItems.filter(item => item.userId === userId || item.seller.name === user?.fullName);
  }, [marketplaceItems, user]);

  const userProperties = useMemo(() => {
    const userId = user?.id || 'user-julius-adeyemi';
    return propertyListings.filter(p => p.userId === userId || p.landlord.name === user?.fullName);
  }, [propertyListings, user]);

  // Combined listings
  const combinedListings = useMemo(() => {
    const list: Array<
      | { type: 'marketplace'; data: MarketplaceItem }
      | { type: 'property'; data: PropertyListing }
    > = [
      ...userItems.map(item => ({ type: 'marketplace' as const, data: item })),
      ...userProperties.map(prop => ({ type: 'property' as const, data: prop }))
    ];

    if (activeTab === 'all') return list;
    return list.filter(item => item.data.status === activeTab);
  }, [userItems, userProperties, activeTab]);

  // Aggregate stats
  const totalViews = [...userItems, ...userProperties].reduce((acc, curr) => acc + curr.viewsCount, 0);
  const totalSaves = [...userItems, ...userProperties].reduce((acc, curr) => acc + curr.savesCount, 0);
  const activeBoostsCount = [...userItems, ...userProperties].filter(i => i.isBoosted).length;

  const calculateHoursLeft = (boostedUntil?: string) => {
    if (!boostedUntil) return '23h 42m';
    const diffMs = new Date(boostedUntil).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display tracking-tight">
            Manage My Listings
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Track student inquiries, boost listing reach, and manage your active campus inventory.
          </p>
        </div>

        <button
          onClick={onOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-600/25 transition-all text-sm flex-shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-5 h-5" />
          Create New Listing
        </button>
      </div>

      {/* Aggregate Performance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Active Ads</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1 font-display">
            {userItems.filter(i => i.status === 'active').length + userProperties.filter(p => p.status === 'active').length}
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Student Views</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1 font-display">
            {totalViews}
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Student Bookmarks</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1 font-display">
            {totalSaves}
          </p>
        </div>

        <div className="p-5 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800/60 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Active Boosts</p>
            <Zap className="w-4 h-4 text-orange-600 fill-current" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-orange-600 dark:text-orange-400 mt-1 font-display">
            {activeBoostsCount}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        {(['all', 'active', 'paused'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {tab} Listings
          </button>
        ))}
      </div>

      {/* Listings List */}
      {combinedListings.length > 0 ? (
        <div className="space-y-4">
          {combinedListings.map(({ type, data }) => (
            <div
              key={data.id}
              className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              {/* Item Info Left */}
              <div 
                onClick={() => {
                  if (type === 'marketplace') onSelectItem(data as MarketplaceItem);
                  else onSelectProperty(data as PropertyListing);
                }}
                className="flex items-center gap-4 cursor-pointer flex-1 min-w-0"
              >
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
                  <img src={data.images[0]} alt={data.title} className="w-full h-full object-cover" />
                  {data.isBoosted && (
                    <div className="absolute top-1 left-1 p-1 bg-amber-500 rounded-full text-white">
                      <Zap className="w-2.5 h-2.5 fill-current" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {type === 'marketplace' ? 'Marketplace' : 'Accommodation'}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                      data.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {data.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base truncate hover:text-orange-600 transition-colors">
                    {data.title}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-bold text-orange-600 dark:text-orange-400 font-display">
                      {BRAND_CONFIG.currency.format('price' in data ? data.price : data.pricePerYear)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {data.viewsCount} views
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" />
                      {data.savesCount} saves
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Right */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
                {/* Boost Button */}
                {data.isBoosted ? (
                  <div className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                    <span>Boosted ({calculateHoursLeft(data.boostedUntil)})</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onOpenBoost(data)}
                    className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    Boost (Free Ads)
                  </button>
                )}

                {/* Pause/Resume */}
                <button
                  onClick={() => togglePauseListing(type, data.id)}
                  className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                  title={data.status === 'active' ? 'Pause listing' : 'Activate listing'}
                >
                  {data.status === 'active' ? (
                    <PauseCircle className="w-5 h-5 text-amber-600" />
                  ) : (
                    <PlayCircle className="w-5 h-5 text-emerald-600" />
                  )}
                </button>

                {/* Delete */}
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this listing?')) {
                      deleteListing(type, data.id);
                    }
                  }}
                  className="p-2 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                  title="Delete listing"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 flex items-center justify-center">
            <Package className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              You haven&apos;t posted any listings yet
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Have textbooks, gadgets, hostel furniture, or a room to sublet? Post it in seconds and reach thousands of OAU students.
            </p>
          </div>
          <button
            onClick={onOpenCreate}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
          >
            Post Your First Listing
          </button>
        </div>
      )}
    </div>
  );
};
