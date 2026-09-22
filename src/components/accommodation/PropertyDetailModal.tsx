import React, { useState } from 'react';
import { PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useData } from '../../context/DataContext';
import { 
  X, 
  MapPin, 
  Heart, 
  Share2, 
  ShieldCheck, 
  Zap, 
  MessageSquare, 
  Phone, 
  Check, 
  Droplets, 
  BatteryCharging, 
  Shield, 
  ExternalLink,
  AlertTriangle
} from 'lucide-react';

interface PropertyDetailModalProps {
  property: PropertyListing | null;
  onClose: () => void;
  onStartChat: (landlord: any, property: PropertyListing) => void;
  onOpenReport: (property: PropertyListing) => void;
  onOpenBoost?: (property: PropertyListing) => void;
  isOwner?: boolean;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  property,
  onClose,
  onStartChat,
  onOpenReport,
  onOpenBoost,
  isOwner = false
}) => {
  if (!property) return null;

  const { toggleSaveItem, isItemSaved } = useData();
  const saved = isItemSaved('property', property.id);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const whatsappPhone = property.contactWhatsapp?.replace(/[^0-9]/g, '') || property.contactPhone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
    `Hello ${property.landlord.name}, I found your student accommodation listing for "${property.title}" on JID OAU Campus Hub. Is it still available for inspection?`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 rounded-full">
              {property.roomType}
            </span>
            <span className="px-2.5 py-1 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full">
              {property.area}
            </span>
            {property.isBoosted && (
              <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-500 text-white rounded-full">
                <Zap className="w-3 h-3 fill-current" />
                Featured Lodge
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              title="Share lodge"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleSaveItem('property', property.id)}
              className={`p-2 rounded-full transition-colors ${
                saved
                  ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/40'
                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title={saved ? 'Remove bookmark' : 'Bookmark lodge'}
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

        {/* Modal Scroll Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          {copied && (
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-sm font-medium rounded-xl text-center">
              Accommodation link copied to clipboard!
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Gallery Column */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative aspect-[16/10] w-full bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <img
                  src={property.images[activeImageIndex] || property.images[0]}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 text-xs font-semibold bg-zinc-950/80 text-white backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-orange-500" />
                    {property.distanceToCampus}
                  </span>
                </div>
              </div>

              {/* Thumbnails */}
              {property.images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {property.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-24 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
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

              {/* Verified Lodge Badge & Safety */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                <p className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Direct Student Verification
                </p>
                <p className="leading-relaxed">
                  Never pay rent into any private account without physically inspecting the room, confirming tenancy terms with the caretaker or landlord, and receiving an official receipt.
                </p>
              </div>
            </div>

            {/* Information Column */}
            <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                    {property.availability}
                  </span>
                  <h1 className="text-2xl font-bold text-zinc-950 dark:text-white leading-tight font-display mt-1">
                    {property.title}
                  </h1>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-zinc-950 dark:text-white font-display">
                      {BRAND_CONFIG.currency.format(property.pricePerYear)}
                    </span>
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">/ year</span>
                  </div>
                </div>

                {/* Infrastructure Details */}
                <div className="space-y-2.5 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Droplets className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">Water Infrastructure:</span>
                      <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{property.waterSource}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <BatteryCharging className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">Power & Electricity:</span>
                      <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{property.powerSetup}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">Security & Environment:</span>
                      <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{property.security}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2">
                    Lodge Overview
                  </h3>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {property.description}
                  </p>
                </div>

                {/* Amenities */}
                {property.amenities && property.amenities.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2">
                      Included Amenities
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.map((amenity, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium rounded-lg"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Landlord / Caretaker Card */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2.5">
                    Property Contact
                  </h3>
                  <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
                    <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 font-bold flex items-center justify-center flex-shrink-0">
                      {property.landlord.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                        {property.landlord.name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {property.landlord.role}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2.5 pt-4">
                {isOwner ? (
                  <button
                    onClick={() => onOpenBoost && onOpenBoost(property)}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    Boost Accommodation Placement
                  </button>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all text-center"
                      >
                        <ExternalLink className="w-4 h-4" />
                        WhatsApp Caretaker
                      </a>
                      <a
                        href={`tel:${property.contactPhone}`}
                        className="py-3 px-4 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all text-center"
                      >
                        <Phone className="w-4 h-4" />
                        Call Phone
                      </a>
                    </div>

                    <button
                      onClick={() => onStartChat({ ...property.landlord, id: property.userId, fullName: property.landlord.name }, property)}
                      className="w-full py-3 px-4 border border-zinc-300 dark:border-zinc-700 hover:border-orange-600 dark:hover:border-orange-500 text-zinc-900 dark:text-zinc-100 font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all"
                    >
                      <MessageSquare className="w-4 h-4 text-orange-600" />
                      Inquire In-App
                    </button>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => onOpenReport(property)}
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
