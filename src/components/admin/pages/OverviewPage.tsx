/**
 * Admin overview: platform health at a glance plus the moderation queue.
 *
 * Everything here is read-only counters from `admin_dashboard_stats`, which the
 * shell already loads for the nav badges — so this page reuses the shell's
 * snapshot and only fetches the activity feed of its own.
 */

import React from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Flag,
  Home as HomeIcon,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Star,
  TrendingUp,
  UserCheck,
  Users as UsersIcon,
} from 'lucide-react';
import { getActivityFeed } from '../../../services/adminApi';
import type { ActivityItem } from '../../../services/adminApi';
import type { ViewType } from '../../../types';
import {
  AdminAvatar,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminSectionHeader,
  AsyncBoundary,
  StatTile,
  timeAgo,
  titleCase,
  useAdminAsync,
} from '../ui';
import { useAdminChrome } from '../AdminShell';

export const OverviewPage: React.FC = () => {
  const { stats, refreshStats, reportAuthProblem, go } = useAdminChrome();

  const feed = useAdminAsync<ActivityItem[]>(() => getActivityFeed(14), [], {
    onAuthProblem: reportAuthProblem,
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ---------------- Headline counters ---------------- */}
      <AdminCard>
        <AdminSectionHeader
          title="Platform at a glance"
          description="Live totals computed in the database, not in the browser."
          icon={TrendingUp}
          actions={
            <AdminButton icon={RefreshCw} onClick={() => void refreshStats()} loading={!stats}>
              Refresh
            </AdminButton>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatTile
            label="Registered students"
            value={stats?.users_total ?? 0}
            icon={UsersIcon}
            hint={`${stats?.users_new_7d ?? 0} new this week`}
            onClick={() => go('admin-users' as ViewType)}
          />
          <StatTile
            label="Active marketplace"
            value={stats?.market_active ?? 0}
            icon={ShoppingBag}
            hint={`${stats?.market_removed ?? 0} removed`}
            tone="info"
            onClick={() => go('admin-listings' as ViewType)}
          />
          <StatTile
            label="Live accommodations"
            value={stats?.property_active ?? 0}
            icon={HomeIcon}
            hint={`${stats?.property_verified ?? 0} verified`}
            tone="info"
            onClick={() => go('admin-listings' as ViewType)}
          />
          <StatTile
            label="Open reports"
            value={stats?.reports_pending ?? 0}
            icon={Flag}
            hint={`${stats?.reports_24h ?? 0} filed today`}
            tone={stats?.reports_pending ? 'warn' : 'brand'}
            onClick={() => go('admin-reports' as ViewType)}
          />
        </div>
      </AdminCard>

      {/* ---------------- Moderation queue ---------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard>
          <AdminSectionHeader title="Moderation queue" icon={ShieldAlert} />
          <div className="space-y-2">
            <QueueRow
              icon={AlertTriangle}
              tone={stats?.reports_pending ? 'warn' : 'ok'}
              label="Reports awaiting a decision"
              value={stats?.reports_pending ?? 0}
              detail={`${stats?.reports_total ?? 0} filed all time`}
              onClick={() => go('admin-reports' as ViewType)}
            />
            <QueueRow
              icon={UsersIcon}
              tone={stats?.users_suspended ? 'danger' : 'ok'}
              label="Suspended accounts"
              value={stats?.users_suspended ?? 0}
              detail={`${stats?.users_admins ?? 0} administrators`}
              onClick={() => go('admin-users' as ViewType)}
            />
            <QueueRow
              icon={ShoppingBag}
              tone={stats?.market_removed ? 'danger' : 'ok'}
              label="Removed marketplace listings"
              value={stats?.market_removed ?? 0}
              detail={`${stats?.property_removed ?? 0} removed accommodations`}
              onClick={() => go('admin-listings' as ViewType)}
            />
            <QueueRow
              icon={Flag}
              tone={stats?.denied_24h ? 'danger' : 'ok'}
              label="Refused access attempts (24h)"
              value={stats?.denied_24h ?? 0}
              detail={`${stats?.audit_24h ?? 0} admin actions logged (24h)`}
              onClick={() => go('admin-audit' as ViewType)}
            />
          </div>
        </AdminCard>

        <AdminCard>
          <AdminSectionHeader title="Community signals" icon={Star} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatTile
              label="Reviews published"
              value={stats?.reviews_total ?? 0}
              icon={Star}
              hint={`${stats?.reviews_7d ?? 0} in the last 7 days`}
            />
            <StatTile
              label="Boosted listings"
              value={stats?.boosts_active ?? 0}
              icon={BadgeCheck}
              tone="info"
            />
            <StatTile
              label="New in 24h"
              value={stats?.users_new_24h ?? 0}
              icon={UserCheck}
            />
            <StatTile
              label="Active admins"
              value={stats?.users_admins ?? 0}
              icon={BadgeCheck}
              tone="neutral"
            />
          </div>
        </AdminCard>
      </div>

      {/* ---------------- Activity ---------------- */}
      <AdminCard>
        <AdminSectionHeader
          title="Latest activity"
          description="What students have been doing across JID."
          icon={Activity}
          actions={<AdminButton icon={RefreshCw} onClick={feed.reload} loading={feed.loading} />}
        />
        <AsyncBoundary
          loading={feed.loading}
          error={feed.error}
          isEmpty={!feed.loading && !feed.error && (feed.data?.length ?? 0) === 0}
          onRetry={feed.reload}
          emptyTitle="Nothing has happened yet"
          emptyDescription="Once students start posting, buying and reporting, their activity shows up here."
          emptyIcon={Activity}
        >
          <ol className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {(feed.data ?? []).map((item, index) => (
              <li key={`${item.kind}-${item.target_id}-${index}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <AdminAvatar name={item.actor} src={item.actor_avatar} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">
                    <span className="font-bold">{item.actor || 'Someone'}</span>{' '}
                    <span className="text-zinc-500 dark:text-zinc-400">{item.summary}</span>
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {titleCase(item.target_type)} · {timeAgo(item.occurred_at)}
                  </p>
                </div>
                <AdminBadge tone="muted" className="shrink-0 mt-0.5">
                  {titleCase(item.kind)}
                </AdminBadge>
              </li>
            ))}
          </ol>
        </AsyncBoundary>
      </AdminCard>
    </div>
  );
};

const QueueRow: React.FC<{
  icon: React.ElementType;
  tone: 'ok' | 'warn' | 'danger';
  label: string;
  value: number;
  detail: string;
  onClick: () => void;
}> = ({ icon: Icon, tone, label, value, detail, onClick }) => {
  const chip =
    tone === 'danger'
      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
      : tone === 'warn'
      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors cursor-pointer text-left"
    >
      <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${chip}`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold truncate">{label}</span>
        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{detail}</span>
      </span>
      <span className="font-display text-lg font-black shrink-0">{value}</span>
    </button>
  );
};