import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Zap,
  Sparkles,
  Search,
  Home,
  ShoppingBag,
  PlusCircle,
  ArrowRight
} from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import { MarketplaceItem, PropertyListing } from '../types';
import { listMarketplace, listProperties } from '../services/database';

interface HeroSectionProps {
  onExploreMarketplace: () => void;
  onExploreAccommodation: () => void;
  onOpenCreateListing: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreMarketplace,
  onExploreAccommodation,
  onOpenCreateListing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredItem, setFeaturedItem] = useState<MarketplaceItem | null>(null);
  const [featuredApt, setFeaturedApt] = useState<PropertyListing | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [items, props] = await Promise.all([
          listMarketplace({ limit: 1, sort: 'boosted' }),
          listProperties({ limit: 1, sort: 'boosted' }),
        ]);
        if (cancelled) return;
        setFeaturedItem(items[0] || null);
        setFeaturedApt(props[0] || null);
      } catch (err) {
        if (!cancelled) console.error('[hero] featured fetch failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const quickSearchTags = ['MacBook Air', 'Engineering Maths', 'Asherifa Self-Con', 'Galaxy S22', 'Study Desk'];

  return (
    <section id="hero-section" className="relative pt-10 sm:pt-16 pb-16 sm:pb-24 overflow-hidden bg-gradient-to-b from-white via-sand-50 to-sand-100 dark:from-charcoal-950 dark:via-charcoal-950 dark:to-charcoal-900 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      {/* Background subtle modern grid & ambient glow */}
      <div className="absolute inset-0 modern-grid-pattern pointer-events-none opacity-60 dark:opacity-40" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/8 dark:bg-emerald-500/12 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Editorial Campus Sub-header Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 pb-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850/60 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>EXCLUSIVELY FOR GREAT IFE • OAU CAMPUS</span>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 font-mono-code">
            <span className="hidden sm:inline">CAMPUS HUBS: SUB • HEZEKIAH • ASHERIFA • DAMICO</span>
            <span className="text-zinc-950 dark:text-zinc-200 font-bold bg-zinc-100 dark:bg-zinc-850 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
              ACTIVE TRADING PLATFORM
            </span>
          </div>
        </div>

        {/* Main Grid: Headline Left & Interactive Live Preview Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          
          {/* Left Column: Bold Headline & CTAs */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <h1 className="font-display text-4xl sm:text-6xl md:text-[62px] font-black tracking-tight text-zinc-950 dark:text-white leading-[1.05] mb-6">
              Buy, sell & find lodges around OAU{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-amber-600 dark:from-emerald-500 dark:to-amber-400">
                without the expensive agency fees.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-300 font-normal leading-relaxed max-w-xl mb-8">
              A verified student marketplace and accommodation platform built specifically for Great Ife. Zero middleman agent fees, verified campus course mates, and safe daylight meetups at SUB Car Park and Hezekiah Library.
            </p>

            {/* Interactive Search Bar in Hero */}
            <div className="bg-white dark:bg-zinc-900 p-2 sm:p-2.5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-lg shadow-zinc-900/5 dark:shadow-none mb-6">
              <div className="flex items-center gap-2 px-3">
                <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Try searching 'MacBook', 'Textbooks', 'Self-Con in Asherifa'..."
                  className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none py-1.5"
                />
                <button
                  onClick={onExploreMarketplace}
                  className="hidden sm:inline-flex items-center gap-1.5 bg-zinc-950 dark:bg-emerald-600 hover:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                >
                  <span>Search</span>
                </button>
              </div>

              {/* Quick Suggestion Tags */}
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 overflow-x-auto px-2">
                <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 shrink-0">Popular:</span>
                {quickSearchTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (tag.includes('Self-Con')) onExploreAccommodation();
                      else onExploreMarketplace();
                    }}
                    className="text-[11px] px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg shrink-0 transition-colors cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 mb-8">
              <button
                onClick={onExploreMarketplace}
                className="group inline-flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white px-7 py-3.5 rounded-2xl font-bold text-sm shadow-xl shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Explore Marketplace</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onExploreAccommodation}
                className="inline-flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-6 py-3.5 rounded-2xl font-bold text-sm shadow-sm transition-all cursor-pointer"
              >
                <Home className="w-4 h-4 text-amber-500" />
                <span>Find Accommodation</span>
              </button>

              <button
                onClick={onOpenCreateListing}
                className="inline-flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 hover:underline px-4 py-3.5 font-bold text-sm cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Post an Ad</span>
              </button>
            </div>

            {/* Trust Badges */}
            <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center gap-6 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified OAU students</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>SUB & Hezekiah Handover</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Voluntary Ad Boosts</span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Featured Campus Cards Showcase */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-1 bg-zinc-200/60 dark:bg-zinc-800/60 rounded-3xl backdrop-blur-md shadow-2xl">
              <div className="bg-white dark:bg-zinc-900 rounded-[22px] p-6 space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Live Campus Highlights
                    </span>
                  </div>
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    OAU Feed
                  </span>
                </div>

                {/* Featured Product Card Preview */}
                {featuredItem && (
                  <div 
                    onClick={onExploreMarketplace}
                    className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 hover:border-emerald-500 cursor-pointer transition-all flex items-center gap-4 group"
                  >
                    <img
                      src={featuredItem.images[0]}
                      alt={featuredItem.title}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded">
                          {featuredItem.category}
                        </span>
                        {featuredItem.isBoosted && (
                          <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5 fill-current" /> Boosted
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate mt-1 group-hover:text-emerald-600 transition-colors">
                        {featuredItem.title}
                      </h4>
                      <p className="text-base font-extrabold text-zinc-950 dark:text-white font-display mt-0.5">
                        {BRAND_CONFIG.currency.format(featuredItem.price)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Featured Accommodation Card Preview */}
                {featuredApt && (
                  <div 
                    onClick={onExploreAccommodation}
                    className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 hover:border-amber-500 cursor-pointer transition-all flex items-center gap-4 group"
                  >
                    <img
                      src={featuredApt.images[0]}
                      alt={featuredApt.title}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded">
                          {featuredApt.area}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {featuredApt.distanceToCampus}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate mt-1 group-hover:text-amber-600 transition-colors">
                        {featuredApt.title}
                      </h4>
                      <p className="text-base font-extrabold text-zinc-950 dark:text-white font-display mt-0.5">
                        {BRAND_CONFIG.currency.format(featuredApt.pricePerYear)}
                        <span className="text-xs font-normal text-zinc-400"> / yr</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Direct CTA footer in showcase */}
                <div className="pt-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>Direct WhatsApp & In-App Handover</span>
                  <button
                    onClick={onExploreMarketplace}
                    className="font-bold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    Browse All Listings &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
