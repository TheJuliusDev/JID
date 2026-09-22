import { ItemCondition, AccommodationType, AvailabilityStatus } from '../config/brand';

export type UserRole = 'student' | 'landlord' | 'agent' | 'moderator' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  matricNumber?: string;
  department: string;
  level: string; // '100L' | '200L' | '300L' | '400L' | '500L' | 'Graduating Stalite';
  hallOrArea: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  avatarUrl?: string;
  bio?: string;
  isPremium: boolean;
  premiumUntil?: string;
  isVerified: boolean;
  role: UserRole;
  createdAt: string;
}

export type ListingCategory = 
  | 'electronics' 
  | 'phones' 
  | 'computers' 
  | 'books' 
  | 'fashion' 
  | 'furniture' 
  | 'school-supplies' 
  | 'other';

export type ListingStatus = 'active' | 'paused' | 'sold' | 'removed';

export interface MarketplaceItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: ListingCategory;
  price: number;
  condition: ItemCondition;
  location: string;
  pickupSpot: string;
  specs: string[];
  images: string[];
  contactPreference: 'whatsapp' | 'phone' | 'chat' | 'all';
  phoneOrWhatsapp?: string;
  status: ListingStatus;
  viewsCount: number;
  savesCount: number;
  isBoosted: boolean;
  boostedUntil?: string;
  createdAt: string;
  updatedAt?: string;
  seller: {
    name: string;
    department: string;
    level: string;
    hallOrArea: string;
    avatarUrl?: string;
    isPremium: boolean;
    isVerified: boolean;
  };
}

export interface PropertyListing {
  id: string;
  userId: string;
  title: string;
  description: string;
  area: string;
  distanceToCampus: string;
  pricePerYear: number;
  roomType: AccommodationType;
  availability: AvailabilityStatus;
  waterSource: string;
  powerSetup: string;
  security: string;
  proximityDesc: string;
  amenities: string[];
  images: string[];
  contactPhone: string;
  contactWhatsapp?: string;
  isVerified: boolean;
  status: 'active' | 'paused' | 'rented' | 'removed';
  viewsCount: number;
  savesCount: number;
  isBoosted: boolean;
  boostedUntil?: string;
  createdAt: string;
  updatedAt?: string;
  landlord: {
    name: string;
    role: 'Student Subletter' | 'Lodge Caretaker' | 'Direct Landlord' | 'Campus Agent';
    phone: string;
    avatarUrl?: string;
    isVerified: boolean;
  };
}

export interface SavedItem {
  id: string;
  userId: string;
  listingType: 'marketplace' | 'property';
  listingId: string;
  savedAt: string;
  item?: MarketplaceItem | PropertyListing;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  listingType?: 'marketplace' | 'property';
  listingId?: string;
  listingTitle?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participant: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    department?: string;
    level?: string;
    hallOrArea?: string;
    isPremium?: boolean;
  };
  lastMessage: Message;
  unreadCount: number;
  listingRef?: {
    id: string;
    title: string;
    price: number;
    image: string;
    type: 'marketplace' | 'property';
  };
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'message' | 'boost' | 'inquiry' | 'system' | 'report';
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface BoostRecord {
  id: string;
  listingId: string;
  listingType: 'marketplace' | 'property';
  userId: string;
  adsCompleted: number;
  startedAt: string;
  expiresAt: string;
  status: 'active' | 'expired';
}

export interface ReportItem {
  id: string;
  reporterId?: string;
  targetType: 'marketplace' | 'property' | 'user';
  targetId: string;
  targetTitle: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
  createdAt: string;
}

export type ViewType = 
  | 'home' 
  | 'marketplace' 
  | 'accommodation' 
  | 'dashboard' 
  | 'my-listings' 
  | 'saved' 
  | 'messages' 
  | 'premium' 
  | 'profile' 
  | 'admin';
