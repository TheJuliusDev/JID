/**
 * Domain types for JID Mobile.
 *
 * Ported 1:1 from the JID website (`src/types/index.ts`) so both clients speak
 * the same language about the same Supabase tables. Snake_case row shapes are
 * mapped to these camelCase types inside `services/database.ts`, so no screen
 * ever touches a raw row.
 */
import type {
  ItemCondition,
  AccommodationType,
  AvailabilityStatus,
} from '@/constants/brand';

/** Descriptive role attached to an accommodation listing (not an account role). */
export type LandlordRole =
  | 'Student Subletter'
  | 'Lodge Caretaker'
  | 'Direct Landlord'
  | 'Campus Agent';

export type ListingKind = 'marketplace' | 'property';

export type ListingCategory =
  | 'electronics'
  | 'phones'
  | 'computers'
  | 'books'
  | 'fashion'
  | 'furniture'
  | 'school-supplies'
  | 'other';

export type MarketplaceStatus = 'active' | 'paused' | 'sold' | 'removed';
export type PropertyStatus = 'active' | 'paused' | 'rented' | 'removed';

/** Any listing, regardless of kind. */
export type AnyListing = MarketplaceItem | PropertyListing;

/**
 * The signed-in user. Only public-safe fields plus the session email.
 *
 * Note there is deliberately no `isAdmin` flag: JID's mobile app has no admin
 * surface at all, so the client never needs to know a role in order to decide
 * what to render. Account roles and moderation live entirely in the separate
 * admin system, enforced by row-level security.
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
  /** `profiles.is_suspended`. Suspended accounts are hidden from everyone else by RLS. */
  isSuspended: boolean;
  /**
   * `profiles.last_seen_at`. Null when presence has never been recorded.
   * Own-account only — another person's value is exposed through
   * `get_conversation_participant`, which suppresses it when they opt out.
   */
  lastSeenAt?: string;
  /** Privacy switch. When false the owner is never shown as online or recently seen. */
  lastSeenVisible: boolean;
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
  status: MarketplaceStatus;
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
  listingType: ListingKind;
  listingId: string;
  savedAt: string;
}

/**
 * What a message carries.
 *
 * `text` is the original and stays the default, so every row written before the
 * messaging upgrade reads as text without a backfill. The others describe an
 * attachment whose bytes live in Cloudinary and whose URL lives in
 * `messages.media_url` — see `supabase/migrations/*_messaging_upgrade.sql`.
 */
export type MessageKind = 'text' | 'image' | 'voice' | 'system';

/**
 * A chat message.
 *
 * `status` and `pending` are client-only and never persisted: they describe how
 * far an optimistic local copy has got, so the UI can render "sending", "failed"
 * and a retry affordance without inventing rows.
 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  kind: MessageKind;
  createdAt: string;
  /** Set once the recipient has opened/read this message (read receipt). */
  readAt?: string;
  /** Set when the sender soft-deletes the message (content is wiped). */
  deletedAt?: string;
  /** Set when the deletion removed the message for every participant. */
  deletedForEveryoneAt?: string;
  /** Transport-level receipt: the message reached a device that rendered it. */
  deliveredAt?: string;
  /** The message this one quotes, if it is a reply. */
  replyToId?: string;
  /** Snapshot of the quoted text, so the quote survives history paging. */
  replyPreview?: string;
  /** Voice-message length in milliseconds. */
  durationMs?: number;
  /** Cloudinary URL for image and voice payloads. */
  mediaUrl?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  /**
   * Device-generated idempotency key. The unique index on
   * (sender_id, client_id) makes a retried send return the original row instead
   * of a duplicate bubble.
   */
  clientId?: string;

  // --- client-only -------------------------------------------------------
  /** Optimistic send state. Absent on messages that came from the server. */
  status?: 'sending' | 'sent' | 'failed';
  /** Recoverable payload for a failed send, so retry needs no re-input. */
  pending?: PendingPayload;
}

