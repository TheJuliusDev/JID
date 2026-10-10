/**
 * Formatting helpers shared across screens.
 *
 * Kept free of React so they can be unit-tested and called from mappers.
 */
import { BRAND } from '@/constants/brand';
import type { MarketplaceItem, PropertyListing } from '@/types';

/** 1.2k / 3.4M, for view + save counters. */
export const compactNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) < 1000) return String(value);
  if (Math.abs(value) < 1_000_000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  const m = value / 1_000_000;
  return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
};

export const naira = (value: number): string => BRAND.currency.format(value);
export const nairaCompact = (value: number): string => BRAND.currency.compact(value);

/**
 * Accommodation is quoted per year in the DB, but nobody thinks in "₦150,000
 * per year" while browsing. This is the phrasing the website uses.
 */
export const perYear = (value: number): string => `${BRAND.currency.format(value)}/year`;

/** Approximate monthly equivalent, labelled as such. */
export const perMonth = (value: number): string =>
  `${BRAND.currency.format(Math.round(value / 12))}/mo`;

export const plural = (count: number, singular: string, plural_?: string): string =>
  `${count} ${count === 1 ? singular : (plural_ ?? `${singular}s`)}`;

/** First letter, for avatar fallbacks. */
export const initial = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
};

/**
 * A stable, pleasant colour pair for a name with no avatar.
 *
 * Derived from a hash so the same person is always the same colour across
 * sessions and devices, and drawn from a fixed set of eight warm/cool pairs so
 * it always harmonises with the JID palette.
 */
const AVATAR_COLORS = [
  ['#0F7358', '#38AC88'],
  ['#B57015', '#E5A63C'],
  ['#2563EB', '#60A5FA'],
  ['#7C3AED', '#A78BFA'],
  ['#CC3339', '#F87171'],
  ['#0B5B47', '#6CC7A8'],
  ['#8C5511', '#F2D294'],
  ['#1D4ED8', '#93C5FD'],
] as const;

export const avatarColors = (seed: string): readonly [string, string] => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

/**
 * Trims a Cloudinary URL for a specific pixel size.
 *
 * Listing galleries are the app's heaviest image surface. Serving a 4000px
 * original into a 180pt thumbnail wastes megabytes on a metered connection, so
 * every thumbnail goes through Cloudinary's transformation endpoint instead.
 * Non-Cloudinary URLs are returned untouched.
 */
export const cloudinaryThumb = (
  url: string,
  width: number,
  height?: number,
): string => {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  const crop = height ? `c_fill,w_${width},h_${height}` : `c_limit,w_${width}`;
  return url.replace('/upload/', `/upload/${crop}/`);
};

/** Blur-up placeholder derived from a Cloudinary URL. */
export const cloudinaryTiny = (url: string): string | undefined => {
  if (!url || !url.includes('res.cloudinary.com')) return undefined;
  return url.replace('/upload/', '/upload/c_fill,w_24,h_24,q_20,e_blur/');
};

/** The primary image of any listing, or undefined when it has none. */
export const coverImage = (
  listing: MarketplaceItem | PropertyListing | null | undefined,
): string | undefined => listing?.images?.[0];

/**
 * Builds a deep link to a listing that works from inside the app and opens the
 * website when shared elsewhere.
 */
export const listingLink = (kind: string, id: string): string =>
  `${BRAND.scheme}://listing/${kind}/${id}`;

export const webListingLink = (kind: string, id: string): string =>
  `${BRAND.website}/${kind}/${id}`;

/** Clamp used by the horizontal rails and carousels. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Human label for a stored listing status.
 *
 * These are lowercase Postgres enum values (`active`, `paused`, `sold`,
 * `rented`, `removed`). They are stored as-is, so the capitalisation is purely a
 * display concern and lives here rather than being baked into the data.
 */
export const statusLabel = (status: string): string => {
  switch (status) {
    case 'active':
      return 'Available';
    case 'paused':
      return 'Paused';
    case 'sold':
      return 'Sold';
    case 'rented':
      return 'Rented';
    case 'removed':
      return 'Removed';
    default:
      return status;
  }
};