/**
 * Admin vendors screen.
 *
 * JID has no `vendors` table — a vendor is simply a student who has posted
 * something, and the volume figures here are aggregated from their listings by
 * `admin_list_vendors`. This page is therefore read-only: it exists to spot
 * high-volume sellers and repeat offenders, and links out to the users screen
 * where the actual moderation actions live. Nothing here can suspend or delete.
 */

import React, { useMemo, useState } from 'react';
import { Ban, Flag, Home as HomeIcon, ShoppingBag, Star, Store, TrendingUp } from 'lucide-react';
import { listVendors } from '../../../services/adminApi';
import type { AdminVendorRow, VendorListFilters } from '../../../services/adminApi';
import {
  AdminAvatar,
  AdminBadge,
  AdminCard,
  AdminSectionHeader,
  AdminTable,
  AsyncBoundary,
  PaginationBar,
  SearchField,
  SelectField,
  Td,
  Th,
  Toolbar,
  formatDate,
  formatMoney,
  formatNumber,
  pagedFetcher,
  useAdminResource,
  useDebouncedValue,
} from '../ui';
import { useAdminChrome } from '../AdminShell';

interface Filters {
  search: string;
  filter: string;
  sort: string;
}

const EMPTY: Filters = { search: '', filter: 'all', sort: 'volume' };

export const VendorsPage: React.FC = () => {
  const { reportAuthProblem } = useAdminChrome();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [draft, setDraft] = useState<Omit<Filters, 'search'>>({ filter: 'all', sort: 'volume' });

  const filters = useMemo<Filters>(() => ({ ...draft, search: debouncedSearch }), [draft, debouncedSearch]);

  const vendors = useAdminResource<AdminVendorRow, Filters>(pagedFetcher(listVendors), {
    filters,
    pageSize: 25,
    onAuthProblem: reportAuthProblem,
  });

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminSectionHeader
          title="Vendors"
          description="Everyone who has posted on JID, ranked by trade volume. Aggregated read-only — moderation happens on the Users screen."
          icon={Store}
        />

        <Toolbar className="mb-4">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search name or username…"
            className="flex-1 min-w-[14rem]"
            aria-label="Search vendors"
          />
          <SelectField
            label="Show"
            aria-label="Filter vendors"
            value={draft.filter}
            onChange={(filter) => setDraft((d) => ({ ...d, filter }))}
            options={[
              { value: 'all', label: 'All sellers' },
              { value: 'active', label: 'Active sellers' },
              { value: 'inactive', label: 'No live listings' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'reported', label: 'With open reports' },
              { value: 'flagged', label: 'Has removed listings' },
            ]}
          />
          <SelectField
            label="Sort"
            aria-label="Sort vendors"
            value={draft.sort}
            onChange={(sort) => setDraft((d) => ({ ...d, sort }))}
            options={[
              { value: 'listings', label: 'Most listings' },
              { value: 'value', label: 'Trade volume' },
              { value: 'rating', label: 'Best rated' },
              { value: 'newest', label: 'Newest sellers' },
              { value: 'name', label: 'Name A-Z' },
            ]}
          />
        </Toolbar>

        <AsyncBoundary
          loading={vendors.loading}
          error={vendors.error}
          isEmpty={vendors.isEmpty}
          onRetry={vendors.reload}
          emptyTitle="No sellers found"
          emptyDescription="Vendors appear here as soon as a student posts their first listing."
          emptyIcon={Store}
        >
          <div className={vendors.refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <AdminTable
              head={
                <tr>
                  <Th>Vendor</Th>
                  <Th align="right">Listings</Th>
                  <Th align="right">Removed</Th>
                  <Th align="right">Trade value</Th>
                  <Th align="right">Rating</Th>
                  <Th>Flags</Th>
                  <Th>Joined</Th>
                </tr>
              }
            >
              {vendors.rows.map((row) => {
                const listings = row.marketplace_count + row.property_count;
                const removed = row.marketplace_removed + row.property_removed;
                const active = row.marketplace_active + row.property_active;
                return (
                  <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <Td>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AdminAvatar name={row.full_name || row.username} src={row.avatar_url} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate max-w-[14rem]">
                            {row.full_name || row.username}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                            @{row.username}
                            {row.department ? ` · ${row.department}` : ''}
                          </p>
                        </div>
                        {row.role === 'admin' && <AdminBadge tone="active">Admin</AdminBadge>}
                        {row.is_suspended && <AdminBadge tone="danger">Suspended</AdminBadge>}
                      </div>
                    </Td>
                    <Td align="right">
                      <span className="text-xs font-bold tabular-nums">{formatNumber(active)}</span>
                      <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">
                        of {formatNumber(listings)} total
                      </span>
                    </Td>
                    <Td align="right">
                      {removed > 0 ? (
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          {formatNumber(removed)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">0</span>
                      )}
                      {row.marketplace_count > 0 && (
                        <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">
                          <ShoppingBag className="w-2.5 h-2.5 inline" /> {row.marketplace_removed}
                          <HomeIcon className="w-2.5 h-2.5 inline ml-1" /> {row.property_removed}
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="text-xs font-bold whitespace-nowrap">
                        {formatMoney(row.marketplace_value + row.property_value)}
                      </span>
                    </Td>
                    <Td align="right">
                      {row.avg_rating > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {row.avg_rating.toFixed(1)}
                          <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500">
                            ({row.review_count})
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                      )}
                    </Td>
                    <Td>
                      {row.open_reports > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                          <Flag className="w-3 h-3" />
                          {row.open_reports}
                        </span>
                      ) : row.is_suspended ? (
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                          <Ban className="w-3 h-3" />
                          blocked
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">clean</span>
                      )}
                    </Td>
                    <Td>
                      <span className="text-xs whitespace-nowrap">{formatDate(row.created_at)}</span>
                    </Td>
                  </tr>
                );
              })}
            </AdminTable>

            <PaginationBar
              total={vendors.total}
              limit={vendors.pageSize}
              offset={(vendors.page - 1) * vendors.pageSize}
              onOffsetChange={(offset) => vendors.setPage(Math.floor(offset / vendors.pageSize) + 1)}
              onLimitChange={vendors.setPageSize}
              label="vendors"
            />
          </div>
        </AsyncBoundary>
      </AdminCard>

      <p className="flex items-start gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-px" />
        Trade value sums the asking price of every listing a vendor has posted, active or not. It is a
        rough measure of activity, not revenue.
      </p>
    </div>
  );
};