import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchMyRole,
  adminListUsers,
  adminSetSuspended,
  adminListReports,
  adminResolveListingReport,
  adminResolveUserReport,
  adminRemoveListing,
  adminLog,
  adminStats,
} from '../../services/database';
import { ReportItem, UserProfile } from '../../types';
import {
  Shield,
  ShieldAlert,
  LogOut,
  Users as UsersIcon,
  Flag,
  LayoutDashboard,
  Loader2,
  Ban,
  CheckCircle2,
  Trash2,
  Lock,
  AlertTriangle,
  ShoppingBag,
  Home,
  UserCheck,
  RefreshCw,
} from 'lucide-react';

interface AdminGateProps {
  onExit: () => void;
}

type AdminUser = UserProfile & { isSuspended: boolean; role: string };
type Stats = { users: number; marketplace: number; properties: number; reports: number };
type GateState = 'checking' | 'unauthenticated' | 'denied' | 'authorized';
type AdminTab = 'overview' | 'users' | 'reports';

export const AdminGate: React.FC<AdminGateProps> = ({ onExit }) => {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const [gate, setGate] = useState<GateState>('checking');

  // Server-side role verification (defense in depth): even though App only
  // routes here, and RLS blocks the data itself, we independently confirm the
  // signed-in account carries the admin role before rendering the console.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isLoading) {
        setGate('checking');
        return;
      }
      if (!isAuthenticated || !user) {
        setGate('unauthenticated');
        return;
      }
      try {
        const role = await fetchMyRole(user.id);
        if (cancelled) return;
        setGate(role === 'admin' ? 'authorized' : 'denied');
      } catch {
        if (!cancelled) setGate('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, user?.id]);

  if (gate === 'checking') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
          <p className="text-sm">Verifying access…</p>
        </div>
      </Shell>
    );
  }

  if (gate === 'unauthenticated') {
    return <AdminLogin onLogin={login} onExit={onExit} />;
  }

  if (gate === 'denied') {
    return (
      <Shell>
        <div className="max-w-md text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto text-rose-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white font-display">Access denied</h1>
            <p className="text-sm text-zinc-400 mt-2">
              Your account does not have administrator privileges. This attempt has been logged.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onExit}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm rounded-xl cursor-pointer"
            >
              Back to JID
            </button>
            <button
              onClick={logout}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl cursor-pointer flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return <AdminConsole onExit={onExit} onSignOut={logout} adminId={user!.id} adminName={user!.fullName} />;
};

/* ---------------------------------------------------------------- */
/* Dark full-screen shell — the admin console is visually separate.  */
/* ---------------------------------------------------------------- */
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">{children}</div>
);

