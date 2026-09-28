import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Cookie, ShieldCheck, X } from 'lucide-react';
import { BRAND_CONFIG } from '../../config/brand';
import { useCookieConsent } from '../../context/CookieConsentContext';
import { NavLink } from '../../router/RouterProvider';

const BRAND_COPY = {
  first: `${BRAND_CONFIG.name} stores a little data in your browser to keep you signed in and remember whether you are using light or dark mode. We do not use advertising cookies, and we do not track you across other websites.`,
  settings:
    'You can change your choice below. Essential storage keeps you signed in and records this decision; there is no advertising or cross-site tracking either way.',
} as const;

const LEGAL_LINKS = [
  { to: 'cookies', label: 'Cookie policy' },
  { to: 'privacy', label: 'Privacy policy' },
  { to: 'terms', label: 'Terms' },
] as const;

/**
 * Non-blocking cookie notice.
 *
 * It deliberately does not dim the page or trap focus: the app works exactly the
 * same whether or not anyone touches it, because nothing on JID depends on
 * optional tracking. It sits above the mobile bottom bar so it never covers
 * navigation, and the footer carries a "Cookie settings" link that reopens it
 * with the visitor's previous choice selected.
 */
export const CookieConsentBanner: React.FC = () => {
  const { isBannerOpen, hasDecided, choice, saveChoice, dismissForSession } = useCookieConsent();
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  // Escape is the conventional way out of a non-modal dialog: it hides the
  // notice for the rest of the visit without recording a decision, so the
  // visitor is asked again next time rather than being silently opted in.
  useEffect(() => {
    if (!isBannerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissForSession();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBannerOpen, dismissForSession]);

  // Move focus to the panel when it is reopened from the footer, so keyboard
  // and screen-reader users are not left at the top of the document.
  useEffect(() => {
    if (isBannerOpen && hasDecided) cardRef.current?.focus();
  }, [isBannerOpen, hasDecided]);

  return (
    <AnimatePresence>
      {isBannerOpen && (
        <motion.div
          key="cookie-consent"
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-consent-title"
          aria-describedby="cookie-consent-body"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-40 pointer-events-none px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem] sm:max-w-[calc(100vw-3rem)] sm:pb-0 sm:px-0"
        >
          <div
            ref={cardRef}
            tabIndex={-1}
            className="pointer-events-auto outline-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl shadow-zinc-950/15 dark:shadow-black/50 p-5 sm:p-6"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Cookie className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="cookie-consent-title"
                  className="font-display text-base font-black tracking-tight text-zinc-950 dark:text-white"
                >
                  {hasDecided ? 'Your cookie settings' : 'Your privacy, in your hands'}
                </h2>
                {hasDecided && (
                  <p className="mt-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Currently: {choice === 'all' ? 'Accept all' : 'Essential only'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={dismissForSession}
                aria-label="Close cookie notice"
                className="p-1.5 -mt-1 -mr-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p id="cookie-consent-body" className="mt-3.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {BRAND_COPY[hasDecided ? 'settings' : 'first']}
            </p>

            <nav aria-label="Legal" className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {LEGAL_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline underline-offset-2"
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center gap-2">
              <button
                type="button"
                onClick={() => saveChoice('essential')}
                className="sm:flex-1 w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Essential only
              </button>
              <button
                type="button"
                onClick={() => saveChoice('all')}
                className="sm:flex-1 w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Accept all
              </button>
            </div>

            <p className="mt-3 text-[10px] text-zinc-500 dark:text-zinc-500 leading-relaxed">
              You can change this at any time from &ldquo;Cookie settings&rdquo; in the footer. See the{' '}
              <NavLink
                to="cookies"
                className="underline underline-offset-2 hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                cookie policy
              </NavLink>{' '}
              for the full list of what we store.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
