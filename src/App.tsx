import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ViewType, MarketplaceItem, PropertyListing } from './types';
import { configStatus } from './config/env';

// Shared
import { ConfigError } from './components/common/ConfigError';
import { LoadingScreen } from './components/common/LoadingScreen';

// Chrome
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

// Landing sections
import { HeroSection } from './components/HeroSection';
import { ProductExplanation } from './components/ProductExplanation';
import { CampusLifeSection } from './components/CampusLifeSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { FaqSection } from './components/FaqSection';
import { SocialProofSection } from './components/SocialProofSection';
import { FinalCtaSection } from './components/FinalCtaSection';

// Platform Views
import { MarketplaceExplorer } from './components/marketplace/MarketplaceExplorer';
import { AccommodationExplorer } from './components/accommodation/AccommodationExplorer';
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

const PROTECTED_VIEWS: ViewType[] = ['dashboard', 'my-listings', 'saved', 'messages', 'profile'];

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

function AppContent() {
  const { user, isLoading, isAdmin } = useAuth();
  const { startConversation, setActiveConversationId } = useData();

  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [publicProfileUsername, setPublicProfileUsername] = useState<string | null>(null);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MarketplaceItem | PropertyListing | null>(null);
  const [boostListingTarget, setBoostListingTarget] = useState<MarketplaceItem | PropertyListing | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [activeItemDetail, setActiveItemDetail] = useState<MarketplaceItem | null>(null);
  const [activePropDetail, setActivePropDetail] = useState<PropertyListing | null>(null);

  const navigateTo = useCallback((view: ViewType) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Emulate a direct /admin entry: a manual #admin hash routes to the admin gate,
  // which still rejects anyone whose Supabase account lacks the admin role.
  useEffect(() => {
    const applyHash = () => {
      if (window.location.hash.replace('#', '').toLowerCase().startsWith('admin')) {
        setCurrentView('admin');
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // Redirect away from protected views once we know the user is signed out.
  useEffect(() => {
    if (!isLoading && !user && PROTECTED_VIEWS.includes(currentView)) {
      setCurrentView('home');
      setIsAuthOpen(true);
    }
  }, [isLoading, user, currentView]);

  const openProfile = useCallback((username?: string) => {
    if (!username) return;
    if (user && username === user.username) {
      navigateTo('profile');
      return;
    }
    setPublicProfileUsername(username);
    navigateTo('public-profile');
  }, [user, navigateTo]);

  const requireAuth = useCallback((action: () => void) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    action();
  }, [user]);

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
        navigateTo('messages');
      }
    },
    [user, startConversation, setActiveConversationId, navigateTo]
  );

  const openReportListing = useCallback((item: MarketplaceItem | PropertyListing) => {
    requireAuth(() => {
      const kind = 'roomType' in item ? 'property' : 'marketplace';
      setReportTarget({ kind, item });
    });
  }, [requireAuth]);

  const openBoost = useCallback((target: MarketplaceItem | PropertyListing) => {
    requireAuth(() => setBoostListingTarget(target));
  }, [requireAuth]);

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

  // ----- Admin (secured; role verified server-side, all data behind RLS) -----
  if (currentView === 'admin') {
    return <AdminGate onExit={() => { window.location.hash = ''; navigateTo('home'); }} />;
  }

  const isProtected = PROTECTED_VIEWS.includes(currentView);
  const showProtectedLoading = isProtected && isLoading;
  const blockedByAuth = isProtected && !isLoading && !user;

  return (
    <div className="min-h-screen bg-sand-50 dark:bg-charcoal-950 text-zinc-950 dark:text-zinc-100 font-sans selection:bg-emerald-600 selection:text-white flex flex-col transition-colors duration-200 pb-16 sm:pb-0">
      <Navbar
        currentView={currentView}
        onNavigate={navigateTo}
        onOpenCreate={() => requireAuth(() => { setEditTarget(null); setIsCreateOpen(true); })}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <main className="flex-1">
        {showProtectedLoading || blockedByAuth ? (
          <LoadingScreen label={blockedByAuth ? 'Please sign in to continue…' : 'Loading…'} />
        ) : (
          <>
            {currentView === 'home' && (
              <>
                <HeroSection
                  onExploreMarketplace={() => navigateTo('marketplace')}
                  onExploreAccommodation={() => navigateTo('accommodation')}
                  onOpenCreateListing={() => requireAuth(() => setIsCreateOpen(true))}
                />
                <ProductExplanation
                  onExploreMarketplace={() => navigateTo('marketplace')}
                  onExploreAccommodation={() => navigateTo('accommodation')}
                  onOpenCreateListing={() => requireAuth(() => setIsCreateOpen(true))}
                />
                <CampusLifeSection />
                <HowItWorksSection
                  onExploreMarketplace={() => navigateTo('marketplace')}
                  onExploreAccommodation={() => navigateTo('accommodation')}
                  onOpenCreate={() => requireAuth(() => setIsCreateOpen(true))}
                />
                <FaqSection onExploreMarketplace={() => navigateTo('marketplace')} />
                <SocialProofSection />
                <FinalCtaSection
                  onExploreMarketplace={() => navigateTo('marketplace')}
                  onExploreAccommodation={() => navigateTo('accommodation')}
                  onOpenCreateListing={() => requireAuth(() => setIsCreateOpen(true))}
                />
              </>
            )}

            {currentView === 'marketplace' && (
              <MarketplaceExplorer
                onOpenCreateListing={() => requireAuth(() => setIsCreateOpen(true))}
                onSelectItem={setActiveItemDetail}
                onOpenProfile={openProfile}
              />
            )}

            {currentView === 'accommodation' && (
              <AccommodationExplorer
                onOpenCreateListing={() => requireAuth(() => setIsCreateOpen(true))}
                onSelectProperty={setActivePropDetail}
                onOpenProfile={openProfile}
              />
            )}

            {currentView === 'dashboard' && user && (
              <StudentDashboard
                onNavigate={navigateTo}
                onSelectItem={setActiveItemDetail}
                onSelectProperty={setActivePropDetail}
                onOpenCreate={() => setIsCreateOpen(true)}
                onOpenBoost={openBoost}
              />
            )}

            {currentView === 'my-listings' && user && (
              <MyListingsView
                onOpenCreate={() => { setEditTarget(null); setIsCreateOpen(true); }}
                onOpenBoost={openBoost}
                onEdit={openEdit}
                onSelectItem={setActiveItemDetail}
                onSelectProperty={setActivePropDetail}
              />
            )}

            {currentView === 'saved' && user && (
              <SavedView
                onSelectItem={setActiveItemDetail}
                onSelectProperty={setActivePropDetail}
                onExploreMarketplace={() => navigateTo('marketplace')}
              />
            )}

            {currentView === 'messages' && user && (
              <MessagingView onOpenProfile={openProfile} onNavigateHome={() => navigateTo('home')} />
            )}

            {currentView === 'profile' && user && (
              <StudentProfileView
                onSelectItem={setActiveItemDetail}
                onNavigate={navigateTo}
              />
            )}

            {currentView === 'public-profile' && publicProfileUsername && (
              <PublicProfileView
                username={publicProfileUsername}
                onBack={() => navigateTo('marketplace')}
                onSelectItem={setActiveItemDetail}
                onSelectProperty={setActivePropDetail}
                onStartChat={handleStartChat}
              />
            )}
          </>
        )}
      </main>

      <Footer onNavigate={navigateTo} onOpenCreate={() => requireAuth(() => setIsCreateOpen(true))} />

      {/* Mobile bottom navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around py-2.5 px-2">
        <button
          onClick={() => navigateTo('marketplace')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${currentView === 'marketplace' ? 'text-emerald-600' : 'text-zinc-500'}`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Market</span>
        </button>
        <button
          onClick={() => navigateTo('accommodation')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${currentView === 'accommodation' ? 'text-emerald-600' : 'text-zinc-500'}`}
        >
          <Home className="w-5 h-5" />
          <span>Lodges</span>
        </button>
        <button onClick={() => requireAuth(() => { setEditTarget(null); setIsCreateOpen(true); })} className="flex flex-col items-center -mt-5">
          <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-emerald-600 mt-0.5">Post</span>
        </button>
        <button
          onClick={() => navigateTo('messages')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${currentView === 'messages' ? 'text-emerald-600' : 'text-zinc-500'}`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>Chats</span>
        </button>
        <button
          onClick={() => navigateTo('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${currentView === 'dashboard' ? 'text-emerald-600' : 'text-zinc-500'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Home</span>
        </button>
      </div>

      {/* Global modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <CreateListingModal
        isOpen={isCreateOpen}
        onClose={closeCreate}
        editTarget={editTarget}
        onOpenBoost={openBoost}
        onNavigate={navigateTo}
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

export default function App() {
  if (!configStatus.ok) {
    return <ConfigError />;
  }
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
