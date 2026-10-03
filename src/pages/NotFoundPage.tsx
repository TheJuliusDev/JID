import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Compass } from 'lucide-react';
import { MAIN_NAV_VIEWS, getRoute } from '../router/routes';
import { NavLink } from '../router/RouterProvider';

/** Branded 404 for any unknown URL. */
export const NotFoundPage: React.FC = () => {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-sand-50 to-sand-100 dark:from-charcoal-950 dark:via-charcoal-950 dark:to-charcoal-900 transition-colors duration-200">
      <div className="absolute inset-0 modern-grid-pattern pointer-events-none opacity-60 dark:opacity-40" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0.12 } : { duration: 0.45, ease: [0.21, 1, 0.36, 1] }}
        >
          <div className="w-16 h-16 rounded-2xl bg-zinc-950 dark:bg-zinc-800 text-white flex items-center justify-center mx-auto mb-6">
            <Compass className="w-7 h-7" />
          </div>
          <div className="font-mono-code text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold mb-3">
            Error 404
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-black text-zinc-950 dark:text-white tracking-tight leading-tight">
            That page isn&apos;t on the map.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-lg mx-auto">
            The link may be out of date, or the page may have moved. Everything on JID is one click away below.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {MAIN_NAV_VIEWS.filter((view) => view !== 'home').map((view) => (
              <NavLink
                key={view}
                to={view}
                className="px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:border-emerald-400 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
              >
                {getRoute(view)?.title ?? view}
              </NavLink>
            ))}
          </div>

          <div className="mt-8">
            <NavLink
              to="marketplace"
              className="group inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-7 py-3.5 rounded-2xl text-sm shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98]"
            >
              Back to home
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </NavLink>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
