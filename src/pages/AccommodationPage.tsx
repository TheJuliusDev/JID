import React from 'react';
import { AccommodationExplorer } from '../components/accommodation/AccommodationExplorer';
import type { PropertyListing } from '../types';

interface AccommodationPageProps {
  onOpenCreateListing: () => void;
  onSelectProperty: (property: PropertyListing) => void;
  onOpenProfile: (username: string) => void;
}

/**
 * The Accommodation page. As with Marketplace, the explorer owns the masthead,
 * search and filters so the properties themselves are the focus of the page.
 */
export const AccommodationPage: React.FC<AccommodationPageProps> = ({
  onOpenCreateListing,
  onSelectProperty,
  onOpenProfile,
}) => (
  <AccommodationExplorer
    onOpenCreateListing={onOpenCreateListing}
    onSelectProperty={onSelectProperty}
    onOpenProfile={onOpenProfile}
  />
);
