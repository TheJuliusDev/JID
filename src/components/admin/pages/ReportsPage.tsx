/**
 * Admin reports screen — the moderation queue.
 *
 * JID stores listing reports and user reports in two tables, so this page lists
 * them through one endpoint that already unions them, and resolves each one
 * through the matching privileged RPC.
 *
 * A report is a *claim about a record*, never the action itself. "Take action"
 * therefore always chains two audited operations: moderate the target, then
 * record the report outcome. If the second step fails the operator sees an
 * error and nothing is silently lost.
 */

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Flag,
  Gavel,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import { listReports, resolveReport, setListingStatus, setUserSuspended } from '../../../services/adminApi';
import type { AdminReportRow, ReportListFilters } from '../../../services/adminApi';
import {
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
  Toolbar,
  formatDateTime,
  pagedFetcher,
  timeAgo,
  titleCase,
  useAdminAction,
  useAdminResource,
  useDebouncedValue,
} from '../ui';
import type { ConfirmRequest } from '../ui';
import { useAdminChrome } from '../AdminShell';

type Outcome = 'reviewing' | 'resolved' | 'dismissed' | 'action_taken';

interface Filters {
  kind: string;
  status: string;
  search: string;
  sort: string;
}

const EMPTY: Filters = { kind: 'all', status: 'pending', search: '', sort: 'newest' };

