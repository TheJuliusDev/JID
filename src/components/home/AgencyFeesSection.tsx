import React from 'react';
import { HandCoins, ArrowRight } from 'lucide-react';
import { ScrollReveal } from '../ScrollReveal';

interface AgencyFeesSectionProps {
  onOpenAccommodation: () => void;
}

export const AgencyFeesSection: React.FC<AgencyFeesSectionProps> = ({ onOpenAccommodation }) => (
  <section className="py-12 sm:py-16 bg-white dark:bg-charcoal-900 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-3xl border border-amber-200/80 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 via-white to-sand-50 dark:from-amber-950/20 dark:via-zinc-900 dark:to-charcoal-900 p-6 sm:p-9 shadow-md">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="shrink-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25">
                <HandCoins className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                The agency-fee problem
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-black text-zinc-950 dark:text-white tracking-tight mt-1.5 leading-snug">
                Finding a lodge is already stressful.{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-rose-600 dark:from-amber-400 dark:to-rose-400">
                  Expensive agency fees make it worse.
                </span>
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                {`JID connects you directly with landlords and current lodgers around OAU — discover self-cons and rooms yourself, without the middleman.`}
              </p>
            </div>

            <button
              onClick={onOpenAccommodation}
              className="inline-flex items-center justify-center gap-2 shrink-0 bg-zinc-950 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              Find a lodge
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </ScrollReveal>
    </div>
  </section>
);