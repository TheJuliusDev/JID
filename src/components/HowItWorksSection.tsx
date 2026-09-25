import React from 'react';
import { ArrowUpRight, ShieldCheck, Sparkles, Key, Zap, ArrowRight, ShoppingBag, Building, CheckCircle2 } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

interface HowItWorksProps {
  onExploreMarketplace: () => void;
  onExploreAccommodation: () => void;
  onOpenCreate: () => void;
}

export const HowItWorksSection: React.FC<HowItWorksProps> = ({
  onExploreMarketplace,
  onExploreAccommodation,
  onOpenCreate
}) => {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-sand-50 dark:bg-charcoal-950 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 pb-8 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850/60 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-3">
                <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>HOW JID WORKS</span>
              </div>
              <h2 className="font-display text-3xl sm:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
                Simple, safe & direct for OAU students.
              </h2>
            </div>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 max-w-md">
              Replacing 50 cluttered WhatsApp status broadcasts with one organized campus marketplace and accommodation discovery hub.
            </p>
          </div>
        </ScrollReveal>

        {/* 3 Step Cards */}
        <div className="space-y-6">
          
          {/* STEP 01 */}
          <ScrollReveal delay={0.1}>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 shadow-sm p-6 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 hover:shadow-lg transition-all">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-zinc-950 dark:bg-emerald-600 text-white flex items-center justify-center font-display font-black text-2xl shrink-0 shadow-sm">
                  01
                </div>
                <div>
                  <div className="inline-block text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full mb-2">
                    CAMPUS DISCOVERY
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white mb-2">
                    Browse verified student listings & lodges.
                  </h3>
                  <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl mb-4">
                    Filter gear by hall (Fajuyi, Awo, Moremi, Angola) or discover student accommodation in Asherifa, Damico, and Mayfair with explicit borehole and power infrastructure transparency.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-full font-medium">
                      ✓ Upfront Naira pricing
                    </span>
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-full font-medium">
                      ✓ No agent inspection fees
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={onExploreMarketplace}
                className="bg-zinc-950 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Explore Marketplace</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </ScrollReveal>

          {/* STEP 02 */}
          <ScrollReveal delay={0.15}>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 shadow-sm p-6 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 hover:shadow-lg transition-all">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-display font-black text-2xl shrink-0 shadow-sm">
                  02
                </div>
                <div>
                  <div className="inline-block text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full mb-2">
                    DAYLIGHT HANDOVERS
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white mb-2">
                    Meet safely at SUB or Hezekiah Library.
                  </h3>
                  <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl mb-4">
                    Contact student sellers directly via WhatsApp, Phone, or In-App Chat. Inspect items physically in safe, designated campus locations before any money changes hands.
                  </p>
                  <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-850/60 p-3.5 rounded-xl max-w-xl text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      100% Student-to-student community. No anonymous scammers or random external callers.
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={onExploreAccommodation}
                className="bg-zinc-900 hover:bg-emerald-600 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Find Accommodation</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </ScrollReveal>

          {/* STEP 03 */}
          <ScrollReveal delay={0.2}>
            <div className="bg-zinc-950 dark:bg-zinc-900 text-white rounded-3xl border border-zinc-900 dark:border-zinc-800 shadow-xl p-6 sm:p-10 flex flex-col justify-between hover:border-zinc-800 transition-all">
              <div className="flex items-start gap-5 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 text-white flex items-center justify-center font-display font-black text-2xl shrink-0">
                  03
                </div>
                <div>
                  <div className="inline-block text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-0.5 rounded-full mb-2">
                    POST IN 60 SECONDS & REWARDED BOOSTS
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2">
                    Sell your items & voluntarily boost visibility.
                  </h3>
                  <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
                    Snap 2 photos of your laptop, course textbook, or room to sublet. Want 3x faster buyer inquiries? Watch 5 short voluntary sponsor ads to unlock 24 hours of top-tier boost placement without paying a kobo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-zinc-800/80">
                <div className="bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800">
                  <div className="text-sm font-bold text-white mb-1">Voluntary Rewarded Ads</div>
                  <div className="text-xs text-zinc-400">Boost your items free by watching 5 short ads</div>
                </div>
                <div className="bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800">
                  <div className="text-sm font-bold text-white mb-1">Transparent Lodges</div>
                  <div className="text-xs text-zinc-400">Solar borehole, prepaid meter & rent upfront</div>
                </div>
                <div className="bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800">
                  <div className="text-sm font-bold text-white mb-1">Great Ife Only</div>
                  <div className="text-xs text-zinc-400">Honest student commerce across OAU campus</div>
                </div>
              </div>

              <div className="pt-6 mt-4 flex justify-end">
                <button
                  onClick={onOpenCreate}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  + Post a Free Ad Now
                </button>
              </div>
            </div>
          </ScrollReveal>

        </div>

      </div>
    </section>
  );
};
