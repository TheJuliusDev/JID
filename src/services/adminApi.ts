/**
 * JID Admin — server API client.
 *
 * Every privileged operation in the console goes through this module, and every
 * call is a PostgREST RPC into a SECURITY DEFINER function that re-verifies the
 * caller's role against `public.user_roles` and writes the audit log in the same
 * transaction (see `supabase/migrations/002_admin_panel.sql`).
 *
 * What this file deliberately does NOT do:
 *   - it never reads or ships a service_role key;
 *   - it never sends an `isAdmin` flag, a user id for "who is acting", or any
 *     other authority claim — the server derives the acting admin from the JWT;
 *   - it never falls back to a direct table write when an RPC fails, because a
 *     direct write would skip the audit trail. Failures surface as errors.
 */

import { requireSupabase } from './supabase';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard as LayoutDashboardIcon,
  Users as UsersIcon,
  PackageSearch as ListingIcon,
  Flag as FlagIcon,
  Store as StoreIcon,
  Star as StarIcon,
  ScrollText as ScrollIcon,
} from 'lucide-react';

export type AdminErrorKind =
  | 'denied'          // signed in, but not an administrator
  | 'unauthorized'    // no session / expired session
  | 'not-deployed'    // the admin SQL migration has not been applied
  | 'not-found'
  | 'invalid'         // the request itself was rejected (bad value, rule)
  | 'conflict'
  | 'network'
  | 'unknown';

export class AdminApiError extends Error {
  readonly kind: AdminErrorKind;
  readonly code?: string;

  constructor(kind: AdminErrorKind, message: string, code?: string) {
    super(message);
    this.name = 'AdminApiError';
    this.kind = kind;
    this.code = code;
  }

  /** True when the console should send the operator back to the login screen. */
  get isAuthProblem(): boolean {
    return this.kind === 'denied' || this.kind === 'unauthorized';
  }
}

const classify = (raw: any): AdminApiError => {
  const code: string = raw?.code || '';
  const message: string = raw?.message || raw?.details || raw?.hint || 'Request failed';
  const lower = message.toLowerCase();

  if (code === '42501' || lower.includes('administrator privileges')) {
    return new AdminApiError('denied', 'Administrator privileges are required for this action.', code);
  }
  if (
    code === 'PGRST301' ||
    code === 'PGRST202' ||
    code === '42883' ||
    code === 'PGRST203' ||
    lower.includes('jwt expired') ||
    lower.includes('invalid claim') ||
    lower.includes('token is expired') ||
    lower.includes('could not find the function')
  ) {
    // PGRST202 / 42883 mean the RPC does not exist yet -> migration not applied.
    const missing =
      code === 'PGRST202' || code === '42883' || lower.includes('could not find the function');
    return missing
      ? new AdminApiError(
          'not-deployed',
          'The admin database functions are not installed. Run supabase/migrations/002_admin_panel.sql in the Supabase SQL Editor.',
          code
        )
      : new AdminApiError('unauthorized', 'Your session has expired. Please sign in again.', code);
  }
  if (code === 'PGRST116' || code === 'P0002' || lower.includes('no rows returned')) {
    return new AdminApiError('not-found', 'That record no longer exists.', code);
  }
  if (code === '401' || code === '403' || lower.includes('jwt')) {
    return new AdminApiError('unauthorized', 'You are not signed in, or the session expired.', code);
  }
  if (code === '22023' || code === '23514' || code === '23502' || code === '22P02') {
    return new AdminApiError('invalid', message, code);
  }
  if (code === '23505' || lower.includes('duplicate')) {
    return new AdminApiError('conflict', message, code);
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load failed')) {
    return new AdminApiError('network', 'Could not reach JID. Check your connection and try again.', code);
  }
  return new AdminApiError('unknown', message, code);
};

const toError = (err: any): AdminApiError =>
  err instanceof AdminApiError ? err : classify(err);

/** `data` is a JSON object `{ total, rows }`; this unwraps and narrows it. */
export interface Paged<T> {
  total: number;
  rows: T[];
}

const unwrap = <T>(payload: any): Paged<T> => {
  const rows = Array.isArray(payload?.rows) ? (payload.rows as T[]) : [];
  const total = Number.isFinite(Number(payload?.total)) ? Number(payload.total) : rows.length;
  return { total, rows };
};

/** Single choke point for every RPC, so error handling is uniform. */
async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw toError(error);
  return data as T;
}

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface AdminSession {
  authenticated: boolean;
  is_admin: boolean;
  user_id?: string | null;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  role?: 'user' | 'admin' | null;
}

