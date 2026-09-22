import React, { useState } from 'react';
import { 
  ShoppingBag, 
  ArrowRight, 
  Camera, 
  Sparkles, 
  Flame,
  Home, 
  Check, 
  CheckCircle2, 
  ShieldCheck, 
  MapPin, 
  Zap, 
  Droplet, 
  Lock, 
  ArrowUpRight,
  Clock,
  Tag,
  X,
  UserCheck,
  Building,
  DollarSign
} from 'lucide-react';
import { SAMPLE_MARKET_ITEMS, SAMPLE_APARTMENTS } from '../data/mockData';
import { MarketItem, ApartmentListing } from '../types';
import { ScrollReveal } from './ScrollReveal';
import { motion } from 'motion/react';

interface CategoryOption {
  name: string;
  badge?: {
    type: 'hot' | 'new';
    label: string;
  };
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { name: 'All' },
  { name: 'Laptops', badge: { type: 'hot', label: 'HOT' } },
  { name: 'Phones', badge: { type: 'hot', label: 'HOT' } },
  { name: 'Textbooks', badge: { type: 'hot', label: 'HOT' } },
  { name: 'Furniture' },
  { name: 'Fashion', badge: { type: 'new', label: 'NEW' } },
  { name: 'School Supplies', badge: { type: 'hot', label: 'HOT' } },
];

const ITEM_TRENDING_BADGES: Record<string, { type: 'hot' | 'new'; label: string; subtext?: string }> = {
  'item-1': { type: 'hot', label: 'HOT', subtext: 'High Student Demand' },
  'item-2': { type: 'hot', label: 'HOT', subtext: 'Exam Prep Q&A' },
  'item-3': { type: 'hot', label: 'HOT', subtext: 'Fast Deal' },
  'item-5': { type: 'new', label: 'NEW', subtext: 'Campus Drop' },
  'item-6': { type: 'hot', label: 'HOT', subtext: 'Hostel Essential' },
};

interface ProductExplanationProps {
  onExploreMarketplace: () => void;
  onExploreAccommodation: () => void;
  onOpenCreateListing: () => void;
}

