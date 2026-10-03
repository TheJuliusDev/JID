/**
 * Route table for the JID website.
 *
 * JID is a client-rendered Vite app, so routing is handled with the History API
 * (see `RouterProvider`). This file is the single source of truth that maps a
 * URL path to a `ViewType` and back, so navigation, `<NavLink>`, the navbar and
 * the footer can never drift out of sync.
 */

import type { ViewType } from '../types';

export interface RouteDef {
  /** The view the app renders for this path. */
  view: ViewType;
  /** Canonical path. The marketplace is the site's default home, so it owns `/`. */
  path: string;
  /**
   * Extra paths that resolve to the same view. The marketplace answers to
   * `/marketplace` as well, so old links and bookmarks keep working.
   */
  aliases?: string[];
  /**
   * Path to declare as canonical for this view, when it is reachable under more
   * than one URL. Defaults to `path`. See `applyRouteMeta`.
   */
  canonical?: string;
  /** Document title suffix — the router sets `document.title` on navigation. */
  title: string;
  /** Show in the primary desktop / mobile navigation. */
  inMainNav?: boolean;
  /** Requires a signed-in user; the app bounces home and opens auth. */
  requiresAuth?: boolean;
}

export const ROUTES: RouteDef[] = [
  // The marketplace is the default home: `/` and `/marketplace` are the same
  // view, with `/` canonical.
  { view: 'marketplace', path: '/', aliases: ['/marketplace'], title: 'OAU Student Marketplace', inMainNav: true },
  // The marketing landing page lives on its own URL now.
  { view: 'home', path: '/home', title: 'Buy & Sell on Campus', inMainNav: true },
  { view: 'accommodation', path: '/accommodation', title: 'Accommodation', inMainNav: true },
  { view: 'vendors', path: '/vendors', title: 'Sell on JID', inMainNav: true },
  { view: 'about', path: '/about', title: 'About JID', inMainNav: true },
  { view: 'contact', path: '/contact', title: 'Contact', inMainNav: true },
  { view: 'login', path: '/login', title: 'Log in' },
  { view: 'signup', path: '/signup', title: 'Sign up' },

  // Legal — deliberately kept out of `inMainNav`; linked from the footer and
  // from the cookie banner so they are always reachable.
  { view: 'terms', path: '/terms', title: 'Terms & Conditions' },
  { view: 'privacy', path: '/privacy', title: 'Privacy Policy' },
  { view: 'cookies', path: '/cookies', title: 'Cookie Policy' },

  { view: 'dashboard', path: '/dashboard', title: 'Dashboard', requiresAuth: true },
  { view: 'my-listings', path: '/my-listings', title: 'My Listings', requiresAuth: true },
  { view: 'saved', path: '/saved', title: 'Saved', requiresAuth: true },
  { view: 'messages', path: '/messages', title: 'Messages', requiresAuth: true },
  { view: 'profile', path: '/profile', title: 'My Profile', requiresAuth: true },
  { view: 'public-profile', path: '/u/:username', title: 'Profile' },
];

// Admin console.
//
// These are deliberately absent from `ROUTES` navigation flags: the console is
// never advertised in the navbar or footer, because only the database knows who
// may reach it. It is still reachable by URL — the route exists so the screens
// have real, back-button-friendly addresses, while `AdminGate` re-verifies the
// caller's role against `admin_session` on every entry.
//
// `requiresAuth` is intentionally unset: an admin who is signed out must be
// offered the admin sign-in form, not bounced to the public homepage.
export const ADMIN_ROUTES: RouteDef[] = [
  { view: 'admin', path: '/admin', title: 'Admin Overview' },
  { view: 'admin-users', path: '/admin/users', title: 'Admin · Users' },
  { view: 'admin-listings', path: '/admin/listings', title: 'Admin · Listings' },
  { view: 'admin-reports', path: '/admin/reports', title: 'Admin · Reports' },
  { view: 'admin-vendors', path: '/admin/vendors', title: 'Admin · Vendors' },
  { view: 'admin-reviews', path: '/admin/reviews', title: 'Admin · Reviews' },
  { view: 'admin-audit', path: '/admin/audit', title: 'Admin · Audit log' },
];

export const ALL_ROUTES: RouteDef[] = [...ROUTES, ...ADMIN_ROUTES];

export const isAdminView = (view: ViewType): boolean =>
  ADMIN_ROUTES.some((route) => route.view === view);

/** Primary navigation order shown in the navbar and footer. */
export const MAIN_NAV_VIEWS: ViewType[] = ROUTES.filter((r) => r.inMainNav).map((r) => r.view);

const BY_VIEW = new Map<ViewType, RouteDef>(ALL_ROUTES.map((r) => [r.view, r]));

export const getRoute = (view: ViewType): RouteDef | undefined => BY_VIEW.get(view);

/** Routes the app redirects to when a signed-out user lands on them. */
export const PROTECTED_VIEWS: ViewType[] = ROUTES.filter((r) => r.requiresAuth).map((r) => r.view);

export const isProtectedView = (view: ViewType): boolean => PROTECTED_VIEWS.includes(view);

const normalize = (pathname: string): string => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

export interface RouteMatch {
  view: ViewType;
  params: Record<string, string>;
  path: string;
}

/**
 * Resolve a URL pathname to a route. Unknown paths resolve to `not-found` so the
 * app can render a branded 404 instead of a blank screen.
 */
export const matchPath = (pathname: string): RouteMatch => {
  const path = normalize(pathname);

  for (const route of ALL_ROUTES) {
    if (route.path === path || route.aliases?.includes(path)) {
      return { view: route.view, params: {}, path };
    }
  }

  // Parameterised route: /u/:username
  for (const route of ALL_ROUTES) {
    if (!route.path.includes(':')) continue;
    const routeParts = route.path.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    if (routeParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < routeParts.length; i++) {
      const part = routeParts[i];
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (part !== pathParts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { view: route.view, params, path };
  }

  return { view: 'not-found', params: {}, path };
};

export interface NavigateOptions {
  /** Username for `/u/:username` (public profile) routes. */
  username?: string;
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

/** Build the URL for a view without touching the History API. */
export const pathForView = (view: ViewType, options: NavigateOptions = {}): string => {
  const route = getRoute(view);
  if (!route) return '/';
  if (view === 'public-profile') {
    return options.username ? `/u/${encodeURIComponent(options.username)}` : '/';
  }
  return route.path;
};
