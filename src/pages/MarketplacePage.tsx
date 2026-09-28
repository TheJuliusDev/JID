import React from 'react';
import { MarketplaceExplorer } from '../components/marketplace/MarketplaceExplorer';
import type { MarketplaceItem } from '../types';

interface MarketplacePageProps {
  onOpenCreateListing: () => void;
  onSelectItem: (item: MarketplaceItem) => void;
  onOpenProfile: (username: string) => void;
}

/**
 * The Marketplace page. The explorer already carries its own masthead, search,
 * categories and filters, so this page stays a thin host — listings lead,
 * explanation does not.
 */
export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  onOpenCreateListing,
  onSelectItem,
  onOpenProfile,
}) => <MarketplaceExplorer onOpenCreateListing={onOpenCreateListing} onSelectItem={onSelectItem} onOpenProfile={onOpenProfile} />;
