/**
 * Reusable presentation primitives for the JID admin console.
 *
 * These are deliberately admin-local: the public site keeps its own component
 * set, and the console needs denser, data-first variants (tables, toolbars,
 * pagination, stat tiles) that would be dead weight in the marketing UI.
 *
 * Styling follows the JID design system in `src/index.css` — the same emerald /
 * sand / charcoal palette, the same radii and elevation scale, and explicit
 * `dark:` variants on every element so the console honours the app's theme
 * preference rather than forcing its own.
 */

import React from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export const AdminCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}> = ({ children, className = '', padded = true }) => (
  <section
    className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm ${
      padded ? 'p-5 sm:p-6' : ''
    } ${className}`}
  >
    {children}
  </section>
);

export const AdminSectionHeader: React.FC<{
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}> = ({ title, description, icon: Icon, actions }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
    <div className="flex items-start gap-3 min-w-0">
      {Icon && (
        <span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Icon className="w-4.5 h-4.5" />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="font-display text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
          {title}
        </h2>
        {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type BadgeTone = 'active' | 'warn' | 'danger' | 'muted' | 'info' | 'brand';

const BADGE_TONES: Record<BadgeTone, string> = {
  brand: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/70',
  active: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/70',
  info: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/60',
  warn: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
  danger: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60',
  muted: 'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
};

export const AdminBadge: React.FC<{
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  title?: string;
}> = ({ tone = 'muted', children, className = '', title }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${BADGE_TONES[tone]} ${className}`}
  >
    {children}
  </span>
);

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warn' | 'success';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 border border-emerald-600 hover:border-emerald-500',
  secondary:
    'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700',
  ghost:
    'bg-transparent text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-600 hover:border-rose-500 shadow-sm shadow-rose-600/20',
  warn: 'bg-amber-500 hover:bg-amber-400 text-white border border-amber-500 hover:border-amber-400',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600 hover:border-emerald-500',
};

interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  loading?: boolean;
}

export const AdminButton: React.FC<AdminButtonProps> = ({
  variant = 'secondary',
  size = 'sm',
  icon: Icon,
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:opacity-55 disabled:cursor-not-allowed ${
      size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
    } ${BUTTON_VARIANTS[variant]} ${className}`}
    {...rest}
  >
    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon ? <Icon className="w-3.5 h-3.5" /> : null}
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

const FIELD_BASE =
  'w-full rounded-xl border bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-500 disabled:opacity-60';

export const SearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}> = ({ value, onChange, placeholder = 'Search…', className = '', ...rest }) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${FIELD_BASE} border-zinc-200 dark:border-zinc-800 pl-9 pr-9 py-2.5`}
      {...rest}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

export const SelectField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label?: string;
  className?: string;
  'aria-label'?: string;
}> = ({ value, onChange, options, label, className = '', ...rest }) => (
  <label className={`block ${className}`}>
    {label && (
      <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
        {label}
      </span>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD_BASE} border-zinc-200 dark:border-zinc-800 px-3 py-2.5 cursor-pointer`}
      {...rest}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </label>
);

export const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}> = ({ label, value, onChange, placeholder, type = 'text', hint, required, disabled, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </span>
    <input
      type={type}
      value={value}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD_BASE} border-zinc-200 dark:border-zinc-800 px-3 py-2.5`}
    />
    {hint && <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">{hint}</span>}
  </label>
);

export const TextArea: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
  className?: string;
}> = ({ label, value, onChange, placeholder, rows = 3, hint, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
      {label}
    </span>
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD_BASE} border-zinc-200 dark:border-zinc-800 px-3 py-2.5 resize-y`}
    />
    {hint && <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">{hint}</span>}
  </label>
);

/** Container that stacks the filter controls above a table. */
export const Toolbar: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`flex flex-wrap items-end gap-3 ${className}`}>{children}</div>
);

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export const AdminAvatar: React.FC<{
  name?: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}> = ({ name, src, size = 'sm', className = '' }) => {
  const dims = size === 'xs' ? 'w-6 h-6 text-[10px]' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-11 h-11 text-sm';
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        className={`${dims} rounded-full object-cover shrink-0 bg-zinc-100 dark:bg-zinc-800 ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${dims} rounded-full shrink-0 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center ring-1 ring-emerald-500/20 dark:ring-emerald-400/20 ${className}`}
    >
      {initial}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const StatTile: React.FC<{
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  tone?: 'brand' | 'warn' | 'danger' | 'info' | 'neutral';
  onClick?: () => void;
}> = ({ label, value, icon: Icon, hint, tone = 'brand', onClick }) => {
  const tones: Record<string, string> = {
    brand: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
    warn: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
    danger: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
    info: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400',
    neutral: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300',
  };
  const Wrapper: any = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={`text-left w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm transition-colors ${
        onClick ? 'hover:border-emerald-400 dark:hover:border-emerald-700 cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="font-display text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">{label}</p>
      {hint && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">{hint}</p>}
    </Wrapper>
  );
};

// ---------------------------------------------------------------------------
// Async states
// ---------------------------------------------------------------------------

export const LoadingState: React.FC<{ label?: string; className?: string }> = ({
  label = 'Loading…',
  className = '',
}) => (
  <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`}>
    <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
    <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, description, icon: Icon = Inbox, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
    <span className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-4">
      <Icon className="w-5 h-5" />
    </span>
    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{title}</p>
    {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm leading-relaxed">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}> = ({ title = 'Something went wrong', message, onRetry, className = '' }) => (
  <div
    role="alert"
    className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}
  >
    <span className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-500 mb-4">
      <AlertTriangle className="w-5 h-5" />
    </span>
    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{title}</p>
    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-md leading-relaxed">{message}</p>
    {onRetry && (
      <AdminButton icon={RefreshCw} onClick={onRetry} className="mt-4">
        Try again
      </AdminButton>
    )}
  </div>
);

/**
 * Renders the correct async state for a resource, so no page has to re-implement
 * the loading / error / empty / success switch.
 */
export const AsyncBoundary: React.FC<{
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  onRetry?: () => void;
  loadingLabel?: string;
  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
}> = ({
  loading,
  error,
  isEmpty,
  onRetry,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  children,
}) => {
  if (loading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} action={emptyAction} />;
  return <>{children}</>;
};

// ---------------------------------------------------------------------------
// Table + pagination
// ---------------------------------------------------------------------------

/**
 * Responsive data table. Below `md` each row becomes a stacked card via the
 * `mobileLabel` prop, so the same markup serves desktop and phones instead of
 * duplicating the row layout in two places.
 */
export const AdminTable: React.FC<{
  head: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ head, children, className = '' }) => (
  <div className={`overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm ${className}`}>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-left border-collapse">
        <thead className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800">
          {head}
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">{children}</tbody>
      </table>
    </div>
  </div>
);

/**
 * Alignment classes are mapped explicitly rather than interpolated: Tailwind
 * scans source text for complete class names, so a `text-${align}` template
 * would never be generated into the stylesheet.
 */
const ALIGN: Record<'left' | 'right' | 'center', string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export const Th: React.FC<{ children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }> = ({
  children,
  className = '',
  align = 'left',
}) => (
  <th
    scope="col"
    className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ${ALIGN[align]} whitespace-nowrap ${className}`}
  >
    {children}
  </th>
);

