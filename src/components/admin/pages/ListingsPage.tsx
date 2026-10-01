/**
 * Admin listings screen: marketplace items and accommodations in one place.
 *
 * The two tables have different columns, so they share this file but render
 * separate branches. Every moderation action (status, verification, content
 * edit, delete) goes through a dedicated privileged RPC — there is no generic
 * "save row" endpoint, so the content editor can never be used to smuggle a
 * status or counter change past the moderation rules.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BadgeX,
  Eye,
  EyeOff,
  Home as HomeIcon,
  PackageSearch,
  Pencil,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  deleteListing,
  listMarketplaceListings,
  listPropertyAreas,
  listPropertyListings,
  setListingStatus,
  setListingVerified,
  updateListing,
} from '../../../services/adminApi';
import type {
  AdminMarketplaceRow,
  AdminPropertyArea,
  AdminPropertyRow,
  ListingListFilters,
} from '../../../services/adminApi';
import {
  AdminAvatar,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminModal,
  AdminSectionHeader,
  AdminTable,
  AsyncBoundary,
  ConfirmDialog,
  PaginationBar,
  SearchField,
  SelectField,
  Td,
  Th,
  TextArea,
  TextField,
  Toolbar,
  formatDate,
  formatMoney,
  formatNumber,
  pagedFetcher,
  timeAgo,
  titleCase,
  useAdminAction,
  useAdminResource,
  useDebouncedValue,
} from '../ui';
import type { ConfirmRequest } from '../ui';
import { useAdminChrome } from '../AdminShell';
import { BRAND_CONFIG } from '../../../config/brand';

type Kind = 'marketplace' | 'property';
type Row = AdminMarketplaceRow | AdminPropertyRow;

const TABS: Array<{ value: Kind; label: string; icon: React.ElementType }> = [
  { value: 'marketplace', label: 'Marketplace', icon: PackageSearch },
  { value: 'property', label: 'Accommodation', icon: HomeIcon },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Sold' },
  { value: 'rented', label: 'Rented' },
  { value: 'paused', label: 'Paused' },
  { value: 'removed', label: 'Removed' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'views', label: 'Most viewed' },
];

// The filter values must match the Postgres enums in supabase/schema.sql, so
// they are derived from the same BRAND_CONFIG the public forms use rather than
// being retyped here.
const CATEGORY_OPTIONS = BRAND_CONFIG.categories
  .filter((c) => c.id !== 'all')
  .map((c) => ({ value: c.id as string, label: c.label }));

const ROOM_TYPE_OPTIONS = BRAND_CONFIG.accommodationTypes.map((t) => ({
  value: t as string,
  label: t,
}));

export const ListingsPage: React.FC = () => {
  const { toasts, reportAuthProblem, refreshStats } = useAdminChrome();
  const action = useAdminAction();

  const [kind, setKind] = useState<Kind>('marketplace');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [draft, setDraft] = useState({ status: 'all', sort: 'newest', category: 'all', area: 'all', roomType: 'all' });

  const filters = useMemo<ListingListFilters>(
    () => ({
      search: debouncedSearch,
      status: draft.status,
      sort: draft.sort,
      category: draft.category,
      area: draft.area,
      roomType: draft.roomType,
      userId: null,
      limit: 25,
      offset: 0,
    }),
    [debouncedSearch, draft]
  );

  const marketplace = useAdminResource<AdminMarketplaceRow, ListingListFilters>(
    pagedFetcher(listMarketplaceListings),
    { filters, pageSize: 25, enabled: kind === 'marketplace', onAuthProblem: reportAuthProblem }
  );
  const properties = useAdminResource<AdminPropertyRow, ListingListFilters>(
    pagedFetcher(listPropertyListings),
    { filters, pageSize: 25, enabled: kind === 'property', onAuthProblem: reportAuthProblem }
  );

  const resource = kind === 'marketplace' ? marketplace : properties;
  const rows = (resource.rows as Row[]) ?? [];

  const [editing, setEditing] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  // `area` is free text in the schema, so the options come from the data.
  const [areas, setAreas] = useState<AdminPropertyArea[]>([]);
  useEffect(() => {
    if (kind !== 'property' || areas.length > 0) return;
    let cancelled = false;
    void listPropertyAreas()
      .then((rows) => {
        if (!cancelled) setAreas(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [kind, areas.length]);

  const AREA_OPTIONS = useMemo(
    () => [
      { value: 'all', label: 'All areas' },
      ...areas.map((a) => ({ value: a.area, label: `${a.area} (${a.listing_count})` })),
    ],
    [areas]
  );

  const afterMutation = (id: string, patch: Partial<Row>) => {
    resource.patchRow((r) => r.id === id, patch as never);
    void refreshStats();
  };

  // -------------------------------------------------------------------------
  // Moderation actions
  // -------------------------------------------------------------------------

  const askStatus = (row: Row, status: string) => {
    const removing = status === 'removed';
    const restoring = row.status === 'removed';
    setConfirm({
      tone: removing ? 'danger' : 'primary',
      title: removing ? 'Remove this listing?' : restoring ? 'Restore this listing?' : `Mark as ${status}?`,
      description: removing
        ? 'It disappears from the marketplace and the owner is notified. Reversible — you can restore it later.'
        : restoring
        ? 'It becomes visible on JID again exactly as it was.'
        : `The listing will be shown as ${status}.`,
      confirmLabel: removing ? 'Remove listing' : restoring ? 'Restore listing' : 'Update status',
      requireReason: removing,
      reasonLabel: 'Reason (visible in the audit log)',
      reasonPlaceholder: 'e.g. Stolen goods reported by three students',
      facts: [
        { label: 'Listing', value: row.title },
        { label: 'Seller', value: row.username ? `@${row.username}` : 'Unknown' },
        { label: 'Price', value: formatMoney(priceOf(row), kind === 'property') },
        { label: 'Current status', value: titleCase(row.status) },
      ],
      onConfirm: async (reason) => {
        const result = await action.run(`status:${row.id}`, () =>
          setListingStatus(kind, row.id, status, reason)
        );
        if (!result.ok) throw result.error;
        afterMutation(row.id, { status } as Partial<Row>);
        toasts.success(removing ? 'Listing removed' : 'Listing updated', row.title);
      },
    });
  };

  const askVerify = (row: Row, verified: boolean) => {
    if (kind !== 'property') return;
    setConfirm({
      tone: verified ? 'primary' : 'warn',
      title: verified ? 'Mark as verified?' : 'Remove verification?',
      description: verified
        ? 'A verified badge will be shown to students on this accommodation.'
        : 'The verified badge will disappear.',
      confirmLabel: verified ? 'Verify' : 'Unverify',
      requireReason: !verified,
      reasonLabel: 'Reason (visible in the audit log)',
      onConfirm: async (reason) => {
        const result = await action.run(`verify:${row.id}`, () =>
          setListingVerified(row.id, verified, reason)
        );
        if (!result.ok) throw result.error;
        afterMutation(row.id, { is_verified: verified } as Partial<Row>);
        toasts.success(verified ? 'Listing verified' : 'Verification removed', row.title);
      },
    });
  };

  const askDelete = (row: Row) => {
    setConfirm({
      tone: 'danger',
      title: 'Permanently delete?',
      description:
        'The row is deleted from the database and cannot be recovered, even by an administrator. Use "Remove" if you only want to hide it from students.',
      confirmLabel: 'Delete forever',
      requireReason: true,
      typeToConfirm: 'DELETE',
      reasonLabel: 'Reason (visible in the audit log)',
      facts: [
        { label: 'Listing', value: row.title },
        { label: 'Seller', value: row.username ? `@${row.username}` : 'Unknown' },
        { label: 'Price', value: formatMoney(priceOf(row), kind === 'property') },
      ],
      onConfirm: async (reason) => {
        const result = await action.run(`delete:${row.id}`, () => deleteListing(kind, row.id, reason));
        if (!result.ok) throw result.error;
        resource.removeRow((r) => r.id === row.id);
        void refreshStats();
        toasts.success('Listing deleted', row.title);
      },
    });
  };

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminSectionHeader
          title="Listings"
          description="Approve, verify, edit and remove anything posted on JID."
          icon={PackageSearch}
        />

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/70 w-fit mb-4">
          {TABS.map(({ value, label, icon: Icon }) => {
            const active = kind === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        <Toolbar className="mb-4">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search title, description or seller…"
            className="flex-1 min-w-[14rem]"
            aria-label="Search listings"
          />
          <SelectField
            label="Status"
            aria-label="Filter by status"
            value={draft.status}
            onChange={(status) => setDraft((d) => ({ ...d, status }))}
            options={STATUS_OPTIONS}
          />
          {kind === 'marketplace' ? (
            <SelectField
              label="Category"
              aria-label="Filter by category"
              value={draft.category}
              onChange={(category) => setDraft((d) => ({ ...d, category }))}
              options={[{ value: 'all', label: 'All categories' }, ...CATEGORY_OPTIONS]}
            />
          ) : (
            <>
              <SelectField
                label="Area"
                aria-label="Filter by area"
                value={draft.area}
                onChange={(area) => setDraft((d) => ({ ...d, area }))}
                options={AREA_OPTIONS}
              />
              <SelectField
                label="Rooms"
                aria-label="Filter by room type"
                value={draft.roomType}
                onChange={(roomType) => setDraft((d) => ({ ...d, roomType }))}
                options={[{ value: 'all', label: 'Any room type' }, ...ROOM_TYPE_OPTIONS]}
              />
            </>
          )}
          <SelectField
            label="Sort"
            aria-label="Sort listings"
            value={draft.sort}
            onChange={(sort) => setDraft((d) => ({ ...d, sort }))}
            options={SORT_OPTIONS}
          />
        </Toolbar>

        <AsyncBoundary
          loading={resource.loading}
          error={resource.error}
          isEmpty={resource.isEmpty}
          onRetry={resource.reload}
          emptyTitle="No listings match those filters"
          emptyDescription="Try clearing the filters, or switch to the other listing type."
          emptyIcon={PackageSearch}
        >
          <div className={resource.refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <AdminTable
              head={
                <tr>
                  <Th>Listing</Th>
                  <Th>Seller</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">Views</Th>
                  <Th>Posted</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              }
            >
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <Td>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {row.image ? (
                        <img
                          src={row.image}
                          alt=""
                          loading="lazy"
                          className="w-9 h-9 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0"
                        />
                      ) : (
                        <span className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate max-w-[16rem]">{row.title}</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[16rem]">
                          {kind === 'marketplace'
                            ? `${titleCase((row as AdminMarketplaceRow).category)} · ${titleCase(
                                (row as AdminMarketplaceRow).condition
                              )}`
                            : `${titleCase((row as AdminPropertyRow).room_type)} · ${titleCase(
                                (row as AdminPropertyRow).availability
                              )}`}
                        </p>
                      </div>
                      {isVerified(row) && (
                        <AdminBadge tone="active" title="Verified accommodation">
                          <BadgeCheck className="w-3 h-3" />
                        </AdminBadge>
                      )}
                      {row.boosted_until && new Date(row.boosted_until) > new Date() && (
                        <AdminBadge tone="brand" title="Boosted">
                          <Zap className="w-3 h-3" />
                        </AdminBadge>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <AdminAvatar
                        name={row.full_name || row.username}
                        src={row.avatar_url}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <p className="text-xs truncate max-w-[9rem]">
                          {row.username ? `@${row.username}` : 'Unknown'}
                        </p>
                        {row.is_suspended && (
                          <span className="text-[10px] text-rose-500">seller suspended</span>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td align="right">
                    <span className="text-xs font-bold whitespace-nowrap">
                      {formatMoney(priceOf(row), kind === 'property')}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="text-xs tabular-nums">{formatNumber(row.views_count)}</span>
                  </Td>
                  <Td>
                    <span className="text-xs whitespace-nowrap">{formatDate(row.created_at)}</span>
                  </Td>
                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.status === 'removed' ? (
                        <AdminButton
                          variant="ghost"
                          icon={Eye}
                          aria-label={`Restore ${row.title}`}
                          loading={action.pendingKey === `status:${row.id}`}
                          onClick={() => askStatus(row, 'active')}
                        >
                          <span className="sr-only">Restore</span>
                        </AdminButton>
                      ) : (
                        <AdminButton
                          variant="ghost"
                          icon={EyeOff}
                          aria-label={`Remove ${row.title}`}
                          loading={action.pendingKey === `status:${row.id}`}
                          onClick={() => askStatus(row, 'removed')}
                        >
                          <span className="sr-only">Remove</span>
                        </AdminButton>
                      )}
                      {kind === 'property' &&
                        (isVerified(row) ? (
                          <AdminButton
                            variant="ghost"
                            icon={BadgeX}
                            aria-label={`Unverify ${row.title}`}
                            loading={action.pendingKey === `verify:${row.id}`}
                            onClick={() => askVerify(row, false)}
                          >
                            <span className="sr-only">Unverify</span>
                          </AdminButton>
                        ) : (
                          <AdminButton
                            variant="ghost"
                            icon={BadgeCheck}
                            aria-label={`Verify ${row.title}`}
                            loading={action.pendingKey === `verify:${row.id}`}
                            onClick={() => askVerify(row, true)}
                          >
                            <span className="sr-only">Verify</span>
                          </AdminButton>
                        ))}
                      <AdminButton
                        variant="ghost"
                        icon={Pencil}
                        aria-label={`Edit ${row.title}`}
                        onClick={() => setEditing(row)}
                      >
                        <span className="sr-only">Edit</span>
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        icon={Trash2}
                        aria-label={`Delete ${row.title}`}
                        loading={action.pendingKey === `delete:${row.id}`}
                        onClick={() => askDelete(row)}
                      >
                        <span className="sr-only">Delete</span>
                      </AdminButton>
                    </div>
                  </Td>
                </tr>
              ))}
            </AdminTable>

            <PaginationBar
              total={resource.total}
              limit={resource.pageSize}
              offset={(resource.page - 1) * resource.pageSize}
              onOffsetChange={(offset) => resource.setPage(Math.floor(offset / resource.pageSize) + 1)}
              onLimitChange={resource.setPageSize}
              label="listings"
            />
          </div>
        </AsyncBoundary>
      </AdminCard>

      {editing && (
        <EditListingModal
          kind={kind}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            resource.reload();
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Content editor
// ---------------------------------------------------------------------------

const EditListingModal: React.FC<{
  kind: Kind;
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}> = ({ kind, row, onClose, onSaved }) => {
  const { toasts } = useAdminChrome();
  const action = useAdminAction();
  const [title, setTitle] = useState(row.title);
  const [description, setDescription] = useState(row.description);
  const [price, setPrice] = useState(String(priceOf(row)));

  const save = async () => {
    const patch =
      kind === 'marketplace'
        ? { title: title.trim(), description: description.trim(), price: Number(price) || 0 }
        : { title: title.trim(), description: description.trim(), price_per_year: Number(price) || 0 };

    const result = await action.run('save-listing', () => updateListing(kind, row.id, patch));
    if (!result.ok) {
      toasts.error('Could not save', result.error.message);
      return;
    }
    toasts.success('Listing updated', title.trim());
    onSaved();
  };

  return (
    <AdminModal
      open
      onClose={onClose}
      title="Edit listing content"
      description="Only content can be changed here. Status, verification, counters and boosts are controlled by the dedicated moderation actions."
      width="lg"
      footer={
        <>
          <AdminButton size="md" onClick={onClose} disabled={action.pendingKey === 'save-listing'}>
            Cancel
          </AdminButton>
          <AdminButton size="md" variant="primary" onClick={save} loading={action.pendingKey === 'save-listing'}>
            Save changes
          </AdminButton>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label="Title" value={title} onChange={setTitle} required />
        <TextArea label="Description" value={description} onChange={setDescription} rows={6} />
        <TextField
          label={kind === 'property' ? 'Price per year (₦)' : 'Price (₦)'}
          type="number"
          value={price}
          onChange={setPrice}
          hint={`Currently ${formatMoney(priceOf(row), kind === 'property')}`}
        />
        {row.boosted_until && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Boosted until {formatDate(row.boosted_until)} ({timeAgo(row.boosted_until)}).
          </p>
        )}
      </div>
    </AdminModal>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const priceOf = (row: Row): number =>
  'price_per_year' in row ? Number(row.price_per_year) : Number(row.price);

const isVerified = (row: Row): boolean => 'is_verified' in row && Boolean(row.is_verified);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <AdminBadge
    tone={
      status === 'active'
        ? 'active'
        : status === 'removed'
        ? 'danger'
        : status === 'sold' || status === 'rented'
        ? 'info'
        : status === 'paused'
        ? 'warn'
        : 'muted'
    }
  >
    {titleCase(status)}
  </AdminBadge>
);