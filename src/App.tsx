import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ViewType, MarketplaceItem, PropertyListing } from './types';

// Components
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
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
import { PremiumUpgradeView } from './components/premium/PremiumUpgradeView';
import { StudentProfileView } from './components/profile/StudentProfileView';
import { AdminDashboard } from './components/admin/AdminDashboard';

// Modals
import { AuthModal } from './components/auth/AuthModal';
import { CreateListingModal } from './components/listings/CreateListingModal';
import { BoostListingModal } from './components/monetization/BoostListingModal';
import { ReportModal } from './components/safety/ReportModal';
import { ListingDetailModal } from './components/marketplace/ListingDetailModal';
import { PropertyDetailModal } from './components/accommodation/PropertyDetailModal';

// Icons for Mobile Bottom Navigation
import { 
  ShoppingBag, 
  Home, 
  PlusCircle, 
  LayoutDashboard, 
  MessageSquare 
} from 'lucide-react';

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewType>('home');

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [boostListingTarget, setBoostListingTarget] = useState<MarketplaceItem | PropertyListing | null>(null);
  const [reportTarget, setReportTarget] = useState<MarketplaceItem | PropertyListing | null>(null);

  // Detail modals
  const [activeItemDetail, setActiveItemDetail] = useState<MarketplaceItem | null>(null);
  const [activePropDetail, setActivePropDetail] = useState<PropertyListing | null>(null);

  const { startChatWithSeller } = useData();
  const { user } = useAuth();

  // Scroll to top on navigation change
  const navigateTo = (view: ViewType) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Chat launcher from any listing
  const handleStartChat = (
    seller: any,
    item: MarketplaceItem | PropertyListing
  ) => {
    setActiveItemDetail(null);
    setActivePropDetail(null);

    const isProperty = 'roomType' in item;
    const fullName = seller.fullName || seller.name || 'Student Seller';
    startChatWithSeller({
      ...seller,
      id: seller.id || 'seller-default',
      fullName
    }, {
      id: item.id,
      title: item.title,
      price: isProperty ? item.pricePerYear : item.price,
      image: item.images[0],
      type: isProperty ? 'property' : 'marketplace'
    });

    navigateTo('messages');
  };

  // If viewing admin dashboard, render full admin container
  if (currentView === 'admin') {
    return (
      <AdminDashboard onBackToApp={() => navigateTo('home')} />
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#090A0F] text-zinc-950 dark:text-zinc-100 font-sans selection:bg-orange-600 selection:text-white flex flex-col transition-colors duration-200 pb-16 sm:pb-0">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={navigateTo}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Content Router */}
      <main className="flex-1">
        {currentView === 'home' && (
          <>
            {/* Live Hero */}
            <HeroSection
              onExploreMarketplace={() => navigateTo('marketplace')}
              onExploreAccommodation={() => navigateTo('accommodation')}
              onOpenCreateListing={() => setIsCreateOpen(true)}
            />

            {/* Product Explanations: 01 Buy, 02 Sell, 03 Find a Home */}
            <ProductExplanation
              onExploreMarketplace={() => navigateTo('marketplace')}
              onExploreAccommodation={() => navigateTo('accommodation')}
              onOpenCreateListing={() => setIsCreateOpen(true)}
            />

            {/* Campus Life & Movement Ecosystem */}
            <CampusLifeSection />

            {/* How It Works (Simple 3 Steps for OAU students) */}
            <HowItWorksSection
              onExploreMarketplace={() => navigateTo('marketplace')}
              onExploreAccommodation={() => navigateTo('accommodation')}
              onOpenCreate={() => setIsCreateOpen(true)}
            />

            {/* Frequently Asked Questions */}
            <FaqSection onExploreMarketplace={() => navigateTo('marketplace')} />

            {/* Honest Campus Social Proof / Culture */}
            <SocialProofSection />

            {/* Final Live Platform CTA */}
            <FinalCtaSection
              onExploreMarketplace={() => navigateTo('marketplace')}
              onExploreAccommodation={() => navigateTo('accommodation')}
              onOpenCreateListing={() => setIsCreateOpen(true)}
            />
          </>
        )}

        {currentView === 'marketplace' && (
          <MarketplaceExplorer
            onOpenCreateListing={() => setIsCreateOpen(true)}
            onStartChat={handleStartChat}
            onOpenReport={(item) => setReportTarget(item)}
            onOpenBoost={(item) => setBoostListingTarget(item)}
          />
        )}

        {currentView === 'accommodation' && (
          <AccommodationExplorer
            onOpenCreateListing={() => setIsCreateOpen(true)}
            onStartChat={handleStartChat}
            onOpenReport={(prop) => setReportTarget(prop)}
            onOpenBoost={(prop) => setBoostListingTarget(prop)}
          />
        )}

        {currentView === 'dashboard' && (
          <StudentDashboard
            onNavigate={navigateTo}
            onSelectItem={(item) => setActiveItemDetail(item)}
            onSelectProperty={(prop) => setActivePropDetail(prop)}
            onOpenCreate={() => setIsCreateOpen(true)}
            onOpenBoost={(target) => setBoostListingTarget(target)}
          />
        )}

        {currentView === 'my-listings' && (
          <MyListingsView
            onOpenCreate={() => setIsCreateOpen(true)}
            onOpenBoost={(target) => setBoostListingTarget(target)}
            onSelectItem={(item) => setActiveItemDetail(item)}
            onSelectProperty={(prop) => setActivePropDetail(prop)}
          />
        )}

        {currentView === 'saved' && (
          <SavedView
            onSelectItem={(item) => setActiveItemDetail(item)}
            onSelectProperty={(prop) => setActivePropDetail(prop)}
            onExploreMarketplace={() => navigateTo('marketplace')}
          />
        )}

        {currentView === 'messages' && (
          <MessagingView
            onSelectItem={(item) => setActiveItemDetail(item)}
            onSelectProperty={(prop) => setActivePropDetail(prop)}
          />
        )}

        {currentView === 'premium' && (
          <PremiumUpgradeView />
        )}

        {currentView === 'profile' && (
          <StudentProfileView
            onSelectItem={(item) => setActiveItemDetail(item)}
            onOpenUpgrade={() => navigateTo('premium')}
          />
        )}
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={navigateTo}
        onOpenCreate={() => setIsCreateOpen(true)}
      />

      {/* Mobile Bottom Navigation Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around py-2.5 px-2">
        <button
          onClick={() => navigateTo('marketplace')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            currentView === 'marketplace' ? 'text-orange-600' : 'text-zinc-500'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Market</span>
        </button>

        <button
          onClick={() => navigateTo('accommodation')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            currentView === 'accommodation' ? 'text-orange-600' : 'text-zinc-500'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Lodges</span>
        </button>

        {/* Highlighted Center Add Button */}
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex flex-col items-center -mt-5"
        >
          <div className="w-12 h-12 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-600/30">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-orange-600 mt-0.5">Post</span>
        </button>

        <button
          onClick={() => navigateTo('messages')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            currentView === 'messages' ? 'text-orange-600' : 'text-zinc-500'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>Chats</span>
        </button>

        <button
          onClick={() => navigateTo('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            currentView === 'dashboard' ? 'text-orange-600' : 'text-zinc-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Home</span>
        </button>
      </div>

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <CreateListingModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onOpenBoost={(target) => setBoostListingTarget(target)}
      />

      {boostListingTarget && (
        <BoostListingModal
          listing={boostListingTarget}
          onClose={() => setBoostListingTarget(null)}
        />
      )}

      {reportTarget && (
        <ReportModal
          target={reportTarget}
          onClose={() => setReportTarget(null)}
        />
      )}

      {activeItemDetail && (
        <ListingDetailModal
          item={activeItemDetail}
          onClose={() => setActiveItemDetail(null)}
          onStartChat={handleStartChat}
          onOpenReport={(item) => setReportTarget(item)}
          onOpenBoost={(item) => setBoostListingTarget(item)}
          isOwner={activeItemDetail.userId === user?.id || activeItemDetail.seller.name === user?.fullName}
        />
      )}

      {activePropDetail && (
        <PropertyDetailModal
          property={activePropDetail}
          onClose={() => setActivePropDetail(null)}
          onStartChat={handleStartChat}
          onOpenReport={(prop) => setReportTarget(prop)}
          onOpenBoost={(prop) => setBoostListingTarget(prop)}
          isOwner={activePropDetail.userId === user?.id || activePropDetail.landlord.name === user?.fullName}
        />
      )}
    </div>
  );
}

export default function App() {
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
