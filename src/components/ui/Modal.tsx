/**
 * The app's modal / bottom-sheet shell.
 *
 * Everything temporary and centred uses this: sign-in, listing details, posting
 * a listing, boosting, reporting, chat reports. Beyond the visuals it also
 * guarantees the behaviour users expect from any overlay, which is the part
 * that is easy to get subtly wrong per-component:
 *
 *   - Click the dimmed background to dismiss; clicking the panel does not.
 *   - Escape dismisses on desktop, and never closes two layers at once.
 *   - Background scrolling stops and is restored exactly as it was, including
 *     when overlays are stacked.
 *   - The dialog animates out instead of vanishing.
 *   - Focus moves into the dialog and returns to whatever opened it.
 *
 * Dismissal itself lives in `useDismiss`: this shell only decides whether the
 * surface is dismissable, so a background tap, an Escape key and the built-in
 * close button all take the same path.
 *
 * It renders through a portal so a `backdrop-filter` ancestor (the sticky
 * header) cannot trap the fixed positioning and collapse the dialog.
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useDismiss } from './useDismiss';

export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Accessible name. Use `ariaLabel`, or `ariaLabelledBy` pointing at a heading. */
  ariaLabel?: string;
  ariaLabelledBy?: string;
  size?: ModalSize;
  /**
   * How the dialog is framed. `sheet` fills the bottom of a phone screen and
   * becomes a centred card from `sm` up; `dialog` is centred at every width.
   */
  variant?: 'dialog' | 'sheet';
  /** Set false for a form where a stray background tap would lose input. */
  dismissOnOutside?: boolean;
  /** Set false for a transient surface that should not freeze the page. */
  lockScroll?: boolean;
  /** Elements that count as "inside" for outside-tap detection. */
  ignoreRefs?: Array<React.RefObject<HTMLElement | null> | null | undefined>;
  /** Renders the built-in close affordance in the panel's top-right. */
  showCloseButton?: boolean;
  closeLabel?: string;
  /** Extra classes on the scroll container / panel. */
  className?: string;
  panelClassName?: string;
  /**
   * Wrap children in the panel's own scroll container. True by default, which is
   * what keeps long content scrollable while the page behind stays locked. Set
   * false for dialogs that lay themselves out edge to edge (split hero + form)
   * and manage their own overflow.
   */
  scrollBody?: boolean;
  /** Darker scrim for image-heavy contexts. */
  scrimClassName?: string;
}

const SIZES: Record<ModalSize, string> = {
  xs: 'sm:max-w-xs',
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-5xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  size = 'md',
  variant = 'dialog',
  dismissOnOutside = true,
  lockScroll = true,
  ignoreRefs,
  showCloseButton = false,
  closeLabel = 'Close',
  className = '',
  panelClassName = '',
  scrollBody = true,
  scrimClassName = '',
}) => {
  const reduceMotion = useReducedMotion();
  const dismissable = open && dismissOnOutside;

  const panelRef = useDismiss<HTMLDivElement>({
    active: dismissable,
    onDismiss: onClose,
    escape: open,
    lockScroll: open && lockScroll,
    extraInsideRefs: ignoreRefs,
  });

  // Move focus into the dialog and hand it back on close, so keyboard and
  // screen-reader users are not left on a detached element.
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const raf = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector<HTMLElement>('[data-modal-autofocus]');
      (target ?? panel).focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(raf);
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, panelRef]);

  const enter = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 26, scale: 0.985 };
  const settle = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1 };
  const exit = reduceMotion
    ? { opacity: 0, transition: { duration: 0.08 } }
    : {
        opacity: 0,
        y: 12,
        scale: 0.99,
        transition: { duration: 0.16, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
      };

  const isSheet = variant === 'sheet';

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 z-50 flex justify-center ${
            isSheet
              ? 'items-end sm:items-center p-0 sm:p-4 sm:p-6'
              : 'items-center p-4 sm:p-6 overflow-y-auto'
          }`}
        >
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.08 : 0.2 }}
            className={`absolute inset-0 bg-zinc-950/60 backdrop-blur-sm ${
              dismissOnOutside ? 'cursor-pointer' : ''
            } ${scrimClassName}`}
            aria-hidden="true"
          />

          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabelledBy ? undefined : ariaLabel}
            aria-labelledby={ariaLabelledBy}
            tabIndex={-1}
            initial={enter}
            animate={settle}
            exit={exit}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }
            }
            onClick={(e) => e.stopPropagation()}
            className={[
              'relative w-full outline-none',
              isSheet
                ? 'max-h-[92dvh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl'
                : 'my-auto max-h-[92dvh] rounded-3xl',
              SIZES[size],
              'jid-glass-strong jid-glass-edge shadow-2xl',
              'overflow-hidden flex flex-col',
              panelClassName,
            ].join(' ')}
          >
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="absolute top-3 right-3 z-30 p-2 -mr-1 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {scrollBody ? (
              <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${className}`}>
                {children}
              </div>
            ) : (
              <>{children}</>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
