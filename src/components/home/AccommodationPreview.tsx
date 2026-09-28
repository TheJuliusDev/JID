import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, MapPin, PackageOpen } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { BRAND_CONFIG } from '../../config/brand';
import { listProperties } from '../../services/database';
import type { PropertyListing } from '../../types';
import { PropertyCard } from '../accommodation/PropertyCard';
import { ScrollReveal } from '../ScrollReveal';

interface AccommodationPreviewProps {
  onOpenAccommodation: () => void;
  onOpenCreateListing: () => void;
  onOpenProfile: (username: string) => void;
}

/** Home page preview of Accommodation. Live listings only — no invented rooms. */
export const AccommodationPreview: React.FC<AccommodationPreviewProps> = ({
  onOpenAccommodation,
  onOpenCreateListing,
  onOpenProfile,
}) => {
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [area, setArea] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listProperties({ limit: 9, sort: 'newest' });
        if (!cancelled) setProperties(rows);
      } catch (err) {
        if (!cancelled) console.error('[home] accommodation preview failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (area === 'all' ? properties : properties.filter((p) => p.area === area)).slice(0, 3),
    [properties, area]
  );

  return (
    <section className="py-16 sm:py-20 bg-white dark:bg-charcoal-900 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-850/60 text-amber-800 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" />
                Accommodation
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-black text-zinc-950 dark:text-white tracking-tight mt-3">
                Lodges around OAU, listed directly
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 max-w-xl">
                Water source, power setup, security and yearly rent stated up front — no agent inspection fees.
              </p>
            </div>
            <button
              onClick={onOpenAccommodation}
              className="group inline-flex items-center gap-2 self-start md:self-auto px-5 py-3 bg-zinc-900 dark:bg-white hover:bg-amber-600 dark:hover:bg-amber-600 text-white dark:text-zinc-950 dark:hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-[0.98] cursor-pointer shadow-sm"
            >
              Browse all lodges
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
            {['all', ...BRAND_CONFIG.campusLocations.offCampusAreas].map((option) => (
              <button
                key={option}
                onClick={() => setArea(option)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full shrink-0 transition-all cursor-pointer ${
                  area === option
                    ? 'bg-zinc-950 dark:bg-amber-600 text-white shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                <MapPin className="w-3 h-3 text-emerald-500" />
                {option === 'all' ? 'All areas' : option}
              </button>
            ))}
          </div>
        </ScrollReveal>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="aspect-[16/10] w-full bg-zinc-100 dark:bg-zinc-800" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-5 bg-zinc-50 dark:bg-zinc-800/60 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-14 px-6 bg-sand-50 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-3xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
              <PackageOpen className="w-7 h-7" />
            </div>
            <h3 className="font-display text-xl font-bold text-zinc-950 dark:text-white mb-1.5">
              {properties.length === 0 ? 'No lodges listed yet' : 'No lodges in this area yet'}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-5">
              {properties.length === 0
                ? 'Landlords, caretakers and outgoing tenants can list a room directly — no agent fees involved.'
                : 'No live rooms match this area at the moment. Try another neighbourhood or browse everything.'}
            </p>
            <button
              onClick={properties.length === 0 ? onOpenCreateListing : onOpenAccommodation}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl shadow cursor-pointer"
            >
              {properties.length === 0 ? 'List a lodge' : 'View all lodges'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((property, index) => (
              <motion.div
                key={property.id}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={
                  reduceMotion
                    ? { duration: 0.12 }
                    : { duration: 0.45, delay: (index % 3) * 0.06, ease: [0.21, 1, 0.36, 1] }
                }
              >
                <PropertyCard property={property} onClick={onOpenAccommodation} onOpenProfile={onOpenProfile} />
              </motion.div>
            ))}
          </div>
        )}

        {properties.length > 0 && (
          <div className="mt-8 p-6 sm:p-7 rounded-3xl bg-zinc-950 dark:bg-zinc-900 text-white flex flex-col md:flex-row items-center justify-between gap-5 shadow-xl">
            <div>
              <div className="font-display text-lg font-bold text-white mb-1">Got a room, lodge or bed space?</div>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
                List it once and reach students searching in your area — no agents, no queue, no commission.
              </p>
            </div>
            <button
              onClick={onOpenCreateListing}
              className="shrink-0 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer"
            >
              List a lodge
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
