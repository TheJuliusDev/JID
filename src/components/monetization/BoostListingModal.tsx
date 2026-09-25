import React, { useState, useMemo, useCallback } from 'react';
import { MarketplaceItem, PropertyListing } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { BRAND_CONFIG } from '../../config/brand';
import {
  isRewardedAdsAvailable,
  requiredAdsCount,
  watchAdsForBoost,
} from '../../services/adService';
import { createBoost } from '../../services/database';
import {
  X,
  Zap,
  Play,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface BoostListingModalProps {
  listing: MarketplaceItem | PropertyListing;
  onClose: () => void;
}

type Stage = 'intro' | 'watching' | 'saving' | 'done' | 'error';

export const BoostListingModal: React.FC<BoostListingModalProps> = ({ listing, onClose }) => {
  const { user } = useAuth();

  const listingType: 'marketplace' | 'property' = 'roomType' in listing ? 'property' : 'marketplace';
  const totalRequired = requiredAdsCount();
  const adsAvailable = useMemo(() => isRewardedAdsAvailable(), []);
  const durationHours = BRAND_CONFIG.boostRules.durationHours;

  const [stage, setStage] = useState<Stage>('intro');
  const [watched, setWatched] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runBoost = useCallback(async () => {
    if (!user) {
      setError('Please sign in to boost your listing.');
      setStage('error');
      return;
    }
    setError(null);
    setWatched(0);
    setStage('watching');
    try {
      // The reward is granted ONLY if the provider confirms every ad was watched.
      const completed = await watchAdsForBoost((w) => setWatched(w));
      if (!completed) {
        setError('The ads were closed before finishing. Watch all of them to unlock your boost.');
        setStage('error');
        return;
      }
      setStage('saving');
      await createBoost(listingType, listing.id, user.id);
      setStage('done');
    } catch (err: any) {
      console.error('[boost] failed', err);
      setError(err?.message || 'Could not activate your boost. Please try again.');
      setStage('error');
    }
  }, [user, listing.id, listingType]);

  const progressPct = totalRequired > 0 ? Math.round((watched / totalRequired) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={stage === 'watching' || stage === 'saving' ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-950 dark:text-white text-base font-display">Boost Your Listing</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Free • Watch {totalRequired} short ads</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={stage === 'watching' || stage === 'saving'}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Target listing summary */}
          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex-shrink-0">
              {listing.images[0] ? (
                <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                  <Zap className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Target Listing
              </p>
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">{listing.title}</h4>
              <p className="text-xs text-zinc-500">
                {listing.isBoosted ? 'Currently boosted' : 'Standard placement'}
              </p>
            </div>
          </div>

          {/* Ads not configured — never fake a completion */}
          {!adsAvailable ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="font-bold text-zinc-900 dark:text-white text-base font-display">
                  Boosting is temporarily unavailable
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Rewarded ads aren’t available right now, so boosts can’t be unlocked at the moment. Your
                  listing stays live with standard placement — please check back soon.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs rounded-xl shadow cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : stage === 'intro' ? (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h4 className="text-xl font-extrabold text-zinc-900 dark:text-white font-display">Get more visibility</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Watch {totalRequired} short sponsor ads to unlock a{' '}
                  <strong className="text-zinc-900 dark:text-white">{durationHours}-hour boost</strong>. Your listing
                  gets pinned near the top of OAU campus searches.
                </p>
              </div>

              <div className="p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl text-left text-xs text-zinc-600 dark:text-zinc-400 space-y-1 border border-zinc-200/80 dark:border-zinc-700/60">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  100% voluntary — no payment ever
                </p>
                <p>
                  We never interrupt normal browsing with ads. This is the only way to promote a listing, and it
                  always stays free.
                </p>
              </div>

              <button
                type="button"
                onClick={runBoost}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Watch {totalRequired} ads to unlock boost
              </button>
            </div>
          ) : stage === 'watching' || stage === 'saving' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <span>{stage === 'saving' ? 'Activating boost…' : 'Watching ads'}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {watched} / {totalRequired}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${stage === 'saving' ? 100 : progressPct}%` }}
                  />
                </div>
              </div>

              <div className="aspect-video rounded-2xl bg-zinc-950 flex flex-col items-center justify-center gap-3 text-white">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <p className="text-xs text-zinc-300">
                  {stage === 'saving' ? 'Finalizing your 24-hour boost…' : `Playing ad ${Math.min(watched + 1, totalRequired)} of ${totalRequired}…`}
                </p>
              </div>

              <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
                Please keep this window open until all ads finish.
              </p>
            </div>
          ) : stage === 'error' ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="font-bold text-zinc-900 dark:text-white text-base font-display">Boost not activated</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{error}</p>
              </div>
              <div className="flex justify-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={runBoost}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : (
            /* done */
            <div className="text-center py-4 space-y-6 animate-fadeIn">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">Your listing is boosted!</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
                  All {totalRequired} ads watched. Your listing now enjoys enhanced placement on the campus feed.
                </p>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
                <Clock className="w-4 h-4 text-emerald-600" />
                Active for {durationHours} hours
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-2xl text-sm shadow transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
