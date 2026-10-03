import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { CookieConsentProvider } from './context/CookieConsentContext';
import { CookieConsentBanner } from './components/cookie/CookieConsentBanner';
import { MarketplaceItem, PropertyListing } from './types';
import { configStatus } from './config/env';
import { RouterProvider, useRouter } from './router/RouterProvider';
import { isAdminView, isProtectedView } from './router/routes';
import { setPendingSearch, SavedFilters } from './services/pendingSearch';

// Shared
import { ConfigError } from './components/common/ConfigError';
import { LoadingScreen } from './components/common/LoadingScreen';
import { PageTransition } from './components/common/PageTransition';

// Chrome
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

// Pages
import { HomePage } from './pages/HomePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { AccommodationPage } from './pages/AccommodationPage';
import { VendorsPage } from './pages/VendorsPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { CookiePolicyPage } from './pages/CookiePolicyPage';
import { AuthPage } from './pages/AuthPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Product surfaces
import { StudentDashboard } from './components/dashboard/StudentDashboard';
import { MyListingsView } from './components/listings/MyListingsView';
import { SavedView } from './components/saved/SavedView';
import { MessagingView } from './components/messages/MessagingView';
import { StudentProfileView } from './components/profile/StudentProfileView';
import { PublicProfileView } from './components/profile/PublicProfileView';
import { AdminGate } from './components/admin/AdminGate';

// Modals
import { AuthModal } from './components/auth/AuthModal';
import { CreateListingModal } from './components/listings/CreateListingModal';
import { BoostListingModal } from './components/monetization/BoostListingModal';
import { ReportModal, ReportTarget } from './components/safety/ReportModal';
import { ListingDetailModal } from './components/marketplace/ListingDetailModal';
import { PropertyDetailModal } from './components/accommodation/PropertyDetailModal';

