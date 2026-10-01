import React from 'react';
import { HeroSection } from '../components/HeroSection';
import { WhatIsJid } from '../components/home/WhatIsJid';
import { MarketplacePreview } from '../components/home/MarketplacePreview';
import { AccommodationPreview } from '../components/home/AccommodationPreview';
import { AgencyFeesSection } from '../components/home/AgencyFeesSection';
import { FinalCtaSection } from '../components/FinalCtaSection';

interface HomePageProps {
  onOpenMarketplace: () => void;
  onOpenAccommodation: () => void;
  onOpenVendors: () => void;
  onOpenCreateListing: () => void;
  onOpenProfile: (username: string) => void;
}

/**
 * The Home page is intentionally an introduction, not the whole website: a
 * hero, a two-sentence explanation, live previews of the two main features,
 * and CTAs. Everything else has a page.
 */
export const HomePage: React.FC<HomePageProps> = ({
  onOpenMarketplace,
  onOpenAccommodation,
  onOpenVendors,
  onOpenCreateListing,
  onOpenProfile,
}) => (
  <>
    <HeroSection
      onExploreMarketplace={onOpenMarketplace}
      onExploreAccommodation={onOpenAccommodation}
      onOpenCreateListing={onOpenCreateListing}
    />

    <WhatIsJid
      onOpenMarketplace={onOpenMarketplace}
      onOpenAccommodation={onOpenAccommodation}
      onOpenVendors={onOpenVendors}
    />

    <MarketplacePreview
      onOpenMarketplace={onOpenMarketplace}
      onOpenCreateListing={onOpenCreateListing}
      onOpenProfile={onOpenProfile}
    />

    <AgencyFeesSection onOpenAccommodation={onOpenAccommodation} />

    <AccommodationPreview
      onOpenAccommodation={onOpenAccommodation}
      onOpenCreateListing={onOpenCreateListing}
      onOpenProfile={onOpenProfile}
    />

    <FinalCtaSection
      onExploreMarketplace={onOpenMarketplace}
      onExploreAccommodation={onOpenAccommodation}
      onOpenCreateListing={onOpenCreateListing}
    />
  </>
);
