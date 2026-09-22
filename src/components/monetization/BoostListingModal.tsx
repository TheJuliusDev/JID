import React, { useState, useEffect } from 'react';
import { MarketplaceItem, PropertyListing } from '../../types';
import { useData } from '../../context/DataContext';
import { 
  X, 
  Zap, 
  Play, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Sparkles, 
  Tv, 
  Volume2, 
  ExternalLink 
} from 'lucide-react';

interface BoostListingModalProps {
  listing: MarketplaceItem | PropertyListing | null;
  onClose: () => void;
}

const SIMULATED_SPONSORS = [
  {
    brand: 'Ife Student Tech Hub',
    headline: 'Learn Python, Flutter & AI in Ile-Ife',
    tagline: 'Special discount for OAU students at SUB Tech Lab.',
    duration: 4,
    color: 'from-blue-600 to-indigo-700'
  },
  {
    brand: 'Campus Eatery & Shawarma Spot',
    headline: 'Crispy Shawarma & Smoothies at Motion Ground',
    tagline: 'Fast delivery straight to Fajuyi, Awo, Moremi & Angola buttery.',
    duration: 4,
    color: 'from-amber-600 to-orange-700'
  },
  {
    brand: 'Great Ife Print & Spiral Center',
    headline: 'Distinction Project Printing & Hardcover Binding',
    tagline: 'Located beside Hezekiah Library walkway. Fast turnaround.',
    duration: 4,
    color: 'from-emerald-600 to-teal-700'
  },
  {
    brand: 'Damico High-Speed Fibre WiFi',
    headline: 'Affordable Monthly Student Unlimited Data',
    tagline: 'Reliable latency for coders and remote students around Road 7.',
    duration: 4,
    color: 'from-purple-600 to-pink-700'
  },
  {
    brand: 'OAU Campus Transit & Logistics',
    headline: 'Safe Campus Bike & Mini-Van Relocation Service',
    tagline: 'Move your fridge, reading table, and mattress hassle-free.',
    duration: 4,
    color: 'from-orange-600 to-red-700'
  }
];

export const BoostListingModal: React.FC<BoostListingModalProps> = ({ listing, onClose }) => {
  if (!listing) return null;

  const { boostListing } = useData();

  // Step state: 'intro' | 'watching' | 'completed'
  const [step, setStep] = useState<'intro' | 'watching' | 'completed'>('intro');
  const [adsWatched, setAdsWatched] = useState<number>(0);
  const totalRequired = 5;

  // Active Ad Simulation state
  const [countdown, setCountdown] = useState<number>(4);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const currentSponsor = SIMULATED_SPONSORS[adsWatched % SIMULATED_SPONSORS.length];

  // Ad playback timer simulation
  useEffect(() => {
    let timer: any;
    if (step === 'watching' && isPlaying && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (step === 'watching' && isPlaying && countdown === 0) {
      // Completed this ad!
      const nextCount = adsWatched + 1;
      setAdsWatched(nextCount);
      setIsPlaying(false);

      if (nextCount >= totalRequired) {
        // Unlock 24h boost!
        const listingType = 'roomType' in listing ? 'property' : 'marketplace';
        boostListing(listingType, listing.id);
        setStep('completed');
      } else {
        // Reset for next ad
        setCountdown(4);
      }
    }

    return () => clearInterval(timer);
  }, [step, isPlaying, countdown, adsWatched, listing, boostListing]);

  const startNextAd = () => {
    setCountdown(4);
    setIsPlaying(true);
    setStep('watching');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center shadow">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-950 dark:text-white text-base font-display">
                Boost Your Listing
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                100% Free • Voluntary Rewarded Ads
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Target Listing Summary */}
          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                Target Listing
              </p>
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                {listing.title}
              </h4>
              <p className="text-xs text-zinc-500">
                Current Status: {listing.isBoosted ? 'Already Boosted' : 'Standard Placement'}
              </p>
            </div>
          </div>

          {/* STEP: INTRO */}
          {step === 'intro' && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h4 className="text-xl font-extrabold text-zinc-900 dark:text-white font-display">
                  Get More Visibility
                </h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Watch 5 short sponsor messages voluntarily to unlock a <strong className="text-zinc-900 dark:text-white">24-hour boost</strong>. Your listing will appear pinned near the top of OAU campus searches.
                </p>
              </div>

              {/* Honest Notice */}
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl text-left text-xs text-zinc-600 dark:text-zinc-400 space-y-1 border border-zinc-200/80 dark:border-zinc-700/60">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
                  No Forced Ads Ever
                </p>
                <p>
                  We never interrupt your normal browsing with popups. Rewarded ads are 100% voluntary and empower students to promote items without paying cash.
                </p>
              </div>

              {/* Start Button */}
              <button
                type="button"
                onClick={startNextAd}
                className="w-full py-4 px-6 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-2xl shadow-xl shadow-orange-600/25 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Watch 5 Ads to Unlock Boost (0/5 Completed)
              </button>
            </div>
          )}

          {/* STEP: WATCHING AD SIMULATION */}
          {step === 'watching' && (
            <div className="space-y-6">
              {/* Progress Tracker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <span>Ad Progress</span>
                  <span className="text-orange-600 dark:text-orange-400">
                    {adsWatched} / {totalRequired} Completed
                  </span>
                </div>
                {/* 5 Progress Bars */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <div
                      key={index}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        index < adsWatched
                          ? 'bg-emerald-500'
                          : index === adsWatched && isPlaying
                          ? 'bg-orange-500 animate-pulse'
                          : 'bg-zinc-200 dark:bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Simulated Ad Display Screen */}
              <div className={`relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br ${currentSponsor.color} p-6 text-white flex flex-col justify-between shadow-lg`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2 py-0.5 bg-black/40 rounded-md backdrop-blur-sm uppercase font-bold tracking-wider text-[10px]">
                    Campus Sponsor
                  </span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/50 rounded-full font-mono font-bold text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>0:0{countdown}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white/80">{currentSponsor.brand}</p>
                  <h4 className="text-lg sm:text-xl font-bold font-display leading-tight">
                    {currentSponsor.headline}
                  </h4>
                  <p className="text-xs text-white/90">{currentSponsor.tagline}</p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-white/70">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" /> Audio enabled
                  </span>
                  <span>Demo Rewarded Video Simulation</span>
                </div>
              </div>

              {/* Ad Controls / Status */}
              <div className="text-center">
                {isPlaying ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Watching ad {adsWatched + 1} of 5... (Auto-advances when finished)
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={startNextAd}
                    className="w-full py-3.5 px-6 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-2xl shadow transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Watch Next Ad ({adsWatched}/{totalRequired})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP: COMPLETED */}
          {step === 'completed' && (
            <div className="text-center py-6 space-y-6 animate-fadeIn">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow">
                  Boost Active 🚀
                </span>
                <h4 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">
                  Your listing has been boosted!
                </h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
                  5/5 voluntary ads watched. Your listing will now enjoy enhanced placement on the campus feed.
                </p>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-around text-center">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Boost Duration</p>
                  <p className="text-base font-bold text-zinc-900 dark:text-white font-display">24 Hours</p>
                </div>
                <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Time Remaining</p>
                  <p className="text-base font-bold text-orange-600 dark:text-orange-400 font-display">23h 59m</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-2xl text-sm shadow transition-all cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