export const ReportsPage: React.FC = () => {
  const { toasts, reportAuthProblem, refreshStats } = useAdminChrome();
  const action = useAdminAction();

  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const filters = useMemo<Filters>(() => ({ ...draft, search: debouncedSearch }), [draft, debouncedSearch]);

  const reports = useAdminResource<AdminReportRow, Filters>(pagedFetcher(listReports), {
    filters,
    pageSize: 25,
    onAuthProblem: reportAuthProblem,
  });

  const [note, setNote] = useState<{ row: AdminReportRow; outcome: Outcome } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const openResolution = (row: AdminReportRow, outcome: Outcome) => {
    if (outcome === 'dismissed' || outcome === 'resolved' || outcome === 'reviewing') {
      applyOutcome(row, outcome, '');
      return;
    }
    // `action_taken` always needs an explanation: it asserts that the target
    // was moderated, and the note is the record of why.
    setNote({ row, outcome });
  };

  const applyOutcome = async (row: AdminReportRow, outcome: Outcome, resolutionNote: string) => {
    const result = await action.run(`resolve:${row.id}`, () =>
      resolveReport(row.report_table, row.id, outcome, resolutionNote)
    );
    if (!result.ok) {
      toasts.error('Could not update the report', result.error.message);
      return;
    }
    reports.patchRow((r) => r.id === row.id, {
      status: outcome,
      resolution_note: resolutionNote || null,
      resolved_at: outcome === 'reviewing' ? null : new Date().toISOString(),
    } as Partial<AdminReportRow>);
    void refreshStats();
    toasts.success('Report updated', `${row.reason} → ${titleCase(outcome)}`);
  };

  const askTakeAction = (row: AdminReportRow, resolutionNote: string) => {
    const onUser = row.is_user_report;
    setConfirm({
      tone: 'danger',
      title: onUser ? 'Suspend this user?' : 'Remove this listing?',
      description: onUser
        ? 'The account loses posting, messaging and reporting access. Existing listings stay visible.'
        : 'The listing disappears from JID. This is reversible — the report is closed as "action taken".',
      confirmLabel: onUser ? 'Suspend & close report' : 'Remove & close report',
      facts: [
        { label: 'Reported', value: row.target_title || 'Deleted record' },
        { label: 'Reason', value: titleCase(row.reason) },
        { label: 'Reporter', value: row.reporter_username ? `@${row.reporter_username}` : 'Anonymous' },
      ],
      onConfirm: async () => {
        // 1. Moderate the target, 2. close the report. Both are audited.
        const target = onUser
          ? await action.run(`target:${row.id}`, () => setUserSuspended(row.target_id, true, `Report ${row.id}: ${resolutionNote}`))
          : await action.run(`target:${row.id}`, () =>
              setListingStatus(row.listing_kind ?? 'marketplace', row.target_id, 'removed', `Report ${row.id}: ${resolutionNote}`)
            );
        if (!target.ok) throw target.error;

        const result = await action.run(`resolve:${row.id}`, () =>
          resolveReport(row.report_table, row.id, 'action_taken', resolutionNote)
        );
        if (!result.ok) throw result.error;

        reports.patchRow((r) => r.id === row.id, {
          status: 'action_taken',
          resolution_note: resolutionNote,
          resolved_at: new Date().toISOString(),
        });
        void refreshStats();
        toasts.success('Action taken', 'The report has been closed.');
      },
    });
  };

  const pendingCount = filters.status === 'pending' ? reports.total : 0;

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminSectionHeader
          title="Reports"
          description="Claims reported by students about listings and accounts."
          icon={Flag}
          actions={
            filtersActive(draft, search) ? (
              <AdminButton
                onClick={() => {
                  setDraft(EMPTY);
                  setSearch('');
                }}
              >
                Reset
              </AdminButton>
            ) : undefined
          }
        />

        <Toolbar className="mb-4">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search target or details…"
            className="flex-1 min-w-[14rem]"
            aria-label="Search reports"
          />
          <SelectField
            label="Type"
            aria-label="Filter by report type"
            value={draft.kind}
            onChange={(kind) => setDraft((f) => ({ ...f, kind }))}
            options={[
              { value: 'all', label: 'Listings & users' },
              { value: 'listing', label: 'Listings only' },
              { value: 'user', label: 'Users only' },
            ]}
          />
          <SelectField
            label="Status"
            aria-label="Filter by status"
            value={draft.status}
            onChange={(status) => setDraft((f) => ({ ...f, status }))}
            options={[
              { value: 'open', label: 'Needs attention (pending + in review)' },
              { value: 'pending', label: 'Pending' },
              { value: 'reviewing', label: 'In review' },
              { value: 'all', label: 'Any status' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'dismissed', label: 'Dismissed' },
              { value: 'action_taken', label: 'Action taken' },
            ]}
          />
          <SelectField
            label="Sort"
            aria-label="Sort reports"
            value={draft.sort}
            onChange={(sort) => setDraft((f) => ({ ...f, sort }))}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
            ]}
          />
        </Toolbar>

        <AsyncBoundary
          loading={reports.loading}
          error={reports.error}
          isEmpty={reports.isEmpty}
          onRetry={reports.reload}
          emptyTitle={
            draft.status === 'pending' ? 'The moderation queue is clear' : 'No reports match those filters'
          }
          emptyDescription={
            draft.status === 'pending'
              ? 'Nothing is waiting for a decision right now.'
              : 'Try a different status or clear the search.'
          }
          emptyIcon={CheckCircle2}
        >
          <div className={reports.refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <AdminTable
              head={
                <tr>
                  <Th>Reported item</Th>
                  <Th>Reason</Th>
                  <Th>Reporter</Th>
                  <Th>Filed</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              }
            >
              {reports.rows.map((row) => {
                const open = row.status === 'pending' || row.status === 'reviewing';
                return (
                  <tr key={`${row.report_table}-${row.id}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <Td>
                      <div className="flex items-center gap-2 min-w-0">
                        <AdminBadge tone={row.is_user_report ? 'warn' : 'info'}>
                          {row.is_user_report ? 'User' : titleCase(row.listing_kind ?? 'listing')}
                        </AdminBadge>
                        <span className="text-sm font-bold truncate max-w-[14rem]">
                          {row.target_title || 'Record no longer exists'}
                        </span>
                      </div>
                      {row.details && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 max-w-[22rem]">
                          {row.details}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <span className="text-xs font-bold">{titleCase(row.reason)}</span>
                    </Td>
                    <Td>
                      <span className="text-xs truncate block max-w-[10rem]">
                        {row.reporter_username ? `@${row.reporter_username}` : 'Anonymous'}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs whitespace-nowrap" title={formatDateTime(row.created_at)}>
                        {timeAgo(row.created_at)}
                      </span>
                    </Td>
                    <Td>
                      <AdminBadge
                        tone={
                          row.status === 'pending'
                            ? 'warn'
                            : row.status === 'reviewing'
                            ? 'info'
                            : row.status === 'action_taken'
                            ? 'danger'
                            : row.status === 'resolved'
                            ? 'active'
                            : 'muted'
                        }
                      >
                        {titleCase(row.status)}
                      </AdminBadge>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        {open ? (
                          <>
                            <AdminButton
                              variant="ghost"
                              icon={MessageSquare}
                              loading={action.pendingKey === `resolve:${row.id}`}
                              onClick={() => openResolution(row, 'reviewing')}
                            >
                              <span className="sr-only">Mark in review</span>
                            </AdminButton>
                            <AdminButton
                              variant="ghost"
                              icon={CheckCircle2}
                              onClick={() => openResolution(row, 'dismissed')}
                            >
                              Dismiss
                            </AdminButton>
                            <AdminButton
                              variant="ghost"
                              icon={Gavel}
                              onClick={() => openResolution(row, 'action_taken')}
                            >
                              Take action
                            </AdminButton>
                          </>
                        ) : (
                          <AdminButton
                            variant="ghost"
                            icon={RotateCcw}
                            loading={action.pendingKey === `resolve:${row.id}`}
                            onClick={() => openResolution(row, 'reviewing')}
                          >
                            Reopen
                          </AdminButton>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </AdminTable>

            <PaginationBar
              total={reports.total}
              limit={reports.pageSize}
              offset={(reports.page - 1) * reports.pageSize}
              onOffsetChange={(offset) => reports.setPage(Math.floor(offset / reports.pageSize) + 1)}
              onLimitChange={reports.setPageSize}
              label="reports"
            />

            {pendingCount > 0 && (
              <p className="pt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                {pendingCount} report{pendingCount === 1 ? '' : 's'} in this view still need a decision.
              </p>
            )}
          </div>
        </AsyncBoundary>
      </AdminCard>

      {note && (
        <ResolutionNoteModal
          row={note.row}
          onClose={() => setNote(null)}
          onSubmit={(text) => {
            setNote(null);
            askTakeAction(note.row, text);
          }}
        />
      )}

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

/** Collects the mandatory explanation before the target is moderated. */
const ResolutionNoteModal: React.FC<{
  row: AdminReportRow;
  onClose: () => void;
  onSubmit: (note: string) => void;
}> = ({ row, onClose, onSubmit }) => {
  const [text, setText] = useState('');

  return (
    <AdminModal
      open
      onClose={onClose}
      title="Why is action being taken?"
      description={`This note is stored with the report and shown in the audit log.${
        row.target_title ? ` Target: ${row.target_title}` : ''
      }`}
      footer={
        <>
          <AdminButton size="md" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton
            size="md"
            variant="danger"
            onClick={() => onSubmit(text.trim())}
            disabled={!text.trim()}
          >
            Continue
          </AdminButton>
        </>
      }
    >
      <TextArea
        label="Resolution note"
        value={text}
        onChange={setText}
        rows={4}
        placeholder="e.g. Confirmed counterfeit. Suspended the seller and removed the listing."
      />
    </AdminModal>
  );
};

const filtersActive = (draft: Filters, search: string) =>
  draft.kind !== 'all' || draft.status !== 'pending' || draft.sort !== 'newest' || search !== '';