export interface DashboardStats {
  users_total: number;
  users_suspended: number;
  users_admins: number;
  users_new_24h: number;
  users_new_7d: number;
  market_total: number;
  market_active: number;
  market_removed: number;
  property_total: number;
  property_active: number;
  property_removed: number;
  property_verified: number;
  reports_total: number;
  reports_pending: number;
  reports_24h: number;
  reviews_total: number;
  reviews_7d: number;
  boosts_active: number;
  audit_24h: number;
  denied_24h: number;
}

export interface ActivityItem {
  kind: string;
  occurred_at: string;
  actor: string;
  actor_handle: string;
  actor_avatar: string | null;
  summary: string;
  target_type: string;
  target_id: string;
}

export interface AdminUserRow {
  id: string;
  username: string;
  full_name: string;
  department: string | null;
  level: string | null;
  hall_or_area: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_suspended: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
  role: 'user' | 'admin';
  email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  marketplace_count: number;
  property_count: number;
  review_count: number;
  open_reports: number;
}

export interface AdminUserDetail {
  profile: AdminUserRow & { email_confirmed_at: string | null; last_sign_in_at: string | null };
  listings: Array<{
    id: string;
    kind: 'marketplace' | 'property';
    title: string;
    price: number;
    status: string;
    category: string;
    image: string | null;
    created_at: string;
    views_count: number;
    is_verified?: boolean;
  }>;
  reviews_received: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    reviewer: string | null;
  }>;
  reviews_given: number;
  avg_rating: number;
  reports_against: Array<{
    id: string;
    reason: string;
    details: string | null;
    status: string;
    created_at: string;
    reporter: string | null;
  }>;
  reports_filed: number;
  messages_sent: number;
}

export interface AdminMarketplaceRow {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  condition: string;
  location: string;
  pickup_spot: string | null;
  images: string[];
  image: string | null;
  status: string;
  views_count: number;
  saves_count: number;
  boosted_until: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_suspended: boolean;
}

export interface AdminPropertyRow {
  id: string;
  title: string;
  description: string;
  area: string;
  distance_to_campus: string | null;
  price_per_year: number;
  room_type: string;
  availability: string;
  amenities: string[];
  images: string[];
  image: string | null;
  status: string;
  is_verified: boolean;
  landlord_role: string;
  views_count: number;
  saves_count: number;
  boosted_until: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_suspended: boolean;
}

export type AdminListingRow = AdminMarketplaceRow | AdminPropertyRow;

export interface AdminReportRow {
  id: string;
  report_table: 'listing_reports' | 'user_reports';
  listing_kind: 'marketplace' | 'property' | null;
  target_id: string;
  target_title: string;
  reason: string;
  details: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_username: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  is_user_report: boolean;
  is_listing_report: boolean;
}

export interface AdminVendorRow {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
  level: string | null;
  hall_or_area: string | null;
  is_suspended: boolean;
  suspension_reason: string | null;
  created_at: string;
  role: 'user' | 'admin';
  marketplace_count: number;
  property_count: number;
  marketplace_active: number;
  property_active: number;
  marketplace_removed: number;
  property_removed: number;
  marketplace_value: number;
  property_value: number;
  review_count: number;
  avg_rating: number;
  open_reports: number;
}

export interface AdminReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  vendor_id: string;
  vendor_username: string | null;
  vendor_name: string | null;
  vendor_avatar: string | null;
  reviewer_id: string;
  reviewer_username: string | null;
  reviewer_name: string | null;
  reviewer_avatar: string | null;
}

export interface AdminAuditRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  admin_id: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface AuditActor {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  action_count: number;
  last_action_at: string;
}

