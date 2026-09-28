import React from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  Heart,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  X,
} from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import { PageHeader } from '../components/common/PageHeader';
import { ScrollReveal } from '../components/ScrollReveal';
import { SocialProofSection } from '../components/SocialProofSection';
import { FaqSection } from '../components/FaqSection';
import { NavLink } from '../router/RouterProvider';

const WHO_IT_SERVES = [
  {
    icon: Users,
    title: 'Students',
    body: 'Buy used electronics and course materials, sell what you no longer need, and find a lodge without paying agent inspection fees.',
  },
  {
    icon: Store,
    title: 'Vendors & sellers',
    body: 'Anyone with something to sell can create a profile, list products, and reach buyers across campus. Students are welcome, never required.',
  },
  {
    icon: Building2,
    title: 'Property providers',
    body: 'Landlords, caretakers, agents and outgoing tenants list rooms directly with the water, power and rent details students actually ask about.',
  },
] as const;

const PROBLEMS = [
  'Scrolling through dozens of WhatsApp statuses hoping to find a used textbook or a working mini-fridge.',
  'Paying non-refundable inspection fees to agents just to see one room in Asherifa.',
  '"DM for price" games that waste hours of study time.',
  'No reliable way to tell whether an online seller is a real campus member or a stranger.',
];

const STANDARDS = [
  'Searchable listings with real specs, condition and naira prices.',
  'Direct property listings with no "agent form" extortion.',
  'Water source, power setup and distance to the gate stated up front.',
  'Daylight handovers at recognised campus spots such as SUB, Hezekiah Library and hall quadrangles.',
];

/** /about — what JID is, why it exists, who it serves and how it behaves. */
export const AboutPage: React.FC<{ onContact: () => void }> = ({ onContact }) => (
  <>
    <PageHeader
      eyebrow={`About ${BRAND_CONFIG.name}`}
      title="A campus marketplace that behaves like a real platform."
      description={`${BRAND_CONFIG.name} is a student-focused marketplace and accommodation platform for ${BRAND_CONFIG.institution.name} (${BRAND_CONFIG.institution.shortName}), ${BRAND_CONFIG.institution.location}. It exists for one reason: buying, selling and finding a place to live on this campus should not depend on disappearing status posts and agent commissions.`}
      highlights={[`Built in ${BRAND_CONFIG.institution.location.split(',')[0]}`, 'Accounts, not anonymous numbers', 'No commission on sales']}
    />

    {/* What it is */}
    <section className="py-16 sm:py-20 bg-white dark:bg-charcoal-900 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScrollReveal>
            <div className="h-full p-7 sm:p-8 bg-sand-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
              <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-5">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h2 className="font-display text-xl font-bold text-zinc-950 dark:text-white mb-2">Marketplace</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-5">
                Electronics, phones, laptops, textbooks, fashion and hostel furniture, listed by people on campus with a
                price, a condition and a pickup location attached. Buyers can save listings, message sellers, and arrange
                a daylight handover.
              </p>
              <NavLink
                to="marketplace"
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Visit the marketplace
                <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.08}>
            <div className="h-full p-7 sm:p-8 bg-sand-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
              <div className="w-11 h-11 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center mb-5">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="font-display text-xl font-bold text-zinc-950 dark:text-white mb-2">Accommodation</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-5">
                Self-contained rooms, shared flats, studios and bed spaces around {BRAND_CONFIG.institution.shortName},
                listed directly by landlords and outgoing tenants. Every listing states its yearly rent, water source,
                power setup, security and distance to the gate.
              </p>
              <NavLink
                to="accommodation"
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Browse lodges
                <ArrowRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>

    {/* Who it serves */}
    <section className="py-16 sm:py-20 bg-sand-50 dark:bg-charcoal-950 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">
              Who JID serves
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Three groups, one marketplace. Anyone can buy, anyone can sell.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {WHO_IT_SERVES.map((group, index) => {
            const Icon = group.icon;
            return (
              <ScrollReveal key={group.title} delay={0.06 * index}>
                <div className="h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-7">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-950 dark:bg-zinc-800 text-white flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white">{group.title}</h3>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{group.body}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>

    <SocialProofSection />

    {/* Why it exists */}
    <section className="py-16 sm:py-20 bg-white dark:bg-charcoal-900 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScrollReveal>
            <div className="h-full p-7 sm:p-8 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-[11px] font-bold uppercase tracking-wider mb-4">
                <X className="w-4 h-4" />
                The problem
              </div>
              <h3 className="font-display text-xl font-bold text-zinc-950 dark:text-white mb-4">
                What campus trade and housing look like without a platform
              </h3>
              <ul className="space-y-3">
                {PROBLEMS.map((problem) => (
                  <li key={problem} className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="text-rose-500 font-bold mt-0.5">&times;</span>
                    {problem}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.08}>
            <div className="h-full p-7 sm:p-8 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider mb-4">
                <Heart className="w-4 h-4" />
                Why JID exists
              </div>
              <h3 className="font-display text-xl font-bold text-zinc-950 dark:text-white mb-4">
                A standard for how this campus should trade
              </h3>
              <ul className="space-y-3">
                {STANDARDS.map((standard) => (
                  <li key={standard} className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    {standard}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={0.12}>
          <div className="mt-8 p-6 sm:p-7 rounded-3xl bg-zinc-950 dark:bg-zinc-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="font-display text-lg font-bold text-white mb-1">
                  Made for {BRAND_CONFIG.institution.sobriquet}
                </div>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-xl leading-relaxed">
                  {BRAND_CONFIG.institution.landmark} — the places where students actually meet, trade and hand over
                  what they bought.
                </p>
              </div>
            </div>
            <NavLink
              to="contact"
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-6 py-3.5 rounded-xl transition-all active:scale-[0.98]"
            >
              Questions? Contact us
              <ArrowRight className="w-4 h-4" />
            </NavLink>
          </div>
        </ScrollReveal>
      </div>
    </section>

    <FaqSection onContact={onContact} />

    {/* Closing CTA */}
    <section className="py-16 sm:py-20 bg-sand-50 dark:bg-charcoal-950 transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto mb-5" />
          <h2 className="font-display text-2xl sm:text-4xl font-black text-zinc-950 dark:text-white tracking-tight">
            Ready to see it in action?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-300 max-w-lg mx-auto leading-relaxed">
            Browse live listings, or start selling on JID — it is free to join and free to list.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <NavLink
              to="marketplace"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-7 py-3.5 rounded-2xl text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
            >
              <ShoppingBag className="w-4 h-4" />
              Browse the marketplace
            </NavLink>
            <NavLink
              to="vendors"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white font-bold px-7 py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98]"
            >
              <Store className="w-4 h-4 text-emerald-600" />
              Start selling on JID
            </NavLink>
          </div>
        </ScrollReveal>
      </div>
    </section>
  </>
);
