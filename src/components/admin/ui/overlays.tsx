/**
 * Overlays for the JID admin console: modal, side drawer, confirmation dialog
 * and the toast stack.
 *
 * Every destructive action in the console goes through `ConfirmDialog`, which
 * can additionally require a written reason and/or a typed confirmation phrase.
 * The reason is not decoration — it is stored in `admin_audit_log.details`, so
 * the moderation trail always explains why something was removed.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminButton, TextArea } from './primitives';

// Close on Escape and lock background scroll while an overlay is open.
function useOverlayBehaviour(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
}

/** Blocks page scroll while `locked` (mobile nav, sidebar drawer). */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export const AdminModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}> = ({ open, onClose, title, description, children, footer, width = 'md' }) => {
  useOverlayBehaviour(open, onClose);
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px] dark:bg-black/60"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className={`relative w-full ${widths[width]} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-zinc-950/30 max-h-[92vh] flex flex-col`}
          >
            <header className="flex items-start justify-between gap-4 p-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="min-w-0">
                <h3 className="font-display text-base font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                  {title}
                </h3>
                {description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 -mr-1.5 -mt-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            {children && <div className="p-5 overflow-y-auto flex-1">{children}</div>}
            {footer && (
              <footer className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2 shrink-0 bg-zinc-50/60 dark:bg-zinc-900/60 rounded-b-3xl sm:rounded-b-2xl">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// Drawer (side panel for record details)
// ---------------------------------------------------------------------------

export const AdminDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children, footer }) => {
  useOverlayBehaviour(open, onClose);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px] dark:bg-black/60"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="relative w-full sm:max-w-xl bg-sand-50 dark:bg-charcoal-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
          >
            <header className="flex items-start justify-between gap-4 p-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
              <div className="min-w-0">
                <h3 className="font-display text-base font-black text-zinc-900 dark:text-zinc-50 tracking-tight truncate">
                  {title}
                </h3>
                {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="p-1.5 -mr-1.5 -mt-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
            {footer && (
              <footer className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-end gap-2 shrink-0">
                {footer}
              </footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

export type ConfirmTone = 'danger' | 'warn' | 'primary';

const CONFIRM_TONES: Record<ConfirmTone, { icon: LucideIcon; chip: string; button: 'danger' | 'warn' | 'primary' }> = {
  danger: { icon: ShieldAlert, chip: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400', button: 'danger' },
  warn: { icon: AlertTriangle, chip: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400', button: 'warn' },
  primary: { icon: Info, chip: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400', button: 'primary' },
};

export interface ConfirmRequest {
  tone: ConfirmTone;
  title: string;
  description: string;
  confirmLabel: string;
  /** When set, the operator must type this exact string to enable the button. */
  typeToConfirm?: string;
  /** When true, a reason must be written (it is stored in the audit log). */
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Extra facts rendered as a compact list, e.g. what will be affected. */
  facts?: Array<{ label: string; value: string }>;
  onConfirm: (reason: string) => Promise<void> | void;
}

export const ConfirmDialog: React.FC<{ request: ConfirmRequest | null; onClose: () => void }> = ({
  request,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever a new confirmation is raised.
  useEffect(() => {
    setReason('');
    setTyped('');
    setBusy(false);
    setError(null);
  }, [request]);

  const close = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  if (!request) return null;

  const tone = CONFIRM_TONES[request.tone];
  const Icon = tone.icon;
  const typedOk = !request.typeToConfirm || typed.trim().toUpperCase() === request.typeToConfirm.toUpperCase();
  const reasonOk = !request.requireReason || reason.trim().length > 0;
  const canConfirm = typedOk && reasonOk && !busy;

  const submit = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await request.onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'The action could not be completed.');
      setBusy(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={close}
          className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px] dark:bg-black/70"
        />
        <motion.div
          role="alertdialog"
          aria-modal="true"
          aria-label={request.title}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-zinc-950/40 max-h-[92vh] flex flex-col"
        >
          <div className="p-5 overflow-y-auto">
            <div className="flex items-start gap-3.5">
              <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${tone.chip}`}>
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                  {request.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  {request.description}
                </p>
              </div>
            </div>

            {request.facts && request.facts.length > 0 && (
              <dl className="mt-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                {request.facts.map((fact) => (
                  <div key={fact.label} className="flex items-center justify-between gap-3 px-3.5 py-2">
                    <dt className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{fact.label}</dt>
                    <dd className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 text-right truncate max-w-[60%]">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {request.requireReason && (
              <div className="mt-4">
                <TextArea
                  label={request.reasonLabel || 'Reason (recorded in the audit log)'}
                  value={reason}
                  onChange={setReason}
                  rows={3}
                  placeholder={request.reasonPlaceholder || 'Explain why this is being done…'}
                />
              </div>
            )}

            {request.typeToConfirm && (
              <div className="mt-4">
                <TextArea
                  label={`Type ${request.typeToConfirm} to confirm`}
                  value={typed}
                  onChange={setTyped}
                  rows={1}
                  placeholder={request.typeToConfirm}
                />
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400">
                {error}
              </p>
            )}
          </div>

          <footer className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2 shrink-0 bg-zinc-50/60 dark:bg-zinc-900/60 rounded-b-3xl sm:rounded-b-2xl">
            <AdminButton size="md" onClick={close} disabled={busy}>
              Cancel
            </AdminButton>
            <AdminButton
              size="md"
              variant={tone.button}
              onClick={submit}
              disabled={!canConfirm}
              loading={busy}
            >
              {request.confirmLabel}
            </AdminButton>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export type ToastTone = 'success' | 'error' | 'info';

export interface AdminToast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

const TOAST_TONES: Record<ToastTone, { icon: LucideIcon; chip: string }> = {
  success: { icon: CheckCircle2, chip: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400' },
  error: { icon: XCircle, chip: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' },
  info: { icon: Info, chip: 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400' },
};

export const Toaster: React.FC<{ toasts: AdminToast[]; onDismiss: (id: number) => void }> = ({
  toasts,
  onDismiss,
}) => (
  <div className="fixed bottom-4 right-4 z-[120] w-[calc(100vw-2rem)] max-w-sm space-y-2 pointer-events-none">
    <AnimatePresence initial={false}>
      {toasts.map((toast) => {
        const tone = TOAST_TONES[toast.tone];
        const Icon = tone.icon;
        return (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            role="status"
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl shadow-zinc-950/10"
          >
            <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${tone.chip}`}>
              <Icon className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{toast.title}</p>
              {toast.message && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed break-words">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss"
              className="p-1 -mr-0.5 -mt-0.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);

/** Toast queue used by every admin page. */
export function useToasts() {
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, message?: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, tone, title, message }]);
      const timer = window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 5000);
      timers.current.push(timer);
    },
    [dismiss]
  );

  return {
    toasts,
    dismiss,
    success: (title: string, message?: string) => push('success', title, message),
    error: (title: string, message?: string) => push('error', title, message),
    info: (title: string, message?: string) => push('info', title, message),
  };
}

export type UseToasts = ReturnType<typeof useToasts>;
