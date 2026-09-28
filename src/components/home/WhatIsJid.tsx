import React from 'react';
import { ArrowRight, Building2, MessageCircle, ShieldCheck, ShoppingBag, Store, Users } from 'lucide-react';
import { BRAND_CONFIG } from '../../config/brand';
import { ScrollReveal } from '../ScrollReveal';

const PILLARS = [
  {
    icon: ShoppingBag,
    title: 'Marketplace',
    body: 'Buy and sell electronics, textbooks, phones and hostel gear with firm naira prices.',
    href: '/marketplace',
    cta: 'Browse items',
  },
  {
    icon: Building2,
    title: 'Accommodation',
    body: 'Find self-cons, shared flats and bed spaces with water, power and rent stated up front.',
    href: '/accommodation',
    cta: 'Find a lodge',
  },
  {
    icon: Store,
    title: 'Sell on JID',
    body: 'Anyone can list. Create a profile, post in a minute and reach buyers campus-wide.',
    href: '/vendors',
    cta: 'Start selling',
  },
] as const;

interface WhatIsJidProps {
  onOpenMarketplace: () => void;
  onOpenAccommodation: () => void;
  onOpenVendors: () => void;
}

/**
 * The one-paragraph "what is JID" answer plus the three things the platform
 * does. Deliberately short — everything else lives on its own page.
 */
export const WhatIsJid: React.FC<WhatIsJidProps> = ({
  onOpenMarketplace,
  onOpenAccommodation,
  onOpenVendors,
}) => {
  const handlers = [onOpenMarketplace, onOpenAccommodation, onOpenVendors];

  return (
    <section className="py-16 sm:py-24 bg-white dark:bg-charcoal-900 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
            <div className="lg:col-span-5">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-850/60 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-bold uppercase tracking-wider">
                What is JID?
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-black text-zinc-950 dark:text-white tracking-tight mt-4 leading-[1.12]">
                One place to buy, sell and settle around campus.
              </h2>
              <p className="mt-4 text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {BRAND_CONFIG.name} replaces scattered WhatsApp status posts and agent-run hostel hunting with a
                searchable, account-based platform built for{' '}
                {BRAND_CONFIG.institution.shortName} students, vendors and property providers in{' '}
                {BRAND_CONFIG.institution.location}.
              </p>

              <div className="mt-6 flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-300">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Accounts, not anonymous numbers
                </span>
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  In-app chat with sellers
                </span>
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Open to students and vendors
                </span>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PILLARS.map((pillar, index) => {
                const Icon = pillar.icon;
                return (
                  <ScrollReveal key={pillar.title} delay={0.08 * index}>
                    <button
                      onClick={handlers[index]}
                      className="w-full h-full text-left p-6 bg-sand-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-zinc-950 dark:bg-emerald-600 text-white flex items-center justify-center mb-4">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white mb-1.5">
                        {pillar.title}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">{pillar.body}</p>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {pillar.cta}
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};
