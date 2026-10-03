/**
 * JID data access layer — all reads/writes go through Supabase.
 * Row shapes (snake_case) are mapped to the app's camelCase domain types here
 * so components never touch raw DB rows. RLS enforces authorization server-side.
 */
import { requireSupabase } from './supabase';
import type {
  MarketplaceItem,
  PropertyListing,
  SavedItem,
  SavedSearch,
  Conversation,
  Message,
  NotificationItem,
  NotificationCategory,
  VendorReview,
  VendorRatingSummary,
  PublicProfile,
  UserProfile,
  ReportItem,
  ListingCategory,
  MessageKind,
  ImageMessageMeta,
  VoiceMessageMeta,
  MessageReplyPreview,
  ChatReportReason,
  BlockedUser,
} from '../types';
import type { ItemCondition } from '../config/brand';

const SELLER_EMBED = 'seller:profiles(username, full_name, department, level, hall_or_area, avatar_url)';
const LANDLORD_EMBED = 'landlord:profiles(username, full_name, avatar_url)';
const REVIEWER_EMBED = 'reviewer:profiles!vendor_reviews_reviewer_id_fkey(username, full_name, avatar_url)';

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------
const computeBoosted = (boostedUntil?: string | null) =>
  Boolean(boostedUntil && new Date(boostedUntil).getTime() > Date.now());