export const ProductExplanation: React.FC<ProductExplanationProps> = ({
  onExploreMarketplace,
  onExploreAccommodation,
  onOpenCreateListing
}) => {
  // Category filter for 01 BUY
  const [selectedBuyCategory, setSelectedBuyCategory] = useState<string>('All');
  const [activeItemModal, setActiveItemModal] = useState<MarketItem | null>(null);

  // Area filter for 03 FIND A HOME
  const [selectedArea, setSelectedArea] = useState<string>('All');

  const filteredItems = selectedBuyCategory === 'All' 
    ? SAMPLE_MARKET_ITEMS 
    : SAMPLE_MARKET_ITEMS.filter(item => item.category === selectedBuyCategory);

  const areas = ['All', 'Asherifa', 'Mayfair', 'Damico', 'Ede Road'];

  const filteredApartments = selectedArea === 'All'
    ? SAMPLE_APARTMENTS
    : SAMPLE_APARTMENTS.filter(apt => apt.area === selectedArea);

  return (
    <div id="explore-section" className="relative bg-[#FAFAF9] dark:bg-[#090A0F] transition-colors duration-200">

      {/* ========================================================================= */}
      {/* 01 — BUY SECTION */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-12 pb-8 border-b border-zinc-200 dark:border-zinc-800">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-850/60 text-orange-700 dark:text-orange-400 text-xs font-semibold mb-3">
                  <ShoppingBag className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                  <span>CAMPUS MARKETPLACE</span>
                </div>
                <h2 className="font-display text-3xl sm:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
                  Find what students are selling on campus.
                </h2>
              </div>
              <div className="lg:col-span-4">
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Laptops, phones, hall reading desks, and engineering textbooks. Clean, verified listings with firm student prices and safe daylight meetups.
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Category Tabs: Rounded Pills with Animated Floating Badges */}
          <ScrollReveal delay={0.1}>
            <div className="flex items-center gap-3 overflow-x-auto pt-4 pb-4 mb-8 scrollbar-none">
              {CATEGORY_OPTIONS.map((cat) => {
                const isSelected = selectedBuyCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedBuyCategory(cat.name)}
                    className={`relative px-4 py-2 text-xs font-semibold rounded-full shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-950 dark:bg-orange-600 text-white shadow-md shadow-zinc-900/10'
                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{cat.name}</span>

                    {/* Animated Floating 'New' or 'Hot' Badge */}
                    {cat.badge && (
                      <motion.span
                        animate={{ 
                          y: [-1, -5, -1],
                        }}
                        transition={{
                          duration: 2.2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: cat.badge.type === 'hot' ? 0 : 0.35
                        }}
                        className={`absolute -top-2.5 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase flex items-center gap-0.5 shadow-sm border select-none pointer-events-none ring-2 ring-white dark:ring-zinc-900 ${
                          cat.badge.type === 'hot'
                            ? 'bg-rose-600 text-white border-rose-400'
                            : 'bg-emerald-600 text-white border-emerald-400'
                        }`}
                      >
                        {cat.badge.type === 'hot' ? (
                          <Flame className="w-2.5 h-2.5 fill-current text-white animate-pulse" />
                        ) : (
                          <Sparkles className="w-2.5 h-2.5 fill-current text-white" />
                        )}
                        <span>{cat.badge.label}</span>
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollReveal>

          {/* Modern Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {filteredItems.map((item, index) => {
              const trendingBadge = ITEM_TRENDING_BADGES[item.id];
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ 
                    duration: 0.45, 
                    delay: (index % 6) * 0.08, 
                    ease: [0.21, 1, 0.36, 1] 
                  }}
                  whileHover={{ y: -6 }}
                  onClick={() => setActiveItemModal(item)}
                  className="group relative bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 hover:border-orange-500/50 dark:hover:border-orange-500/60 rounded-2xl p-5 sm:p-6 flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-xl transition-all"
                >
                  {/* Animated Floating Card Badge for Trending Student Items */}
                  {trendingBadge && (
                    <motion.div
                      animate={{ y: [-2, -6, -2] }}
                      transition={{
                        repeat: Infinity,
                        duration: 2.5,
                        ease: "easeInOut",
                        delay: (index % 3) * 0.25,
                      }}
                      className={`absolute -top-3 right-5 z-10 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 border ring-2 ring-white dark:ring-zinc-900 select-none ${
                        trendingBadge.type === 'hot'
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-emerald-600 text-white border-emerald-400'
                      }`}
                    >
                      {trendingBadge.type === 'hot' ? (
                        <Flame className="w-3 h-3 fill-current text-white animate-pulse" />
                      ) : (
                        <Sparkles className="w-3 h-3 fill-current text-white" />
                      )}
                      <span>{trendingBadge.label}</span>
                      {trendingBadge.subtext && (
                        <span className="font-medium text-[9px] opacity-90 hidden sm:inline">
                          • {trendingBadge.subtext}
                        </span>
                      )}
                    </motion.div>
                  )}

                  <div>
                    {/* Category & Condition Badge */}
                    <div className="flex items-center justify-between text-xs mb-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                          {item.category}
                        </span>
                        {trendingBadge && (
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            trendingBadge.type === 'hot'
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60'
                          }`}>
                            {trendingBadge.type === 'hot' ? (
                              <Flame className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 fill-rose-500" />
                            ) : (
                              <Sparkles className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 fill-emerald-500" />
                            )}
                            <span>{trendingBadge.label}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-850/60 px-2.5 py-0.5 rounded-full">
                        {item.condition}
                      </span>
                    </div>

                  {/* Title & Price */}
                  <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors leading-snug mb-2">
                    {item.title}
                  </h3>

                  <div className="flex items-baseline justify-between mb-4">
                    <span className="font-display text-2xl font-black text-zinc-950 dark:text-white">
                      ₦{item.price.toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono-code">Student Price</span>
                  </div>

                  {/* Seller Details Card */}
                  <div className="bg-zinc-50 dark:bg-zinc-850/70 border border-zinc-100 dark:border-zinc-800 rounded-xl p-3 mb-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        {item.sellerName}
                      </span>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono-code">{item.timeAgo}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {item.department}
                    </div>
                    <div className="text-[11px] text-zinc-700 dark:text-zinc-300 font-medium mt-1 flex items-center gap-1">
                      <span>Hall / Lodge:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.hallOrArea}</span>
                    </div>
                  </div>

                  {/* Quick specs */}
                  <div className="space-y-1 mb-4 text-xs text-zinc-600 dark:text-zinc-300">
                    {item.specs?.slice(0, 2).map((spec, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-1.5 text-[11px]">
                        <span className="text-orange-600 dark:text-orange-400 font-bold">•</span>
                        <span>{spec}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Handover location & CTA */}
                <div className="pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate mr-2">
                    <MapPin className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                    <span className="truncate">Meetup: <strong className="text-zinc-800 dark:text-zinc-200">{item.pickupSpot}</strong></span>
                  </div>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400 group-hover:translate-x-0.5 transition-transform flex items-center shrink-0">
                    Details <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

          {/* Bottom callout strip */}
          <ScrollReveal delay={0.2}>
            <div className="mt-10 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-pulse" />
                <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                  Have gadgets, books or furniture in Fajuyi, Awo, ETF, or Asherifa?
                </span>
              </div>
              <button
                onClick={onOpenCreateListing}
                className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Post your item on JID</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </ScrollReveal>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 02 — SELL SECTION (DARK PREMIUM) */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-zinc-950 text-white border-b border-zinc-900 relative overflow-hidden">
        
        {/* Subtle background glow */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-orange-600/10 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-950/60 border border-orange-800/50 text-orange-400 text-xs font-semibold mb-3">
              <Tag className="w-3.5 h-3.5 text-orange-400" />
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
                <div className="text-xs uppercase text-orange-400 font-bold mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
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
              <div className="w-10 h-10 rounded-xl bg-orange-600/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-5">
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-xs font-mono-code text-orange-400 font-bold mb-2 uppercase">
                Step 01
              </div>
              <h3 className="font-display text-xl font-bold text-white mb-2">
                Snap & Specify
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                Take 2 clear photos in your room. Add your condition, department, and campus pickup zone (e.g. SUB ground floor or Hezekiah Library).
              </p>
              <div className="bg-zinc-950/80 p-3 rounded-xl text-xs font-mono-code text-orange-400 border border-zinc-800">
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
                Every buyer and seller is verified through their Great Ife student credentials. No random anonymous scammers or fake phone numbers.
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
                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-lg shadow-orange-600/30 transition-all cursor-pointer"
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
      <section id="find-home-section" className="py-20 sm:py-28 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#0E0F15] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-12 pb-8 border-b border-zinc-200 dark:border-zinc-800">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-850/60 text-orange-700 dark:text-orange-400 text-xs font-semibold mb-3">
                  <Home className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
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
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 mr-2">
                Filter Area:
              </span>
              {areas.map((area) => (
                <button
                  key={area}
                  onClick={() => setSelectedArea(area)}
                  className={`px-4 py-2 text-xs font-semibold rounded-full shrink-0 transition-all cursor-pointer ${
                    selectedArea === area
                      ? 'bg-zinc-950 dark:bg-orange-600 text-white shadow-md shadow-zinc-900/10'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </ScrollReveal>

          {/* Housing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredApartments.map((apt, index) => (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ 
                  duration: 0.5, 
                  delay: (index % 4) * 0.1, 
                  ease: [0.21, 1, 0.36, 1] 
                }}
                whileHover={{ y: -6 }}
                className="bg-zinc-50/70 dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
              >
                <div>
                  
                  {/* Top Bar: Location & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-zinc-200/80 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="bg-zinc-950 dark:bg-black text-white text-[11px] font-bold uppercase px-2.5 py-1 rounded-md">
                        {apt.area}
                      </span>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        {apt.roomType}
                      </span>
                    </div>

                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      {apt.availability}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-display text-2xl font-bold text-zinc-950 dark:text-white mb-2 leading-tight">
                    {apt.title}
                  </h3>

                  {/* Distance from campus gate */}
                  <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 font-semibold mb-6">
                    <MapPin className="w-4 h-4" />
                    <span>{apt.distanceToCampus}</span>
                  </div>

                  {/* Price Tag Box */}
                  <div className="bg-white dark:bg-zinc-850/80 border border-zinc-200/80 dark:border-zinc-750 rounded-2xl p-4 sm:p-5 mb-6 flex items-baseline justify-between shadow-xs">
                    <div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase font-mono-code block">
                        Annual Rent
                      </span>
                      <span className="font-display text-3xl font-black text-zinc-950 dark:text-white">
                        ₦{apt.pricePerYear.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                      Zero Agent "Agreement" Fees
                    </span>
                  </div>

                  {/* OAU Amenities Matrix */}
                  <div className="space-y-3 mb-6 text-xs">
                    <div className="flex items-start gap-3">
                      <Droplet className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] uppercase font-mono-code">Water Reliability</span>
                        <span className="text-zinc-800 dark:text-zinc-200 font-medium">{apt.waterSource}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] uppercase font-mono-code">Power Setup</span>
                        <span className="text-zinc-800 dark:text-zinc-200 font-medium">{apt.powerSetup}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Lock className="w-4 h-4 text-zinc-700 dark:text-zinc-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] uppercase font-mono-code">Security</span>
                        <span className="text-zinc-800 dark:text-zinc-200 font-medium">{apt.security}</span>
                      </div>
                    </div>
                  </div>

                  {/* Proximity note */}
                  <div className="text-xs text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-850 p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-750 mb-6 italic">
                    "{apt.proximityDesc}"
                  </div>

                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Verified listing by resident stalite
                  </span>
                  <button
                    onClick={onExploreAccommodation}
                    className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>View Accommodation</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

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
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-all cursor-pointer shadow-md shadow-orange-600/20"
              >
                Browse Roommate Postings
              </button>
            </div>
          </ScrollReveal>

        </div>
      </section>

      {/* Item Inspection Modal / Detail Drawer */}
      {activeItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-zinc-900 dark:text-zinc-100">
            <button
              onClick={() => setActiveItemModal(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="inline-block text-xs font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-850/60 px-2.5 py-0.5 rounded-full">
                Item Preview • {activeItemModal.category}
              </div>
              {ITEM_TRENDING_BADGES[activeItemModal.id] && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  ITEM_TRENDING_BADGES[activeItemModal.id].type === 'hot'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                }`}>
                  {ITEM_TRENDING_BADGES[activeItemModal.id].type === 'hot' ? (
                    <Flame className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 fill-rose-500 animate-pulse" />
                  ) : (
                    <Sparkles className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 fill-emerald-500" />
                  )}
                  <span>{ITEM_TRENDING_BADGES[activeItemModal.id].label}</span>
                </span>
              )}
            </div>

            <h3 className="font-display text-2xl font-bold text-zinc-950 dark:text-white mb-3">
              {activeItemModal.title}
            </h3>

            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-display text-3xl font-black text-orange-600 dark:text-orange-500">
                ₦{activeItemModal.price.toLocaleString()}
              </span>
              <span className="text-xs font-semibold uppercase px-2.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md text-zinc-700 dark:text-zinc-300">
                {activeItemModal.condition}
              </span>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-5">
              {activeItemModal.description}
            </p>

            <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-700 space-y-2 mb-6 text-xs text-zinc-800 dark:text-zinc-200">
              <div><strong className="text-zinc-950 dark:text-white">Seller:</strong> {activeItemModal.sellerName} ({activeItemModal.department})</div>
              <div><strong className="text-zinc-950 dark:text-white">Campus Residence:</strong> {activeItemModal.hallOrArea}</div>
              <div><strong className="text-zinc-950 dark:text-white">Designated Handover:</strong> {activeItemModal.pickupSpot}</div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveItemModal(null);
                  onExploreMarketplace();
                }}
                className="w-full bg-zinc-950 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white py-3.5 rounded-xl text-sm font-semibold transition-colors shadow-md cursor-pointer"
              >
                Browse Full Marketplace
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
