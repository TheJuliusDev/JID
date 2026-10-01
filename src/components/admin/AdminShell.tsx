/**
 * Admin console chrome: sidebar, mobile navigation, page routing and the shared
 * toast/refresh plumbing.
 *
 * The shell owns three things the pages should not each reinvent:
 *   - which page is mounted (driven by the app router, so every console screen
 *     is a real, back-button-friendly URL);
 *   - the dashboard counters shown as nav badges;
 *   - the toast queue and the "your access changed" handler, which every page
 *     feeds through so an expired session or a revoked role bounces the
 *     operator out of the console from anywhere.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ExternalLink,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useRouter } from '../../router/RouterProvider';
import { pathForView } from '../../router/routes';
import type { ViewType } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { ThemeToggle } from '../ThemeToggle';
import { ADMIN_NAV, getDashboardStats } from '../../services/adminApi';
import type { AdminApiError, AdminSession, DashboardStats } from '../../services/adminApi';
import { AdminBadge, AdminButton, useToasts, Toaster, useScrollLock } from './ui';
import type { UseToasts } from './ui';

import { OverviewPage } from './pages/OverviewPage';
import { UsersPage } from './pages/UsersPage';
import { ListingsPage } from './pages/ListingsPage';
import { ReportsPage } from './pages/ReportsPage';
import { VendorsPage } from './pages/VendorsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { AuditLogPage } from './pages/AuditLogPage';

// ---------------------------------------------------------------------------
// Chrome context
// ---------------------------------------------------------------------------

interface AdminChromeValue {
  /** The signed-in administrator, as verified by the database. */
  session: AdminSession;
  /** Nav badge counters (dashboard totals). */
  stats: DashboardStats | null;
  refreshStats: () => Promise<void>;
  /** Toast queue shared by every page. */
  toasts: UseToasts;
  /** Navigate between console screens. */
  go: (view: ViewType) => void;
  /** Report an access problem; the gate re-verifies and kicks the operator out. */
  reportAuthProblem: (error: AdminApiError) => void;
}

const AdminChromeContext = createContext<AdminChromeValue | null>(null);

export const useAdminChrome = (): AdminChromeValue => {
  const context = useContext(AdminChromeContext);
  if (!context) throw new Error('useAdminChrome must be used inside the admin console');
  return context;
};

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

interface AdminShellProps {
  session: AdminSession;
  onExit: () => void;
  onSignOut: () => void;
  onRevoked: () => void;
}

