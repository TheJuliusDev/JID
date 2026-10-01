/**
 * Admin reviews screen.
 *
 * Reviews are the one piece of user content an administrator can delete, so the
 * screen is deliberately thin: filter by rating or author, read the comment, and
 * remove it through a confirm dialog that requires both a written reason and a
 * typed confirmation. Ratings cannot be edited — a review is an opinion, and
 * rewriting someone's opinion would be worse than removing abuse.
 */

import React, { useMemo, useState } from 'react';
import { Star, StarOff, Trash2 } from 'lucide-react';
import { deleteReview, listReviews } from '../../../services/adminApi';
import type { AdminReviewRow, ReviewListFilters } from '../../../services/adminApi';
import {
  AdminAvatar,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminSectionHeader,
  AdminTable,
  AsyncBoundary,
  ConfirmDialog,
  PaginationBar,
  SearchField,
  SelectField,
  Td,
  Th,
  Toolbar,
  formatDate,
  formatDateTime,
  pagedFetcher,
  useAdminAction,
  useAdminResource,
  useDebouncedValue,
} from '../ui';
import type { ConfirmRequest } from '../ui';
import { useAdminChrome } from '../AdminShell';

interface Filters {
  search: string;
  rating: number | null;
  sort: string;
}

const EMPTY: Filters = { search: '', rating: null, sort: 'newest' };

export const ReviewsPage: React.FC = () => {
  const { toasts, reportAuthProblem } = useAdminChrome();
  const action = useAdminAction();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [draft, setDraft] = useState<{ rating: number | null; sort: string }>({ rating: null, sort: 'newest' });

  const filters = useMemo<Filters>(() => ({ ...draft, search: debouncedSearch }), [draft, debouncedSearch]);

  const reviews = useAdminResource<AdminReviewRow, Filters>(pagedFetcher(listReviews), {
    filters,
    pageSize: 25,
    onAuthProblem: reportAuthProblem,
  });

  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const askDelete = (row: AdminReviewRow) => {
    setConfirm({
      tone: 'danger',
      title: 'Delete this review?',
      description:
        'The review and its rating are removed permanently. This cannot be undone, and the average rating of the seller is recalculated immediately.',
      confirmLabel: 'Delete review',
      requireReason: true,
      typeToConfirm: 'DELETE',
      reasonLabel: 'Reason (visible in the audit log)',
      reasonPlaceholder: 'e.g. Contains personal information about another student',
      facts: [
        { label: 'Rating', value: `${row.rating} / 5` },
        { label: 'Comment', value: row.comment?.slice(0, 80) || '(no comment)' },
        {
          label: 'Written by',
          value: row.reviewer_username ? `@${row.reviewer_username}` : 'Unknown',
        },
        { label: 'About', value: row.vendor_username ? `@${row.vendor_username}` : 'Unknown' },
      ],
      onConfirm: async (reason) => {
        const result = await action.run(`review:${row.id}`, () => deleteReview(row.id, reason));
        if (!result.ok) throw result.error;
        reviews.removeRow((r) => r.id === row.id);
        toasts.success('Review deleted', `About @${row.vendor_username ?? 'unknown'}`);
      },
    });
  };

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminSectionHeader
          title="Reviews"
          description="Ratings students have left for each other. Read-only apart from deletion."
          icon={Star}
          actions={
            draft.rating !== null || search !== '' ? (
              <AdminButton
                onClick={() => {
                  setDraft({ rating: null, sort: 'newest' });
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
            placeholder="Search comment, author or seller…"
            className="flex-1 min-w-[14rem]"
            aria-label="Search reviews"
          />
          <SelectField
            label="Rating"
            aria-label="Filter by rating"
            value={draft.rating === null ? 'all' : String(draft.rating)}
            onChange={(value) => setDraft((d) => ({ ...d, rating: value === 'all' ? null : Number(value) }))}
            options={[
              { value: 'all', label: 'Any rating' },
              { value: '5', label: '5 stars' },
              { value: '4', label: '4 stars' },
              { value: '3', label: '3 stars' },
              { value: '2', label: '2 stars' },
              { value: '1', label: '1 star' },
            ]}
          />
          <SelectField
            label="Sort"
            aria-label="Sort reviews"
            value={draft.sort}
            onChange={(sort) => setDraft((d) => ({ ...d, sort }))}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'lowest', label: 'Lowest rated' },
              { value: 'highest', label: 'Highest rated' },
            ]}
          />
        </Toolbar>

        <AsyncBoundary
          loading={reviews.loading}
          error={reviews.error}
          isEmpty={reviews.isEmpty}
          onRetry={reviews.reload}
          emptyTitle="No reviews found"
          emptyDescription="Reviews appear here once students rate each other after a transaction."
          emptyIcon={StarOff}
        >
          <div className={reviews.refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <AdminTable
              head={
                <tr>
                  <Th align="right">Rating</Th>
                  <Th>Comment</Th>
                  <Th>Written by</Th>
                  <Th>About</Th>
                  <Th>Posted</Th>
                  <Th align="right">Actions</Th>
                </tr>
              }
            >
              {reviews.rows.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <Td align="right">
                    <span className="inline-flex items-center gap-0.5" title={`${row.rating} out of 5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < row.rating ? 'text-amber-500 fill-amber-500' : 'text-zinc-300 dark:text-zinc-700'
                          }`}
                        />
                      ))}
                    </span>
                    {row.rating <= 2 && (
                      <span className="block">
                        <AdminBadge tone="warn">Low</AdminBadge>
                      </span>
                    )}
                  </Td>
                  <Td>
                    {row.comment ? (
                      <p className="text-xs leading-relaxed max-w-md line-clamp-3">{row.comment}</p>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                        No written comment
                      </span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <AdminAvatar
                        name={row.reviewer_name || row.reviewer_username}
                        src={row.reviewer_avatar}
                        size="xs"
                      />
                      <span className="text-xs truncate max-w-[8rem]">
                        {row.reviewer_username ? `@${row.reviewer_username}` : 'Unknown'}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs truncate block max-w-[8rem]">
                      {row.vendor_username ? `@${row.vendor_username}` : 'Unknown'}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs whitespace-nowrap" title={formatDateTime(row.created_at)}>
                      {formatDate(row.created_at)}
                    </span>
                  </Td>
                  <Td align="right">
                    <AdminButton
                      variant="ghost"
                      icon={Trash2}
                      aria-label={`Delete review by ${row.reviewer_username ?? 'unknown'}`}
                      loading={action.pendingKey === `review:${row.id}`}
                      onClick={() => askDelete(row)}
                    >
                      <span className="sr-only">Delete</span>
                    </AdminButton>
                  </Td>
                </tr>
              ))}
            </AdminTable>

            <PaginationBar
              total={reviews.total}
              limit={reviews.pageSize}
              offset={(reviews.page - 1) * reviews.pageSize}
              onOffsetChange={(offset) => reviews.setPage(Math.floor(offset / reviews.pageSize) + 1)}
              onLimitChange={reviews.setPageSize}
              label="reviews"
            />
          </div>
        </AsyncBoundary>
      </AdminCard>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};