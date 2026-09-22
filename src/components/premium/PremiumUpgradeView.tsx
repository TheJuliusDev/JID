import React, { useState } from 'react';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import { 
  Sparkles, 
  Check, 
  ShieldCheck, 
  Zap, 
  Eye, 
  TrendingUp, 
  Sliders, 
  Crown, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

export const PremiumUpgradeView: React.FC = () => {
  const { user, upgradeToPremium } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'semester' | 'annual'>('semester');
  const [isUpgraded, setIsUpgraded] = useState(false);

  const handleSimulatedUpgrade = () => {
    upgradeToPremium(selectedPlan);
    setIsUpgraded(true);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      {/* Editorial Header */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-full text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4 fill-current" />
          <span>JID Campus Pro</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-zinc-950 dark:text-white font-display tracking-tight leading-tight">
          Stand out on campus.
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Unlock high-impact seller visibility, advanced accommodation filters, and dedicated analytics tailored for Great Ife students and campus entrepreneurs.
        </p>
      </div>

      {/* Current Plan Status Banner */}
      <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Current Membership</p>
            <h3 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2 font-display">
              {user?.isPremium ? 'Premium Member' : 'Free Campus Plan'}
              {user?.isPremium && (
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full">
                  Active
                </span>
              )}
            </h3>
            {user?.premiumUntil && (
              <p className="text-xs text-zinc-400">Valid until {new Date(user.premiumUntil).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        {user?.isPremium ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4" />
            All Premium Privileges Unlocked
          </div>
        ) : (
          <div className="text-xs text-zinc-500">
            Up to 3 active listings on Free tier
          </div>
        )}
      </div>

      {/* Success Notification */}
      {isUpgraded && (
        <div className="p-5 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-sm">Congratulations! Your account is now upgraded to Premium Member.</h4>
            <p className="text-xs mt-0.5">Your listings will now receive 3x organic visibility and display the official gold Premium Member badge.</p>
          </div>
        </div>
      )}

      {/* Tangible Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/70 text-orange-600 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white font-display">
            3x Higher Listing Visibility
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Your products and hostels appear above standard free listings on category landing pages and campus search results.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white font-display">
            Official &ldquo;Premium Member&rdquo; Badge
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Stand out to student buyers with our dedicated gold badge. Clearly distinguishes serious campus entrepreneurs.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white font-display">
            Up to 20 Active Listings
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Expand beyond the 3-listing limit. Perfect for students running campus clothing brands, tech repairs, or multiple lodge units.
          </p>
        </div>
      </div>

      {/* Plan Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Monthly Plan */}
        <div 
          onClick={() => setSelectedPlan('monthly')}
          className={`p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between space-y-6 ${
            selectedPlan === 'monthly'
              ? 'bg-white dark:bg-zinc-900 border-orange-500 shadow-xl ring-2 ring-orange-500/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Monthly Pass</span>
              <span className="text-xs text-zinc-400">1 Month</span>
            </div>
            <div className="text-3xl font-black text-zinc-950 dark:text-white font-display">
              {BRAND_CONFIG.currency.format(BRAND_CONFIG.premiumPricing.monthly)}
            </div>
            <p className="text-xs text-zinc-500">Ideal for selling high-value items during exam clearance.</p>
          </div>

          <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Up to 10 active items</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Premium Member Badge</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> In-App messaging priority</div>
          </div>
        </div>

        {/* Semester Plan (Recommended) */}
        <div 
          onClick={() => setSelectedPlan('semester')}
          className={`relative p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between space-y-6 ${
            selectedPlan === 'semester'
              ? 'bg-white dark:bg-zinc-900 border-orange-600 shadow-2xl ring-2 ring-orange-600/30'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
          }`}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-full shadow-md">
            Most Popular for Students
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Full Semester</span>
              <span className="text-xs text-zinc-400">4 Months</span>
            </div>
            <div className="text-3xl font-black text-zinc-950 dark:text-white font-display">
              {BRAND_CONFIG.currency.format(BRAND_CONFIG.premiumPricing.semester)}
            </div>
            <p className="text-xs text-zinc-500">Save 25% across the entire academic session.</p>
          </div>

          <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Up to 20 active items</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> 3x Boost multiplier</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Advanced Lodge filter alerts</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Premium Member Badge</div>
          </div>
        </div>

        {/* Annual Plan */}
        <div 
          onClick={() => setSelectedPlan('annual')}
          className={`p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between space-y-6 ${
            selectedPlan === 'annual'
              ? 'bg-white dark:bg-zinc-900 border-orange-500 shadow-xl ring-2 ring-orange-500/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Annual Pass</span>
              <span className="text-xs text-zinc-400">12 Months</span>
            </div>
            <div className="text-3xl font-black text-zinc-950 dark:text-white font-display">
              {BRAND_CONFIG.currency.format(BRAND_CONFIG.premiumPricing.annual)}
            </div>
            <p className="text-xs text-zinc-500">Best value for campus agents, stores, and hostel managers.</p>
          </div>

          <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Unlimited listings</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Listing analytics & views charts</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Priority caretaker verification</div>
          </div>
        </div>
      </div>

      {/* Upgrade CTA */}
      <div className="text-center space-y-3 pt-6">
        <button
          onClick={handleSimulatedUpgrade}
          className="px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold rounded-2xl shadow-xl shadow-orange-600/25 text-sm sm:text-base transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <Sparkles className="w-5 h-5 fill-current" />
          {user?.isPremium ? 'Extend Premium Membership' : `Upgrade to Premium (${selectedPlan.toUpperCase()})`}
        </button>
        <p className="text-xs text-zinc-500">
          Demo Mode Simulation: Click to activate Premium perks instantly without real payment deduction.
        </p>
      </div>
    </div>
  );
};
