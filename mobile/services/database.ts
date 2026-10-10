/**
 * JID Mobile data access layer.
 *
 * A faithful port of the website's `src/services/database.ts`. Every read and
 * write goes directly to Supabase using the anon key; row shapes (snake_case)
 * are mapped to the app's camelCase domain types here so no screen ever touches
 * a raw row.
 *
 * Two deliberate changes from the web version:
 *
 *  1. `getSupabase()` instead of `requireSupabase()`. The web app must throw
 *     synchronously if it was constructed without env; the mobile app renders a
 *     setup screen instead (see `app/_layout.tsx`), so the client is created
 *     lazily on first use.
 *
 *  2. PostgREST rows are typed as `DbRow`. `supabase-js` can generate exact row
 *     types from the live schema, but that requires a generated
 *     `database.types.ts` committed to the repo; until that exists, a narrow
 *     `any`-based alias keeps this file a line-for-line match with the web
 *     version, which has been exercised in production. `mapX` functions are the
 *     single place where that looseness is allowed, and they normalise every
 *     field explicitly.
 */
import { getSupabase } from './supabase';
import type { ItemCondition } from '../constants/brand';
import type {
  Conversation,
  ListingCategory,
  ListingKind,
  MarketplaceItem,
  Message,
  NotificationItem,
  PropertyListing,
  PublicProfile,
  SavedItem,
  UserProfile,
  VendorRatingSummary,
  VendorReview,
} from '../types';

/** Loosely-typed DB row. Only ever touched inside this module's mappers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = any;

const SELLER_EMBED =
  'seller:profiles(username, full_name, department, level, hall_or_area, avatar_url)';
const LANDLORD_EMBED = 'landlord:profiles(username, full_name, avatar_url)';
const REVIEWER_EMBED =
  'reviewer:profiles!vendor_reviews_reviewer_id_fkey(username, full_name, avatar_url)';

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * A boost is only "active" while `boosted_until` is in the future. Stale
 * timestamps are kept in the DB (they are the audit trail) but must never
 * render as a boost, so this check is evaluated per read rather than trusted
 * from the row.
 */
const computeBoosted = (boostedUntil?: string | null): boolean =>
  Boolean(boostedUntil && new Date(boostedUntil).getTime() > Date.now());

export function mapMarketplace(row: DbRow): MarketplaceItem {
  const s = row.seller || {};
  const boostedUntil = row.boosted_until || undefined;
  const boosted = computeBoosted(boostedUntil);
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    price: Number(row.price),
    condition: row.condition,
    location: row.location,
    pickupSpot: row.pickup_spot || '',
    specs: row.specs || [],
    images: row.images || [],
    contactPreference: row.contact_preference,
    phoneOrWhatsapp: row.phone_or_whatsapp || undefined,
    status: row.status,
    viewsCount: row.views_count ?? 0,
    savesCount: row.saves_count ?? 0,
    isBoosted: boosted,
    boostedUntil: boosted ? boostedUntil : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
    seller: {
      id: row.user_id,
      username: s.username || '',
      name: s.full_name || 'JID Student',
      department: s.department || undefined,
      level: s.level || undefined,
      hallOrArea: s.hall_or_area || undefined,
      avatarUrl: s.avatar_url || undefined,
    },
  };
}

export function mapProperty(row: DbRow): PropertyListing {
  const l = row.landlord || {};
  const boostedUntil = row.boosted_until || undefined;
  const boosted = computeBoosted(boostedUntil);
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    area: row.area,
    distanceToCampus: row.distance_to_campus || '',
    pricePerYear: Number(row.price_per_year),
    roomType: row.room_type,
    availability: row.availability,
    waterSource: row.water_source || '',
    powerSetup: row.power_setup || '',
    security: row.security || '',
    proximityDesc: row.proximity_desc || '',
    amenities: row.amenities || [],
    images: row.images || [],
    contactPhone: row.contact_phone || '',
    contactWhatsapp: row.contact_whatsapp || undefined,
    isVerified: Boolean(row.is_verified),
    status: row.status,
    viewsCount: row.views_count ?? 0,
    savesCount: row.saves_count ?? 0,
    isBoosted: boosted,
    boostedUntil: boosted ? boostedUntil : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
    landlord: {
      id: row.user_id,
      username: l.username || '',
      name: l.full_name || 'JID Host',
      role: row.landlord_role,
      phone: row.contact_phone || '',
      avatarUrl: l.avatar_url || undefined,
    },
  };
}

