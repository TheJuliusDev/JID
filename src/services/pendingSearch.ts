/**
 * Cross-view hand-off for "run this saved search".
 *
 * SavedView lives on its own route; the explorers mount fresh when the user
 * navigates to Marketplace / Accommodation. Rather than thread filters through
 * the router (which only models view + username), a saved search is stashed
 * here and claimed once by the matching explorer on mount.
 */
export type SavedFilters = Record<string, string | number | boolean>;

let pending: { type: 'marketplace' | 'property'; filters: SavedFilters } | null = null;

export const setPendingSearch = (type: 'marketplace' | 'property', filters: SavedFilters) => {
  pending = { type, filters };
};

/** Claim and clear the pending search for `type` (returns null if none). */
export const takePendingSearch = (type: 'marketplace' | 'property'): SavedFilters | null => {
  if (pending && pending.type === type) {
    const { filters } = pending;
    pending = null;
    return filters;
  }
  return null;
};

/**
 * Canonical, key-stable representation of a filter set. Used to detect whether
 * the current explorer filters are already saved, regardless of object key
 * order between the client and the jsonb round-trip.
 */
export const canonicalFilters = (filters: SavedFilters): string => {
  const keys = Object.keys(filters)
    .filter((k) => filters[k] !== '' && filters[k] !== undefined && filters[k] !== null && filters[k] !== false)
    .sort();
  return JSON.stringify(keys.map((k) => [k, filters[k]]));
};