export interface PageQuery {
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Session + dashboard
// ---------------------------------------------------------------------------

/**
 * The authoritative role probe. Called on every entry to the console and again
 * whenever the auth session changes, so the browser's idea of "am I an admin"
 * is always re-derived from the database rather than cached or asserted.
 */
export async function getAdminSession(): Promise<AdminSession> {
  const sb = requireSupabase();
  const { data } = await sb.auth.getSession();
  if (!data.session?.user) return { authenticated: false, is_admin: false };
  return rpc<AdminSession>('admin_session');
}

export const getDashboardStats = () => rpc<DashboardStats>('admin_dashboard_stats');

export const getActivityFeed = (limit = 20) =>
  rpc<ActivityItem[]>('admin_activity_feed', { p_limit: limit });

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserListFilters extends PageQuery {
  search: string;
  role: string;
  status: string;
  sort: string;
}

export async function listUsers(filters: UserListFilters): Promise<Paged<AdminUserRow>> {
  return unwrap<AdminUserRow>(
    await rpc('admin_list_users', {
      p_search: filters.search || null,
      p_role: filters.role,
      p_status: filters.status,
      p_sort: filters.sort,
      p_limit: filters.limit,
      p_offset: filters.offset,
    })
  );
}

export const getUserDetail = (userId: string) => rpc<AdminUserDetail>('admin_get_user', { p_user_id: userId });

export const setUserSuspended = (userId: string, suspended: boolean, reason?: string) =>
  rpc('admin_set_user_suspended', { p_user_id: userId, p_suspended: suspended, p_reason: reason || null });

export const setUserRole = (userId: string, role: 'user' | 'admin') =>
  rpc('admin_set_user_role', { p_user_id: userId, p_role: role });

export interface ProfilePatch {
  fullName?: string;
  username?: string;
  department?: string | null;
  level?: string | null;
  hallOrArea?: string | null;
  bio?: string | null;
}

export const updateUserProfile = (userId: string, patch: ProfilePatch) =>
  rpc('admin_update_profile', {
    p_user_id: userId,
    p_full_name: patch.fullName ?? null,
    p_username: patch.username ?? null,
    p_department: patch.department ?? null,
    p_level: patch.level ?? null,
    p_hall_or_area: patch.hallOrArea ?? null,
    p_bio: patch.bio ?? null,
  });

export const notifyUser = (userId: string, title: string, body: string, type = 'system') =>
  rpc('admin_notify_user', { p_user_id: userId, p_title: title, p_body: body, p_type: type });

/**
 * Records that a non-admin tried to use the console. The server stamps the
 * caller's own id, so this can log an attempt but never attribute it to someone
 * else. Failures are swallowed — a failed log must not block the UI.
 */
export async function logAccessDenied(context: string): Promise<void> {
  try {
    await rpc('admin_log_access_denied', { p_context: context });
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export interface ListingListFilters extends PageQuery {
  search: string;
  status: string;
  sort: string;
  category?: string;
  area?: string;
  roomType?: string;
  userId?: string | null;
}

export async function listMarketplaceListings(
  filters: ListingListFilters
): Promise<Paged<AdminMarketplaceRow>> {
  return unwrap<AdminMarketplaceRow>(
    await rpc('admin_list_marketplace_listings', {
      p_search: filters.search || null,
      p_status: filters.status,
      p_category: filters.category || 'all',
      p_sort: filters.sort,
      p_limit: filters.limit,
      p_offset: filters.offset,
    })
  );
}

export async function listPropertyListings(filters: ListingListFilters): Promise<Paged<AdminPropertyRow>> {
  return unwrap<AdminPropertyRow>(
    await rpc('admin_list_property_listings', {
      p_search: filters.search || null,
      p_status: filters.status,
      p_area: filters.area || 'all',
      p_room_type: filters.roomType || 'all',
      p_user_id: filters.userId ?? null,
      p_sort: filters.sort,
      p_limit: filters.limit,
      p_offset: filters.offset,
    })
  );
}

export interface AdminPropertyArea {
  area: string;
  listing_count: number;
}

/** Distinct accommodation areas currently in use (the column is free text). */
export async function listPropertyAreas(): Promise<AdminPropertyArea[]> {
  const data = await rpc('admin_list_property_areas');
  return Array.isArray(data) ? (data as AdminPropertyArea[]) : [];
}

export const setListingStatus = (kind: 'marketplace' | 'property', listingId: string, status: string, reason?: string) =>
  rpc('admin_set_listing_status', {
    p_kind: kind,
    p_listing_id: listingId,
    p_status: status,
    p_reason: reason || null,
  });

export const setListingVerified = (listingId: string, verified: boolean, reason?: string) =>
  rpc('admin_set_listing_verified', {
    p_listing_id: listingId,
    p_verified: verified,
    p_reason: reason || null,
  });

/**
 * Content-only edit. The server whitelists the writable columns and rejects
 * privileged ones (status, is_verified, counters, boost window) so this can
 * never be used to bypass the dedicated moderation actions.
 */
export const updateListing = (kind: 'marketplace' | 'property', listingId: string, patch: Record<string, unknown>) =>
  rpc('admin_update_listing', { p_kind: kind, p_listing_id: listingId, p_patch: patch });

export const deleteListing = (kind: 'marketplace' | 'property', listingId: string, reason: string) =>
  rpc('admin_delete_listing', { p_kind: kind, p_listing_id: listingId, p_reason: reason });

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface ReportListFilters extends PageQuery {
  kind: string;
  status: string;
  search: string;
  sort: string;
}

export async function listReports(filters: ReportListFilters): Promise<Paged<AdminReportRow>> {
  return unwrap<AdminReportRow>(
    await rpc('admin_list_reports', {
      p_kind: filters.kind,
      p_status: filters.status,
      p_search: filters.search || null,
      p_sort: filters.sort,
      p_limit: filters.limit,
      p_offset: filters.offset,
    })
  );
}

export const resolveReport = (
  table: 'listing_reports' | 'user_reports',
  reportId: string,
  status: 'reviewing' | 'resolved' | 'dismissed' | 'action_taken',
  note?: string
) => rpc('admin_resolve_report', { p_report_table: table, p_report_id: reportId, p_status: status, p_note: note || null });

// ---------------------------------------------------------------------------
// Vendors + reviews
// ---------------------------------------------------------------------------

export interface VendorListFilters extends PageQuery {
  search: string;
  filter: string;
  sort: string;
}

export async function listVendors(filters: VendorListFilters): Promise<Paged<AdminVendorRow>> {
  return unwrap<AdminVendorRow>(
    await rpc('admin_list_vendors', {
      p_search: filters.search || null,
      p_filter: filters.filter,
      p_sort: filters.sort,
      p_limit: filters.limit,
      p_offset: filters.offset,
    })
  );
}

export interface ReviewListFilters extends PageQuery {
  search: string;
  rating: number | null;
  sort: string;
}

export async function listReviews(filters: ReviewListFilters): Promise<Paged<AdminReviewRow>> {
  return unwrap<AdminReviewRow>(
    await rpc('admin_list_reviews', {
      p_search: filters.search || null,
      p_rating: filters.rating,
      p_sort: filters.sort,
      p_limit: filters.limit,
      p_offset: filters.offset,
    })
  );
}

export const deleteReview = (reviewId: string, reason: string) =>
  rpc('admin_delete_review', { p_review_id: reviewId, p_reason: reason });

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditListFilters extends PageQuery {
  actionPrefix: string;
  adminId: string | null;
}

export async function listAuditLog(filters: AuditListFilters): Promise<Paged<AdminAuditRow>> {
  return unwrap<AdminAuditRow>(
    await rpc('admin_list_audit_log', {
      p_action_prefix: filters.actionPrefix || null,
      p_admin_id: filters.adminId,
      p_limit: filters.limit,
      p_offset: filters.offset,
    })
  );
}

export const listAuditActors = () => rpc<AuditActor[]>('admin_list_audit_actors');

// ---------------------------------------------------------------------------
// Presentation helpers shared by every page
// ---------------------------------------------------------------------------

export const STATUS_TONE: Record<string, 'active' | 'warn' | 'danger' | 'muted' | 'info'> = {
  active: 'active',
  sold: 'info',
  rented: 'info',
  paused: 'warn',
  pending: 'warn',
  reviewing: 'warn',
  removed: 'danger',
  action_taken: 'danger',
  dismissed: 'muted',
  resolved: 'active',
  expired: 'muted',
  cancelled: 'muted',
};

export interface NavItem {
  view: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Key on DashboardStats used to render a count badge on the nav item. */
  badgeKey?: keyof DashboardStats;
  tone?: 'danger' | 'warn';
}

export const ADMIN_NAV: NavItem[] = [
  { view: 'admin', label: 'Overview', icon: LayoutDashboardIcon, description: 'Platform health and moderation queue' },
  { view: 'admin-users', label: 'Users', icon: UsersIcon, description: 'Accounts, roles and suspensions', badgeKey: 'users_suspended', tone: 'warn' },
  { view: 'admin-listings', label: 'Listings', icon: ListingIcon, description: 'Approve, edit and remove listings', badgeKey: 'market_removed', tone: 'danger' },
  { view: 'admin-reports', label: 'Reports', icon: FlagIcon, description: 'Reported listings and users', badgeKey: 'reports_pending', tone: 'warn' },
  { view: 'admin-vendors', label: 'Vendors', icon: StoreIcon, description: 'Sellers and their trade volume' },
  { view: 'admin-reviews', label: 'Reviews', icon: StarIcon, description: 'Ratings and moderation' },
  { view: 'admin-audit', label: 'Audit log', icon: ScrollIcon, description: 'Every privileged action on record' },
];
