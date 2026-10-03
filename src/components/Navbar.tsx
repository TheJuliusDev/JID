import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShoppingBag,
  Store,
  User,
  X,
  Home as HomeIcon,
  BedDouble,
  Info,
  Mail,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ThemeToggle } from './ThemeToggle';
import { NotificationsDropdown } from './common/NotificationsDropdown';
import { NavLink, useRouter } from '../router/RouterProvider';
import { MAIN_NAV_VIEWS } from '../router/routes';
import type { ViewType } from '../types';

interface NavbarProps {
  onOpenCreate: () => void;
  /** Used by the notifications dropdown to jump to a related surface. */
  onNavigate: (view: ViewType) => void;
}

/** Labels for the entries in `MAIN_NAV_VIEWS`, in navigation order. */
const NAV_LABELS: Record<string, string> = {
  home: 'Home',
  marketplace: 'Marketplace',
  accommodation: 'Accommodation',
  vendors: 'Vendors',
  about: 'About',
  contact: 'Contact',
};

const navLabel = (view: ViewType): string => NAV_LABELS[view] ?? view;

/** Icon per main-nav entry, used in the mobile drawer and elsewhere. */
const NAV_ICONS: Record<string, LucideIcon> = {
  home: HomeIcon,
  marketplace: ShoppingBag,
  accommodation: BedDouble,
  vendors: Store,
  about: Info,
  contact: Mail,
};

