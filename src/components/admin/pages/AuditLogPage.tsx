/**
 * Admin audit log screen.
 *
 * This screen is deliberately read-only: the audit trail is written by the
 * database inside the same transaction as each privileged mutation, and there is
 * no RPC — and no RLS policy — that lets anyone edit or delete an entry. That
 * immutability is the whole point, so nothing on this page is editable.
 *
 * `details` is a free-form JSON object whose shape depends on the action, so it
 * is rendered as a key/value list rather than dumped raw.
 */

import React, { useMemo, useState } from 'react';
import { Download, ScrollText, ShieldAlert } from 'lucide-react';
import { listAuditActors, listAuditLog } from '../../../services/adminApi';
import type { AdminAuditRow, AuditActor, AuditListFilters } from '../../../services/adminApi';
import {
  AdminAvatar,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminDrawer,
  AdminSectionHeader,
  AdminTable,
  AsyncBoundary,
  PaginationBar,
  SelectField,
  Td,
  Th,
  Toolbar,
  formatDateTime,
  pagedFetcher,
  timeAgo,
  titleCase,
  useAdminAsync,
  useAdminResource,
} from '../ui';
import { useAdminChrome } from '../AdminShell';

interface Filters {
  actionPrefix: string;
  adminId: string | null;
}

const ACTION_GROUPS = [
  { value: '', label: 'Every action' },
  { value: 'user.', label: 'User actions' },
  { value: 'listing.', label: 'Listing actions' },
  { value: 'report.', label: 'Report actions' },
  { value: 'review.', label: 'Review actions' },
  { value: 'admin.', label: 'Access attempts' },
];

/** `user.suspended` → `User · Suspended`, for readable badges. */
const actionLabel = (action: string) => {
  const [group, rest] = action.split('.');
  return `${titleCase(group)} · ${titleCase((rest ?? '').replace(/_/g, ' '))}`;
};

const actionTone = (action: string): 'active' | 'warn' | 'danger' | 'muted' | 'info' | 'brand' => {
  if (action.startsWith('access.')) return 'danger';
  if (/suspend|delete|remove|dismiss|revoke/.test(action)) return 'danger';
  if (/restore|resolve|reinstate/.test(action)) return 'active';
  if (/create|notify|update/.test(action)) return 'info';
  return 'muted';
};