/* ---------------------------------------------------------------- */
/* Login form (shown when nobody is signed in).                      */
/* ---------------------------------------------------------------- */
const AdminLogin: React.FC<{
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onExit: () => void;
}> = ({ onLogin, onExit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await onLogin(email.trim(), password);
      if (!res.success) setError(res.error || 'Sign in failed.');
      // On success the gate re-checks the role automatically.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-400">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white font-display">JID Admin</h1>
            <p className="text-sm text-zinc-400 mt-1">Restricted area. Sign in with an administrator account.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
          />
          {error && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm rounded-xl cursor-pointer flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <button
          onClick={onExit}
          className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          ← Back to JID
        </button>
      </div>
    </Shell>
  );
};

/* ---------------------------------------------------------------- */
/* The authorized console.                                           */
/* ---------------------------------------------------------------- */
const AdminConsole: React.FC<{
  onExit: () => void;
  onSignOut: () => void;
  adminId: string;
  adminName: string;
}> = ({ onExit, onSignOut, adminId, adminName }) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, u, r] = await Promise.all([adminStats(), adminListUsers(), adminListReports()]);
      setStats(s);
      setUsers(u);
      setReports(r);
    } catch (err: any) {
      console.error('[admin] load failed', err);
      setError('Could not load admin data. Your session may have expired.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, u, r] = await Promise.all([adminStats(), adminListUsers(), adminListReports()]);
        if (cancelled) return;
        setStats(s);
        setUsers(u);
        setReports(r);
      } catch (err) {
        if (!cancelled) {
          console.error('[admin] load failed', err);
          setError('Could not load admin data. Your session may have expired.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSuspend = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const next = !u.isSuspended;
      await adminSetSuspended(u.id, next);
      await adminLog(adminId, next ? 'suspend_user' : 'unsuspend_user', 'user', u.id);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isSuspended: next } : x)));
    } catch (err) {
      console.error('[admin] suspend failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const resolveReport = async (r: ReportItem, status: 'dismissed' | 'action_taken') => {
    setBusyId(r.id);
    try {
      if (r.targetType === 'user') {
        if (status === 'action_taken') {
          await adminSetSuspended(r.targetId, true);
          setUsers((prev) => prev.map((x) => (x.id === r.targetId ? { ...x, isSuspended: true } : x)));
        }
        await adminResolveUserReport(r.id, status, adminId);
      } else {
        if (status === 'action_taken') {
          await adminRemoveListing(r.targetType, r.targetId);
        }
        await adminResolveListingReport(r.id, status, adminId);
      }
      await adminLog(adminId, `report_${status}`, r.targetType, r.targetId, { reason: r.reason });
      setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
    } catch (err) {
      console.error('[admin] resolve report failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const pendingReports = reports.filter((r) => r.status === 'pending' || r.status === 'reviewing');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white leading-none font-display">JID Admin</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{adminName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              title="Refresh"
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onExit}
              className="px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 rounded-lg cursor-pointer"
            >
              Exit
            </button>
            <button
              onClick={onSignOut}
              className="px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 rounded-lg cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Tabs */}
        <nav className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
          <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')} icon={LayoutDashboard} label="Overview" />
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')} icon={UsersIcon} label={`Users (${users.length})`} />
          <TabBtn
            active={tab === 'reports'}
            onClick={() => setTab('reports')}
            icon={Flag}
            label={`Reports${pendingReports.length ? ` (${pendingReports.length})` : ''}`}
          />
        </nav>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-rose-400 bg-rose-950/40 border border-rose-900 rounded-xl">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'overview' && stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={UsersIcon} label="Total users" value={stats.users} />
                <StatCard icon={ShoppingBag} label="Marketplace items" value={stats.marketplace} />
                <StatCard icon={Home} label="Accommodation" value={stats.properties} />
                <StatCard icon={Flag} label="Reports filed" value={stats.reports} accent={pendingReports.length > 0} />
              </div>
            )}

            {tab === 'users' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                {users.length === 0 ? (
                  <EmptyRow label="No users yet." />
                ) : (
                  <div className="divide-y divide-zinc-800">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 p-4">
                        <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center text-sm font-bold text-emerald-300 flex-shrink-0">
                          {(u.fullName || u.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white truncate">{u.fullName || u.username}</p>
                            {u.role === 'admin' && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-300 rounded">
                                ADMIN
                              </span>
                            )}
                            {u.isSuspended && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/15 text-rose-300 rounded">
                                SUSPENDED
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 truncate">
                            @{u.username}
                            {u.department ? ` • ${u.department}` : ''}
                          </p>
                        </div>
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => toggleSuspend(u)}
                            disabled={busyId === u.id}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-60 ${
                              u.isSuspended
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-zinc-800 hover:bg-rose-600 text-zinc-200 hover:text-white'
                            }`}
                          >
                            {busyId === u.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : u.isSuspended ? (
                              <UserCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" />
                            )}
                            {u.isSuspended ? 'Reinstate' : 'Suspend'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'reports' && (
              <div className="space-y-3">
                {reports.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <EmptyRow label="No reports filed. All clear." />
                  </div>
                ) : (
                  reports.map((r) => {
                    const resolved = r.status !== 'pending' && r.status !== 'reviewing';
                    return (
                      <div
                        key={r.id}
                        className={`bg-zinc-900 border rounded-2xl p-4 ${
                          resolved ? 'border-zinc-800 opacity-60' : 'border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 rounded">
                                {r.targetType}
                              </span>
                              <p className="text-sm font-bold text-white truncate">{r.targetTitle}</p>
                            </div>
                            <p className="text-xs text-amber-400 font-semibold mt-1.5">{r.reason}</p>
                            {r.details && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{r.details}</p>}
                            <p className="text-[11px] text-zinc-600 mt-1.5">
                              {new Date(r.createdAt).toLocaleString()}
                              {resolved && ` • ${r.status.replace('_', ' ')}`}
                            </p>
                          </div>
                        </div>

                        {!resolved && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
                            <button
                              onClick={() => resolveReport(r, 'action_taken')}
                              disabled={busyId === r.id}
                              className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white rounded-lg cursor-pointer flex items-center gap-1.5"
                            >
                              {busyId === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : r.targetType === 'user' ? (
                                <Ban className="w-3.5 h-3.5" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              {r.targetType === 'user' ? 'Suspend user' : 'Remove listing'}
                            </button>
                            <button
                              onClick={() => resolveReport(r, 'dismissed')}
                              disabled={busyId === r.id}
                              className="px-3 py-1.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-zinc-200 rounded-lg cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const TabBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ElementType; label: string }> = ({
  active,
  onClick,
  icon: Icon,
  label,
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
      active ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: number; accent?: boolean }> = ({
  icon: Icon,
  label,
  value,
  accent,
}) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${accent ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
      <Icon className="w-5 h-5" />
    </div>
    <p className="text-2xl font-black text-white font-display">{value.toLocaleString()}</p>
    <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
  </div>
);

const EmptyRow: React.FC<{ label: string }> = ({ label }) => (
  <div className="text-center py-14 text-sm text-zinc-500">{label}</div>
);
