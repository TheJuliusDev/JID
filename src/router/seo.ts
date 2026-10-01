/**
 * Per-route document metadata (SEO + link previews).
 *
 * The app is a client-rendered SPA, so a crawler that only reads the initial
 * HTML sees the homepage's `<title>` and `<meta description>` for *every* URL.
 * That makes `/marketplace` and `/accommodation` look like duplicate content and
 * stops them ranking for their own terms. Google does execute JavaScript, so
 * updating these tags on navigation is enough to give each route a distinct
 * title, description and canonical URL.
 *
 * Any route left without copy here falls back to no description at all, and is
 * marked `noindex` unless listed in `INDEXABLE_VIEWS`.
 */

import type { ViewType } from '../types';

const SITE_NAME = 'JIDapp';
const SITE_URL = 'https://jidapp.ng';
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const OG_IMAGE_ALT = 'JIDapp — the verified student marketplace and accommodation platform for OAU, Ile-Ife';

/** Indexable, public routes. Everything else is deliberately excluded. */
const INDEXABLE_VIEWS = new Set([
  'home',
  'marketplace',
  'accommodation',
  'vendors',
  'about',
  'contact',
]);

/**
 * Route-specific copy. Written to read naturally, not to repeat the target
 * query — Google's site-name and exact-match handling means the branded term
 * only needs to appear once, and stuffing it reads as spam.
 */
const META: Partial<Record<ViewType, string>> = {
  // Must stay in step with the static tag in index.html: this is the page that
  // has to win the "jidapp" query, and it is the one Google indexes from the
  // initial HTML before any JavaScript runs.
  home: 'JIDapp is the verified student marketplace and accommodation platform for Obafemi Awolowo University (OAU), Ile-Ife. Buy and sell on campus, find lodges near OAU, chat directly with sellers. jidapp.ng',
  marketplace:
    'Buy and sell used items, electronics, textbooks and hostel furniture on JIDapp. Student-to-student listings at Obafemi Awolowo University, Ile-Ife, with public seller profiles and reviews.',
  accommodation:
    'Find student accommodation near OAU on JIDapp. Rooms, bed spaces, self-contained flats and shared apartments around Ile-Ife, listed by students and verified landlords, with prices per year.',
  vendors:
    'Sell on JIDapp for free. Create a storefront, list your items or lodges, set a naira price and pick a campus pickup spot. Keep 100% of what you earn as an OAU student in Ile-Ife.',
  about:
    'About JIDapp — the student-built marketplace and accommodation platform for Obafemi Awolowo University (OAU) in Ile-Ife. Our mission, how it works, and who it is for.',
  contact:
    'Contact JIDapp. Report a listing, flag a scam or get help with your account. Reach the team behind the student marketplace for Obafemi Awolowo University, Ile-Ife.',
};

const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
  const selector = `meta[${attr}="${key}"]`;
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

/**
 * Apply title, description, canonical and Open Graph tags for a route.
 * Safe to call on every navigation.
 *
 * @param view       the view being rendered
 * @param path       resolved pathname for this view, e.g. `/marketplace`
 * @param routeTitle the route's display title, from the route table
 */
export const applyRouteMeta = (view: ViewType, path: string, routeTitle?: string): void => {
  if (typeof document === 'undefined') return;

  const routePath = path === '' ? '/' : path;
  const url = `${SITE_URL}${routePath}`;
  const isKnown = view !== 'not-found';
  const indexable = INDEXABLE_VIEWS.has(view);

  const title = isKnown
    ? routeTitle
      ? `${routeTitle} | ${SITE_NAME}`
      : SITE_NAME
    : `Page not found | ${SITE_NAME}`;

  const description = (isKnown && META[view]) || undefined;

  document.title = title;

  if (description) {
    setMeta('name', 'description', description);
  } else {
    document.head.querySelector('meta[name="description"]')?.remove();
  }

  // Non-indexable pages (account, admin, legal) must not compete in search.
  setMeta('name', 'robots', indexable ? 'index, follow' : 'noindex, follow');

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;

  setMeta('property', 'og:url', url);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description ?? '');
  setMeta('property', 'og:image', OG_IMAGE);
  setMeta('property', 'og:image:alt', OG_IMAGE_ALT);

  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description ?? '');
  setMeta('name', 'twitter:image', OG_IMAGE);
};