export const Td: React.FC<{
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  colSpan?: number;
}> = ({ children, className = '', align = 'left', colSpan }) => (
  <td colSpan={colSpan} className={`px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 ${ALIGN[align]} align-middle ${className}`}>
    {children}
  </td>
);

export const PaginationBar: React.FC<{
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;
  limitOptions?: number[];
  label?: string;
}> = ({ total, limit, offset, onOffsetChange, onLimitChange, limitOptions = [10, 25, 50, 100], label = 'results' }) => {
  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  // Compact page list: first, last, and a window around the current page.
  const pages: Array<number | 'gap'> = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== 'gap') pages.push('gap');
  }

  const btn =
    'px-2.5 h-8 rounded-lg text-xs font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {from}-{to} of {total.toLocaleString()} {label}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="hidden sm:inline">Per page</span>
          <select
            value={limit}
            onChange={(e) => {
              const next = Number(e.target.value);
              onLimitChange(next);
              onOffsetChange(0);
            }}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          >
            {limitOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            className={`${btn} bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750`}
          >
            Prev
          </button>
          {pages.map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-zinc-400 text-xs">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onOffsetChange((p - 1) * limit)}
                aria-current={p === page ? 'page' : undefined}
                className={`${btn} ${
                  p === page
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => onOffsetChange(offset + limit)}
            className={`${btn} bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750`}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export const formatNumber = (n: number | null | undefined): string =>
  typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString() : '0';

export const formatMoney = (n: number | null | undefined, perYear = false): string => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return perYear ? '₦0/yr' : '₦0';
  return `₦${n.toLocaleString('en-NG')}${perYear ? '/yr' : ''}`;
};

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** "3 hours ago" style relative time for audit trails and activity feeds. */
export const timeAgo = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const units: Array<[number, string]> = [
    [60, 'minute'],
    [60, 'hour'],
    [24, 'day'],
    [30, 'month'],
    [12, 'year'],
  ];
  let value = seconds;
  let label = 'second';
  for (const [size, name] of units) {
    if (Math.abs(value) < size) {
      label = name;
      break;
    }
    value = Math.floor(value / size);
    label = name;
  }
  return `${value} ${label}${value === 1 ? '' : 's'} ago`;
};

export const titleCase = (value: string | null | undefined): string => {
  if (!value) return '—';
  const spaced = value.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};
