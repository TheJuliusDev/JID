/**
 * Administrator sign-in for the JID console.
 *
 * This is intentionally a separate surface from the consumer auth modal: admin
 * sessions get a different treatment (re-verification on every entry, no
 * "sign up" path, no social login), and an operator should never be able to
 * wander into the console from the public navbar.
 *
 * The form does not decide who is an administrator. It signs in, and the gate
 * then asks the database (`admin_session`) whether that account holds the admin
 * role.
 */

import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { BRAND_CONFIG } from '../../config/brand';

interface AdminLoginProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onExit: () => void;
  /** Message carried over from a failed role check, e.g. "not an administrator". */
  notice?: string | null;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, onExit, notice }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await onLogin(email.trim(), password);
      // On success the gate re-checks the role against the database; a failure
      // here means the credentials themselves were wrong.
      if (!result.success) setError(result.error || 'Sign in failed.');
    } catch {
      setError('Sign in failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-50 dark:bg-charcoal-950 text-zinc-950 dark:text-zinc-100 flex items-center justify-center p-6 transition-colors duration-200">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight">{BRAND_CONFIG.name} Admin</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Restricted area. Sign in with an administrator account.
            </p>
          </div>
        </div>

        {notice && (
          <p className="flex items-start gap-2 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            {notice}
          </p>
        )}

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Administrator email"
              autoComplete="email"
              autoFocus
              className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:ring-2 focus:ring-emerald-600/40 focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </label>
          <label className="block">
            <span className="sr-only">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:ring-2 focus:ring-emerald-600/40 focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </label>

          {error && (
            <p role="alert" className="flex items-start gap-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Sign in
          </button>
        </form>

        <button
          type="button"
          onClick={onExit}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to {BRAND_CONFIG.name}
        </button>
      </div>
    </div>
  );
};