import { ShoppingBag, Home, PlusCircle, LayoutDashboard, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Seller {
  id: string;
  username?: string;
  name?: string;
  fullName?: string;
  avatarUrl?: string;
  department?: string;
  level?: string;
  hallOrArea?: string;
}

type MobileNavTab =
  | { kind: 'tab'; key: string; label: string; icon: LucideIcon; active: boolean; onSelect: () => void }
  | { kind: 'post' };

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { startConversation, setActiveConversationId } = useData();
  const { view, username, navigate } = useRouter();

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MarketplaceItem | PropertyListing | null>(null);
  const [boostListingTarget, setBoostListingTarget] = useState<MarketplaceItem | PropertyListing | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [activeItemDetail, setActiveItemDetail] = useState<MarketplaceItem | null>(null);
  const [activePropDetail, setActivePropDetail] = useState<PropertyListing | null>(null);

  // Hide the mobile bottom bar while the on-screen keyboard is open, so it
  // never covers the keyboard or crowds the focused input/field.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const covered = window.innerHeight - vv.height;
        setKeyboardVisible(window.matchMedia('(any-pointer: coarse)').matches && covered > 24);
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // An unauthenticated visit to a protected surface bounces home and opens auth.
  useEffect(() => {
    if (!isLoading && !user && isProtectedView(view)) {
      navigate('marketplace', { replace: true });
      setIsAuthOpen(true);
    }
  }, [isLoading, user, view, navigate]);

  const openProfile = useCallback(
    (targetUsername?: string) => {
      if (!targetUsername) return;
      if (user && targetUsername === user.username) {
        navigate('profile');
        return;
      }
      navigate('public-profile', { username: targetUsername });
    },
    [user, navigate]
  );

  const requireAuth = useCallback(
    (action: () => void) => {
      if (!user) {
        setIsAuthOpen(true);
        return;
      }
      action();
    },
    [user]
  );

  const handleStartChat = useCallback(
    async (seller: Seller, item: MarketplaceItem | PropertyListing) => {
      setActiveItemDetail(null);
      setActivePropDetail(null);
      if (!user) {
        setIsAuthOpen(true);
        return;
      }
      if (seller.id === user.id) return; // can't chat yourself
      const isProperty = 'roomType' in item;
      const convId = await startConversation(seller.id, {
        id: item.id,
        title: item.title,
        price: isProperty ? (item as PropertyListing).pricePerYear : (item as MarketplaceItem).price,
        image: item.images[0] || '',
        type: isProperty ? 'property' : 'marketplace',
      });
      if (convId) {
        setActiveConversationId(convId);
        navigate('messages');
      }
    },
    [user, startConversation, setActiveConversationId, navigate]
  );

  const openReportListing = useCallback(
    (item: MarketplaceItem | PropertyListing) => {
      requireAuth(() => {
        const kind = 'roomType' in item ? 'property' : 'marketplace';
        setReportTarget({ kind, item });
      });
    },
    [requireAuth]
  );

  const openBoost = useCallback(
    (target: MarketplaceItem | PropertyListing) => {
      requireAuth(() => setBoostListingTarget(target));
    },
    [requireAuth]
  );

  const openEdit = useCallback((target: MarketplaceItem | PropertyListing) => {
    setActiveItemDetail(null);
    setActivePropDetail(null);
    setEditTarget(target);
    setIsCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setIsCreateOpen(false);
    setEditTarget(null);
  }, []);

  const openCreate = useCallback(() => {
    setEditTarget(null);
    setIsCreateOpen(true);
  }, []);

  const openCreateOrAuth = useCallback(() => requireAuth(openCreate), [requireAuth, openCreate]);

  // ----- Admin console -------------------------------------------------------
  // The console owns the whole screen (no site chrome) and every `/admin/*`
  // route renders it. `AdminGate` is the security boundary: it asks the database
  // whether this account is an administrator before anything else is rendered.
  if (isAdminView(view)) {
    return <AdminGate onExit={() => navigate('marketplace')} />;
  }

  const blockedByAuth = isProtectedView(view) && !isLoading && !user;
  const showProtectedLoading = isProtectedView(view) && isLoading;

  // Messages is a dedicated full-screen surface: no site navbar, footer or
  // mobile bottom bar, so the chat owns the whole viewport.
  const isMessagesView = view === 'messages';

  const renderPage = () => {
    switch (view) {
      case 'home':
        return (
          <HomePage
            onOpenMarketplace={() => navigate('marketplace')}
            onOpenAccommodation={() => navigate('accommodation')}
            onOpenVendors={() => navigate('vendors')}
            onOpenCreateListing={openCreateOrAuth}
            onOpenProfile={openProfile}
          />
        );

      case 'marketplace':
        return (
          <MarketplacePage
            onOpenCreateListing={openCreateOrAuth}
            onSelectItem={setActiveItemDetail}
            onOpenProfile={openProfile}
            onRequireAuth={() => setIsAuthOpen(true)}
          />
        );

      case 'accommodation':
        return (
          <AccommodationPage
            onOpenCreateListing={openCreateOrAuth}
            onSelectProperty={setActivePropDetail}
            onOpenProfile={openProfile}
            onRequireAuth={() => setIsAuthOpen(true)}
          />
        );

      case 'vendors':
        return (
          <VendorsPage onOpenCreateListing={openCreate} onOpenAuth={() => setIsAuthOpen(true)} isAuthenticated={isAuthenticated} />
        );

      case 'about':
        return <AboutPage onContact={() => navigate('contact')} />;

      case 'contact':
        return <ContactPage />;

      case 'terms':
        return <TermsPage />;

      case 'privacy':
        return <PrivacyPolicyPage />;

      case 'cookies':
        return <CookiePolicyPage />;

      case 'login':
        return <AuthPage mode="login" redirectTo="marketplace" />;

      case 'signup':
        return <AuthPage mode="signup" redirectTo="marketplace" />;

      case 'not-found':
        return <NotFoundPage />;

      case 'dashboard':
        return user ? (
          <StudentDashboard
            onNavigate={navigate}
            onSelectItem={setActiveItemDetail}
            onSelectProperty={setActivePropDetail}
            onOpenCreate={openCreate}
            onOpenBoost={openBoost}
          />
        ) : null;

      case 'my-listings':
        return user ? (
          <MyListingsView
            onOpenCreate={openCreate}
            onOpenBoost={openBoost}
            onEdit={openEdit}
            onSelectItem={setActiveItemDetail}
            onSelectProperty={setActivePropDetail}
          />
        ) : null;

      case 'saved':
        return user ? (
          <SavedView
            onSelectItem={setActiveItemDetail}
            onSelectProperty={setActivePropDetail}
            onExploreMarketplace={() => navigate('marketplace')}
            onRunSearch={(type: 'marketplace' | 'property', filters: SavedFilters) => {
              setPendingSearch(type, filters);
              navigate(type === 'marketplace' ? 'marketplace' : 'accommodation');
            }}
          />
        ) : null;

      case 'messages':
        return user ? (
          <MessagingView
            onOpenProfile={openProfile}
            onBack={() => navigate('dashboard')}
            onExploreMarketplace={() => navigate('marketplace')}
          />
        ) : null;

      case 'profile':
        return user ? (
          <StudentProfileView onSelectItem={setActiveItemDetail} onNavigate={navigate} />
        ) : null;

      case 'public-profile':
        return username ? (
          <PublicProfileView
            username={username}
            onBack={() => navigate('marketplace')}
            onSelectItem={setActiveItemDetail}
            onSelectProperty={setActivePropDetail}
            onStartChat={handleStartChat}
          />
        ) : null;

      default:
        return <NotFoundPage />;
    }
  };

  return (
    <div
      className={`min-h-screen bg-sand-50 dark:bg-charcoal-950 text-zinc-950 dark:text-zinc-100 font-sans selection:bg-emerald-600 selection:text-white flex flex-col transition-colors duration-200 ${
        isMessagesView || keyboardVisible ? 'pb-0' : 'pb-16 sm:pb-0'
      }`}
    >
      {!isMessagesView && <Navbar onNavigate={navigate} onOpenCreate={openCreateOrAuth} />}

      <main className={isMessagesView ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'flex-1'}>
        {showProtectedLoading || blockedByAuth ? (
          <LoadingScreen label={blockedByAuth ? 'Please sign in to continue…' : 'Loading…'} />
        ) : isMessagesView ? (
          renderPage()
        ) : (
          <PageTransition>{renderPage()}</PageTransition>
        )}
      </main>

      {!isMessagesView && <Footer onOpenCreate={openCreateOrAuth} />}

      {/* Mobile bottom navigation */}
      <AnimatePresence>
        {!isMessagesView && !keyboardVisible && (
          <motion.nav
            key="mobile-nav"
            role="navigation"
            aria-label="Primary"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-end justify-around px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
              {(
                [
                  {
                    kind: 'tab',
                    key: 'market',
                    label: 'Market',
                    icon: ShoppingBag,
                    active: view === 'marketplace',
                    onSelect: () => navigate('marketplace'),
                  },
                  {
                    kind: 'tab',
                    key: 'lodges',
                    label: 'Lodges',
                    icon: Home,
                    active: view === 'accommodation',
                    onSelect: () => navigate('accommodation'),
                  },
                  { kind: 'post' },
                  {
                    kind: 'tab',
                    key: 'chats',
                    label: 'Chats',
                    icon: MessageSquare,
                    active: isMessagesView,
                    onSelect: () => (isAuthenticated ? navigate('messages') : setIsAuthOpen(true)),
                  },
                  {
                    kind: 'tab',
                    key: 'account',
                    label: 'Account',
                    icon: LayoutDashboard,
                    active: ['dashboard', 'profile', 'my-listings', 'saved'].includes(view),
                    onSelect: () => (isAuthenticated ? navigate('dashboard') : setIsAuthOpen(true)),
                  },
                ] as MobileNavTab[]
              ).map((tab) =>
                tab.kind === 'post' ? (
                  <motion.button
                    key="post"
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={openCreateOrAuth}
                    className="flex flex-col items-center -mt-5"
                    aria-label="Post a listing"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 ring-4 ring-sand-50 dark:ring-charcoal-950">
                      <PlusCircle className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 mt-0.5">Post</span>
                  </motion.button>
                ) : (
                  <motion.button
                    key={tab.key}
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={tab.onSelect}
                    aria-label={tab.label}
                    aria-current={tab.active ? 'page' : undefined}
                    className={`relative flex flex-col items-center gap-1 pt-1 text-[10px] font-bold transition-colors duration-200 ${
                      tab.active
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    <span className="relative flex items-center justify-center w-9 h-8">
                      {tab.active && (
                        <motion.span
                          layoutId="mobile-nav-active-pill"
                          className="absolute inset-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/70"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                      <tab.icon className="relative w-6 h-6" />
                    </span>
                    <span className="relative">{tab.label}</span>
                  </motion.button>
                )
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Global modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <CreateListingModal
        isOpen={isCreateOpen}
        onClose={closeCreate}
        editTarget={editTarget}
        onOpenBoost={openBoost}
        onNavigate={navigate}
      />

      {boostListingTarget && (
        <BoostListingModal listing={boostListingTarget} onClose={() => setBoostListingTarget(null)} />
      )}

      {reportTarget && <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />}

      {activeItemDetail && (
        <ListingDetailModal
          item={activeItemDetail}
          onClose={() => setActiveItemDetail(null)}
          onStartChat={handleStartChat}
          onOpenReport={openReportListing}
          onOpenBoost={openBoost}
          onOpenProfile={openProfile}
          onEdit={openEdit}
          isOwner={activeItemDetail.userId === user?.id}
        />
      )}

      {activePropDetail && (
        <PropertyDetailModal
          property={activePropDetail}
          onClose={() => setActivePropDetail(null)}
          onStartChat={handleStartChat}
          onOpenReport={openReportListing}
          onOpenBoost={openBoost}
          onOpenProfile={openProfile}
          onEdit={openEdit}
          isOwner={activePropDetail.userId === user?.id}
        />
      )}
    </div>
  );
}

function RoutedApp() {
  return (
    <RouterProvider>
      <AppContent />
      {/* Rendered inside the router so its legal NavLinks can navigate. */}
      <CookieConsentBanner />
    </RouterProvider>
  );
}

export default function App() {
  if (!configStatus.ok) {
    return <ConfigError />;
  }
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <CookieConsentProvider>
            <RoutedApp />
          </CookieConsentProvider>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
