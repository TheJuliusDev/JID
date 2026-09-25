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
  Conversation,
  Message,
  NotificationItem,
  VendorReview,
  VendorRatingSummary,
  PublicProfile,
  UserProfile,
  ReportItem,
} from '../types';

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
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapNotification(row: any): NotificationItem {
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

/** Escape characters that would break a PostgREST .or() filter string. */
const sanitizeSearch = (term: string) => term.replace(/[,()%\\]/g, ' ').trim();

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
export interface MarketplaceQuery {
  search?: string;
  category?: string;
  condition?: string;
  location?: string;
  sort?: 'boosted' | 'newest' | 'price-asc' | 'price-desc';
  limit?: number;
  offset?: number;
}

export async function listMarketplace(q: MarketplaceQuery = {}): Promise<MarketplaceItem[]> {
  const sb = requireSupabase();
  const limit = q.limit ?? 24;
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
      query = query
        .order('boosted_until', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return (data || []).map(mapMarketplace);
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
  category: string;
  price: number;
  condition: string;
  location: string;
  pickupSpot?: string;
  specs?: string[];
  images: string[];
  contactPreference: string;
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
  maxPrice?: number;
  sort?: 'boosted' | 'newest' | 'price-asc' | 'price-desc';
  limit?: number;
  offset?: number;
}

export async function listProperties(q: PropertyQuery = {}): Promise<PropertyListing[]> {
  const sb = requireSupabase();
  const limit = q.limit ?? 24;
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
  return (data || []).map(mapProperty);
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
    },
    lastMessage: r.last_message
      ? {
          id: '',
          conversationId: r.conversation_id,
          senderId: r.last_sender_id,
          content: r.last_message,
          createdAt: r.last_message_at,
        }
      : undefined,
    unreadCount: Number(r.unread_count) || 0,
    lastMessageAt: r.last_message_at,
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

export async function fetchMessages(conversationId: string, limit = 50): Promise<Message[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapMessage).reverse();
}

export async function sendMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select('*')
    .single();
  if (error) throw error;
  return mapMessage(data);
}

export async function markConversationRead(conversationId: string) {
  const sb = requireSupabase();
  await sb.rpc('mark_conversation_read', { conv_id: conversationId });
}

export function subscribeToMessages(conversationId: string, onInsert: (m: Message) => void): () => void {
  const sb = requireSupabase();
  const channel = sb
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(mapMessage(payload.new))
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
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
