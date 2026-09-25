import React, { useEffect, useMemo, useState } from 'react';
import { MarketplaceItem, PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import {
  listMarketplaceByUser,
  listPropertiesByUser,
  updateMarketplace,
  updateProperty,
  deleteMarketplace,
  deleteProperty,
} from '../../services/database';
import {
  PlusCircle,
  Eye,
  Heart,
  Zap,
  Trash2,
  PauseCircle,
  PlayCircle,
  Clock,
  Package,
  Loader2,
} from 'lucide-react';

interface MyListingsViewProps {
  onOpenCreate: () => void;
  onOpenBoost: (item: MarketplaceItem | PropertyListing) => void;
  onSelectItem: (item: MarketplaceItem) => void;
  onSelectProperty: (property: PropertyListing) => void;
}

type Combined =
  | { type: 'marketplace'; data: MarketplaceItem }
  | { type: 'property'; data: PropertyListing };

export const MyListingsView: React.FC<MyListingsViewProps> = ({
  onOpenCreate,
  onOpenBoost,
  onSelectItem,
  onSelectProperty,
}) => {
  const { user } = useAuth();

  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [props, setProps] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paused'>('all');

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [mine, myProps] = await Promise.all([
          listMarketplaceByUser(user.id),
          listPropertiesByUser(user.id),
        ]);
        if (cancelled) return;
        setItems(mine);
        setProps(myProps);
      } catch (err) {
        if (!cancelled) console.error('[my-listings] load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const combinedListings = useMemo(() => {
    const list: Combined[] = [
      ...items.map((item) => ({ type: 'marketplace' as const, data: item })),
      ...props.map((prop) => ({ type: 'property' as const, data: prop })),
    ];
    if (activeTab === 'all') return list;
    return list.filter((entry) => entry.data.status === activeTab);
  }, [items, props, activeTab]);

  const allOwned = useMemo(() => [...items, ...props], [items, props]);
  const totalViews = allOwned.reduce((acc, curr) => acc + (curr.viewsCount || 0), 0);
  const totalSaves = allOwned.reduce((acc, curr) => acc + (curr.savesCount || 0), 0);
  const activeBoostsCount = allOwned.filter((i) => i.isBoosted).length;
  const activeCount =
    items.filter((i) => i.status === 'active').length + props.filter((p) => p.status === 'active').length;

  const calculateHoursLeft = (boostedUntil?: string) => {
    if (!boostedUntil) return null;
    const diffMs = new Date(boostedUntil).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const handleTogglePause = async (entry: Combined) => {
    const next = entry.data.status === 'active' ? 'paused' : 'active';
    setBusyId(entry.data.id);
    try {
      if (entry.type === 'marketplace') {
        await updateMarketplace(entry.data.id, { status: next });
        setItems((prev) => prev.map((i) => (i.id === entry.data.id ? { ...i, status: next } : i)));
      } else {
        await updateProperty(entry.data.id, { status: next });
        setProps((prev) => prev.map((p) => (p.id === entry.data.id ? { ...p, status: next } : p)));
      }
    } catch (err) {
      console.error('[my-listings] status change failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (entry: Combined) => {
    if (!window.confirm('Delete this listing permanently? This cannot be undone.')) return;
    setBusyId(entry.data.id);
    try {
      if (entry.type === 'marketplace') {
        await deleteMarketplace(entry.data.id);
        setItems((prev) => prev.filter((i) => i.id !== entry.data.id));
      } else {
        await deleteProperty(entry.data.id);
        setProps((prev) => prev.filter((p) => p.id !== entry.data.id));
      }
    } catch (err) {
      console.error('[my-listings] delete failed', err);
    } finally {
      setBusyId(null);
    }
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
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all text-sm flex-shrink-0 cursor-pointer"
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
            {loading ? '—' : activeCount}
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Student Views</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1 font-display">
            {loading ? '—' : totalViews}
          </p>
        </div>

        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Student Bookmarks</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1 font-display">
            {loading ? '—' : totalSaves}
          </p>
        </div>

        <div className="p-5 bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-950/40 dark:to-amber-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Active Boosts</p>
            <Zap className="w-4 h-4 text-emerald-600 fill-current" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-display">
            {loading ? '—' : activeBoostsCount}
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
      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-400">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
      ) : combinedListings.length > 0 ? (
        <div className="space-y-4">
          {combinedListings.map((entry) => {
            const { type, data } = entry;
            const boostLeft = data.isBoosted ? calculateHoursLeft(data.boostedUntil) : null;
            const isBusy = busyId === data.id;
            return (
              <div
                key={data.id}
                className={`p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isBusy ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                {/* Item Info Left */}
                <div
                  onClick={() => {
                    if (type === 'marketplace') onSelectItem(data);
                    else onSelectProperty(data);
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
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          data.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {data.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base truncate hover:text-emerald-600 transition-colors">
                      {data.title}
                    </h3>

                    <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-display">
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
                  {/* Boost */}
                  {data.isBoosted ? (
                    <div className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Boosted{boostLeft ? ` (${boostLeft})` : ''}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onOpenBoost(data)}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      Boost
                    </button>
                  )}

                  {/* Pause/Resume */}
                  <button
                    onClick={() => handleTogglePause(entry)}
                    disabled={isBusy}
                    className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
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
                    onClick={() => handleDelete(entry)}
                    disabled={isBusy}
                    className="p-2 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                    title="Delete listing"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
            <Package className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {activeTab === 'all' ? "You haven't posted any listings yet" : `No ${activeTab} listings`}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Have textbooks, gadgets, hostel furniture, or a room to sublet? Post it in seconds and reach students across OAU.
            </p>
          </div>
          <button
            onClick={onOpenCreate}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
          >
            Post Your First Listing
          </button>
        </div>
      )}
    </div>
  );
};
