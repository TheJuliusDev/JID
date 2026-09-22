import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { BRAND_CONFIG } from '../../config/brand';
import { 
  ShieldAlert, 
  Users, 
  ShoppingBag, 
  Building, 
  Zap, 
  Sparkles, 
  Check, 
  Trash2, 
  Ban, 
  AlertTriangle, 
  ArrowLeft,
  CheckCircle2,
  Sliders,
  BarChart3
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToApp: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToApp }) => {
  const { 
    marketplaceItems, 
    propertyListings, 
    reports, 
    dismissReport, 
    resolveReportAction, 
    deleteListing 
  } = useData();

  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'reports' | 'listings' | 'users'>('overview');
  const [suspendedUsers, setSuspendedUsers] = useState<string[]>([]);

  // Demo users list for admin view
  const demoUsersList = [
    { id: 'user-julius-adeyemi', name: 'Julius Adeyemi', dept: 'Elect/Elect Engineering', level: '400L', items: 2, premium: true },
    { id: 'user-praise-eniola', name: 'Praise Eniola', dept: 'Faculty of Law', level: '300L', items: 1, premium: true },
    { id: 'user-tobi-mth', name: 'Bukunmi A.', dept: 'Computer Science', level: '200L', items: 1, premium: false },
    { id: 'user-femi-desk', name: 'Femi K.', dept: 'Economics', level: 'Graduating Stalite', items: 1, premium: false },
    { id: 'user-landlord-bisi', name: 'Engr. Bisi Adeleke', dept: 'Sunview Lodge Caretaker', level: 'Hostel Mgr', items: 1, premium: false }
  ];

  const handleToggleSuspend = (userId: string) => {
    if (suspendedUsers.includes(userId)) {
      setSuspendedUsers(prev => prev.filter(id => id !== userId));
    } else {
      setSuspendedUsers(prev => [...prev, userId]);
    }
  };

  const activeBoosts = [
    ...marketplaceItems.filter(i => i.isBoosted),
    ...propertyListings.filter(p => p.isBoosted)
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-8 space-y-8">
      {/* Top Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToApp}
            className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Return to Student Platform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-full">
                Platform Moderator
              </span>
              <span className="text-xs text-zinc-400">Demo Environment</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight mt-1">
              Campus Operations & Moderation
            </h1>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'reports', label: `Reports (${reports.filter(r => r.status === 'pending').length})`, icon: AlertTriangle },
            { id: 'listings', label: 'Listings', icon: ShoppingBag },
            { id: 'users', label: 'Users', icon: Users }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveAdminTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeAdminTab === tab.id
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW: OVERVIEW */}
      {activeAdminTab === 'overview' && (
        <div className="space-y-8">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Campus Users</p>
              <p className="text-3xl font-black text-zinc-950 dark:text-white mt-1 font-display">1,420</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Simulated student base</span>
            </div>

            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Marketplace Items</p>
              <p className="text-3xl font-black text-zinc-950 dark:text-white mt-1 font-display">{marketplaceItems.length}</p>
              <span className="text-[11px] text-emerald-600 mt-1 block">Active across OAU halls</span>
            </div>

            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Accommodation Lodges</p>
              <p className="text-3xl font-black text-zinc-950 dark:text-white mt-1 font-display">{propertyListings.length}</p>
              <span className="text-[11px] text-amber-600 mt-1 block">Asherifa, Damico, Mayfair</span>
            </div>

            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pending Reports</p>
              <p className="text-3xl font-black text-rose-600 mt-1 font-display">{reports.filter(r => r.status === 'pending').length}</p>
              <span className="text-[11px] text-rose-500 mt-1 block">Requires moderation review</span>
            </div>
          </div>

          {/* Active Boosts & Voluntary Ads Monitor */}
          <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-600 flex items-center justify-center">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-white text-base font-display">
                  Active Boost Activity (Rewarded Ads Model)
                </h3>
              </div>
              <span className="text-xs text-zinc-400">
                {activeBoosts.length} items boosted in past 24 hours
              </span>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {activeBoosts.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <img src={item.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                      <p className="text-zinc-400">
                        Unlocked via 5 voluntary ads • Expires: {new Date(item.boostedUntil || '').toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold rounded-lg">
                    Boost Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: REPORTS QUEUE */}
      {activeAdminTab === 'reports' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-zinc-950 dark:text-white text-lg font-display">
              Campus Safety Moderation Queue
            </h3>
            <span className="text-xs text-zinc-400">
              Student submissions for fraudulent listings or suspicious behavior
            </span>
          </div>

          {reports.length > 0 ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {reports.map((report) => (
                <div key={report.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                        {report.reason}
                      </span>
                      <span className="text-xs text-zinc-400">
                        Target: {report.targetTitle}
                      </span>
                    </div>
                    {report.details && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">
                        &ldquo;{report.details}&rdquo;
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-400">
                      Status: <strong className="capitalize">{report.status}</strong> • Submitted: {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {report.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => dismissReport(report.id)}
                        className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => resolveReportAction(report.id, 'remove_listing')}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow"
                      >
                        Remove Listing
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 text-center py-8">
              No reports currently in moderation queue.
            </p>
          )}
        </div>
      )}

      {/* VIEW: USERS MANAGEMENT */}
      {activeAdminTab === 'users' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-6">
          <h3 className="font-bold text-zinc-950 dark:text-white text-lg font-display">
            Registered Student Users
          </h3>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {demoUsersList.map((u) => {
              const isSuspended = suspendedUsers.includes(u.id);
              return (
                <div key={u.id} className="py-4 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 font-bold flex items-center justify-center">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">{u.name}</span>
                        {u.premium && (
                          <span className="px-2 py-0.5 text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold rounded">
                            Premium Member
                          </span>
                        )}
                        {isSuspended && (
                          <span className="px-2 py-0.5 text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold rounded">
                            Suspended
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-500">{u.dept} • {u.level} • {u.items} listings</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleSuspend(u.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                      isSuspended
                        ? 'bg-emerald-600 text-white'
                        : 'border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                    }`}
                  >
                    {isSuspended ? 'Reactivate User' : 'Suspend User'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: ALL LISTINGS */}
      {activeAdminTab === 'listings' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-6">
          <h3 className="font-bold text-zinc-950 dark:text-white text-lg font-display">
            Active Campus Inventory
          </h3>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {marketplaceItems.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <img src={item.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                    <p className="text-zinc-400">
                      {BRAND_CONFIG.currency.format(item.price)} • Seller: {item.seller.name} ({item.location})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteListing('marketplace', item.id)}
                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg"
                  title="Remove listing"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