export function mapPublicProfile(row: DbRow): PublicProfile {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    department: row.department || undefined,
    level: row.level || undefined,
    hallOrArea: row.hall_or_area || undefined,
    avatarUrl: row.avatar_url || undefined,
    bio: row.bio || undefined,
    createdAt: row.created_at,
    avgRating: Number(row.avg_rating) || 0,
    reviewCount: Number(row.review_count) || 0,
  };
}

function mapMessage(row: DbRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    // Rows written before the messaging upgrade have no `kind`; text is the
    // correct default and the codec still recognises legacy `jid://` payloads.
    kind: row.kind ?? 'text',
    createdAt: row.created_at,
    readAt: row.read_at || undefined,
    deletedAt: row.deleted_at || undefined,
  };
}

function mapNotification(row: DbRow): NotificationItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.body,
    type: row.type,
    link: row.link || undefined,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

function mapReview(row: DbRow): VendorReview {
  const r = row.reviewer || {};
  return {
    id: row.id,
    vendorId: row.vendor_id,
    reviewerId: row.reviewer_id,
    rating: row.rating,
    comment: row.comment || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
    reviewer: r.username
      ? { username: r.username, fullName: r.full_name, avatarUrl: r.avatar_url || undefined }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Photo messages
//
// Encoding lives in `services/messaging/codec`, which understands all four
// message kinds and both the dedicated columns and the legacy `jid://` prefix.
// These re-exports keep every existing import site working unchanged.
// ---------------------------------------------------------------------------
export {
  PHOTO_MESSAGE_PREFIX,
  DELETED_MESSAGE_MARKER,
  AUDIO_MESSAGE_PREFIX,
  isPhotoMessage,
  isDeletedMessage,
  photoMessageUrl,
  photoMessageContent,
  messagePreview,
} from './messaging/codec';

/** Human-friendly preview of a message body. Never shows a raw photo URL. */
export function messageSummary(content: string): string {
  if (content.startsWith('jid://deleted/')) return 'Message deleted';
  if (content.startsWith('jid://photo/')) return 'Sent a photo';
  if (content.startsWith('jid://audio/')) return 'Sent a voice message';
  return content;
}

/**
 * Strips characters that would break a PostgREST `.or()` filter string. Without
 * this a user searching for "hp (2)" produces an invalid filter and the whole
 * query 500s instead of simply matching nothing.
 */
const sanitizeSearch = (term: string): string => term.replace(/[,()%\\]/g, ' ').trim();

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/**
 * Reads the signed-in user's own profile row.
 *
 * RLS restricts `profiles` to the caller plus public columns, so this returns
 * exactly the caller's row and nothing else.
 */
export async function fetchProfileRow(userId: string): Promise<DbRow> {
  const sb = getSupabase();
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(
  userId: string,
  updates: Partial<
    Pick<
      UserProfile,
      'fullName' | 'username' | 'department' | 'level' | 'hallOrArea' | 'bio' | 'avatarUrl'
    >
  >,
): Promise<void> {
  const sb = getSupabase();
  const patch: Record<string, unknown> = {};
  if (updates.fullName !== undefined) patch.full_name = updates.fullName;
  if (updates.username !== undefined) patch.username = updates.username;
  if (updates.department !== undefined) patch.department = updates.department;
  if (updates.level !== undefined) patch.level = updates.level;
  if (updates.hallOrArea !== undefined) patch.hall_or_area = updates.hallOrArea;
  if (updates.bio !== undefined) patch.bio = updates.bio;
  if (updates.avatarUrl !== undefined) patch.avatar_url = updates.avatarUrl;
  const { error } = await sb.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

export async function getPublicProfileByUsername(
  username: string,
): Promise<PublicProfile | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('public_profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPublicProfile(data) : null;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const sb = getSupabase();
  const { data } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
  return !data;
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

export interface MarketplaceQuery {
  search?: string;
  category?: string;
  condition?: string;
  location?: string;
  sort?: 'boosted' | 'newest' | 'price-asc' | 'price-desc';
  limit?: number;
  offset?: number;
}

export const PAGE_SIZE = 24;

export async function listMarketplace(q: MarketplaceQuery = {}): Promise<MarketplaceItem[]> {
  const sb = getSupabase();
  const limit = q.limit ?? PAGE_SIZE;
  const offset = q.offset ?? 0;
  let query = sb
    .from('marketplace_listings')
    .select(`*, ${SELLER_EMBED}`)
    .eq('status', 'active');

  if (q.category && q.category !== 'all') query = query.eq('category', q.category);
  if (q.condition) query = query.eq('condition', q.condition);
  if (q.location) query = query.eq('location', q.location);
  if (q.search) {
    const s = sanitizeSearch(q.search);
    if (s) query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%,location.ilike.%${s}%`);
  }

  switch (q.sort) {
    case 'price-asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price-desc':
      query = query.order('price', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    default:
      // Boosted listings float to the top of the default feed; NULL timestamps
      // sort last so un-boosted rows never outrank an active boost.
      query = query
        .order('boosted_until', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return ((data || []) as DbRow[]).map(mapMarketplace);
}

export async function listMarketplaceByUser(userId: string): Promise<MarketplaceItem[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('marketplace_listings')
    .select(`*, ${SELLER_EMBED}`)
    .eq('user_id', userId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as DbRow[]).map(mapMarketplace);
}

export async function getMarketplace(id: string): Promise<MarketplaceItem | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('marketplace_listings')
    .select(`*, ${SELLER_EMBED}`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMarketplace(data) : null;
}

export interface NewMarketplaceInput {
  title: string;
  description: string;
  category: ListingCategory;
  price: number;
  condition: ItemCondition;
  location: string;
  pickupSpot?: string;
  specs?: string[];
  images: string[];
  contactPreference: 'whatsapp' | 'phone' | 'chat' | 'all';
  phoneOrWhatsapp?: string;
}

export async function createMarketplace(
  userId: string,
  input: NewMarketplaceInput,
): Promise<MarketplaceItem> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('marketplace_listings')
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description,
      category: input.category,
      price: input.price,
      condition: input.condition,
      location: input.location,
      pickup_spot: input.pickupSpot || null,
      specs: input.specs || [],
      images: input.images,
      contact_preference: input.contactPreference,
      phone_or_whatsapp: input.phoneOrWhatsapp || null,
    })
    .select(`*, ${SELLER_EMBED}`)
    .single();
  if (error) throw error;
  return mapMarketplace(data);
}

/**
 * Partial update. Only the keys actually present in `updates` are written, so
 * an edit form that omits an untouched field never nulls it by accident.
 */
export async function updateMarketplace(
  id: string,
  updates: Partial<NewMarketplaceInput> & { status?: string },
): Promise<void> {
  const sb = getSupabase();
  const patch: Record<string, unknown> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.price !== undefined) patch.price = updates.price;
  if (updates.condition !== undefined) patch.condition = updates.condition;
  if (updates.location !== undefined) patch.location = updates.location;
  if (updates.pickupSpot !== undefined) patch.pickup_spot = updates.pickupSpot;
  if (updates.specs !== undefined) patch.specs = updates.specs;
  if (updates.images !== undefined) patch.images = updates.images;
  if (updates.contactPreference !== undefined)
    patch.contact_preference = updates.contactPreference;
  if (updates.phoneOrWhatsapp !== undefined) patch.phone_or_whatsapp = updates.phoneOrWhatsapp;
  if (updates.status !== undefined) patch.status = updates.status;
  const { error } = await sb.from('marketplace_listings').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteMarketplace(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('marketplace_listings').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Property / accommodation
// ---------------------------------------------------------------------------

export interface PropertyQuery {
  search?: string;
  roomType?: string;
  area?: string;
  availability?: string;
  maxPrice?: number;
  sort?: 'boosted' | 'newest' | 'price-asc' | 'price-desc';
  limit?: number;
  offset?: number;
}

export async function listProperties(q: PropertyQuery = {}): Promise<PropertyListing[]> {
  const sb = getSupabase();
  const limit = q.limit ?? PAGE_SIZE;
  const offset = q.offset ?? 0;
  let query = sb
    .from('property_listings')
    .select(`*, ${LANDLORD_EMBED}`)
    .eq('status', 'active');

  if (q.roomType) query = query.eq('room_type', q.roomType);
  if (q.area) query = query.eq('area', q.area);
  if (q.availability) query = query.eq('availability', q.availability);
  if (q.maxPrice) query = query.lte('price_per_year', q.maxPrice);
  if (q.search) {
    const s = sanitizeSearch(q.search);
    if (s) query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%,area.ilike.%${s}%`);
  }

  switch (q.sort) {
    case 'price-asc':
      query = query.order('price_per_year', { ascending: true });
      break;
    case 'price-desc':
      query = query.order('price_per_year', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    default:
      query = query
        .order('boosted_until', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return ((data || []) as DbRow[]).map(mapProperty);
}

export async function listPropertiesByUser(userId: string): Promise<PropertyListing[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('property_listings')
    .select(`*, ${LANDLORD_EMBED}`)
    .eq('user_id', userId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as DbRow[]).map(mapProperty);
}

export async function getProperty(id: string): Promise<PropertyListing | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('property_listings')
    .select(`*, ${LANDLORD_EMBED}`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProperty(data) : null;
}

export interface NewPropertyInput {
  title: string;
  description: string;
  area: string;
  distanceToCampus?: string;
  pricePerYear: number;
  roomType: string;
  availability: string;
  waterSource?: string;
  powerSetup?: string;
  security?: string;
  proximityDesc?: string;
  amenities?: string[];
  images: string[];
  contactPhone: string;
  contactWhatsapp?: string;
  landlordRole?: string;
}

export async function createProperty(
  userId: string,
  input: NewPropertyInput,
): Promise<PropertyListing> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('property_listings')
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description,
      area: input.area,
      distance_to_campus: input.distanceToCampus || null,
      price_per_year: input.pricePerYear,
      room_type: input.roomType,
      availability: input.availability,
      water_source: input.waterSource || null,
      power_setup: input.powerSetup || null,
      security: input.security || null,
      proximity_desc: input.proximityDesc || null,
      amenities: input.amenities || [],
      images: input.images,
      contact_phone: input.contactPhone,
      contact_whatsapp: input.contactWhatsapp || null,
      landlord_role: input.landlordRole || 'Student Subletter',
    })
    .select(`*, ${LANDLORD_EMBED}`)
    .single();
  if (error) throw error;
  return mapProperty(data);
}

export async function updateProperty(
  id: string,
  updates: Partial<NewPropertyInput> & { status?: string },
): Promise<void> {
  const sb = getSupabase();
  const patch: Record<string, unknown> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.area !== undefined) patch.area = updates.area;
  if (updates.distanceToCampus !== undefined) patch.distance_to_campus = updates.distanceToCampus;
  if (updates.pricePerYear !== undefined) patch.price_per_year = updates.pricePerYear;
  if (updates.roomType !== undefined) patch.room_type = updates.roomType;
  if (updates.availability !== undefined) patch.availability = updates.availability;
  if (updates.waterSource !== undefined) patch.water_source = updates.waterSource;
  if (updates.powerSetup !== undefined) patch.power_setup = updates.powerSetup;
  if (updates.security !== undefined) patch.security = updates.security;
  if (updates.proximityDesc !== undefined) patch.proximity_desc = updates.proximityDesc;
  if (updates.amenities !== undefined) patch.amenities = updates.amenities;
  if (updates.images !== undefined) patch.images = updates.images;
  if (updates.contactPhone !== undefined) patch.contact_phone = updates.contactPhone;
  if (updates.contactWhatsapp !== undefined) patch.contact_whatsapp = updates.contactWhatsapp;
  if (updates.landlordRole !== undefined) patch.landlord_role = updates.landlordRole;
  if (updates.status !== undefined) patch.status = updates.status;
  const { error } = await sb.from('property_listings').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteProperty(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('property_listings').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Fire-and-forget view counter. Failures are swallowed: a dropped counter must
 * never block someone from viewing a listing, and the RPC is rate-limited
 * server-side anyway.
 */
export async function incrementView(kind: ListingKind, id: string): Promise<void> {
  const sb = getSupabase();
  await sb.rpc('increment_listing_view', { kind, lid: id });
}

// ---------------------------------------------------------------------------
// Saved listings
// ---------------------------------------------------------------------------

export async function listSaved(userId: string): Promise<SavedItem[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('saved_listings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as DbRow[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    listingType: r.listing_type,
    listingId: r.listing_id,
    savedAt: r.created_at,
  }));
}

/**
 * Saving is idempotent from the UI's point of view. A duplicate insert is
 * reported as a conflict by Postgres (rather than an error), and that is
 * exactly the state we were trying to reach, so it is swallowed.
 */
export async function addSaved(
  userId: string,
  kind: ListingKind,
  listingId: string,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('saved_listings')
    .insert({ user_id: userId, listing_type: kind, listing_id: listingId });
  if (error && !String(error.message).includes('duplicate')) throw error;
}

export async function removeSaved(
  userId: string,
  kind: ListingKind,
  listingId: string,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('saved_listings')
    .delete()
    .eq('user_id', userId)
    .eq('listing_type', kind)
    .eq('listing_id', listingId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Messaging
//
// The implementation moved to `services/messaging/*`, split by concern: message
// reads and writes, the conversation list, realtime typing and presence, safety
// controls and media uploads. These re-exports keep every existing import site
// working unchanged, so there is exactly one implementation of a chat send
// rather than two that can drift apart.
// ---------------------------------------------------------------------------
export {
  fetchMessages,
  fetchMessagesBefore,
  markThreadRead,
  markThreadDelivered,
  sendMessage,
  deleteMessageForEveryone as deleteMessage,
  deleteMessageForMe,
  searchMessages,
  subscribeToMessages,
  mapMessage,
  mergeIncoming,
  newClientId,
  optimisticMessage,
  encodeContent,
} from './messaging/messages';

export {
  fetchConversations,
  getOrCreateConversation,
  markConversationRead,
  searchConversations,
  setConversationArchived,
  setConversationPinned,
  subscribeToMemberships,
  fetchUnreadTotal,
  countArchived,
} from './messaging/conversations';

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function listNotifications(userId: string): Promise<NotificationItem[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data || []) as DbRow[]).map(mapNotification);
}

export async function markNotificationRead(id: string): Promise<void> {
  const sb = getSupabase();
  await sb.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const sb = getSupabase();
  await sb
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export function subscribeToNotifications(
  userId: string,
  onInsert: (n: NotificationItem) => void,
): () => void {
  const sb = getSupabase();
  const channel = sb
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(mapNotification(payload.new)),
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Vendor reviews
// ---------------------------------------------------------------------------

export async function listVendorReviews(vendorId: string): Promise<VendorReview[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('vendor_reviews')
    .select(`*, ${REVIEWER_EMBED}`)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as DbRow[]).map(mapReview);
}

/** Average, count and a 1..5 histogram, computed client-side from the rows. */
export function summarizeReviews(reviews: VendorReview[]): VendorRatingSummary {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  reviews.forEach((r) => {
    const bucket = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[bucket] += 1;
    total += r.rating;
  });
  return {
    average: reviews.length ? total / reviews.length : 0,
    count: reviews.length,
    distribution,
  };
}

/** One review per reviewer per vendor — a second tap edits the first. */
export async function upsertReview(
  vendorId: string,
  reviewerId: string,
  rating: number,
  comment?: string,
): Promise<VendorReview> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('vendor_reviews')
    .upsert(
      { vendor_id: vendorId, reviewer_id: reviewerId, rating, comment: comment || null },
      { onConflict: 'vendor_id,reviewer_id' },
    )
    .select(`*, ${REVIEWER_EMBED}`)
    .single();
  if (error) throw error;
  return mapReview(data);
}

export async function deleteReview(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('vendor_reviews').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function submitListingReport(input: {
  reporterId: string;
  listingType: ListingKind;
  listingId: string;
  listingTitle: string;
  reason: string;
  details?: string;
}): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('listing_reports').insert({
    reporter_id: input.reporterId,
    listing_type: input.listingType,
    listing_id: input.listingId,
    listing_title: input.listingTitle,
    reason: input.reason,
    details: input.details || null,
  });
  if (error) throw error;
}

export async function submitUserReport(input: {
  reporterId: string;
  reportedUserId: string;
  reason: string;
  details?: string;
}): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('user_reports').insert({
    reporter_id: input.reporterId,
    reported_user_id: input.reportedUserId,
    reason: input.reason,
    details: input.details || null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Boosts
// ---------------------------------------------------------------------------

/**
 * Records a completed 24-hour boost.
 *
 * `boosted_until` on the listing itself is what the feed sorts and renders on;
 * this row is the redemption ledger (who watched which ads, when), and it also
 * enforces one active boost per listing.
 */
export async function createBoost(
  kind: ListingKind,
  listingId: string,
  userId: string,
): Promise<void> {
  const sb = getSupabase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from('listing_boosts').insert({
    listing_type: kind,
    listing_id: listingId,
    user_id: userId,
    expires_at: expiresAt,
    status: 'active',
  });
  if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;
}

/** Applies the boost window to the listing. Called after `createBoost` succeeds. */
export async function applyBoostToListing(
  kind: ListingKind,
  listingId: string,
): Promise<void> {
  const sb = getSupabase();
  const table = kind === 'marketplace' ? 'marketplace_listings' : 'property_listings';
  const { error } = await sb
    .from(table)
    .update({ boosted_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', listingId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

/**
 * Deletes the authenticated user and everything RLS cascades from it.
 *
 * This RPC exists precisely so the app never needs a service-role key: the
 * function runs with the caller's privileges and cannot be pointed at another
 * user's account.
 */
export async function deleteMyAccount(): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc('delete_my_account');
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
