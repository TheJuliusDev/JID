import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, ShieldCheck, Zap } from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import { AuthForm, AuthMode } from '../components/auth/AuthForm';
import { NavLink, useRouter } from '../router/RouterProvider';

interface AuthPageProps {
  mode: Extract<AuthMode, 'login' | 'signup'>;
  /** Where to send the visitor once they are authenticated. */
  redirectTo: 'home' | 'marketplace' | 'accommodation';
}

const COPY = {
  login: {
    eyebrow: 'Welcome back',
    title: 'Log in to your JID account',
    description: 'Pick up your saved items, messages and listings where you left off.',
  },
  signup: {
    eyebrow: 'Join the campus',
    title: 'Create your free JID account',
    description: 'Buy, sell and message other people on campus. Free to join, free to list.',
  },
} as const;

/** Shared shell for /login and /signup. */
export const AuthPage: React.FC<AuthPageProps> = ({ mode, redirectTo }) => {
  const reduceMotion = useReducedMotion();
  const { navigate } = useRouter();
  const copy = COPY[mode];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-sand-50 to-sand-100 dark:from-charcoal-950 dark:via-charcoal-950 dark:to-charcoal-900 transition-colors duration-200">
      <div className="absolute inset-0 modern-grid-pattern pointer-events-none opacity-60 dark:opacity-40" />
      <div className="absolute top-0 right-1/4 w-[460px] h-[280px] bg-emerald-500/10 dark:bg-emerald-500/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0.12 } : { duration: 0.45, ease: [0.21, 1, 0.36, 1] }}
          className="grid grid-cols-1 md:grid-cols-12 rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl"
        >
          {/* Brand panel */}
          <div className="md:col-span-5 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white p-7 sm:p-9 flex flex-col justify-between relative overflow-hidden border-b md:border-b-0 md:border-r border-zinc-800">
            <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-3 h-3 rounded-full bg-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  {BRAND_CONFIG.name} • {BRAND_CONFIG.institution.sobriquet}
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                {copy.title}
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed mt-3">{copy.description}</p>
            </div>

            <div className="space-y-3 py-8 relative z-10 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Account-based, not anonymous numbers</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Message sellers and landlords directly</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Free ad-powered listing boosts</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 relative z-10">
              Any valid email works — you don’t need an OAU address to join.
            </p>
          </div>

          {/* Form panel */}
          <div className="md:col-span-7 bg-white dark:bg-zinc-900 p-7 sm:p-9">
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                {copy.eyebrow}
              </span>
            </div>

            <AuthForm
              initialMode={mode}
              onAuthenticated={() => navigate(redirectTo)}
              className="max-w-md"
            />

            <p className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 text-center">
              {mode === 'login' ? (
                <>
                  New to {BRAND_CONFIG.name}?{' '}
                  <NavLink to="signup" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                    Create a free account
                  </NavLink>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <NavLink to="login" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                    Log in
                  </NavLink>
                </>
              )}
            </p>

            <p className="mt-4 text-[11px] text-zinc-400 text-center">
              By continuing, you agree to the {BRAND_CONFIG.name} campus honor code and safety standards.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
