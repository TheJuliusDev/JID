import React, { useMemo } from 'react';
import { MarketplaceItem, PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { MarketplaceCard } from '../marketplace/MarketplaceCard';
import { PropertyCard } from '../accommodation/PropertyCard';
import { 
  ShoppingBag, 
  Building, 
  Heart, 
  Eye, 
  MessageSquare, 
  Bell, 
  Zap, 
  PlusCircle, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  MapPin, 
  TrendingUp, 
  Clock 
} from 'lucide-react';

interface StudentDashboardProps {
  onNavigate: (view: any) => void;
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
  onOpenBoost
}) => {
  const { user } = useAuth();
  const { 
    marketplaceItems, 
    propertyListings, 
    savedListings, 
    conversations, 
    notifications,
    unreadMessagesCount,
    unreadNotificationsCount 
  } = useData();

  // Greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = user?.fullName.split(' ')[0] || 'Julius';

  // Current user's active listings
  const myActiveListings = useMemo(() => {
    const userId = user?.id || 'user-julius-adeyemi';
    const items = marketplaceItems.filter(i => i.userId === userId || i.seller.name === user?.fullName);
    const props = propertyListings.filter(p => p.userId === userId || p.landlord.name === user?.fullName);
    return [...items, ...props];
  }, [marketplaceItems, propertyListings, user]);

  // Aggregate metrics
  const totalViews = myActiveListings.reduce((sum, item) => sum + item.viewsCount, 0);

  // Recommendations
  const recentMarketItems = marketplaceItems.slice(0, 4);
  const recommendedProperties = propertyListings.slice(0, 3);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Top Personalized Greeting Bar */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white rounded-3xl border border-zinc-800 shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 text-orange-400 rounded-full text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{user?.department} • {user?.level}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight">
              {greeting}, {firstName}.
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl">
              Welcome to your campus life hub at {BRAND_CONFIG.institution.sobriquet}. Track your live listings, saved lodges, messages, and campus trade.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenCreate}
              className="px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-lg shadow-orange-600/25 transition-all flex items-center gap-2 cursor-pointer"
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Active Listings */}
        <div 
          onClick={() => onNavigate('my-listings')}
          className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-orange-400 dark:hover:border-orange-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">My Listings</span>
            <ShoppingBag className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display">
            {myActiveListings.length}
          </p>
          <span className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1 group-hover:text-orange-600 transition-colors">
            Manage ads &rarr;
          </span>
        </div>

        {/* Listing Views */}
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Views</span>
            <Eye className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display">
            {totalViews}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> Across your items
          </span>
        </div>

        {/* Saved Items */}
        <div 
          onClick={() => onNavigate('saved')}
          className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-rose-400 dark:hover:border-rose-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Saved Items</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display">
            {savedListings.length}
          </p>
          <span className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1 group-hover:text-rose-500 transition-colors">
            View saved &rarr;
          </span>
        </div>

        {/* Messages */}
        <div 
          onClick={() => onNavigate('messages')}
          className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Messages</span>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display">
              {conversations.length}
            </p>
            {unreadMessagesCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-600 text-white rounded-full">
                {unreadMessagesCount} unread
              </span>
            )}
          </div>
          <span className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1 group-hover:text-blue-500 transition-colors">
            Open chat &rarr;
          </span>
        </div>

        {/* Premium Status */}
        <div 
          onClick={() => onNavigate('premium')}
          className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl shadow-sm hover:border-amber-400 transition-all cursor-pointer group col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Plan Status</span>
            <Sparkles className="w-4 h-4 text-amber-500 fill-current" />
          </div>
          <p className="text-xl font-extrabold text-amber-900 dark:text-amber-200 font-display">
            {user?.isPremium ? 'Premium' : 'Free Member'}
          </p>
          <span className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1 mt-1 group-hover:underline">
            {user?.isPremium ? 'View perks &rarr;' : 'Upgrade now &rarr;'}
          </span>
        </div>
      </div>

      {/* Quick Notifications Banner */}
      {notifications.filter(n => !n.isRead).length > 0 && (
        <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-orange-950 dark:text-orange-200">
                {notifications.find(n => !n.isRead)?.title}
              </p>
              <p className="text-xs text-orange-800 dark:text-orange-300">
                {notifications.find(n => !n.isRead)?.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('my-listings')}
            className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex-shrink-0"
          >
            Check Status &rarr;
          </button>
        </div>
      )}

      {/* Recent Marketplace Activity Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">
              Recent Marketplace Activity
            </h2>
            <p className="text-xs text-zinc-500">Fresh listings posted by students across OAU halls</p>
          </div>
          <button
            onClick={() => onNavigate('marketplace')}
            className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            View All ({marketplaceItems.length}) &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {recentMarketItems.map((item) => (
            <MarketplaceCard
              key={item.id}
              item={item}
              onClick={() => onSelectItem(item)}
            />
          ))}
        </div>
      </div>

      {/* Recommended Accommodation Lodges */}
      <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">
              Recommended Accommodation
            </h2>
            <p className="text-xs text-zinc-500">Verified student lodges in Asherifa, Damico & Mayfair</p>
          </div>
          <button
            onClick={() => onNavigate('accommodation')}
            className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            Explore Lodges ({propertyListings.length}) &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recommendedProperties.map((prop) => (
            <PropertyCard
              key={prop.id}
              property={prop}
              onClick={() => onSelectProperty(prop)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
