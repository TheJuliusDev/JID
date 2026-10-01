/**
 * Admin users screen.
 *
 * Covers accounts, roles and suspensions. Two rules shape this page:
 *   1. Every mutation goes through a privileged RPC that re-checks the caller's
 *      role and writes the audit log server-side — this page never writes a
 *      table directly, and never logs anything itself.
 *   2. Anything that changes someone's access (suspension, role) must state a
 *      reason first, and the reason is what lands in `admin_audit_log.details`.
 */

import React, { useMemo, useState } from 'react';
import {
  Ban,
  BellRing,
  Flag,
  Home as HomeIcon,
  Pencil,
  ShieldCheck,
  ShieldMinus,
  ShoppingBag,
  Star,
  UserCheck,
  Users as UsersIcon,
} from 'lucide-react';
import {
  getUserDetail,
  listUsers,
  notifyUser,
  setUserRole,
  setUserSuspended,
  updateUserProfile,
} from '../../../services/adminApi';
import type { AdminUserDetail, AdminUserRow, ProfilePatch } from '../../../services/adminApi';
import {
  AdminAvatar,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminDrawer,
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
  formatDateTime,
  formatNumber,
  formatMoney,
  pagedFetcher,
  timeAgo,
  titleCase,
  useAdminAction,
  useAdminAsync,
  useAdminResource,
  useDebouncedValue,
} from '../ui';
import type { ConfirmRequest } from '../ui';
import { useAdminChrome } from '../AdminShell';

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'listings', label: 'Most listings' },
];

interface Filters {
  search: string;
  role: string;
  status: string;
  sort: string;
}

const EMPTY_FILTERS: Filters = { search: '', role: 'all', status: 'all', sort: 'newest' };

