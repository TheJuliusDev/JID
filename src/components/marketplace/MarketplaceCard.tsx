import React from 'react';
import { MarketplaceItem } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useData } from '../../context/DataContext';
import { MapPin, Heart, Zap, ShieldCheck, Sparkles } from 'lucide-react';

interface MarketplaceCardProps {
  item: MarketplaceItem;
  onClick: () => void;
}

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({ item, onClick }) => {
  const { toggleSaveItem, isItemSaved } = useData();
  const saved = isItemSaved('marketplace', item.id);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSaveItem('marketplace', item.id);
  };

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col ${
        item.isBoosted
          ? 'border-orange-500/60 dark:border-orange-500/50 shadow-orange-500/5 ring-1 ring-orange-500/20'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700'
      }`}
    >
      {/* Boosted Banner Badge */}
      {item.isBoosted && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[11px] font-bold tracking-wider uppercase rounded-full shadow-md">
          <Zap className="w-3 h-3 fill-current animate-pulse" />
          <span>Boosted</span>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
          saved
            ? 'bg-rose-500 text-white shadow-md'
            : 'bg-white/80 dark:bg-black/60 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800'
        }`}
        title={saved ? 'Remove from saved' : 'Save item'}
      >
        <Heart className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
      </button>

      {/* Product Image Container */}
      <div className="relative aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <img
          src={item.images[0]}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {/* Condition Tag */}
        <div className="absolute bottom-2.5 left-2.5">
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-950/75 text-zinc-100 backdrop-blur-sm rounded-md border border-white/10">
            {item.condition}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Price & Location Header */}
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-lg font-bold text-zinc-950 dark:text-white tracking-tight font-display">
              {BRAND_CONFIG.currency.format(item.price)}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400 truncate max-w-[140px]">
              <MapPin className="w-3 h-3 text-orange-600 flex-shrink-0" />
              {item.location}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-[15px] leading-snug line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors mb-2">
            {item.title}
          </h3>
        </div>

        {/* Seller Info & Meta */}
        <div className="pt-3 mt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-2 truncate">
            <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-bold flex items-center justify-center text-[11px] flex-shrink-0">
              {item.seller.name.charAt(0)}
            </div>
            <div className="truncate">
              <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1">
                {item.seller.name}
                {item.seller.isPremium && (
                  <span className="inline-flex items-center text-amber-500" title="Premium Member">
                    <Sparkles className="w-3 h-3 fill-current" />
                  </span>
                )}
              </p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate">
                {item.seller.department}
              </p>
            </div>
          </div>

          <span className="text-[11px] text-zinc-600 dark:text-zinc-300 flex-shrink-0 ml-2">
            {item.viewsCount} views
          </span>
        </div>
      </div>
    </div>
  );
};
