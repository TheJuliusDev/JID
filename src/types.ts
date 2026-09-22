// Re-export all modern types from types/index
export * from './types/index';

// Compatibility types for legacy components
export interface MarketItem {
  id: string;
  title: string;
  category: string;
  price: number;
  condition: string;
  sellerName: string;
  department: string;
  hallOrArea: string;
  timeAgo: string;
  badge?: string;
  specs?: string[];
  description: string;
  pickupSpot: string;
}

export interface ApartmentListing {
  id: string;
  title: string;
  area: string;
  distanceToCampus: string;
  pricePerYear: number;
  roomType: string;
  availability: string;
  waterSource: string;
  powerSetup: string;
  security: string;
  proximityDesc: string;
  isVerified: boolean;
}

export interface CampusNode {
  id: string;
  name: string;
  subtitle: string;
  type: 'hall' | 'academic' | 'off-campus' | 'transit';
  vibe: string;
  typicalActivity: string;
}