export const AdminShell: React.FC<AdminShellProps> = ({ session, onExit, onSignOut, onRevoked }) => {
  const { view, navigate } = useRouter();
  const toasts = useToasts();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useScrollLock(navOpen);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await getDashboardStats());
    } catch {
      // Badges are decorative; a failure here must not break navigation.
    }
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const reportAuthProblem = useCallback(
    (error: AdminApiError) => {
      if (error.kind === 'not-deployed') return;
      toasts.error('Access revoked', error.message);
      onRevoked();
    },
    [onRevoked, toasts]
  );

  const go = useCallback(
    (target: ViewType) => {
      setNavOpen(false);
      navigate(target);
    },
    [navigate]
  );

  const value = useMemo<AdminChromeValue>(
    () => ({ session, stats, refreshStats, toasts, go, reportAuthProblem }),
    [session, stats, refreshStats, toasts, go, reportAuthProblem]
  );

  const current = ADMIN_NAV.find((item) => item.view === view) ?? ADMIN_NAV[0];

  return (
    <AdminChromeContext.Provider value={value}>
      <div className="min-h-screen bg-sand-50 dark:bg-charcoal-950 text-zinc-950 dark:text-zinc-100 font-sans flex transition-colors duration-200">
        {/* ---------------- Desktop sidebar ---------------- */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-charcoal-950 sticky top-0 h-screen">
          <BrandMark />
          <NavList currentView={view} stats={stats} onNavigate={go} />
          <Identity
            session={session}
            stats={stats}
            onExit={onExit}
            onSignOut={onSignOut}
            className="mt-auto"
          />
        </aside>

        {/* ---------------- Mobile drawer ---------------- */}
        <AnimatePresence>
          {navOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setNavOpen(false)}
                className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px]"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                className="relative w-72 max-w-[85vw] flex flex-col bg-white dark:bg-charcoal-950 border-r border-zinc-200 dark:border-zinc-800"
              >
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  aria-label="Close navigation"
                  className="absolute top-4 right-3 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <BrandMark />
                <NavList currentView={view} stats={stats} onNavigate={go} />
                <Identity session={session} stats={stats} onExit={onExit} onSignOut={onSignOut} className="mt-auto" />
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* ---------------- Main column ---------------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-40 bg-white/90 dark:bg-charcoal-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
            <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setNavOpen(true)}
                  aria-label="Open navigation"
                  className="lg:hidden p-2 -ml-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="font-display text-base font-black tracking-tight truncate">
                    {current.label}
                  </h1>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate hidden sm:block">
                    {current.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <ThemeToggle />
                <AdminButton size="sm" variant="ghost" icon={ExternalLink} onClick={onExit}>
                  <span className="hidden sm:inline">Exit</span>
                </AdminButton>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
            <PageView view={view} />
          </main>
        </div>

        <Toaster toasts={toasts.toasts} onDismiss={toasts.dismiss} />
      </div>
    </AdminChromeContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Shell pieces
// ---------------------------------------------------------------------------

const BrandMark: React.FC = () => (
  <div className="px-5 h-16 flex items-center gap-2.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
    <span className="w-8 h-8 rounded-xl bg-emerald-600/10 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
      <ShieldCheck className="w-4 h-4" />
    </span>
    <div className="leading-none">
      <p className="font-display text-sm font-black tracking-tight">{BRAND_CONFIG.name} Admin</p>
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Operations console</p>
    </div>
  </div>
);

const NavList: React.FC<{
  currentView: string;
  stats: DashboardStats | null;
  onNavigate: (view: ViewType) => void;
}> = ({ currentView, stats, onNavigate }) => (
  <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
    {ADMIN_NAV.map(({ view, label, icon: Icon, badgeKey, tone }) => {
      const active = view === currentView;
      const count = badgeKey && stats ? Number(stats[badgeKey] ?? 0) : 0;
      return (
        <a
          key={view}
          href={pathForView(view as ViewType)}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(view as ViewType);
          }}
          aria-current={active ? 'page' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            active
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
              : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
          }`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">{label}</span>
          {count > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                active
                  ? 'bg-white/20 text-white'
                  : tone === 'danger'
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
              }`}
            >
              {count}
            </span>
          )}
        </a>
      );
    })}
  </nav>
);

const Identity: React.FC<{
  session: AdminSession;
  stats: DashboardStats | null;
  onExit: () => void;
  onSignOut: () => void;
  className?: string;
}> = ({ session, stats, onExit, onSignOut, className = '' }) => (
  <div className={`p-3 border-t border-zinc-200 dark:border-zinc-800 ${className}`}>
    <div className="flex items-center gap-2.5 px-2 py-2">
      <span className="w-9 h-9 rounded-full bg-emerald-600/10 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0">
        {(session.full_name || session.username || 'A').charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold truncate">{session.full_name || session.username}</p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
          {stats ? `${stats.users_admins} admin${stats.users_admins === 1 ? '' : 's'}` : 'Administrator'}
        </p>
      </div>
      <AdminBadge tone="active">Admin</AdminBadge>
    </div>
    <div className="flex items-center gap-1.5 mt-1">
      <AdminButton size="sm" variant="ghost" icon={ArrowLeft} onClick={onExit} className="flex-1">
        Exit
      </AdminButton>
      <AdminButton size="sm" variant="ghost" icon={LogOut} onClick={onSignOut} className="flex-1">
        Sign out
      </AdminButton>
    </div>
  </div>
);

/** Maps the router's current view onto the console's page component. */
const PageView: React.FC<{ view: string }> = ({ view }) => {
  switch (view) {
    case 'admin':
      return <OverviewPage />;
    case 'admin-users':
      return <UsersPage />;
    case 'admin-listings':
      return <ListingsPage />;
    case 'admin-reports':
      return <ReportsPage />;
    case 'admin-vendors':
      return <VendorsPage />;
    case 'admin-reviews':
      return <ReviewsPage />;
    case 'admin-audit':
      return <AuditLogPage />;
    default:
      return <OverviewPage />;
  }
};