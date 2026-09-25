import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  ArrowRight,
  Camera,
  Sparkles,
  Home,
  ShieldCheck,
  ArrowUpRight,
  Tag,
  Loader2,
  PackageOpen,
} from 'lucide-react';
import { MarketplaceItem, PropertyListing } from '../types';
import { listMarketplace, listProperties } from '../services/database';
import { BRAND_CONFIG } from '../config/brand';
import { MarketplaceCard } from './marketplace/MarketplaceCard';
import { PropertyCard } from './accommodation/PropertyCard';
import { ScrollReveal } from './ScrollReveal';
import { motion } from 'motion/react';

interface ProductExplanationProps {
  onExploreMarketplace: () => void;
  onExploreAccommodation: () => void;
  onOpenCreateListing: () => void;
}

const AREA_FILTERS = ['All', ...BRAND_CONFIG.campusLocations.offCampusAreas];

export const ProductExplanation: React.FC<ProductExplanationProps> = ({
  onExploreMarketplace,
  onExploreAccommodation,
  onOpenCreateListing,
}) => {
  const [selectedBuyCategory, setSelectedBuyCategory] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('All');

  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingProps, setLoadingProps] = useState(true);

  // Live preview of the newest real listings on the platform.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mkt, props] = await Promise.all([
          listMarketplace({ limit: 12, sort: 'newest' }),
          listProperties({ limit: 6, sort: 'newest' }),
        ]);
        if (cancelled) return;
        setItems(mkt);
        setProperties(props);
      } catch (err) {
        if (!cancelled) console.error('[landing] preview load failed', err);
      } finally {
        if (!cancelled) {
          setLoadingItems(false);
          setLoadingProps(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems =
    selectedBuyCategory === 'all'
      ? items
      : items.filter((item) => item.category === selectedBuyCategory);

  const filteredProperties =
    selectedArea === 'All' ? properties : properties.filter((p) => p.area === selectedArea);

  return (
    <div id="explore-section" className="relative bg-sand-50 dark:bg-charcoal-950 transition-colors duration-200">

      {/* ========================================================================= */}
      {/* 01 — BUY SECTION */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section Header */}
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-12 pb-8 border-b border-zinc-200 dark:border-zinc-800">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850/60 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-3">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>CAMPUS MARKETPLACE</span>
                </div>
                <h2 className="font-display text-3xl sm:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
                  Find what students are selling on campus.
                </h2>
              </div>
              <div className="lg:col-span-4">
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Laptops, phones, hall reading desks, and engineering textbooks — posted by verified Great Ife students with firm prices and safe daylight meetups.
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Category Tabs */}
          <ScrollReveal delay={0.1}>
            <div className="flex items-center gap-3 overflow-x-auto pt-2 pb-4 mb-8 scrollbar-none">
              {BRAND_CONFIG.categories.map((cat) => {
                const isSelected = selectedBuyCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedBuyCategory(cat.id)}
                    className={`relative px-4 py-2 text-xs font-semibold rounded-full shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-950 dark:bg-emerald-600 text-white shadow-md shadow-zinc-900/10'
                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </ScrollReveal>

          {/* Live Marketplace Preview Grid */}
          {loadingItems ? (
            <PreviewSkeleton count={6} variant="item" />
          ) : filteredItems.length === 0 ? (
            <EmptyPreview
              title={items.length === 0 ? 'Be the first to sell on JID' : 'Nothing in this category yet'}
              body={
                items.length === 0
                  ? 'The marketplace is brand new. Post your first item and reach verified students across OAU.'
                  : 'No live listings match this category right now. Check back soon or browse everything.'
              }
              cta="Post an item"
              onClick={onOpenCreateListing}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              {filteredItems.slice(0, 6).map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.45, delay: (index % 6) * 0.08, ease: [0.21, 1, 0.36, 1] }}
                >
                  <MarketplaceCard item={item} onClick={onExploreMarketplace} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Bottom callout strip */}
          <ScrollReveal delay={0.2}>
            <div className="mt-10 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                  Have gadgets, books or furniture in Fajuyi, Awo, ETF, or Asherifa?
                </span>
              </div>
              <button
                onClick={onOpenCreateListing}
                className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Post your item on JID</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </ScrollReveal>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 02 — SELL SECTION */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-zinc-950 text-white border-b border-zinc-900 relative overflow-hidden">

        {/* Subtle background glow */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-emerald-600/10 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 text-xs font-semibold mb-3">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span>STUDENT SELLER WORKFLOW</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start mb-16">
              <div className="lg:col-span-7">
                <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.08] mb-6">
                  Turn gear you no longer need into instant campus cash.
                </h2>
                <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-xl">
                  Graduating, moving hostels, or upgrading? Stop relying on 24-hour disappearing WhatsApp statuses. List items once and reach verified students across OAU.
                </p>
              </div>

              <div className="lg:col-span-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 lg:p-7 shadow-xl">
                <div className="text-xs uppercase text-emerald-400 font-bold mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Why WhatsApp Status Fails
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-4">
                  "On WhatsApp, you post 20 photos that disappear in 24 hours. Random contacts ask for 'price in DM', leave you on read, or negotiate 80% down. On JID, your item is searchable and indexed campus-wide."
                </p>
                <div className="text-xs text-zinc-500 font-mono-code">
                  — The reality of student trade at Great Ife
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Step Workflow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.5, delay: 0, ease: [0.21, 1, 0.36, 1] }}
              whileHover={{ y: -5 }}
              className="bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-6 relative transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-xs font-mono-code text-emerald-400 font-bold mb-2 uppercase">
                Step 01
              </div>
              <h3 className="font-display text-xl font-bold text-white mb-2">
                Snap & Specify
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                Take 2 clear photos in your room. Add your condition, department, and campus pickup zone (e.g. SUB ground floor or Hezekiah Library).
              </p>
              <div className="bg-zinc-950/80 p-3 rounded-xl text-xs font-mono-code text-emerald-400 border border-zinc-800">
                Average listing time: 60 seconds
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.21, 1, 0.36, 1] }}
              whileHover={{ y: -5 }}
              className="bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-6 relative transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs font-mono-code text-emerald-400 font-bold mb-2 uppercase">
                Step 02
              </div>
              <h3 className="font-display text-xl font-bold text-white mb-2">
                Campus Verification
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                Every buyer and seller signs in with a real account tied to their campus identity. No random anonymous scammers or fake phone numbers.
              </p>
              <div className="bg-zinc-950/80 p-3 rounded-xl text-xs font-mono-code text-emerald-400 border border-zinc-800">
                100% Student-Only Community
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.21, 1, 0.36, 1] }}
              whileHover={{ y: -5 }}
              className="bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-6 relative transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-xs font-mono-code text-amber-400 font-bold mb-2 uppercase">
                Step 03
              </div>
              <h3 className="font-display text-xl font-bold text-white mb-2">
                Meetup & Handover
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                Meet at a safe, daylight campus spot like SUB or the Library. The buyer inspects the item, sends the bank transfer, and completes the deal.
              </p>
              <div className="bg-zinc-950/80 p-3 rounded-xl text-xs font-mono-code text-amber-400 border border-zinc-800">
                Zero Platform Commission for Students
              </div>
            </motion.div>

          </div>

          {/* CTA button */}
          <ScrollReveal delay={0.2}>
            <div className="mt-12 text-center">
              <button
                onClick={onOpenCreateListing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <span>Post an Item to Sell Now</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </ScrollReveal>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 03 — FIND A HOME SECTION */}
      {/* ========================================================================= */}
      <section id="find-home-section" className="py-20 sm:py-28 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-charcoal-900 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-12 pb-8 border-b border-zinc-200 dark:border-zinc-800">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850/60 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-3">
                  <Home className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>OFF-CAMPUS HOUSING</span>
                </div>
                <h2 className="font-display text-3xl sm:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
                  Transparent student housing without agent fees.
                </h2>
              </div>
              <div className="lg:col-span-4">
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Real student lodges around Asherifa, Mayfair, Damico, and Ede Road. Direct landlord and outgoing tenant listings with zero ₦10k inspection fees.
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Location Area Pills */}
          <ScrollReveal delay={0.1}>
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 mr-2">
                Filter Area:
              </span>
              {AREA_FILTERS.map((area) => (
                <button
                  key={area}
                  onClick={() => setSelectedArea(area)}
                  className={`px-4 py-2 text-xs font-semibold rounded-full shrink-0 transition-all cursor-pointer ${
                    selectedArea === area
                      ? 'bg-zinc-950 dark:bg-emerald-600 text-white shadow-md shadow-zinc-900/10'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </ScrollReveal>

          {/* Live Housing Preview Grid */}
          {loadingProps ? (
            <PreviewSkeleton count={4} variant="property" />
          ) : filteredProperties.length === 0 ? (
            <EmptyPreview
              title={properties.length === 0 ? 'List the first lodge on JID' : 'No lodges in this area yet'}
              body={
                properties.length === 0
                  ? 'Landlords, caretakers and outgoing tenants can post verified rooms with zero agent fees.'
                  : 'No live rooms match this area right now. Try another area or browse everything.'
              }
              cta="Post a lodge"
              onClick={onOpenCreateListing}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((prop, index) => (
                <motion.div
                  key={prop.id}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.5, delay: (index % 4) * 0.1, ease: [0.21, 1, 0.36, 1] }}
                >
                  <PropertyCard property={prop} onClick={onExploreAccommodation} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Roommate / Flatmate Callout */}
          <ScrollReveal delay={0.2}>
            <div className="mt-12 p-7 rounded-3xl bg-zinc-950 dark:bg-zinc-900 border border-transparent dark:border-zinc-800 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
              <div>
                <div className="font-display text-xl font-bold text-white mb-1.5">
                  Looking for a roommate to split rent?
                </div>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
                  Connect with course mates and verified students in your faculty so you can split rent on 2-bedroom flats in Mayfair or Damico safely.
                </p>
              </div>
              <button
                onClick={onExploreAccommodation}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
              >
                Browse Roommate Postings
              </button>
            </div>
          </ScrollReveal>

        </div>
      </section>

    </div>
  );
};

/* ---------------------------------------------------------------- */
/* Preview helpers                                                   */
/* ---------------------------------------------------------------- */
const PreviewSkeleton: React.FC<{ count: number; variant: 'item' | 'property' }> = ({ count, variant }) => (
  <div
    className={`grid gap-6 ${
      variant === 'item'
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    }`}
  >
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden animate-pulse"
      >
        <div className={`${variant === 'item' ? 'aspect-[4/3]' : 'aspect-[16/10]'} bg-zinc-100 dark:bg-zinc-800`} />
        <div className="p-4 space-y-3">
          <div className="h-4 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-1/3 bg-zinc-100 dark:bg-zinc-800 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyPreview: React.FC<{ title: string; body: string; cta: string; onClick: () => void }> = ({
  title,
  body,
  cta,
  onClick,
}) => (
  <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-3xl">
    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 mb-4">
      <PackageOpen className="w-7 h-7" />
    </div>
    <h3 className="font-display text-xl font-bold text-zinc-950 dark:text-white mb-1.5">{title}</h3>
    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-5">{body}</p>
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow cursor-pointer"
    >
      {cta}
      <ArrowRight className="w-4 h-4" />
    </button>
  </div>
);
