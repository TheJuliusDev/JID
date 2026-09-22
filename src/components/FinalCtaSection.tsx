import React from 'react';
import { ArrowRight, ShoppingBag, PlusCircle, Building } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { BRAND_CONFIG } from '../config/brand';

interface FinalCtaSectionProps {
  onExploreMarketplace: () => void;
  onExploreAccommodation: () => void;
  onOpenCreateListing: () => void;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({
  onExploreMarketplace,
  onExploreAccommodation,
  onOpenCreateListing
}) => {
  return (
    <section className="py-24 sm:py-32 bg-zinc-950 text-white relative overflow-hidden border-t border-zinc-900">
      
      {/* Glow orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        
        <ScrollReveal>
          {/* Micro Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-orange-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
            <span>Great Ife Digital Campus • Live</span>
          </div>

          {/* Dramatic Closing Lines */}
          <div className="space-y-2 mb-6">
            <h2 className="font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-white leading-none">
              Your next apartment.
            </h2>
            <h2 className="font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-orange-500 leading-none">
              Your next deal.
            </h2>
            <h2 className="font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-white leading-none">
              Your next find.
            </h2>
          </div>

          <p className="font-display text-2xl sm:text-3xl text-zinc-300 font-semibold tracking-tight mb-10">
            All in one place.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onExploreMarketplace}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold px-9 py-4 rounded-2xl text-base tracking-wide flex items-center justify-center gap-2.5 shadow-xl shadow-orange-950/40 hover:shadow-orange-600/25 active:scale-[0.98] transition-all cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>Explore Marketplace</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={onExploreAccommodation}
              className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold px-8 py-4 rounded-2xl text-base tracking-wide flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <Building className="w-5 h-5 text-amber-500" />
              <span>Find Accommodations</span>
            </button>

            <button
              onClick={onOpenCreateListing}
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-4 rounded-2xl text-base tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <PlusCircle className="w-5 h-5 text-orange-400" />
              <span>Post Free Ad</span>
            </button>
          </div>

          <div className="mt-14 text-xs text-zinc-500 flex items-center justify-center gap-3 font-mono">
            <span>OBAFEMI AWOLOWO UNIVERSITY</span>
            <span>&bull;</span>
            <span>ILE-IFE, OSUN STATE</span>
          </div>
        </ScrollReveal>

      </div>
    </section>
  );
};