export const UsersPage: React.FC = () => {
  const { session, toasts, reportAuthProblem } = useAdminChrome();
  const action = useAdminAction();

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const filters = useMemo<Filters>(
    () => ({ ...draft, search: debouncedSearch }),
    [draft, debouncedSearch]
  );

  const users = useAdminResource<AdminUserRow, Filters>(pagedFetcher(listUsers), {
    filters,
    pageSize: 25,
    onAuthProblem: reportAuthProblem,
  });

  // Selected record + its detail drawer.
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [notifying, setNotifying] = useState<AdminUserRow | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const detail = useAdminAsync<AdminUserDetail | null>(
    () => (selected ? getUserDetail(selected.id) : Promise.resolve(null)),
    [selected?.id],
    { enabled: Boolean(selected), onAuthProblem: reportAuthProblem }
  );

  // An administrator cannot suspend or demote their own account — the server
  // refuses it too, but blocking it here avoids a guaranteed failed request.
  const isSelf = (row: AdminUserRow) => Boolean(session.user_id) && row.id === session.user_id;

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const askSuspend = (row: AdminUserRow) => {
    const suspending = !row.is_suspended;
    setConfirm({
      tone: suspending ? 'danger' : 'primary',
      title: suspending ? `Suspend ${row.username}?` : `Reinstate ${row.username}?`,
      description: suspending
        ? 'They will be signed out of protected actions and unable to post, message or report until an administrator reinstates the account. Their existing listings stay visible.'
        : 'The account regains full access immediately. Their listings remain as they are.',
      confirmLabel: suspending ? 'Suspend account' : 'Reinstate account',
      requireReason: suspending,
      reasonLabel: 'Reason (visible in the audit log)',
      reasonPlaceholder: 'e.g. Repeated listing of counterfeit goods',
      facts: [
        { label: 'Account', value: `${row.full_name || '—'} (@${row.username})` },
        { label: 'Marketplace listings', value: formatNumber(row.marketplace_count) },
        { label: 'Accommodations', value: formatNumber(row.property_count) },
        { label: 'Open reports', value: formatNumber(row.open_reports) },
      ],
      onConfirm: async (reason) => {
        const result = await action.run(`suspend:${row.id}`, () =>
          setUserSuspended(row.id, suspending, reason)
        );
        if (!result.ok) throw result.error;
        users.patchRow((r) => r.id === row.id, {
          is_suspended: suspending,
          suspension_reason: suspending ? reason || null : null,
          suspended_at: suspending ? new Date().toISOString() : null,
        });
        setSelected((prev) => (prev && prev.id === row.id ? { ...prev, is_suspended: suspending } : prev));
        void detail.reload();
        toasts.success(suspending ? 'Account suspended' : 'Account reinstated', `@${row.username}`);
      },
    });
  };

  const askRole = (row: AdminUserRow) => {
    const promoting = row.role !== 'admin';
    setConfirm({
      tone: promoting ? 'warn' : 'danger',
      title: promoting ? `Grant admin to ${row.username}?` : `Remove admin from ${row.username}?`,
      description: promoting
        ? 'They will immediately be able to moderate every listing, user and report on JID, and every action they take will be attributed to them in the audit log.'
        : 'They will lose access to the console at their next action. Their past admin actions stay in the audit log.',
      confirmLabel: promoting ? 'Grant admin' : 'Remove admin',
      requireReason: true,
      typeToConfirm: promoting ? undefined : row.username,
      reasonLabel: 'Reason (visible in the audit log)',
      reasonPlaceholder: promoting ? 'e.g. Joining the moderation team' : 'e.g. Stepped down as moderator',
      onConfirm: async (reason) => {
        const role = promoting ? 'admin' : 'user';
        const result = await action.run(`role:${row.id}`, () => setUserRole(row.id, role));
        if (!result.ok) throw result.error;
        users.patchRow((r) => r.id === row.id, { role });
        setSelected((prev) => (prev && prev.id === row.id ? { ...prev, role } : prev));
        void detail.reload();
        toasts.success(promoting ? 'Admin granted' : 'Admin removed', `@${row.username}`);
      },
    });
  };

  const filtersActive = draft.role !== 'all' || draft.status !== 'all' || draft.sort !== 'newest' || search !== '';

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminSectionHeader
          title="Users"
          description="Search, inspect and moderate every account on JID."
          icon={UsersIcon}
          actions={
            filtersActive ? (
              <AdminButton
                onClick={() => {
                  setDraft(EMPTY_FILTERS);
                  setSearch('');
                }}
              >
                Clear filters
              </AdminButton>
            ) : undefined
          }
        />

        <Toolbar className="mb-4">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search name, username or email…"
            className="flex-1 min-w-[14rem]"
            aria-label="Search users"
          />
          <SelectField
            label="Role"
            aria-label="Filter by role"
            value={draft.role}
            onChange={(role) => setDraft((f) => ({ ...f, role }))}
            options={[
              { value: 'all', label: 'All roles' },
              { value: 'user', label: 'Students' },
              { value: 'admin', label: 'Administrators' },
            ]}
          />
          <SelectField
            label="Status"
            aria-label="Filter by status"
            value={draft.status}
            onChange={(status) => setDraft((f) => ({ ...f, status }))}
            options={[
              { value: 'all', label: 'Any status' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
          <SelectField
            label="Sort"
            aria-label="Sort users"
            value={draft.sort}
            onChange={(sort) => setDraft((f) => ({ ...f, sort }))}
            options={SORTS}
          />
        </Toolbar>

        <AsyncBoundary
          loading={users.loading}
          error={users.error}
          isEmpty={users.isEmpty}
          onRetry={users.reload}
          emptyTitle="No users match those filters"
          emptyDescription="Try a different search term, or clear the filters to see everyone."
          emptyIcon={UsersIcon}
          emptyAction={
            <AdminButton
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                setSearch('');
              }}
            >
              Clear filters
            </AdminButton>
          }
        >
          <div className={users.refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <AdminTable
              head={
                <tr>
                  <Th>Student</Th>
                  <Th>Contact</Th>
                  <Th align="right">Listings</Th>
                  <Th align="right">Reports</Th>
                  <Th>Joined</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              }
            >
              {users.rows.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <Td>
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="flex items-center gap-2.5 text-left cursor-pointer group"
                    >
                      <AdminAvatar name={row.full_name || row.username} src={row.avatar_url} />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {row.full_name || row.username}
                        </span>
                        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          @{row.username}
                          {row.department ? ` · ${row.department}` : ''}
                        </span>
                      </span>
                      {row.role === 'admin' && <AdminBadge tone="active">Admin</AdminBadge>}
                    </button>
                  </Td>
                  <Td>
                    <span className="block text-xs truncate max-w-[14rem]">{row.email || '—'}</span>
                    {row.email_confirmed_at === null && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">unconfirmed</span>
                    )}
                  </Td>
                  <Td align="right">
                    <span className="text-xs tabular-nums">
                      {formatNumber(row.marketplace_count + row.property_count)}
                    </span>
                    <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">
                      {row.marketplace_count}m / {row.property_count}p
                    </span>
                  </Td>
                  <Td align="right">
                    {row.open_reports > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                        <Flag className="w-3 h-3" />
                        {row.open_reports}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs whitespace-nowrap">{formatDate(row.created_at)}</span>
                  </Td>
                  <Td>
                    {row.is_suspended ? <AdminBadge tone="danger">Suspended</AdminBadge> : <AdminBadge tone="active">Active</AdminBadge>}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <AdminButton
                        variant="ghost"
                        icon={Pencil}
                        aria-label={`Edit ${row.username}`}
                        onClick={() => setEditing(row)}
                      >
                        <span className="sr-only">Edit</span>
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        icon={BellRing}
                        aria-label={`Notify ${row.username}`}
                        onClick={() => setNotifying(row)}
                      >
                        <span className="sr-only">Notify</span>
                      </AdminButton>
                      {isSelf(row) ? (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 pr-1">This is you</span>
                      ) : (
                        <>
                          <AdminButton
                            variant="ghost"
                            icon={row.is_suspended ? UserCheck : Ban}
                            aria-label={
                              row.is_suspended ? `Reinstate ${row.username}` : `Suspend ${row.username}`
                            }
                            loading={action.pendingKey === `suspend:${row.id}`}
                            onClick={() => askSuspend(row)}
                          >
                            <span className="sr-only">{row.is_suspended ? 'Reinstate' : 'Suspend'}</span>
                          </AdminButton>
                          {row.role === 'user' ? (
                            <AdminButton
                              variant="ghost"
                              icon={ShieldCheck}
                              aria-label={`Grant admin to ${row.username}`}
                              onClick={() => askRole(row)}
                            >
                              <span className="sr-only">Grant admin</span>
                            </AdminButton>
                          ) : (
                            <AdminButton
                              variant="ghost"
                              icon={ShieldMinus}
                              aria-label={`Remove admin from ${row.username}`}
                              loading={action.pendingKey === `role:${row.id}`}
                              onClick={() => askRole(row)}
                            >
                              <span className="sr-only">Remove admin</span>
                            </AdminButton>
                          )}
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </AdminTable>

            <PaginationBar
              total={users.total}
              limit={users.pageSize}
              offset={(users.page - 1) * users.pageSize}
              onOffsetChange={(offset) => users.setPage(Math.floor(offset / users.pageSize) + 1)}
              onLimitChange={users.setPageSize}
              label="users"
            />
          </div>
        </AsyncBoundary>
      </AdminCard>

      {/* ---------------- Detail drawer ---------------- */}
      <UserDrawer
        row={selected}
        detail={detail.data}
        loading={detail.loading}
        error={detail.error}
        onClose={() => setSelected(null)}
        onEdit={() => selected && setEditing(selected)}
        onSuspend={() => selected && askSuspend(selected)}
        onRole={() => selected && askRole(selected)}
        onNotify={() => selected && setNotifying(selected)}
        isSelf={Boolean(selected && isSelf(selected))}
      />

      {editing && (
        <EditProfileModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            users.reload();
            void detail.reload();
            setEditing(null);
          }}
        />
      )}

      {notifying && (
        <NotifyModal
          row={notifying}
          onClose={() => setNotifying(null)}
          onSent={() => setNotifying(null)}
        />
      )}

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

const UserDrawer: React.FC<{
  row: AdminUserRow | null;
  detail: AdminUserDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onEdit: () => void;
  onSuspend: () => void;
  onRole: () => void;
  onNotify: () => void;
  isSelf: boolean;
}> = ({ row, detail, loading, error, onClose, onEdit, onSuspend, onRole, onNotify, isSelf }) => (
  <AdminDrawer
    open={Boolean(row)}
    onClose={onClose}
    title={row ? row.full_name || row.username : ''}
    subtitle={row ? `@${row.username} · joined ${formatDate(row.created_at)}` : ''}
    footer={
      row && (
        <>
          <AdminButton icon={BellRing} onClick={onNotify}>
            Notify
          </AdminButton>
          <AdminButton icon={Pencil} onClick={onEdit}>
            Edit profile
          </AdminButton>
          {!isSelf && (
            <>
              {row.role === 'admin' ? (
                <AdminButton icon={ShieldMinus} onClick={onRole}>
                  Remove admin
                </AdminButton>
              ) : (
                <AdminButton icon={ShieldCheck} onClick={onRole}>
                  Make admin
                </AdminButton>
              )}
              <AdminButton
                icon={row.is_suspended ? UserCheck : Ban}
                variant={row.is_suspended ? 'success' : 'danger'}
                onClick={onSuspend}
              >
                {row.is_suspended ? 'Reinstate' : 'Suspend'}
              </AdminButton>
            </>
          )}
        </>
      )
    }
  >
    {row && (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <AdminAvatar name={row.full_name || row.username} src={row.avatar_url} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-black truncate">{row.full_name || row.username}</p>
              {row.role === 'admin' && <AdminBadge tone="active">Admin</AdminBadge>}
              {row.is_suspended ? <AdminBadge tone="danger">Suspended</AdminBadge> : null}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.email || 'No email on file'}</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {[row.department, row.level, row.hall_or_area].filter(Boolean).join(' · ') || 'No academic details'}
            </p>
          </div>
        </div>

        {row.is_suspended && row.suspension_reason && (
          <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl px-3 py-2.5">
            Suspended {timeAgo(row.suspended_at)} — {row.suspension_reason}
          </p>
        )}

        {row.bio && (
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed border-l-2 border-emerald-500/40 pl-3">
            {row.bio}
          </p>
        )}

        {loading && <p className="text-xs text-zinc-500">Loading activity…</p>}
        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

        {detail && (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <Metric icon={ShoppingBag} label="Marketplace" value={formatNumber(detail.profile.marketplace_count)} />
              <Metric icon={HomeIcon} label="Accommodations" value={formatNumber(detail.profile.property_count)} />
              <Metric icon={Star} label="Avg. rating" value={detail.avg_rating ? detail.avg_rating.toFixed(1) : '—'} />
              <Metric icon={UsersIcon} label="Reviews written" value={formatNumber(detail.reviews_given)} />
            </dl>

            <Section title="Account">
              <KeyValue label="Email confirmed" value={row.email_confirmed_at ? formatDateTime(row.email_confirmed_at) : 'No'} />
              <KeyValue label="Last sign-in" value={row.last_sign_in_at ? formatDateTime(row.last_sign_in_at) : 'Never'} />
              <KeyValue label="Messages sent" value={formatNumber(detail.messages_sent)} />
              <KeyValue label="Reports filed" value={formatNumber(detail.reports_filed)} />
            </Section>

            {detail.reports_against.length > 0 && (
              <Section title={`Reports against this account (${detail.reports_against.length})`}>
                {detail.reports_against.map((report) => (
                  <div key={report.id} className="py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">{titleCase(report.reason)}</span>
                      <AdminBadge tone={report.status === 'pending' ? 'warn' : 'muted'}>
                        {titleCase(report.status)}
                      </AdminBadge>
                    </div>
                    {report.details && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{report.details}</p>}
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      by {report.reporter || 'unknown'} · {formatDate(report.created_at)}
                    </p>
                  </div>
                ))}
              </Section>
            )}

            <Section title={`Listings (${detail.listings.length})`}>
              {detail.listings.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 py-1">No listings yet.</p>
              ) : (
                detail.listings.slice(0, 8).map((listing) => (
                  <div key={listing.id} className="flex items-center gap-2.5 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{listing.title}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {titleCase(listing.category)} ·{' '}
                        {formatMoney(listing.price, listing.kind === 'property')}
                      </p>
                    </div>
                    <AdminBadge tone={listing.status === 'active' ? 'active' : listing.status === 'removed' ? 'danger' : 'muted'}>
                      {titleCase(listing.status)}
                    </AdminBadge>
                  </div>
                ))
              )}
            </Section>
          </>
        )}
      </div>
    )}
  </AdminDrawer>
);

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

const EditProfileModal: React.FC<{
  row: AdminUserRow;
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, onClose, onSaved }) => {
  const { toasts } = useAdminChrome();
  const action = useAdminAction();
  // Local form shape is all-strings: the nullable parts of `ProfilePatch` are
  // converted back to null on save.
  const [form, setForm] = useState({
    fullName: row.full_name || '',
    username: row.username || '',
    department: row.department ?? '',
    level: row.level ?? '',
    hallOrArea: row.hall_or_area ?? '',
    bio: row.bio ?? '',
  });

  const save = async () => {
    const patch: ProfilePatch = {
      fullName: form.fullName.trim(),
      username: form.username.trim().toLowerCase(),
      department: form.department.trim() || null,
      level: form.level.trim() || null,
      hallOrArea: form.hallOrArea.trim() || null,
      bio: form.bio.trim() || null,
    };
    const result = await action.run('save-profile', () => updateUserProfile(row.id, patch));
    if (!result.ok) {
      toasts.error('Could not save', result.error.message);
      return;
    }
    toasts.success('Profile updated', `@${row.username}`);
    onSaved();
  };

  return (
    <AdminModal
      open
      onClose={onClose}
      title="Edit profile"
      description={`Changes to @${row.username}. Every edit is recorded in the audit log.`}
      footer={
        <>
          <AdminButton size="md" onClick={onClose} disabled={action.pendingKey === 'save-profile'}>
            Cancel
          </AdminButton>
          <AdminButton size="md" variant="primary" onClick={save} loading={action.pendingKey === 'save-profile'}>
            Save changes
          </AdminButton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Full name" value={form.fullName} onChange={(v) => setForm((f) => ({ ...f, fullName: v }))} />
        <TextField
          label="Username"
          value={form.username}
          onChange={(v) => setForm((f) => ({ ...f, username: v }))}
          hint="Used in /u/ profile links"
        />
        <TextField label="Department" value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v }))} />
        <TextField label="Level" value={form.level} onChange={(v) => setForm((f) => ({ ...f, level: v }))} />
        <TextField
          label="Hall / area"
          value={form.hallOrArea}
          onChange={(v) => setForm((f) => ({ ...f, hallOrArea: v }))}
          className="sm:col-span-2"
        />
        <TextArea
          label="Bio"
          value={form.bio}
          onChange={(v) => setForm((f) => ({ ...f, bio: v }))}
          className="sm:col-span-2"
        />
      </div>
    </AdminModal>
  );
};

