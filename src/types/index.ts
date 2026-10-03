import { ItemCondition, AccommodationType, AvailabilityStatus } from '../config/brand';

/** Account authorization role — mirrors the DB `user_roles` table. */
export type AccountRole = 'user' | 'admin';

/** Descriptive role attached to an accommodation listing (not an account role). */
export type LandlordRole =
  | 'Student Subletter'
  | 'Lodge Caretaker'
  | 'Direct Landlord'
  | 'Campus Agent';

/**
 * The signed-in user. Only public-safe fields plus the session email.
 * `isAdmin` is derived from the DB `user_roles` table (never trusted from the
 * client) and is used purely to decide whether to attempt admin data access —
 * every admin action is still enforced server-side by RLS.
 */
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  department?: string;
  level?: string;
  hallOrArea?: string;
  avatarUrl?: string;
  bio?: string;
  isAdmin: boolean;
  createdAt: string;
}

/** Public storefront view of any user (no email / phone / private data). */
export interface PublicProfile {
  id: string;
  username: string;
  fullName: string;
  department?: string;
  level?: string;
  hallOrArea?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
  avgRating: number;
  reviewCount: number;
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
    id: string;
    username: string;
    name: string;
    department?: string;
    level?: string;
    hallOrArea?: string;
    avatarUrl?: string;
  };
}

export type PropertyStatus = 'active' | 'paused' | 'rented' | 'removed';

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
  isVerified: boolean; // moderation-controlled only; never self-serve
  status: PropertyStatus;
  viewsCount: number;
  savesCount: number;
  isBoosted: boolean;
  boostedUntil?: string;
  createdAt: string;
  updatedAt?: string;
  landlord: {
    id: string;
    username: string;
    name: string;
    role: LandlordRole;
    phone: string;
    avatarUrl?: string;
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

/**
 * How a message renders. Rows written before the `kind` column existed are
 * backfilled from their `jid://photo/` content prefix by migration 006, so
 * `text` means a real text message here.
 */
export type MessageKind = 'text' | 'image' | 'voice';

export interface ImageMessageMeta {
  /** One or more absolute image URLs. */
  urls: string[];
}

export interface VoiceMessageMeta {
  url: string;
  durationMs: number;
  /**
   * Normalised 0..1 amplitude peaks used to draw the waveform. Recorded once at
   * capture time so playback never has to decode the audio to draw it.
   */
  peaks?: number[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  /** Set once the recipient has opened/read this message (read receipt). */
  readAt?: string;
  /** Set when the sender soft-deletes the message (content is wiped). */
  deletedAt?: string;
  kind: MessageKind;
  /** Per-kind extras (image URLs, voice duration/waveform). */
  imageMeta?: ImageMessageMeta;
  voiceMeta?: VoiceMessageMeta;
  /** The message this one replies to, if any. */
  replyToId?: string;
  /**
   * The id the sending device generated before the row existed. Used to swap an
   * optimistic bubble for the real row exactly once.
   */
  clientId?: string;
  /** Resolved preview of the parent, for rendering the quoted block. */
  replyTo?: MessageReplyPreview;
  /** True when the signed-in student hid this message for themselves only. */
  hiddenForMe?: boolean;
}

/** Compact snapshot of a replied-to message, embedded in the quote block. */
export interface MessageReplyPreview {
  id: string;
  senderId: string;
  kind: MessageKind;
  /** Never the full body — quotes stay one or two lines. */
  preview: string;
  createdAt: string;
}

/** Local-only delivery state. `sending`/`failed` exist only on the sender's device. */
export type MessageDeliveryState = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Conversation {
  id: string;
  participant: {
    id: string;
    username?: string;
    fullName: string;
    avatarUrl?: string;
    department?: string;
    level?: string;
    hallOrArea?: string;
    /** Throttled heartbeat written while the student was last active. */
    lastSeenAt?: string;
    /** False when that student has turned presence off in settings. */
    presenceVisible?: boolean;
  };
  lastMessage?: Message;
  unreadCount: number;
  lastMessageAt: string;
  listingRef?: {
    id: string;
    title: string;
    price: number;
    image: string;
    type: 'marketplace' | 'property';
  };
  /** Set while pinned; pinned chats sort above everything else. */
  pinnedAt?: string;
  /** Set while archived; archived chats are hidden from the main inbox. */
  archivedAt?: string;
  /** True when the signed-in student has blocked this participant. */
  isBlocked?: boolean;
}

/** Categories offered by the in-chat reporting flow. */
export type ChatReportReason =
  | 'scam'
  | 'harassment'
  | 'spam'
  | 'inappropriate'
  | 'fake_listing'
  | 'impersonation'
  | 'other';

export interface ChatReportReasonOption {
  value: ChatReportReason;
  label: string;
  hint: string;
}

export interface BlockedUser {
  id: string;
  username?: string;
  fullName: string;
  avatarUrl?: string;
  blockedAt: string;
}

export type NotificationType = 'message' | 'boost' | 'inquiry' | 'system' | 'report' | 'review';

/** Sub-type for `system` notifications, used to pick an icon/label. */
export type NotificationCategory = 'price_drop' | 'saved_search';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  /** Alert sub-type (price drop on a saved listing, new saved-search match). */
  category?: NotificationCategory;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface SavedSearch {
  id: string;
  userId: string;
  listingType: 'marketplace' | 'property';
  label: string;
  /** Persisted explorer filters (search, category, price range, toggles…). */
  filters: Record<string, string | number | boolean>;
  notify: boolean;
  createdAt: string;
  lastNotifiedAt?: string;
}

export type BoostStatus = 'active' | 'expired' | 'cancelled';

export interface BoostRecord {
  id: string;
  listingId: string;
  listingType: 'marketplace' | 'property';
  userId: string;
  startedAt: string;
  expiresAt: string;
  status: BoostStatus;
}

export interface VendorReview {
  id: string;
  vendorId: string;
  reviewerId: string;
  rating: number; // 1..5
  comment?: string;
  createdAt: string;
  updatedAt?: string;
  reviewer?: {
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
}

export interface VendorRatingSummary {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'action_taken';

export interface ReportItem {
  id: string;
  reporterId?: string;
  targetType: 'marketplace' | 'property' | 'user';
  targetId: string;
  targetTitle: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  createdAt: string;
}

export type ViewType =
  // Public marketing pages
  | 'home'
  | 'marketplace'
  | 'accommodation'
  | 'vendors'
  | 'about'
  | 'contact'
  | 'login'
  | 'signup'
  | 'not-found'
  // Legal / policy pages (reachable from the footer and the cookie banner)
  | 'terms'
  | 'privacy'
  | 'cookies'
  // Authenticated product surfaces
  | 'dashboard'
  | 'my-listings'
  | 'saved'
  | 'messages'
  | 'profile'
  | 'public-profile'
  // Admin console (each screen is a real URL; all are kept out of `inMainNav`)
  | 'admin'
  | 'admin-users'
  | 'admin-listings'
  | 'admin-reports'
  | 'admin-vendors'
  | 'admin-reviews'
  | 'admin-audit';
