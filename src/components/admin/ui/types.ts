/**
 * Shared admin UI types and small adapters.
 *
 * The list endpoints take `limit`/`offset` inside their filter object (that is
 * what PostgREST expects), while `useAdminResource` supplies pagination
 * separately. `pagedFetcher` bridges the two so each page can do:
 *
 *   const resource = useAdminResource(
 *     pagedFetcher(listUsers),
 *     { filters: { search, role, status, sort }, pageSize: 25 }
 *   );
 */

import type { Paged, PageQuery } from '../../../services/adminApi';

export type { Paged, PageQuery };

export interface ResourceArgs<F> {
  limit: number;
  offset: number;
  filters: F;
}

/**
 * Adapts an admin list function (whose filter type extends `PageQuery`) into the
 * fetcher signature `useAdminResource` expects. The returned fetcher takes only
 * the page's own filters — `limit`/`offset` are supplied by the hook, so callers
 * never pass them and never have to keep them in sync.
 */
export function pagedFetcher<F extends object, T>(
  fn: (filters: F & PageQuery) => Promise<Paged<T>>
) {
  type Filters = Omit<F, keyof PageQuery>;
  return ({ limit, offset, filters }: ResourceArgs<Filters>) =>
    fn({ ...filters, limit, offset } as F & PageQuery);
}

/** Select option list used by every filter dropdown in the console. */
export const selectOption = (value: string, label: string) => ({ value, label });

/** Filter dropdowns need "any/all" defaults; the server expects a plain string. */
export const ANY = 'all';