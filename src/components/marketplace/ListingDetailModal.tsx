import React, { useState } from 'react';
import { MarketplaceItem } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useData } from '../../context/DataContext';
import { 
  X, 
  MapPin, 
  Heart, 
  Share2, 
  ShieldCheck, 
  Sparkles, 
  Zap, 
  MessageSquare, 
  Phone, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

interface ListingDetailModalProps {
  item: MarketplaceItem | null;
  onClose: () => void;
  onStartChat: (seller: MarketplaceItem['seller'] & { id: string }, item: MarketplaceItem) => void;
  onOpenReport: (item: MarketplaceItem) => void;
  onOpenBoost?: (item: MarketplaceItem) => void;
  isOwner?: boolean;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  item,
  onClose,
  onStartChat,
  onOpenReport,
  onOpenBoost,
  isOwner = false
}) => {
  if (!item) return null;

  const { toggleSaveItem, isItemSaved } = useData();
  const saved = isItemSaved('marketplace', item.id);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const whatsappPhone = item.phoneOrWhatsapp?.replace(/[^0-9]/g, '') || '2348123456789';
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
    `Hello ${item.seller.name}, I saw your listing for "${item.title}" on JID OAU Campus Marketplace. Is it still available for inspection?`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      {/* Modal Card */}
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 rounded-full">
              {item.category}
            </span>
            {item.isBoosted && (
              <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-500 text-white rounded-full">
                <Zap className="w-3 h-3 fill-current" />
                Boosted
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              title="Share listing"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleSaveItem('marketplace', item.id)}
              className={`p-2 rounded-full transition-colors ${
                saved
                  ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/40'
                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title={saved ? 'Remove bookmark' : 'Bookmark item'}
            >
              <Heart className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {copied && (
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-sm font-medium rounded-xl text-center">
              Listing link copied to clipboard!
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Image Gallery */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <img
                  src={item.images[activeImageIndex] || item.images[0]}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 text-xs font-semibold bg-zinc-950/80 text-white backdrop-blur-md rounded-lg border border-white/10">
                    {item.condition}
                  </span>
                </div>
              </div>

              {/* Thumbnails */}
              {item.images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {item.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                        activeImageIndex === idx
                          ? 'border-orange-600 scale-95 shadow-md'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Safety Notice */}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Great Ife Campus Safety Guide
                </p>
                <p className="leading-relaxed">
                  Always inspect the item physically at public campus spots like SUB, Hezekiah Library, or Amphitheatre. Never transfer money before seeing the item.
                </p>
              </div>
            </div>

            {/* Right Column: Information & Actions */}
            <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold text-zinc-950 dark:text-white leading-tight font-display">
                    {item.title}
                  </h1>
                  <div className="mt-2 text-3xl font-extrabold text-orange-600 dark:text-orange-500 font-display">
                    {BRAND_CONFIG.currency.format(item.price)}
                  </div>
                </div>

                {/* Campus Location & Meeting Point */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <MapPin className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    <span className="font-semibold">Resident Hall / Area:</span>
                    <span>{item.location}</span>
                  </div>
                  <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Suggested Handover Spot:</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.pickupSpot}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2">
                    Description
                  </h3>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                    {item.description}
                  </p>
                </div>

                {/* Specs / Checklist */}
                {item.specs && item.specs.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2">
                      Key Highlights & Condition
                    </h3>
                    <ul className="space-y-1.5">
                      {item.specs.map((spec, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-600 flex-shrink-0" />
                          <span>{spec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Seller Profile Card */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2.5">
                    Student Seller
                  </h3>
                  <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-orange-100 dark:bg-orange-950 flex-shrink-0 border border-orange-200 dark:border-orange-800">
                      {item.seller.avatarUrl ? (
                        <img src={item.seller.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-orange-700">
                          {item.seller.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                          {item.seller.name}
                        </span>
                        {item.seller.isPremium && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 rounded-full">
                            <Sparkles className="w-2.5 h-2.5 fill-current" />
                            Premium Member
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {item.seller.department} • {item.seller.level}
                      </p>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate">
                        Based in {item.seller.hallOrArea}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-4">
                {isOwner ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => onOpenBoost && onOpenBoost(item)}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 transition-all cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      Boost Visibility (Watch Ads)
                    </button>
                    <p className="text-[11px] text-center text-zinc-600 dark:text-zinc-300">
                      You own this listing. Manage and track analytics from your dashboard.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {item.phoneOrWhatsapp && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all text-center"
                        >
                          <ExternalLink className="w-4 h-4" />
                          WhatsApp
                        </a>
                      )}
                      {item.phoneOrWhatsapp && (
                        <a
                          href={`tel:${whatsappPhone}`}
                          className="py-3 px-4 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all text-center"
                        >
                          <Phone className="w-4 h-4" />
                          Call Seller
                        </a>
                      )}
                    </div>

                    <button
                      onClick={() => onStartChat({ ...item.seller, id: item.userId }, item)}
                      className="w-full py-3 px-4 border border-zinc-300 dark:border-zinc-700 hover:border-orange-600 dark:hover:border-orange-500 text-zinc-900 dark:text-zinc-100 font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all"
                    >
                      <MessageSquare className="w-4 h-4 text-orange-600" />
                      Send In-App Message
                    </button>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Posted recently
                      </span>
                      <button
                        onClick={() => onOpenReport(item)}
                        className="text-[11px] text-zinc-600 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 transition-colors"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Report this listing
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
