import React, { useEffect, useMemo, useState } from 'react';
import { MarketplaceItem, PropertyListing, ViewType } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { listMarketplace, listProperties, listMarketplaceByUser, listPropertiesByUser } from '../../services/database';
import { MarketplaceCard } from '../marketplace/MarketplaceCard';
import { PropertyCard } from '../accommodation/PropertyCard';
import {
  ShoppingBag,
  Heart,
  Eye,
  MessageSquare,
  Bell,
  Zap,
  PlusCircle,
  Sparkles,
  TrendingUp,
  Loader2,
  PackageOpen,
} from 'lucide-react';

interface StudentDashboardProps {
  onNavigate: (view: ViewType) => void;
  onSelectItem: (item: MarketplaceItem) => void;
  onSelectProperty: (property: PropertyListing) => void;
  onOpenCreate: () => void;
  onOpenBoost: (item: MarketplaceItem | PropertyListing) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onNavigate,
  onSelectItem,
  onSelectProperty,
  onOpenCreate,
  onOpenBoost,
}) => {
  const { user } = useAuth();
  const { saved, conversations, notifications, unreadMessagesCount, unreadNotificationsCount } = useData();

  const [myItems, setMyItems] = useState<MarketplaceItem[]>([]);
  const [myProps, setMyProps] = useState<PropertyListing[]>([]);
  const [recentItems, setRecentItems] = useState<MarketplaceItem[]>([]);
  const [recommendedProps, setRecommendedProps] = useState<PropertyListing[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = user?.fullName?.split(' ')[0] || 'there';

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoadingMine(true);
    setLoadingFeed(true);

    (async () => {
      try {
        const [mine, myProperties] = await Promise.all([
          listMarketplaceByUser(user.id),
          listPropertiesByUser(user.id),
        ]);
        if (cancelled) return;
        setMyItems(mine);
        setMyProps(myProperties);
      } catch (err) {
        if (!cancelled) console.error('[dashboard] my listings failed', err);
      } finally {
        if (!cancelled) setLoadingMine(false);
      }
    })();

    (async () => {
      try {
        const [items, props] = await Promise.all([
          listMarketplace({ limit: 4, sort: 'newest' }),
          listProperties({ limit: 3, sort: 'newest' }),
        ]);
        if (cancelled) return;
        setRecentItems(items);
        setRecommendedProps(props);
      } catch (err) {
        if (!cancelled) console.error('[dashboard] feed failed', err);
      } finally {
        if (!cancelled) setLoadingFeed(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const myListingsCount = myItems.length + myProps.length;
  const totalViews = useMemo(
    () => [...myItems, ...myProps].reduce((sum, l) => sum + (l.viewsCount || 0), 0),
    [myItems, myProps]
  );

  const activeMyListings = useMemo(
    () =>
      [...myItems, ...myProps]
        .filter((l) => l.status === 'active')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 3),
    [myItems, myProps]
  );

  const firstUnread = notifications.find((n) => !n.isRead);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Greeting */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white rounded-3xl border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            {(user?.department || user?.level) && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 text-emerald-400 rounded-full text-xs font-semibold backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{[user?.department, user?.level].filter(Boolean).join(' • ')}</span>
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight">
              {greeting}, {firstName}.
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl">
              Welcome to your campus hub at {BRAND_CONFIG.institution.sobriquet}. Track your listings, saved lodges, messages, and campus trade.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenCreate}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Post New Ad
            </button>
            <button
              onClick={() => onNavigate('marketplace')}
              className="px-5 py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-2xl text-xs sm:text-sm backdrop-blur-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              Browse Market
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('my-listings')}
          className="text-left p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-emerald-400 dark:hover:border-emerald-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">My Listings</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display">
            {loadingMine ? '—' : myListingsCount}
          </p>
          <span className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1 group-hover:text-emerald-600 transition-colors">
            Manage ads &rarr;
          </span>
        </button>

        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Views</span>
            <Eye className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display">
            {loadingMine ? '—' : totalViews}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> Across your ads
          </span>
        </div>

        <button
          onClick={() => onNavigate('saved')}
          className="text-left p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-rose-400 dark:hover:border-rose-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Saved</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display">{saved.length}</p>
          <span className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1 group-hover:text-rose-500 transition-colors">
            View saved &rarr;
          </span>
        </button>

        <button
          onClick={() => onNavigate('messages')}
          className="text-left p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Messages</span>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display">{conversations.length}</p>
            {unreadMessagesCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full">
                {unreadMessagesCount} new
              </span>
            )}
          </div>
          <span className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1 group-hover:text-blue-500 transition-colors">
            Open chat &rarr;
          </span>
        </button>
      </div>

      {/* Unread notification banner */}
      {firstUnread && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200 truncate">{firstUnread.title}</p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 truncate">{firstUnread.message}</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            {unreadNotificationsCount} unread
          </span>
        </div>
      )}

      {/* My active listings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">Your Active Listings</h2>
            <p className="text-xs text-zinc-500">Boost a listing to reach more students across OAU</p>
          </div>
          {myListingsCount > 0 && (
            <button
              onClick={() => onNavigate('my-listings')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Manage all ({myListingsCount}) &rarr;
            </button>
          )}
        </div>

        {loadingMine ? (
          <DashboardLoading />
        ) : activeMyListings.length === 0 ? (
          <div className="text-center py-12 px-6 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 mb-4">
              <PackageOpen className="w-7 h-7" />
            </div>
            <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white mb-1">No active listings yet</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">Post your first item or lodge to start trading on JID.</p>
            <button
              onClick={onOpenCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Post a listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMyListings.map((listing) => {
              const isProperty = 'roomType' in listing;
              return (
                <div key={listing.id} className="relative group">
                  {isProperty ? (
                    <PropertyCard property={listing as PropertyListing} onClick={() => onSelectProperty(listing as PropertyListing)} />
                  ) : (
                    <MarketplaceCard item={listing as MarketplaceItem} onClick={() => onSelectItem(listing as MarketplaceItem)} />
                  )}
                  {!listing.isBoosted && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenBoost(listing);
                      }}
                      className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-full shadow-lg transition-all cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      Boost
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent marketplace activity */}
      <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">Recent Marketplace Activity</h2>
            <p className="text-xs text-zinc-500">Fresh listings posted by students across OAU halls</p>
          </div>
          <button
            onClick={() => onNavigate('marketplace')}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            View all &rarr;
          </button>
        </div>

        {loadingFeed ? (
          <DashboardLoading />
        ) : recentItems.length === 0 ? (
          <EmptyRow label="No marketplace listings yet. Be the first to post one." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentItems.map((item) => (
              <MarketplaceCard key={item.id} item={item} onClick={() => onSelectItem(item)} />
            ))}
          </div>
        )}
      </div>

      {/* Recommended accommodation */}
      <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">Recommended Accommodation</h2>
            <p className="text-xs text-zinc-500">Verified student lodges in Asherifa, Damico & Mayfair</p>
          </div>
          <button
            onClick={() => onNavigate('accommodation')}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            Explore lodges &rarr;
          </button>
        </div>

        {loadingFeed ? (
          <DashboardLoading variant="thirds" />
        ) : recommendedProps.length === 0 ? (
          <EmptyRow label="No accommodation listings yet. Post a lodge to get started." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendedProps.map((prop) => (
              <PropertyCard key={prop.id} property={prop} onClick={() => onSelectProperty(prop)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardLoading: React.FC<{ variant?: 'quarters' | 'thirds' }> = ({ variant = 'quarters' }) => {
  const count = variant === 'thirds' ? 3 : 4;
  const gridClass =
    variant === 'thirds'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6';
  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden animate-pulse">
          <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-800" />
          <div className="p-4 space-y-3">
            <div className="h-4 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded" />
            <div className="h-3 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

const EmptyRow: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-3 py-10 text-sm text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
    <Loader2 className="w-4 h-4 text-zinc-300" />
    {label}
  </div>
);
