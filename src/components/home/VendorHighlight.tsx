import React from 'react';
import { ArrowRight, Store, Users, Wallet, Zap } from 'lucide-react';
import { ScrollReveal } from '../ScrollReveal';

const POINTS = [
  {
    icon: Users,
    title: 'A profile that sells for you',
    body: 'Add your name, department and hall once. Buyers see your public storefront and reviews before they message you.',
  },
  {
    icon: Store,
    title: 'List products in about a minute',
    body: 'Snap photos, set a naira price and pick a campus pickup spot. Edit, pause or mark sold whenever you like.',
  },
  {
    icon: Wallet,
    title: 'Keep 100% of what you earn',
    body: 'JID introduces buyers and hosts the conversation. Payment happens directly between you and your customer.',
  },
  {
    icon: Zap,
    title: 'Optional free visibility boosts',
    body: 'Earn a 24-hour boost by watching short sponsor ads. No paid tiers, no paid placement.',
  },
] as const;

interface VendorHighlightProps {
  onOpenVendors: () => void;
  onOpenCreateListing: () => void;
}

/** Compact seller pitch on the Home page. The full story lives on /vendors. */
export const VendorHighlight: React.FC<VendorHighlightProps> = ({ onOpenVendors, onOpenCreateListing }) => (
  <section className="py-16 sm:py-20 bg-zinc-950 text-white border-b border-zinc-900 relative overflow-hidden">
    <div className="absolute top-0 right-1/4 w-[480px] h-[280px] bg-emerald-600/10 blur-[130px] pointer-events-none rounded-full" />

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="lg:col-span-5">
          <ScrollReveal>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-emerald-400 text-[11px] font-bold uppercase tracking-wider mb-4">
              <Store className="w-3.5 h-3.5" />
              For sellers
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight leading-[1.1]">
              Selling on JID is open to everyone.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-zinc-400 leading-relaxed">
              Students clearing out a hostel room, a campus vendor restocking shelves, or a landlord filling a lodge —
              all of them can create a profile, list what they have and talk to real buyers on campus.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={onOpenCreateListing}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                Start selling on JID
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenVendors}
                className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white px-6 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
              >
                How selling works
              </button>
            </div>
          </ScrollReveal>
        </div>

        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {POINTS.map((point, index) => {
            const Icon = point.icon;
            return (
              <ScrollReveal key={point.title} delay={0.06 * index}>
                <div className="h-full bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-display text-base font-bold text-white mb-1.5">{point.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{point.body}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);
