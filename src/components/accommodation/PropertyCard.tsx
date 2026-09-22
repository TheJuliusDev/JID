import React from 'react';
import { PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useData } from '../../context/DataContext';
import { MapPin, Heart, Zap, ShieldCheck, Droplets, ZapOff, BatteryCharging, Clock, Users } from 'lucide-react';

interface PropertyCardProps {
  property: PropertyListing;
  onClick: () => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, onClick }) => {
  const { toggleSaveItem, isItemSaved } = useData();
  const saved = isItemSaved('property', property.id);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSaveItem('property', property.id);
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'Available Immediately':
        return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'Roommate Needed':
        return 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800';
      default:
        return 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white dark:bg-zinc-900 border rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer flex flex-col ${
        property.isBoosted
          ? 'border-orange-500/60 dark:border-orange-500/50 shadow-orange-500/5 ring-1 ring-orange-500/20'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700'
      }`}
    >
      {/* Boost Badge */}
      {property.isBoosted && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[11px] font-bold tracking-wider uppercase rounded-full shadow-md">
          <Zap className="w-3 h-3 fill-current animate-pulse" />
          <span>Featured Lodge</span>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        className={`absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
          saved
            ? 'bg-rose-500 text-white shadow-md'
            : 'bg-white/85 dark:bg-black/60 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800'
        }`}
        title={saved ? 'Remove bookmark' : 'Bookmark lodge'}
      >
        <Heart className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
      </button>

      {/* Property Image Container */}
      <div className="relative aspect-[16/10] w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <img
          src={property.images[0]}
          alt={property.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Distance Banner */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <span className="px-3 py-1 text-xs font-semibold bg-zinc-950/80 text-white backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-orange-500" />
            {property.distanceToCampus}
          </span>
          <span className="px-2.5 py-1 text-xs font-bold bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-white backdrop-blur-md rounded-lg shadow-sm">
            {property.roomType}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Availability & Area Tag */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${getAvailabilityColor(property.availability)}`}>
              {property.availability}
            </span>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {property.area}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base leading-snug line-clamp-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
            {property.title}
          </h3>

          {/* Price */}
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-zinc-950 dark:text-white font-display">
              {BRAND_CONFIG.currency.format(property.pricePerYear)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">/ year</span>
          </div>
        </div>

        {/* Infrastructure Highlights */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <Droplets className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="truncate">{property.waterSource.split(' ')[0]} Water</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <BatteryCharging className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="truncate">{property.powerSetup.split('(')[0]}</span>
          </div>
        </div>

        {/* Caretaker / Landlord Info */}
        <div className="pt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
            {property.landlord.name} ({property.landlord.role})
          </span>
          <span className="text-orange-600 dark:text-orange-400 font-semibold group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-2">
            View Details &rarr;
          </span>
        </div>
      </div>
    </div>
  );
};