/** Everything needed to retry a send that never reached the server. */
export type PendingPayload =
  | { kind: 'text'; content: string; replyToId?: string; replyPreview?: string }
  | {
      kind: 'image';
      uri: string;
      width?: number;
      height?: number;
      replyToId?: string;
      replyPreview?: string;
    }
  | { kind: 'voice'; uri: string; durationMs: number; replyToId?: string; replyPreview?: string };

/**
 * Someone who is currently typing in an open conversation.
 *
 * Re-exported from `services/messaging/typing` so components can depend on the
 * shape without importing the transport that produces it. The typing indicator is
 * broadcast over Realtime and never stored, so this type describes a moment rather
 * than a row — there is no id, no timestamp of sending, and nothing to persist.
 */
export type { TypingState } from '@/services/messaging/typing';

/** How a participant's availability should be rendered in a header. */
export interface PresenceState {
  /** True only while a live presence channel says they are connected. */
  isOnline: boolean;
  /**
   * Persisted timestamp, or null when they have opted out of last-seen. Absent
   * entirely when the capability is unavailable, which is how the UI knows to
   * hide the line rather than print an empty one.
   */
  lastSeenAt?: string | null;
  /** False when the person has turned last-seen off in privacy settings. */
  visible: boolean;
}

export interface ListingRef {
  id: string;
  title: string;
  price: number;
  image: string;
  type: ListingKind;
}

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
    /**
     * Null when the person has opted out of last-seen. The UI must render
     * nothing in that case rather than "Last seen unknown".
     */
    lastSeenAt?: string | null;
    lastSeenVisible?: boolean;
  };
  lastMessage?: Message;
  unreadCount: number;
  lastMessageAt: string;
  listingRef?: ListingRef;
  /** Set when this user pinned the chat. Per-user, never shared. */
  pinnedAt?: string;
  /** Set when this user archived the chat. Per-user, never shared. */
  archivedAt?: string;
  /** Set when this user muted notifications for the chat. */
  mutedAt?: string;
}

/** A user this account has blocked. Read from `list_blocked_users()`. */
export interface BlockedUser {
  id: string;
  username?: string;
  fullName: string;
  avatarUrl?: string;
  blockedAt: string;
}

/**
 * One row from conversation search.
 *
 * Carries the matching message separately from the thread's last message: a hit
 * on an old message should say what matched, while the row still shows what the
 * conversation currently looks like.
 */
export interface ConversationSearchResult {
  conversationId: string;
  participant: {
    id: string;
    username?: string;
    fullName: string;
    avatarUrl?: string;
  };
  lastMessage?: Message;
  lastMessageAt?: string;
  unreadCount: number;
  pinnedAt?: string;
  archivedAt?: string;
  matchedMessageId?: string;
  matchedMessageKind?: MessageKind;
  matchedSenderId?: string;
  /**
   * The text of the message that actually matched, from
   * `search_my_conversations`. Null when the hit was on a participant's name
   * rather than on anything said — in that case there is no snippet to show and
   * the row falls back to the thread's latest message.
   */
  matchedMessageContent?: string;
}

/** Categories offered when reporting a user, a message or a conversation. */
export type SafetyReportReason =
  | 'scam'
  | 'harassment'
  | 'spam'
  | 'inappropriate'
  | 'fake_listing'
  | 'other';

export interface SafetyReportInput {
  reason: SafetyReportReason;
  details?: string;
  /** For a message-level report. */
  messageId?: string;
  /** For a message- or conversation-level report. */
  conversationId?: string;
}

export type NotificationType =
  | 'message'
  | 'boost'
  | 'inquiry'
  | 'system'
  | 'report'
  | 'review';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  isRead: boolean;
  createdAt: string;
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

export type ReportStatus =
  | 'pending'
  | 'reviewing'
  | 'resolved'
  | 'dismissed'
  | 'action_taken';

/**
 * A moderation report, shown only to the reporter (as "report sent") and to the
 * separate admin system. The mobile app writes these but never reads the queue.
 */
export interface ReportItem {
  id: string;
  reporterId?: string;
  targetType: ListingKind | 'user';
  targetId: string;
  targetTitle: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  createdAt: string;
}