/** Local hamburger so the drawer does not depend on a heavier icon import. */
const MenuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreate, onNavigate }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { unreadMessagesCount, unreadNotificationsCount } = useData();
  const { view, isActive } = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [view]);

  // Lock body scroll while the full-screen mobile drawer is open.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileMenuOpen]);

  // Close the drawer with the Escape key.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const navLinkClass = (target: ViewType) =>
    [
      'relative px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap',
      isActive(target)
        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
        : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900',
    ].join(' ');

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      {/* Campus context bar */}
      <div className="hidden sm:block bg-zinc-950 dark:bg-black text-zinc-300 text-xs py-1.5 px-4 sm:px-8 flex items-center justify-between border-b border-zinc-900">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono-code text-[11px] tracking-wider uppercase text-zinc-300 font-medium">
            Great Ife • {BRAND_CONFIG.institution.name}
          </span>
        </div>
        <span className="text-[11px] font-mono-code text-zinc-400">100% Free Campus Trades</span>
      </div>

      {/* Main bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
        <NavLink
          to="marketplace"
          className="group flex items-center gap-3 shrink-0 flex-1 min-w-0"
          aria-label={`${BRAND_CONFIG.name} home`}
        >
          <img
            src="/apple-touch-icon.png"
            alt=""
            draggable={false}
            className="w-10 h-10 rounded-2xl object-cover flex-shrink-0 group-hover:opacity-90 transition-opacity"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-xl sm:text-2xl font-black tracking-tight text-zinc-950 dark:text-white group-hover:text-emerald-600 transition-colors truncate">
                {BRAND_CONFIG.name}
              </span>
              <span className="text-[10px] font-mono-code uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 px-2 py-0.5 rounded-full font-bold">
                {BRAND_CONFIG.institution.shortName}
              </span>
            </div>
            <span className="hidden sm:block text-[11px] text-zinc-500 dark:text-zinc-400 font-medium tracking-tight">
              Marketplace &amp; Accommodation
            </span>
          </div>
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-0.5 text-sm font-medium">
          {MAIN_NAV_VIEWS.map((target) => (
            <NavLink
              key={target}
              to={target}
              className={navLinkClass(target)}
              activeClassName="after:absolute after:left-3 after:right-3 after:-bottom-px after:h-0.5 after:bg-emerald-500 after:rounded-full"
            >
              {navLabel(target)}
            </NavLink>
          ))}
        </nav>

        {/* Right controls */}
        <div className="hidden sm:flex items-center gap-2 lg:gap-3">
          <ThemeToggle />

          {isAuthenticated && (
            <>
              <button
                onClick={() => onNavigate('messages')}
                className="relative p-2.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
                title="Messages"
                aria-label={`Messages${unreadMessagesCount > 0 ? `, ${unreadMessagesCount} unread` : ''}`}
              >
                <MessageSquare className="w-5 h-5" />
                {unreadMessagesCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-white dark:ring-zinc-900" />
                  )}
                </button>
                <NotificationsDropdown
                  isOpen={notificationsOpen}
                  onClose={() => setNotificationsOpen(false)}
                  onNavigate={onNavigate}
                />
              </div>
            </>
          )}

          <button
            onClick={onOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span className="hidden md:inline">Post an Ad</span>
            <span className="md:hidden">Post</span>
          </button>

          {isAuthenticated && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Account menu"
                aria-expanded={userDropdownOpen}
              >
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-emerald-100 dark:bg-emerald-950 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-700">
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
                    <p className="font-bold text-xs text-zinc-900 dark:text-white truncate">{user.fullName}</p>
                    <p className="text-[11px] text-zinc-500 truncate">@{user.username}</p>
                  </div>

                  <div className="py-1 space-y-0.5 text-xs font-medium">
                    <button onClick={() => onNavigate('dashboard')} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <LayoutDashboard className="w-4 h-4 text-emerald-600" />
                      Dashboard
                    </button>
                    <button onClick={() => onNavigate('my-listings')} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      My Listings
                    </button>
                    <button onClick={() => onNavigate('saved')} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <Heart className="w-4 h-4 text-rose-500" />
                      Saved
                    </button>
                    <button onClick={() => onNavigate('profile')} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <User className="w-4 h-4 text-blue-500" />
                      My Profile
                    </button>
                  </div>

                  <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold">
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink
                to="login"
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 text-zinc-900 dark:text-white font-bold rounded-xl text-xs transition-colors"
              >
                Log in
              </NavLink>
              <NavLink
                to="signup"
                className="hidden lg:inline-flex px-4 py-2 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold rounded-xl text-xs transition-colors"
              >
                Sign up
              </NavLink>
            </div>
          )}
        </div>

        {/* Mobile / tablet controls */}
        <div className="flex lg:hidden items-center gap-1.5">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="p-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
        </div>
      </div>

    </header>

    {/* Mobile / tablet drawer — outside the header so `position: fixed` is
        relative to the viewport (the header's backdrop-filter otherwise traps
        fixed descendants and collapses the drawer). */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              key="drawer-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            />
          )}
          {mobileMenuOpen && (
            <motion.aside
              key="drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[85%] max-w-sm bg-white dark:bg-zinc-950 shadow-2xl flex flex-col"
            >
              {/* Drawer header */}
              <div className="px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src="/apple-touch-icon.png"
                    alt=""
                    draggable={false}
                    className="w-10 h-10 rounded-2xl object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-xl tracking-tight text-zinc-950 dark:text-white truncate">
                        {BRAND_CONFIG.name}
                      </span>
                      <span className="text-[9px] font-mono-code uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                        {BRAND_CONFIG.institution.shortName}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      Marketplace &amp; Accommodation
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-2 -mr-1.5 -mt-1 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Signed-in greeting */}
              {isAuthenticated && user && (
                <div className="px-5 pt-3.5 flex-shrink-0">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold overflow-hidden flex-shrink-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.fullName.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{user.fullName}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">@{user.username}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Scrollable middle */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-3 pb-2">
                  Browse
                </p>
                <motion.nav
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } } }}
                  initial="hidden"
                  animate="show"
                  className="space-y-1"
                >
                  {MAIN_NAV_VIEWS.map((target) => {
                    const Icon = NAV_ICONS[target];
                    const active = isActive(target);
                    return (
                      <motion.div
                        key={target}
                        variants={{
                          hidden: { opacity: 0, x: -16 },
                          show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 30 } },
                        }}
                      >
                        <NavLink
                          to={target}
                          className={`relative flex items-center gap-3 p-3 rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
                            active
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                          }`}
                        >
                          <span
                            className={`flex items-center justify-center w-8 h-8 rounded-xl transition-colors ${
                              active
                                ? 'bg-emerald-600/10 dark:bg-emerald-400/10'
                                : 'bg-zinc-100 dark:bg-zinc-800/70'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="flex-1">{navLabel(target)}</span>
                          {active && (
                            <motion.span
                              layoutId="drawer-active-dot"
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className="w-2 h-2 rounded-full bg-emerald-500"
                            />
                          )}
                        </NavLink>
                      </motion.div>
                    );
                  })}
                </motion.nav>

                <motion.div
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.24 } } }}
                  initial="hidden"
                  animate="show"
                  className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-3 pb-2">
                    {isAuthenticated ? 'Your JID' : 'Account'}
                  </p>

                  {isAuthenticated ? (
                    <div className="space-y-1">
                      {[
                        { label: 'Dashboard', icon: LayoutDashboard, tint: 'text-emerald-600', view: 'dashboard' as ViewType },
                        { label: 'My Listings', icon: ShoppingBag, tint: 'text-emerald-600', view: 'my-listings' as ViewType },
                        { label: 'Saved', icon: Heart, tint: 'text-rose-500', view: 'saved' as ViewType },
                      ].map((row) => (
                        <motion.div
                          key={row.label}
                          variants={{
                            hidden: { opacity: 0, x: -16 },
                            show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 30 } },
                          }}
                        >
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              onNavigate(row.view);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-2xl text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer text-left"
                          >
                            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800/70">
                              <row.icon className={`w-4 h-4 ${row.tint}`} />
                            </span>
                            <span className="flex-1">{row.label}</span>
                          </button>
                        </motion.div>
                      ))}
                      <motion.div
                        variants={{
                          hidden: { opacity: 0, x: -16 },
                          show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 30 } },
                        }}
                      >
                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            onNavigate('messages');
                          }}
                          className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer text-left"
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800/70">
                              <MessageSquare className="w-4 h-4 text-emerald-600" />
                            </span>
                            Messages
                          </span>
                          {unreadMessagesCount > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
                              {unreadMessagesCount}
                            </span>
                          )}
                        </button>
                      </motion.div>
                    </div>
                  ) : (
                    <motion.div
                      variants={{ hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 30 } } }}
                      className="grid grid-cols-2 gap-3 px-3"
                    >
                      <NavLink
                        to="login"
                        className="py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white font-bold text-sm rounded-2xl text-center"
                      >
                        Log in
                      </NavLink>
                      <NavLink
                        to="signup"
                        className="py-3 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-sm rounded-2xl text-center"
                      >
                        Sign up
                      </NavLink>
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* Pinned footer */}
              <div className="px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-zinc-100 dark:border-zinc-800 space-y-2 bg-white dark:bg-zinc-950 flex-shrink-0">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenCreate();
                  }}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow cursor-pointer transition-colors"
                >
                  + Post an Ad
                </button>
                {isAuthenticated && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-2xl transition-colors cursor-pointer"
                  >
                    Sign out
                  </button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
    </>
  );
};