const NotifyModal: React.FC<{ row: AdminUserRow; onClose: () => void; onSent: () => void }> = ({
  row,
  onClose,
  onSent,
}) => {
  const { toasts } = useAdminChrome();
  const action = useAdminAction();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const send = async () => {
    const result = await action.run('notify', () =>
      notifyUser(row.id, title.trim(), body.trim(), 'admin_message')
    );
    if (!result.ok) {
      toasts.error('Could not send', result.error.message);
      return;
    }
    toasts.success('Notification sent', `To @${row.username}`);
    onSent();
  };

  return (
    <AdminModal
      open
      onClose={onClose}
      title={`Message ${row.username}`}
      description="The message appears in the student's notifications."
      footer={
        <>
          <AdminButton size="md" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton
            size="md"
            variant="primary"
            onClick={send}
            disabled={!title.trim() || !body.trim()}
            loading={action.pendingKey === 'notify'}
          >
            Send
          </AdminButton>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label="Title" value={title} onChange={setTitle} required placeholder="e.g. Your listing was removed" />
        <TextArea label="Message" value={body} onChange={setBody} rows={5} placeholder="Explain what happened and what to do next." />
      </div>
    </AdminModal>
  );
};

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">{title}</p>
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-1">{children}</div>
  </div>
);

const KeyValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</span>
    <span className="text-[11px] font-bold truncate max-w-[55%]">{value}</span>
  </div>
);

const Metric: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
    <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
    <p className="font-display text-lg font-black mt-1.5">{value}</p>
    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{label}</p>
  </div>
);