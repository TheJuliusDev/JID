import React, { useState } from 'react';
import { BRAND_CONFIG } from '../config/brand';
import { ViewType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ThemeToggle } from './ThemeToggle';
import { NotificationsDropdown } from './common/NotificationsDropdown';
import { 
  ArrowUpRight, 
  Menu, 
  X, 
  Sparkles, 
  MapPin, 
  ShoppingBag, 
  Building, 
  MessageSquare, 
  Bell, 
  User, 
  PlusCircle, 
  ShieldCheck, 
  LogOut, 
  Sliders, 
  LayoutDashboard, 
  Crown,
  Heart
} from 'lucide-react';

interface NavbarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onOpenCreate: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenCreate,
  onOpenAuth
}) => {
  const { user, isAuthenticated, logout, isDemoMode } = useAuth();
  const { unreadMessagesCount, unreadNotificationsCount } = useData();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      {/* Top Campus Bar with Demo indicator */}
      <div className="bg-zinc-950 dark:bg-black text-zinc-300 text-xs py-1.5 px-4 sm:px-8 flex items-center justify-between border-b border-zinc-900">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono-code text-[11px] tracking-wider uppercase text-zinc-300 font-medium">
            Great Ife • {BRAND_CONFIG.institution.name}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono-code">
          {isDemoMode && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-950/80 border border-orange-700/60 text-orange-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Demo Mode (Real Keys Ready)
            </span>
          )}
          <span className="text-zinc-500 hidden sm:inline">•</span>
          <span className="text-zinc-400">100% Free Campus Trades</span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('home')} 
            className="group flex items-center gap-3 cursor-pointer text-left"
          >
            <div className="w-10 h-10 rounded-2xl bg-zinc-950 dark:bg-zinc-800 text-white flex items-center justify-center font-black text-xl shadow group-hover:bg-orange-600 transition-colors">
              {BRAND_CONFIG.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-black tracking-tight text-zinc-950 dark:text-white group-hover:text-orange-600 transition-colors">
                  {BRAND_CONFIG.name}
                </span>
                <span className="text-[10px] font-mono-code uppercase tracking-wider text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 border border-orange-200/80 dark:border-orange-800/60 px-2 py-0.5 rounded-full font-bold">
                  {BRAND_CONFIG.institution.shortName}
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium tracking-tight">
                Marketplace & Accommodation
              </span>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-sm font-medium">
          <button
            onClick={() => onNavigate('marketplace')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              currentView === 'marketplace'
                ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            Marketplace
          </button>
          <button
            onClick={() => onNavigate('accommodation')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              currentView === 'accommodation'
                ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            Accommodations
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              currentView === 'dashboard'
                ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onNavigate('premium')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              currentView === 'premium'
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50/50'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Premium</span>
          </button>
        </nav>

        {/* Right Nav Action Controls */}
        <div className="hidden sm:flex items-center gap-2 lg:gap-3">
          <ThemeToggle />

          {/* Messages Icon */}
          <button
            onClick={() => onNavigate('messages')}
            className="relative p-2.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
            title="Messages"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadMessagesCount > 0 && (
              <span className="absolute 1.5 top-1.5 right-1.5 w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadMessagesCount}
              </span>
            )}
          </button>

          {/* Notifications Trigger */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-orange-600 ring-2 ring-white dark:ring-zinc-900" />
              )}
            </button>
            <NotificationsDropdown
              isOpen={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              onNavigate={onNavigate}
            />
          </div>

          {/* "Post an Ad" CTA */}
          <button
            onClick={onOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-orange-600/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Post an Ad</span>
          </button>

          {/* User Profile Menu */}
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-orange-100 dark:bg-orange-950 border border-orange-500/30 flex items-center justify-center font-bold text-orange-700">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user.fullName.charAt(0)
                  )}
                </div>
              </button>

              {userDropdownOpen && (
                <div 
                  className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                    <p className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                      {user.fullName}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {user.department} • {user.level}
                    </p>
                  </div>

                  <div className="py-1 space-y-0.5 text-xs font-medium">
                    <button
                      onClick={() => onNavigate('dashboard')}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <LayoutDashboard className="w-4 h-4 text-orange-600" />
                      Dashboard Home
                    </button>
                    <button
                      onClick={() => onNavigate('my-listings')}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <ShoppingBag className="w-4 h-4 text-orange-600" />
                      My Active Listings
                    </button>
                    <button
                      onClick={() => onNavigate('saved')}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Heart className="w-4 h-4 text-rose-500" />
                      Saved Items
                    </button>
                    <button
                      onClick={() => onNavigate('profile')}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <User className="w-4 h-4 text-blue-500" />
                      Student Profile
                    </button>
                    <button
                      onClick={() => onNavigate('admin')}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Admin & Moderation
                    </button>
                  </div>

                  <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 text-zinc-900 dark:text-white font-bold rounded-xl text-xs"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex sm:hidden items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 px-6 py-6 space-y-4 shadow-xl animate-fadeIn">
          <div className="flex flex-col gap-2 text-sm font-semibold">
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigate('marketplace'); }}
              className="text-left py-2.5 px-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200 flex justify-between items-center"
            >
              <span>Marketplace</span>
              <span className="text-xs text-orange-600 font-bold">Buy & Sell</span>
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigate('accommodation'); }}
              className="text-left py-2.5 px-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200 flex justify-between items-center"
            >
              <span>Accommodations</span>
              <span className="text-xs text-zinc-400">Asherifa & Damico</span>
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigate('dashboard'); }}
              className="text-left py-2.5 px-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
            >
              Dashboard
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigate('my-listings'); }}
              className="text-left py-2.5 px-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
            >
              My Listings
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigate('saved'); }}
              className="text-left py-2.5 px-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
            >
              Saved Items
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigate('messages'); }}
              className="text-left py-2.5 px-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200 flex justify-between items-center"
            >
              <span>Messages</span>
              {unreadMessagesCount > 0 && (
                <span className="px-2 py-0.5 bg-orange-600 text-white text-[10px] font-bold rounded-full">
                  {unreadMessagesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigate('premium'); }}
              className="text-left py-2.5 px-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 text-amber-600 font-bold"
            >
              Premium Membership
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigate('admin'); }}
              className="text-left py-2.5 px-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500"
            >
              Admin Moderation
            </button>
          </div>

          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            <button
              onClick={() => { setMobileMenuOpen(false); onOpenCreate(); }}
              className="w-full py-3 bg-orange-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow"
            >
              + Post an Ad
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