export const AuditLogPage: React.FC = () => {
  const { reportAuthProblem } = useAdminChrome();

  const [draft, setDraft] = useState<Filters>({ actionPrefix: '', adminId: null });

  const filters = useMemo<Filters>(
    () => ({ actionPrefix: draft.actionPrefix, adminId: draft.adminId }),
    [draft]
  );

  const log = useAdminResource<AdminAuditRow, Filters>(pagedFetcher(listAuditLog), {
    filters,
    pageSize: 50,
    onAuthProblem: reportAuthProblem,
  });

  const actors = useAdminAsync<AuditActor[]>(() => listAuditActors(), [], {
    onAuthProblem: reportAuthProblem,
  });

  const [selected, setSelected] = useState<AdminAuditRow | null>(null);

  // Export what is on screen. This is a client-side CSV of the current page
  // only — it never bypasses the RLS policies that produced these rows.
  const exportCsv = () => {
    const header = ['timestamp', 'action', 'target_type', 'target_id', 'admin', 'details'];
    const lines = log.rows.map((row) =>
      [
        row.created_at,
        row.action,
        row.target_type ?? '',
        row.target_id ?? '',
        row.username ? `@${row.username}` : '',
        JSON.stringify(row.details ?? {}),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `jid-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminSectionHeader
          title="Audit log"
          description="Every privileged action, written by the database in the same transaction as the change. Entries cannot be edited or deleted."
          icon={ScrollText}
          actions={
            <AdminButton icon={Download} onClick={exportCsv} disabled={log.rows.length === 0}>
              Export page
            </AdminButton>
          }
        />

        <Toolbar className="mb-4">
          <SelectField
            label="Action"
            aria-label="Filter by action type"
            value={draft.actionPrefix}
            onChange={(actionPrefix) => setDraft((f) => ({ ...f, actionPrefix }))}
            options={ACTION_GROUPS}
          />
          <SelectField
            label="Administrator"
            aria-label="Filter by administrator"
            value={draft.adminId ?? ''}
            onChange={(adminId) => setDraft((f) => ({ ...f, adminId: adminId || null }))}
            options={[
              { value: '', label: 'Everyone' },
              ...(actors.data ?? []).map((actor) => ({
                value: actor.id,
                label: `${actor.username} (${actor.action_count})`,
              })),
            ]}
          />
        </Toolbar>

        <AsyncBoundary
          loading={log.loading}
          error={log.error}
          isEmpty={log.isEmpty}
          onRetry={log.reload}
          emptyTitle="No audit entries yet"
          emptyDescription="Administrative actions appear here the moment they happen."
          emptyIcon={ScrollText}
        >
          <div className={log.refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <AdminTable
              head={
                <tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Administrator</Th>
                  <Th>Target</Th>
                  <Th>Details</Th>
                </tr>
              }
            >
              {log.rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer"
                >
                  <Td>
                    <span className="text-xs whitespace-nowrap" title={formatDateTime(row.created_at)}>
                      {timeAgo(row.created_at)}
                    </span>
                  </Td>
                  <Td>
                    <AdminBadge tone={actionTone(row.action)}>{actionLabel(row.action)}</AdminBadge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <AdminAvatar name={row.full_name || row.username} src={row.avatar_url} size="xs" />
                      <span className="text-xs truncate max-w-[9rem]">
                        {row.username ? `@${row.username}` : 'System'}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs truncate block max-w-[12rem]">
                      {row.target_type ? `${titleCase(row.target_type)} ` : ''}
                      <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px]">
                        {row.target_id ? row.target_id.slice(0, 8) : '—'}
                      </span>
                    </span>
                  </Td>
                  <Td>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 max-w-md">
                      {summariseDetails(row)}
                    </span>
                  </Td>
                </tr>
              ))}
            </AdminTable>

            <PaginationBar
              total={log.total}
              limit={log.pageSize}
              offset={(log.page - 1) * log.pageSize}
              onOffsetChange={(offset) => log.setPage(Math.floor(offset / log.pageSize) + 1)}
              onLimitChange={log.setPageSize}
              limitOptions={[25, 50, 100, 200]}
              label="entries"
            />
          </div>
        </AsyncBoundary>
      </AdminCard>

      <AdminDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? actionLabel(selected.action) : ''}
        subtitle={selected ? formatDateTime(selected.created_at) : ''}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
              <AdminAvatar name={selected.full_name || selected.username} src={selected.avatar_url} />
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">
                  {selected.full_name || selected.username || 'System'}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {selected.username ? `@${selected.username}` : 'Automated record'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Target
              </p>
              <dl className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-1">
                <Row label="Type" value={selected.target_type ? titleCase(selected.target_type) : '—'} />
                <Row label="Id" value={selected.target_id ?? '—'} mono />
                <Row label="Action" value={selected.action} mono />
              </dl>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Recorded details
              </p>
              {selected.details && Object.keys(selected.details).length > 0 ? (
                <dl className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-1">
                  {Object.entries(selected.details).map(([key, value]) => (
                    <Row key={key} label={titleCase(key)} value={renderValue(value)} />
                  ))}
                </dl>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">No extra details recorded.</p>
              )}
            </div>

            <p className="flex items-start gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
              This entry is permanent. Audit rows are append-only — there is no endpoint that can edit
              or remove them.
            </p>
          </div>
        )}
      </AdminDrawer>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
    <dt className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">{label}</dt>
    <dd
      className={`text-[11px] font-bold text-right break-all ${mono ? 'font-mono text-[10px]' : ''}`}
    >
      {value}
    </dd>
  </div>
);

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** One-line preview of the `details` blob for the table cell. */
const summariseDetails = (row: AdminAuditRow): string => {
  if (!row.details) return '';
  const entries = Object.entries(row.details).filter(([, value]) => value !== null && value !== undefined);
  if (entries.length === 0) return '';
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${renderValue(value)}`)
    .join(' · ');
};