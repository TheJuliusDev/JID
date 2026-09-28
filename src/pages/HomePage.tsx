import React from 'react';
import { HeroSection } from '../components/HeroSection';
import { WhatIsJid } from '../components/home/WhatIsJid';
import { MarketplacePreview } from '../components/home/MarketplacePreview';
import { AccommodationPreview } from '../components/home/AccommodationPreview';
import { VendorHighlight } from '../components/home/VendorHighlight';
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
 * hero, a two-sentence explanation, live previews of the two main features, a
 * short seller pitch, and CTAs. Everything else has a page.
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

    <AccommodationPreview
      onOpenAccommodation={onOpenAccommodation}
      onOpenCreateListing={onOpenCreateListing}
      onOpenProfile={onOpenProfile}
    />

    <VendorHighlight onOpenVendors={onOpenVendors} onOpenCreateListing={onOpenCreateListing} />

    <FinalCtaSection
      onExploreMarketplace={onOpenMarketplace}
      onExploreAccommodation={onOpenAccommodation}
      onOpenCreateListing={onOpenCreateListing}
    />
  </>
);
