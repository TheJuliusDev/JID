/**
 * The security boundary for the JID admin console.
 *
 * Everything below this component assumes `phase === 'authorized'`, and that
 * verdict never comes from the browser: it is the response of the
 * `admin_session` RPC, which reads the admin role from the database for the
 * caller's own JWT. Hiding the nav link, checking `profiles.is_admin`, or any
 * client-side flag is UX only — this is the check that counts, and every RPC
 * behind it repeats the same verification server-side.
 *
 * Phases:
 *   checking      — resolving the session / asking the database who you are
 *   signed-out    — show the admin sign-in form
 *   denied        — authenticated, but not an administrator (logged server-side)
 *   not-deployed  — the admin SQL migration has not been applied yet
 *   authorized    — render the console
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, LogOut, ShieldAlert, Terminal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { AdminApiError, getAdminSession, logAccessDenied } from '../../services/adminApi';
import type { AdminSession } from '../../services/adminApi';
import { BRAND_CONFIG } from '../../config/brand';
import { AdminLogin } from './AdminLogin';
import { AdminShell } from './AdminShell';

interface AdminGateProps {
  onExit: () => void;
}

type GatePhase = 'checking' | 'signed-out' | 'denied' | 'not-deployed' | 'authorized';

export const AdminGate: React.FC<AdminGateProps> = ({ onExit }) => {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const [phase, setPhase] = useState<GatePhase>('checking');
  const [session, setSession] = useState<AdminSession | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  // Guards against logging the same denied attempt repeatedly.
  const deniedLoggedFor = useRef<string | null>(null);

  const verify = useCallback(async () => {
    deniedLoggedFor.current = null;
    setFatal(null);
    try {
      const result = await getAdminSession();
      if (result.authenticated && result.is_admin) {
        setSession(result);
        setPhase('authorized');
      } else if (result.authenticated) {
        setPhase('denied');
      } else {
        setSession(null);
        setPhase('signed-out');
      }
    } catch (err) {
      if (err instanceof AdminApiError && err.kind === 'not-deployed') {
        setPhase('not-deployed');
        return;
      }
      setFatal(
        err instanceof AdminApiError
          ? err.message
          : 'Could not verify your access. Check your connection and try again.'
      );
      setPhase('denied');
    }
  }, []);

  // Verify whenever the signed-in identity changes, and once on mount.
  useEffect(() => {
    if (isLoading) {
      setPhase('checking');
      return;
    }
    if (!isAuthenticated || !user) {
      setSession(null);
      setPhase('signed-out');
      return;
    }
    setPhase('checking');
    void verify();
  }, [isLoading, isAuthenticated, user?.id, verify]);

  // A revoked role, expired session or sign-out must drop the console
  // immediately rather than leaving a stale admin screen on screen.
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        verify();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [verify]);

  // Record refused entry attempts. The server stamps the caller's own id, so
  // this can log an attempt but can never frame somebody else.
  useEffect(() => {
    if (phase !== 'denied' || !user?.id) return;
    if (deniedLoggedFor.current === user.id) return;
    deniedLoggedFor.current = user.id;
    void logAccessDenied('console_entry');
  }, [phase, user?.id]);

  if (phase === 'checking') {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400" role="status">
          <span className="w-8 h-8 rounded-xl bg-emerald-600/10 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 animate-pulse text-emerald-600 dark:text-emerald-400" />
          </span>
          <p className="text-sm">Verifying access…</p>
        </div>
      </FullScreen>
    );
  }

  if (phase === 'signed-out') {
    return <AdminLogin onLogin={login} onExit={onExit} />;
  }

  if (phase === 'not-deployed') {
    return (
      <FullScreen>
        <Card
          icon={Terminal}
          title="Admin database functions are not installed"
          tone="warn"
          body={
            <>
              <p>
                The console needs the RPCs and policies in{' '}
                <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                  supabase/migrations/002_admin_panel.sql
                </code>
                . Run that file in the Supabase SQL Editor, then reload this page.
              </p>
              <p className="text-xs opacity-80">
                Nothing else is missing — this is purely a database-side step, and it is safe to
                re-run.
              </p>
            </>
          }
          actions={
            <>
              <button type="button" onClick={verify} className={SECONDARY_BTN}>
                Retry
              </button>
              <button type="button" onClick={onExit} className={PRIMARY_BTN}>
                Back to {BRAND_CONFIG.name}
              </button>
            </>
          }
        />
      </FullScreen>
    );
  }

  if (phase === 'denied') {
    return (
      <FullScreen>
        <Card
          icon={ShieldAlert}
          title="Access denied"
          tone="danger"
          body={
            <>
              <p>
                This account does not hold the administrator role. Access is decided by the
                database, not by this page.
              </p>
              <p className="text-xs opacity-80">
                {fatal
                  ? fatal
                  : 'This attempt has been recorded in the audit log. If you believe this is a mistake, ask another administrator to review your role.'}
              </p>
            </>
          }
          actions={
            <>
              <button type="button" onClick={() => void logout()} className={DANGER_BTN}>
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
              <button type="button" onClick={onExit} className={PRIMARY_BTN}>
                Back to {BRAND_CONFIG.name}
              </button>
            </>
          }
        />
      </FullScreen>
    );
  }

  return (
    <AdminShell session={session!} onExit={onExit} onSignOut={() => void logout()} onRevoked={verify} />
  );
};

const FullScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-sand-50 dark:bg-charcoal-950 text-zinc-950 dark:text-zinc-100 flex items-center justify-center p-6 transition-colors duration-200">
    {children}
  </div>
);

const Card: React.FC<{
  icon: React.ElementType;
  title: string;
  body: React.ReactNode;
  actions: React.ReactNode;
  tone: 'danger' | 'warn';
}> = ({ icon: Icon, title, body, actions, tone }) => (
  <div className="w-full max-w-md text-center space-y-5">
    <div
      className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
        tone === 'danger'
          ? 'bg-rose-500/10 text-rose-500'
          : 'bg-amber-500/10 text-amber-500'
      }`}
    >
      <Icon className="w-8 h-8" />
    </div>
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-black tracking-tight">{title}</h1>
      <div className="text-sm text-zinc-500 dark:text-zinc-400 space-y-2 leading-relaxed">{body}</div>
    </div>
    <div className="flex items-center justify-center gap-3 flex-wrap">{actions}</div>
  </div>
);

const BTN =
  'px-4 py-2.5 font-bold text-sm rounded-xl cursor-pointer transition-colors flex items-center gap-2';
const PRIMARY_BTN = `${BTN} bg-emerald-600 hover:bg-emerald-500 text-white`;
const SECONDARY_BTN = `${BTN} bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750`;
const DANGER_BTN = `${BTN} bg-rose-600 hover:bg-rose-500 text-white`;