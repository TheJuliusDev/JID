/**
 * Data-loading hooks for the admin console.
 *
 * `useAdminResource` is the single place that owns the fetch/paginate/retry
 * lifecycle, so no page has to re-implement (or get subtly wrong) the
 * loading / refreshing / error / empty / success state machine. It also keeps
 * the previous page of rows visible while the next one loads, so paginating
 * does not flash the whole table.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminApiError } from '../../../services/adminApi';
import type { Paged } from './types';

/**
 * Monotonic request token shared by every resource instance. Each fetch claims a
 * token and only the newest one is allowed to commit state, so a slow first
 * response can never overwrite a fast second one.
 */
let requestCounter = 0;

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

export interface ResourceOptions<F> {
  /** Filter values; a change in any of them triggers a refetch from page 1. */
  filters: F;
  pageSize?: number;
  /** Skip fetching (e.g. while the operator is not permitted). */
  enabled?: boolean;
  /**
   * Called when the server rejects the request for auth reasons, so the shell
   * can drop the operator back to the admin login screen.
   */
  onAuthProblem?: (error: AdminApiError) => void;
}

export interface ResourceResult<T> {
  rows: T[];
  total: number;
  /** True only for the very first load (no rows are being displayed yet). */
  loading: boolean;
  /** True while a later page or filter change is in flight. */
  refreshing: boolean;
  error: string | null;
  /** True when the last successful load returned nothing. */
  isEmpty: boolean;
  page: number;
  pageSize: number;
  pageCount: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  reload: () => void;
  /** Optimistically patch a row in place after a successful mutation. */
  patchRow: (predicate: (row: T) => boolean, patch: Partial<T>) => void;
  removeRow: (predicate: (row: T) => boolean) => void;
}

export function useAdminResource<T, F extends object>(
  fetcher: (args: { limit: number; offset: number; filters: F }) => Promise<Paged<T>>,
  options: ResourceOptions<F>
): ResourceResult<T> {
  const { filters, pageSize: initialPageSize = 25, enabled = true, onAuthProblem } = options;

  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [nonce, setNonce] = useState(0);

  // Keep the latest fetcher without making it an effect dependency — callers
  // pass an inline closure, and a changing identity must not cause refetches.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const authHandlerRef = useRef(onAuthProblem);
  authHandlerRef.current = onAuthProblem;

  // Only the first load is a blocking spinner; later ones keep the old rows.
  const [settled, setSettled] = useState(false);

  const filtersKey = JSON.stringify(filters ?? {});
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Any filter change returns to the first page, otherwise the operator can
  // land on page 9 of a result set that only has one page.
  const firstFiltersKey = useRef(filtersKey);
  useEffect(() => {
    if (firstFiltersKey.current === filtersKey) return;
    firstFiltersKey.current = filtersKey;
    setPageState(1);
  }, [filtersKey]);

  useEffect(() => {
    if (!enabled) {
      setSettled(true);
      return;
    }
    let cancelled = false;
    // Monotonic token so a slow response can never overwrite a newer one.
    const token = ++requestCounter;

    (async () => {
      if (settled) {
        setRefreshing(true);
        // Clear a previous failure so the stale rows stay usable while loading.
        setError(null);
      }
      try {
        const result = await fetcherRef.current({
          limit: pageSize,
          offset: (page - 1) * pageSize,
          filters: filtersRef.current,
        });
        if (cancelled || token !== requestCounter) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
        setHasLoaded(true);
        setSettled(true);
      } catch (err) {
        if (cancelled || token !== requestCounter) return;
        const apiError =
          err instanceof AdminApiError ? err : new AdminApiError('unknown', 'Something went wrong.');
        if (apiError.isAuthProblem) {
          authHandlerRef.current?.(apiError);
        } else {
          setError(apiError.message);
        }
        setSettled(true);
      } finally {
        if (!cancelled && token === requestCounter) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `settled` is intentionally excluded: including it would restart the
    // fetch every time the loading flag flipped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, page, pageSize, nonce, enabled]);

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, Math.floor(next)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const setPageSize = useCallback((next: number) => {
    setPageSizeState(next);
    setPageState(1);
  }, []);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const patchRow = useCallback((predicate: (row: T) => boolean, patch: Partial<T>) => {
    setRows((prev) => prev.map((row) => (predicate(row) ? { ...row, ...patch } : row)));
  }, []);

  const removeRow = useCallback((predicate: (row: T) => boolean) => {
    setRows((prev) => prev.filter((row) => !predicate(row)));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  return {
    rows,
    total,
    loading: !settled,
    refreshing,
    error,
    isEmpty: hasLoaded && rows.length === 0 && !error,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    setPage,
    setPageSize,
    reload,
    patchRow,
    removeRow,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface ActionRunner {
  /** Run a mutation, tracking its pending key. Never throws. */
  run: <T>(key: string, fn: () => Promise<T>) => Promise<{ ok: true; data: T } | { ok: false; error: AdminApiError }>;
  isPending: (key: string) => boolean;
  pendingKey: string | null;
}

export function useAdminAction(): ActionRunner {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>) => {
    inFlight.current.add(key);
    setPendingKey(key);
    try {
      const data = await fn();
      return { ok: true as const, data };
    } catch (err) {
      const apiError =
        err instanceof AdminApiError ? err : new AdminApiError('unknown', 'Something went wrong.');
      return { ok: false as const, error: apiError };
    } finally {
      inFlight.current.delete(key);
      setPendingKey((current) => (current === key ? null : current));
    }
  }, []);

  const isPending = useCallback((key: string) => inFlight.current.has(key), []);

  return { run, isPending, pendingKey };
}

// ---------------------------------------------------------------------------
// Non-paginated loads (activity feed, actor list, user detail)
// ---------------------------------------------------------------------------

export interface AsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Load-once-per-deps helper for the endpoints that are not paginated. Like
 * `useAdminResource` it keeps the previous value visible while refreshing and
 * ignores out-of-order responses, but there is no page state.
 */
export function useAdminAsync<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList,
  options: { enabled?: boolean; onAuthProblem?: (error: AdminApiError) => void } = {}
): AsyncResult<T> {
  const { enabled = true, onAuthProblem } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const authHandlerRef = useRef(onAuthProblem);
  authHandlerRef.current = onAuthProblem;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const token = ++asyncCounter;

    setLoading(true);
    (async () => {
      try {
        const result = await loaderRef.current();
        if (cancelled || token !== asyncCounter) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (cancelled || token !== asyncCounter) return;
        const apiError =
          err instanceof AdminApiError ? err : new AdminApiError('unknown', 'Something went wrong.');
        if (apiError.isAuthProblem) {
          authHandlerRef.current?.(apiError);
        } else {
          setError(apiError.message);
        }
      } finally {
        if (!cancelled && token === asyncCounter) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  return {
    data,
    loading,
    error,
    reload: useCallback(() => setNonce((n) => n + 1), []),
    setData,
  };
}

let asyncCounter = 0;
