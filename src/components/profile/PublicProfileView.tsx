import React, { useState, useEffect } from 'react';
import { MarketplaceItem, PropertyListing, PublicProfile } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import {
  getPublicProfileByUsername,
  listMarketplaceByUser,
  listPropertiesByUser,
} from '../../services/database';
import { useAuth } from '../../context/AuthContext';
import { StarRating } from '../common/StarRating';
import { VendorReviews } from '../reviews/VendorReviews';
import {
  ArrowLeft,
  MapPin,
  GraduationCap,
  MessageSquare,
  Loader2,
  UserX,
  ShoppingBag,
  Home,
  Store,
  CalendarDays,
} from 'lucide-react';

/** Structurally compatible with App's Seller / handleStartChat signature. */
type ChatSeller = {
  id: string;
  username?: string;
  name?: string;
  fullName?: string;
  avatarUrl?: string;
};

interface PublicProfileViewProps {
  username: string;
  onBack: () => void;
  onSelectItem: (item: MarketplaceItem) => void;
  onSelectProperty: (property: PropertyListing) => void;
  onStartChat: (seller: ChatSeller, item: MarketplaceItem | PropertyListing) => void;
}

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({
  username,
  onBack,
  onSelectItem,
  onSelectProperty,
  onStartChat,
}) => {
  const { user } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<'items' | 'lodges'>('items');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const p = await getPublicProfileByUsername(username);
        if (cancelled) return;
        if (!p) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setProfile(p);
        const [mkt, props] = await Promise.all([
          listMarketplaceByUser(p.id),
          listPropertiesByUser(p.id),
        ]);
        if (cancelled) return;
        // Public storefront shows only live listings.
        setItems(mkt.filter((i) => i.status === 'active'));
        setProperties(props.filter((pl) => pl.status === 'active'));
        setTab(mkt.some((i) => i.status === 'active') || !props.some((pl) => pl.status === 'active') ? 'items' : 'lodges');
      } catch (err) {
        if (!cancelled) {
          console.error('[public-profile] load failed', err);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const isOwnProfile = user?.id === profile?.id;

  const handleMessage = () => {
    if (!profile) return;
    const seller: ChatSeller = {
      id: profile.id,
      username: profile.username,
      name: profile.fullName,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
    };
    const contextListing = items[0] || properties[0];
    if (contextListing) onStartChat(seller, contextListing);
  };

  const hasContactListing = items.length > 0 || properties.length > 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
        <p className="text-sm">Loading profile…</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
          <UserX className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white font-display">Profile not found</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            We couldn’t find a student with the username @{username}.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow cursor-pointer"
        >
          Back to marketplace
        </button>
      </div>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-emerald-100 dark:bg-emerald-950 flex-shrink-0 flex items-center justify-center text-3xl font-black text-emerald-700 dark:text-emerald-300 border-2 border-emerald-200 dark:border-emerald-800">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
            ) : (
              profile.fullName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-zinc-950 dark:text-white font-display">{profile.fullName}</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full">
                <Store className="w-3 h-3" />
                Campus Seller
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">@{profile.username}</p>

            <div className="flex items-center gap-4 flex-wrap text-xs text-zinc-600 dark:text-zinc-300 pt-1">
              {profile.reviewCount > 0 ? (
                <span className="flex items-center gap-1.5">
                  <StarRating value={profile.avgRating} size={14} />
                  <span className="font-bold text-zinc-900 dark:text-white">{profile.avgRating.toFixed(1)}</span>
                  <span className="text-zinc-400">({profile.reviewCount} reviews)</span>
                </span>
              ) : (
                <span className="text-zinc-400">No reviews yet</span>
              )}
              {(profile.department || profile.level) && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                  {[profile.department, profile.level].filter(Boolean).join(' • ')}
                </span>
              )}
              {profile.hallOrArea && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  {profile.hallOrArea}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                Joined {memberSince}
              </span>
            </div>

            {profile.bio && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed pt-1">{profile.bio}</p>
            )}
          </div>

          {!isOwnProfile && hasContactListing && (
            <button
              onClick={handleMessage}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl shadow-md transition-all cursor-pointer flex-shrink-0"
            >
              <MessageSquare className="w-4 h-4" />
              Message
            </button>
          )}
        </div>
      </div>

      {/* Listings */}
      <div className="space-y-5">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setTab('items')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === 'items'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Items ({items.length})
          </button>
          <button
            onClick={() => setTab('lodges')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === 'lodges'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            Lodges ({properties.length})
          </button>
        </div>

        {tab === 'items' ? (
          items.length === 0 ? (
            <EmptyGrid icon={ShoppingBag} label="No items for sale right now." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="group text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    {item.images[0] ? (
                      <img
                        src={item.images[0]}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{item.title}</p>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-500 font-display mt-0.5">
                      {BRAND_CONFIG.currency.format(item.price)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : properties.length === 0 ? (
          <EmptyGrid icon={Home} label="No accommodation listings right now." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((prop) => (
              <button
                key={prop.id}
                onClick={() => onSelectProperty(prop)}
                className="group text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  {prop.images[0] ? (
                    <img
                      src={prop.images[0]}
                      alt={prop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <Home className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                    {prop.roomType} • {prop.area}
                  </span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">{prop.title}</p>
                  <p className="text-sm font-black text-zinc-950 dark:text-white font-display mt-0.5">
                    {BRAND_CONFIG.currency.format(prop.pricePerYear)}
                    <span className="text-xs font-normal text-zinc-500"> / year</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8">
        <VendorReviews vendorId={profile.id} vendorName={profile.fullName} />
      </div>
    </div>
  );
};

const EmptyGrid: React.FC<{ icon: React.ElementType; label: string }> = ({ icon: Icon, label }) => (
  <div className="text-center py-14 space-y-3">
    <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
      <Icon className="w-7 h-7" />
    </div>
    <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
  </div>
);
