import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ViewType } from '../types';
import {
  NavigateOptions,
  getRoute,
  matchPath,
  pathForView,
} from './routes';
import { applyRouteMeta } from './seo';

interface RouterValue {
  /** The view the app should render. */
  view: ViewType;
  /** Route params (currently only `username` for public profiles). */
  params: Record<string, string>;
  /** Convenience accessor for `params.username`. */
  username: string | null;
  /** Current normalized pathname. */
  path: string;
  /** Navigate to a view, pushing (or replacing) a history entry. */
  navigate: (view: ViewType, options?: NavigateOptions) => void;
  /** True when `target` is the view currently being rendered. */
  isActive: (target: ViewType) => boolean;
}

const RouterContext = createContext<RouterValue | null>(null);

const readLocation = () => ({
  path: window.location.pathname,
  state: window.history.state as { view?: ViewType; username?: string } | null,
});

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [match, setMatch] = useState(() => matchPath(readLocation().path));

  // Back / forward buttons.
  useEffect(() => {
    const onPopState = () => setMatch(matchPath(readLocation().path));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Keep the document metadata in step with the page. This is what gives each
  // client-rendered route its own title, description and canonical URL.
  // Uses the resolved path rather than the route's pattern, so `/u/johndoe`
  // produces a real canonical URL instead of a literal `/u/:username`.
  useEffect(() => {
    const route = getRoute(match.view);
    applyRouteMeta(match.view, match.path, route);
  }, [match.view, match.path]);

  const navigate = useCallback<RouterValue['navigate']>((view, options = {}) => {
    const nextPath = pathForView(view, options);
    const current = readLocation();

    // Guard against no-op navigations so we don't spam the history stack.
    if (current.path === nextPath) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const state = { view, username: options.username };
    if (options.replace) {
      window.history.replaceState(state, '', nextPath);
    } else {
      window.history.pushState(state, '', nextPath);
    }

    setMatch(matchPath(nextPath));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const value = useMemo<RouterValue>(
    () => ({
      view: match.view,
      params: match.params,
      username: match.params.username ?? null,
      path: match.path,
      navigate,
      isActive: (target: ViewType) => match.view === target,
    }),
    [match, navigate]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export const useRouter = (): RouterValue => {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useRouter must be used within a RouterProvider');
  return context;
};

interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: ViewType;
  username?: string;
  children: React.ReactNode;
  activeClassName?: string;
  inactiveClassName?: string;
  /** Skip the client-side router and do a full document navigation. */
  hard?: boolean;
}

/**
 * Anchor that keeps real `href`s (so links are copyable, middle-clickable and
 * crawlable) while navigating client-side on a normal left click.
 */
export const NavLink: React.FC<NavLinkProps> = ({
  to,
  username,
  children,
  className = '',
  activeClassName = '',
  inactiveClassName = '',
  onClick,
  hard,
  ...rest
}) => {
  const { navigate, view } = useRouter();
  const href = pathForView(to, { username });
  const isActive = view === to;

  return (
    <a
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`${className} ${isActive ? activeClassName : inactiveClassName}`.trim()}
      onClick={(e) => {
        onClick?.(e);
        if (hard || e.defaultPrevented) return;
        // Let the browser handle modified clicks (new tab/window, download…).
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to, { username });
      }}
      {...rest}
    >
      {children}
    </a>
  );
};