export function mapMarketplace(row: any): MarketplaceItem {
  const s = row.seller || {};
  const boostedUntil = row.boosted_until || undefined;
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
    isBoosted: computeBoosted(boostedUntil),
    boostedUntil: computeBoosted(boostedUntil) ? boostedUntil : undefined,
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

export function mapProperty(row: any): PropertyListing {
  const l = row.landlord || {};
  const boostedUntil = row.boosted_until || undefined;
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
    isBoosted: computeBoosted(boostedUntil),
    boostedUntil: computeBoosted(boostedUntil) ? boostedUntil : undefined,
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

export function mapPublicProfile(row: any): PublicProfile {
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

function mapMessage(row: any): Message {
  const kind = resolveMessageKind(row.content, row.kind);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
    readAt: row.read_at || undefined,
    deletedAt: row.deleted_at || undefined,
    kind,
    imageMeta: mapImageMeta(kind, row.content, row.metadata),
    voiceMeta: mapVoiceMeta(kind, row.metadata),
    replyToId: row.reply_to_id || undefined,
    clientId: row.client_id || undefined,
    replyTo: (row.reply_snapshot as MessageReplyPreview) || undefined,
    hiddenForMe: Boolean(row.hidden_for_me),
  };
}

/**
 * Per-kind extras live in `messages.metadata`. Reading tolerates a malformed
 * payload rather than throwing: one bad row must not take down the whole thread.
 * Images additionally fall back to the legacy `jid://photo/` content prefix.
 */
function mapImageMeta(kind: MessageKind, content: string, meta: any): ImageMessageMeta | undefined {
  if (kind !== 'image') return undefined;
  const urls = Array.isArray(meta?.urls)
    ? meta.urls.filter((u: unknown) => typeof u === 'string')
    : isPhotoMessage(content)
      ? [photoMessageUrl(content)]
      : [];
  return urls.length ? { urls } : undefined;
}

function mapVoiceMeta(kind: MessageKind, meta: any): VoiceMessageMeta | undefined {
  if (kind !== 'voice' || typeof meta?.url !== 'string') return undefined;
  return {
    url: meta.url,
    durationMs: Number(meta.durationMs) || 0,
    peaks: Array.isArray(meta.peaks) ? meta.peaks.map(Number) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Photo messages
//
// A photo message stores the Cloudinary HTTPS URL as its `content`, prefixed
// with PHOTO_MESSAGE_PREFIX. Text content is never prefixed, so existing data
// and realtime inserts keep working without any schema change.
// ---------------------------------------------------------------------------
export const PHOTO_MESSAGE_PREFIX = 'jid://photo/';

export function isPhotoMessage(content: string): boolean {
  return content.startsWith(PHOTO_MESSAGE_PREFIX);
}

export function photoMessageUrl(content: string): string {
  return content.slice(PHOTO_MESSAGE_PREFIX.length);
}

export function photoMessageContent(url: string): string {
  return `${PHOTO_MESSAGE_PREFIX}${url}`;
}

// A soft-deleted message stores this marker instead of its original content.
export const DELETED_MESSAGE_MARKER = 'jid://deleted/';

export function isDeletedMessage(content: string): boolean {
  return content.startsWith(DELETED_MESSAGE_MARKER);
}

/**
 * Resolve a row's effective kind.
 *
 * `messages.kind` is authoritative, but two legacy cases still exist in
 * production data and in payloads from an older client that is still installed
 * on someone's phone:
 *   1. rows written before migration 006 (backfilled there, but a client on the
 *      old build can still create new ones),
 *   2. a photo whose `content` carries the `jid://photo/` prefix.
 * Deriving from the prefix as a fallback means an old client cannot make a photo
 * render as a raw URL.
 */
export function resolveMessageKind(content: string, kind?: string | null): MessageKind {
  if (kind === 'image' || kind === 'voice') return kind;
  if (isPhotoMessage(content)) return 'image';
  return 'text';
}

/**
 * Human-friendly one-line preview for the conversation list and notifications.
 * Never leaks a storage URL.
 */
export function messageSummary(message: {
  content: string;
  kind?: string | null;
  imageMeta?: ImageMessageMeta;
  voiceMeta?: VoiceMessageMeta;
}): string {
  if (isDeletedMessage(message.content)) return 'Message deleted';
  const kind = resolveMessageKind(message.content, message.kind);
  if (kind === 'image') return 'Sent a photo';
  if (kind === 'voice') return 'Sent a voice message';
  return message.content;
}

function mapNotification(row: any): NotificationItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.body,
    type: row.type,
    category: (row.category as NotificationCategory) || undefined,
    link: row.link || undefined,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

function mapReview(row: any): VendorReview {
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
// Profiles
// ---------------------------------------------------------------------------
export async function fetchProfileRow(userId: string) {
  const sb = requireSupabase();
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyRole(userId: string): Promise<'user' | 'admin'> {
  const sb = requireSupabase();
  const { data } = await sb.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  return (data?.role as 'user' | 'admin') || 'user';
}

export async function updateMyProfile(userId: string, updates: Partial<UserProfile>) {
  const sb = requireSupabase();
  const patch: Record<string, any> = {};
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

/**
 * Presence privacy.
 *
 * Split from `updateMyProfile()` on purpose: these are messaging privacy
 * switches, not profile fields, and routing them through the generic profile
 * updater would put presence columns on the same code path as a name change.
 *
 * `presence_visible` is what the UI reads to decide whether to show the Online
 * row at all; `last_seen_visible` is the finer-grained control for the timestamp
 * on its own. Turning presence off implies hiding the timestamp too, so that a
 * single switch always hides everything.
 */
export async function setPresenceVisible(userId: string, visible: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('profiles')
    .update({ presence_visible: visible, last_seen_visible: visible })
    .eq('id', userId);
  if (error) throw error;
}

export async function setLastSeenVisible(userId: string, visible: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('profiles')
    .update({ last_seen_visible: visible })
    .eq('id', userId);
  if (error) throw error;
}

/** Read the caller's own presence switches, for the settings screen. */
export async function fetchMyPresenceSettings(userId: string): Promise<{
  presenceVisible: boolean;
  lastSeenVisible: boolean;
}> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('presence_visible, last_seen_visible')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    // Default to true: a student who has never touched the settings is visible,
    // which matches the column default and avoids a blank first render.
    presenceVisible: data?.presence_visible !== false,
    lastSeenVisible: data?.last_seen_visible !== false,
  };
}

export async function getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('public_profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPublicProfile(data) : null;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const sb = requireSupabase();
  const { data } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
  return !data;
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------
export type SearchSort = 'boosted' | 'newest' | 'price-asc' | 'price-desc' | 'relevance';

export interface MarketplaceQuery {
  search?: string;
  category?: string;
  condition?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  boostedOnly?: boolean;
  sort?: SearchSort;
  limit?: number;
  offset?: number;
}

export interface SearchResults<T> {
  items: T[];
  /** Total rows matching the filters, independent of the current page. */
  total: number;
}

/** Reads the shared `total_count` window value the search RPCs attach to each row. */
const readTotal = (rows: any[]): number => (rows.length ? Number(rows[0].total_count) || 0 : 0);

/**
 * Advanced, server-side marketplace search. Runs the `search_marketplace` RPC
 * so full-text ranking, price ranges, boost-only filtering and the total count
 * all happen in Postgres against indexes — the browser never filters rows.
 */
export async function searchMarketplace(q: MarketplaceQuery = {}): Promise<SearchResults<MarketplaceItem>> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('search_marketplace', {
    p_search: q.search?.trim() || null,
    p_category: q.category && q.category !== 'all' ? q.category : null,
    p_condition: q.condition && q.condition !== 'all' ? q.condition : null,
    p_location: q.location && q.location !== 'all' ? q.location : null,
    p_min_price: q.minPrice ?? null,
    p_max_price: q.maxPrice ?? null,
    p_boosted_only: q.boostedOnly ?? false,
    p_sort: q.sort ?? 'boosted',
    p_limit: q.limit ?? 24,
    p_offset: q.offset ?? 0,
  });
  if (error) throw error;
  const rows = (data || []) as any[];
  return { items: rows.map(mapMarketplace), total: readTotal(rows) };
}

/** Backwards-compatible array-only wrapper used by previews and the hero. */
export async function listMarketplace(q: MarketplaceQuery = {}): Promise<MarketplaceItem[]> {
  return (await searchMarketplace(q)).items;
}

export async function listMarketplaceByUser(userId: string): Promise<MarketplaceItem[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('marketplace_listings')
    .select(`*, ${SELLER_EMBED}`)
    .eq('user_id', userId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapMarketplace);
}

export async function getMarketplace(id: string): Promise<MarketplaceItem | null> {
  const sb = requireSupabase();
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

export async function createMarketplace(userId: string, input: NewMarketplaceInput): Promise<MarketplaceItem> {
  const sb = requireSupabase();
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

export async function updateMarketplace(id: string, updates: Partial<NewMarketplaceInput> & { status?: string }) {
  const sb = requireSupabase();
  const patch: Record<string, any> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.price !== undefined) patch.price = updates.price;
  if (updates.condition !== undefined) patch.condition = updates.condition;
  if (updates.location !== undefined) patch.location = updates.location;
  if (updates.pickupSpot !== undefined) patch.pickup_spot = updates.pickupSpot;
  if (updates.specs !== undefined) patch.specs = updates.specs;
  if (updates.images !== undefined) patch.images = updates.images;
  if (updates.contactPreference !== undefined) patch.contact_preference = updates.contactPreference;
  if (updates.phoneOrWhatsapp !== undefined) patch.phone_or_whatsapp = updates.phoneOrWhatsapp;
  if (updates.status !== undefined) patch.status = updates.status;
  const { error } = await sb.from('marketplace_listings').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteMarketplace(id: string) {
  const sb = requireSupabase();
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
  minPrice?: number;
  maxPrice?: number;
  verifiedOnly?: boolean;
  boostedOnly?: boolean;
  sort?: SearchSort;
  limit?: number;
  offset?: number;
}

/** Advanced, server-side accommodation search (see `searchMarketplace`). */
export async function searchProperties(q: PropertyQuery = {}): Promise<SearchResults<PropertyListing>> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('search_properties', {
    p_search: q.search?.trim() || null,
    p_area: q.area && q.area !== 'all' ? q.area : null,
    p_room_type: q.roomType && q.roomType !== 'all' ? q.roomType : null,
    p_availability: q.availability && q.availability !== 'all' ? q.availability : null,
    p_min_price: q.minPrice ?? null,
    p_max_price: q.maxPrice ?? null,
    p_verified_only: q.verifiedOnly ?? false,
    p_boosted_only: q.boostedOnly ?? false,
    p_sort: q.sort ?? 'boosted',
    p_limit: q.limit ?? 24,
    p_offset: q.offset ?? 0,
  });
  if (error) throw error;
  const rows = (data || []) as any[];
  return { items: rows.map(mapProperty), total: readTotal(rows) };
}

/** Backwards-compatible array-only wrapper used by previews and the hero. */
export async function listProperties(q: PropertyQuery = {}): Promise<PropertyListing[]> {
  return (await searchProperties(q)).items;
}

export async function listPropertiesByUser(userId: string): Promise<PropertyListing[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('property_listings')
    .select(`*, ${LANDLORD_EMBED}`)
    .eq('user_id', userId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapProperty);
}

export async function getProperty(id: string): Promise<PropertyListing | null> {
  const sb = requireSupabase();
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

export async function createProperty(userId: string, input: NewPropertyInput): Promise<PropertyListing> {
  const sb = requireSupabase();
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

export async function updateProperty(id: string, updates: Partial<NewPropertyInput> & { status?: string }) {
  const sb = requireSupabase();
  const patch: Record<string, any> = {};
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

export async function deleteProperty(id: string) {
  const sb = requireSupabase();
  const { error } = await sb.from('property_listings').delete().eq('id', id);
  if (error) throw error;
}

export async function incrementView(type: 'marketplace' | 'property', id: string) {
  const sb = requireSupabase();
  await sb.rpc('increment_listing_view', { kind: type, lid: id });
}

// ---------------------------------------------------------------------------
// Saved listings
// ---------------------------------------------------------------------------
export async function listSaved(userId: string): Promise<SavedItem[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('saved_listings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    listingType: r.listing_type,
    listingId: r.listing_id,
    savedAt: r.created_at,
  }));
}

export async function addSaved(userId: string, type: 'marketplace' | 'property', listingId: string) {
  const sb = requireSupabase();
  const { error } = await sb
    .from('saved_listings')
    .insert({ user_id: userId, listing_type: type, listing_id: listingId });
  if (error && !`${error.message}`.includes('duplicate')) throw error;
}

export async function removeSaved(userId: string, type: 'marketplace' | 'property', listingId: string) {
  const sb = requireSupabase();
  const { error } = await sb
    .from('saved_listings')
    .delete()
    .eq('user_id', userId)
    .eq('listing_type', type)
    .eq('listing_id', listingId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Saved searches + alerts
// ---------------------------------------------------------------------------
function mapSavedSearch(row: any): SavedSearch {
  return {
    id: row.id,
    userId: row.user_id,
    listingType: row.listing_type,
    label: row.label,
    filters: row.filters || {},
    notify: row.notify !== false,
    createdAt: row.created_at,
    lastNotifiedAt: row.last_notified_at || undefined,
  };
}

export async function listSavedSearches(userId: string): Promise<SavedSearch[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('saved_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapSavedSearch);
}

export async function createSavedSearch(
  userId: string,
  input: {
    listingType: 'marketplace' | 'property';
    label: string;
    filters: Record<string, string | number | boolean>;
    notify?: boolean;
  }
): Promise<SavedSearch> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('saved_searches')
    .insert({
      user_id: userId,
      listing_type: input.listingType,
      label: input.label,
      filters: input.filters,
      notify: input.notify ?? true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapSavedSearch(data);
}

export async function removeSavedSearch(id: string) {
  const sb = requireSupabase();
  const { error } = await sb.from('saved_searches').delete().eq('id', id);
  if (error) throw error;
}

export async function setSavedSearchNotify(id: string, notify: boolean) {
  const sb = requireSupabase();
  const { error } = await sb.from('saved_searches').update({ notify }).eq('id', id);
  if (error) throw error;
}

/** Raise alerts for new listings matching the caller's saved searches.
 * Returns the number of notifications created. */
export async function generateSavedSearchAlerts(): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('generate_saved_search_alerts');
  if (error) throw error;
  return Number(data) || 0;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------
export async function getOrCreateConversation(
  otherUserId: string,
  listingRef?: { id: string; title: string; price: number; image: string; type: 'marketplace' | 'property' }
): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('get_or_create_direct_conversation', {
    other_user: otherUserId,
    p_listing_type: listingRef?.type ?? null,
    p_listing_id: listingRef?.id ?? null,
    p_listing_title: listingRef?.title ?? null,
    p_listing_price: listingRef?.price ?? null,
    p_listing_image: listingRef?.image ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchConversations(): Promise<Conversation[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('get_my_conversations');
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.conversation_id,
    participant: {
      id: r.other_id,
      username: r.other_username || undefined,
      fullName: r.other_full_name || 'JID Student',
      avatarUrl: r.other_avatar_url || undefined,
      department: r.other_department || undefined,
      level: r.other_level || undefined,
      hallOrArea: r.other_hall_or_area || undefined,
      // Already nulled server-side when that student hid their presence.
      lastSeenAt: r.other_last_seen_at || undefined,
      presenceVisible: r.other_presence_visible !== false,
    },
    lastMessage: r.last_message
      ? {
          id: '',
          conversationId: r.conversation_id,
          senderId: r.last_sender_id,
          content: r.last_message,
          createdAt: r.last_message_at,
          kind: resolveMessageKind(r.last_message, r.last_message_kind),
        }
      : undefined,
    unreadCount: Number(r.unread_count) || 0,
    lastMessageAt: r.last_message_at,
    pinnedAt: r.pinned_at || undefined,
    archivedAt: r.archived_at || undefined,
    isBlocked: Boolean(r.is_blocked),
    listingRef: r.listing_id
      ? {
          id: r.listing_id,
          title: r.listing_title || '',
          price: Number(r.listing_price) || 0,
          image: r.listing_image || '',
          type: r.listing_type,
        }
      : undefined,
  }));
}

/**
 * Select list for a message row.
 *
 * `reply` self-joins through the `reply_to_id` foreign key so every message
 * carries its own quote preview in the same round trip — the bubble never has to
 * go looking for the parent. RLS on `messages` already limits the join to rows
 * in conversations the caller participates in.
 */
const MESSAGE_SELECT =
  '*, reply:messages!messages_reply_to_fkey(id, sender_id, kind, content, created_at, deleted_at)';

function mapMessageWithReply(row: any): Message {
  const base = mapMessage(row);
  const parent = Array.isArray(row.reply) ? row.reply[0] : row.reply;
  if (!parent || !base.replyToId) return base;
  return {
    ...base,
    replyTo: {
      id: parent.id,
      senderId: parent.sender_id,
      kind: resolveMessageKind(parent.content, parent.kind),
      preview: messageSummary({
        content: parent.content,
        kind: parent.kind,
      }),
      createdAt: parent.created_at,
    },
  };
}

export async function fetchMessages(conversationId: string, limit = 50): Promise<Message[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapMessageWithReply).reverse();
}

/** Load an earlier page of history (builds on `fetchMessages` via a created_at cursor). */
export async function fetchMessagesBefore(
  conversationId: string,
  beforeCreatedAt: string,
  limit = 50
): Promise<Message[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .lt('created_at', beforeCreatedAt)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapMessageWithReply).reverse();
}

/**
 * Search inside one conversation.
 *
 * Ranked server-side on the `messages.search_tsv` GIN index, so a long thread
 * costs the same as a short one. `snippet` comes back with `<mark>` around each
 * hit for highlighting without re-querying.
 */
export async function searchMessages(
  conversationId: string,
  query: string,
  limit = 40
): Promise<Array<Message & { snippet: string }>> {
  const sb = requireSupabase();
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await sb.rpc('search_messages', {
    conv_id: conversationId,
    q: trimmed,
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.message_id,
    conversationId,
    senderId: r.sender_id,
    content: r.content,
    createdAt: r.created_at,
    readAt: r.read_at || undefined,
    kind: resolveMessageKind(r.content, r.kind),
    replyToId: r.reply_to_id || undefined,
    snippet: String(r.snippet || '').replace(/<\/?mark>/g, ''),
    highlightedSnippet: String(r.snippet || ''),
  }));
}

/** Ack the other participant's messages in this thread as read (read receipt). */
export async function markThreadRead(conversationId: string, userId: string) {
  const sb = requireSupabase();
  const { error } = await sb
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export interface SendMessageInput {
  content: string;
  kind?: MessageKind;
  metadata?: Record<string, unknown>;
  replyToId?: string;
}

/**
 * Insert a message.
 *
 * `clientId` is written to `client_id` so the sender can reconcile the row that
 * comes back (and the realtime INSERT that races it) against the optimistic
 * bubble it already painted. Without it, a send can briefly appear twice.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  input: string | SendMessageInput,
  clientId?: string
): Promise<Message> {
  const sb = requireSupabase();
  const payload: Record<string, unknown> =
    typeof input === 'string' ? { content: input } : { content: input.content };

  if (typeof input !== 'string') {
    if (input.kind) payload.kind = input.kind;
    if (input.metadata) payload.metadata = input.metadata;
    if (input.replyToId) payload.reply_to_id = input.replyToId;
  }
  if (clientId) payload.client_id = clientId;

  const { data, error } = await sb
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, ...payload })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw error;
  return mapMessageWithReply(data);
}

/** Soft-delete a message the caller sent: content is wiped and deleted_at is
 * stamped, so both sides render it as "deleted" instead of removing the row. */
export async function deleteMessage(messageId: string): Promise<Message> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('messages')
    .update({ content: DELETED_MESSAGE_MARKER, deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .select('*')
    .single();
  if (error) throw error;
  return mapMessage(data);
}

/**
 * Delete for me — hides a message on this device only.
 *
 * Deliberately a separate table rather than an update to `messages`: wiping
 * `content` would destroy the copy the other side still needs, and the sender
 * may not even have permission to edit someone else's row.
 */
export async function hideMessage(messageId: string, conversationId: string): Promise<void> {
  const sb = requireSupabase();
  const { data } = await sb.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('You must be signed in.');
  const { error } = await sb
    .from('message_deletions')
    .upsert({ message_id: messageId, user_id: userId, conversation_id: conversationId });
  if (error) throw error;
}

/**
 * Ids the caller has hidden in this thread. One indexed lookup, and the result
 * is applied on load and merged in realtime via `subscribeToMessageDeletions`.
 */
export async function fetchHiddenMessageIds(conversationId: string): Promise<string[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('message_deletions')
    .select('message_id')
    .eq('conversation_id', conversationId);
  if (error) throw error;
  return (data || []).map((r: any) => r.message_id as string);
}

export async function markConversationRead(conversationId: string) {
  const sb = requireSupabase();
  await sb.rpc('mark_conversation_read', { conv_id: conversationId });
}

export interface MessageSubscriptionHandlers {
  onInsert: (m: Message) => void;
  /** Read receipts and soft-deletes, from either side. */
  onUpdate?: (m: Message) => void;
  /** Another device of this same student hid a message for themselves. */
  onHidden?: (messageId: string) => void;
}

/**
 * Realtime for one open conversation.
 *
 * Also watches `message_deletions` so a hide performed on the phone lands on the
 * laptop without a refresh. Returns an unsubscribe function; callers must call
 * it on unmount or the socket leaks and duplicate messages start arriving.
 */
export function subscribeToMessages(
  conversationId: string,
  handlers: MessageSubscriptionHandlers | ((m: Message) => void),
  onUpdate?: (m: Message) => void
): () => void {
  // Kept callable as subscribeToMessages(id, onInsert) for existing callers.
  const h: MessageSubscriptionHandlers =
    typeof handlers === 'function'
      ? { onInsert: handlers, onUpdate }
      : handlers;

  const sb = requireSupabase();
  const channel = sb
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => h.onInsert(mapMessage(payload.new))
    );

  // Bound into locals because TypeScript cannot re-narrow the optional handlers
  // inside the callbacks below: `h` is a mutable binding, so narrowing is not
  // preserved across the closure boundary.
  const updateHandler = h.onUpdate;
  const hiddenHandler = h.onHidden;

  if (updateHandler) {
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => updateHandler(mapMessage(payload.new))
    );
  }

  if (hiddenHandler) {
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message_deletions',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => hiddenHandler((payload.new as any)?.message_id as string)
    );
  }

  channel.subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/**
 * Live updates to pin/archive flags for the conversations on screen.
 *
 * Scoped by `user_id` rather than per-conversation so one channel covers the
 * whole list; the payload carries the conversation id the row belongs to.
 */
export function subscribeToParticipantChanges(
  userId: string,
  onChange: (row: { conversationId: string; pinnedAt?: string; archivedAt?: string }) => void
): () => void {
  const sb = requireSupabase();
  const channel = sb
    .channel(`participants:${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as any;
        onChange({
          conversationId: row.conversation_id,
          pinnedAt: row.pinned_at || undefined,
          archivedAt: row.archived_at || undefined,
        });
      }
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Pin, archive, block, report
// ---------------------------------------------------------------------------

/**
 * Realtime for the *conversation list* itself.
 *
 * This exists because messages no longer write a `notifications` row (see
 * migration 006): the conversation list has to react to `messages` directly, or
 * an unread badge would only update after a manual refresh or a full reload.
 *
 * There is deliberately no `conversation_id=eq.*` filter. Supabase applies the
 * `messages` SELECT policy before delivering a change, so a student only ever
 * receives inserts from threads they are actually in — adding a filter would
 * mean re-subscribing every time the thread list changes, for no extra privacy.
 *
 * `onMessage` is debounced by the caller; this fires per row.
 */
export function subscribeToConversationActivity(
  onMessage: (conversationId: string) => void
): () => void {
  const sb = requireSupabase();
  const channel = sb
    .channel('messages:activity')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const convId = (payload.new as any)?.conversation_id;
        if (convId) onMessage(convId);
      }
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

export async function setConversationPinned(conversationId: string, pinned: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('set_conversation_pinned', { conv_id: conversationId, pinned });
  if (error) throw error;
}

export async function setConversationArchived(conversationId: string, archived: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('set_conversation_archived', { conv_id: conversationId, archived });
  if (error) throw error;
}

export async function blockUser(userId: string, reason?: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('block_user', { other_user: userId, p_reason: reason ?? null });
  if (error) throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('unblock_user', { other_user: userId });
  if (error) throw error;
}

export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('blocks')
    .select('blocked_id, created_at, profile:profiles!blocks_blocked_id_fkey(username, full_name, avatar_url)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => {
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
    return {
      id: r.blocked_id,
      username: p?.username || undefined,
      fullName: p?.full_name || 'JID Student',
      avatarUrl: p?.avatar_url || undefined,
      blockedAt: r.created_at,
    };
  });
}

/**
 * Report a user, optionally pinned to a specific message and/or conversation.
 *
 * Insert-only by design: the caller learns nothing about anyone else's reports,
 * and resolution happens entirely in the admin console.
 */
export async function submitChatReport(input: {
  reportedUserId: string;
  conversationId?: string;
  messageId?: string;
  reason: ChatReportReason;
  details?: string;
}): Promise<void> {
  const sb = requireSupabase();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr) throw authErr;
  const { error } = await sb.from('chat_reports').insert({
    reporter_id: auth.user?.id ?? null,
    reported_user_id: input.reportedUserId,
    conversation_id: input.conversationId ?? null,
    message_id: input.messageId ?? null,
    reason: input.reason,
    details: input.details?.trim() || null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

/**
 * Record that the caller is active. Rate-limited server-side to one write per
 * 30s, so a chatty client cannot turn this into polling.
 */
export async function touchLastSeen(): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('touch_last_seen');
  // A heartbeat failure is never worth surfacing to the student.
  if (error) console.warn('[presence] heartbeat failed', error.message);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function listNotifications(userId: string): Promise<NotificationItem[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map(mapNotification);
}

export async function markNotificationRead(id: string) {
  const sb = requireSupabase();
  await sb.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string) {
  const sb = requireSupabase();
  await sb.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}

export function subscribeToNotifications(userId: string, onInsert: (n: NotificationItem) => void): () => void {
  const sb = requireSupabase();
  const channel = sb
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert(mapNotification(payload.new))
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Vendor reviews
// ---------------------------------------------------------------------------
export async function listVendorReviews(vendorId: string): Promise<VendorReview[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('vendor_reviews')
    .select(`*, ${REVIEWER_EMBED}`)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapReview);
}

export function summarizeReviews(reviews: VendorReview[]): VendorRatingSummary {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  reviews.forEach((r) => {
    const k = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[k] += 1;
    total += r.rating;
  });
  return {
    average: reviews.length ? total / reviews.length : 0,
    count: reviews.length,
    distribution,
  };
}

export async function upsertReview(vendorId: string, reviewerId: string, rating: number, comment?: string): Promise<VendorReview> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('vendor_reviews')
    .upsert(
      { vendor_id: vendorId, reviewer_id: reviewerId, rating, comment: comment || null },
      { onConflict: 'vendor_id,reviewer_id' }
    )
    .select(`*, ${REVIEWER_EMBED}`)
    .single();
  if (error) throw error;
  return mapReview(data);
}

export async function deleteReview(id: string) {
  const sb = requireSupabase();
  const { error } = await sb.from('vendor_reviews').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export async function submitListingReport(input: {
  reporterId: string;
  listingType: 'marketplace' | 'property';
  listingId: string;
  listingTitle: string;
  reason: string;
  details?: string;
}) {
  const sb = requireSupabase();
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
}) {
  const sb = requireSupabase();
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
export async function createBoost(type: 'marketplace' | 'property', listingId: string, userId: string): Promise<void> {
  const sb = requireSupabase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from('listing_boosts').insert({
    listing_type: type,
    listing_id: listingId,
    user_id: userId,
    expires_at: expiresAt,
    status: 'active',
  });
  if (error && !`${error.message}`.toLowerCase().includes('duplicate')) throw error;
}

// ---------------------------------------------------------------------------
// Admin (all further gated by RLS — a non-admin gets empty/blocked results)
// ---------------------------------------------------------------------------
export async function adminListUsers(): Promise<Array<UserProfile & { isSuspended: boolean; role: string }>> {
  const sb = requireSupabase();
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    sb.from('profiles').select('*').order('created_at', { ascending: false }),
    sb.from('user_roles').select('*'),
  ]);
  const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
  return (profiles || []).map((p: any) => ({
    id: p.id,
    email: '',
    username: p.username,
    fullName: p.full_name,
    department: p.department || undefined,
    level: p.level || undefined,
    hallOrArea: p.hall_or_area || undefined,
    avatarUrl: p.avatar_url || undefined,
    bio: p.bio || undefined,
    isAdmin: roleMap.get(p.id) === 'admin',
    createdAt: p.created_at,
    isSuspended: Boolean(p.is_suspended),
    role: roleMap.get(p.id) || 'user',
  }));
}

export async function adminSetSuspended(userId: string, suspended: boolean) {
  const sb = requireSupabase();
  const { error } = await sb.from('profiles').update({ is_suspended: suspended }).eq('id', userId);
  if (error) throw error;
}

export async function adminListReports(): Promise<ReportItem[]> {
  const sb = requireSupabase();
  const [{ data: listing }, { data: users }] = await Promise.all([
    sb.from('listing_reports').select('*').order('created_at', { ascending: false }),
    sb.from('user_reports').select('*').order('created_at', { ascending: false }),
  ]);
  const l: ReportItem[] = (listing || []).map((r: any) => ({
    id: r.id,
    reporterId: r.reporter_id || undefined,
    targetType: r.listing_type,
    targetId: r.listing_id,
    targetTitle: r.listing_title || r.listing_id,
    reason: r.reason,
    details: r.details || undefined,
    status: r.status,
    createdAt: r.created_at,
  }));
  const u: ReportItem[] = (users || []).map((r: any) => ({
    id: r.id,
    reporterId: r.reporter_id || undefined,
    targetType: 'user',
    targetId: r.reported_user_id,
    targetTitle: r.reported_user_id,
    reason: r.reason,
    details: r.details || undefined,
    status: r.status,
    createdAt: r.created_at,
  }));
  return [...l, ...u].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function adminResolveListingReport(id: string, status: 'dismissed' | 'action_taken', resolverId: string) {
  const sb = requireSupabase();
  const { error } = await sb
    .from('listing_reports')
    .update({ status, resolved_by: resolverId, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function adminResolveUserReport(id: string, status: 'dismissed' | 'action_taken', resolverId: string) {
  const sb = requireSupabase();
  const { error } = await sb
    .from('user_reports')
    .update({ status, resolved_by: resolverId, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function adminRemoveListing(type: 'marketplace' | 'property', id: string) {
  const sb = requireSupabase();
  const table = type === 'marketplace' ? 'marketplace_listings' : 'property_listings';
  const { error } = await sb.from(table).update({ status: 'removed' }).eq('id', id);
  if (error) throw error;
}

export async function adminLog(adminId: string, action: string, targetType?: string, targetId?: string, details?: any) {
  const sb = requireSupabase();
  await sb.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    details: details || null,
  });
}

export async function adminStats() {
  const sb = requireSupabase();
  const countOf = async (table: string) => {
    const { count } = await sb.from(table).select('*', { count: 'exact', head: true });
    return count || 0;
  };
  const [users, market, property, reportsL, reportsU] = await Promise.all([
    countOf('profiles'),
    countOf('marketplace_listings'),
    countOf('property_listings'),
    countOf('listing_reports'),
    countOf('user_reports'),
  ]);
  return { users, marketplace: market, properties: property, reports: reportsL + reportsU };
}
