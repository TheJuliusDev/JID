/**
 * Anchored popover panel — dropdowns, notification trays, account menus.
 *
 * Shares the dismissal layer with `Modal` (see `useDismiss`), so a dropdown
 * behaves the same way as a dialog: the background tap closes it, Escape closes
 * it, and closing one that was opened from a modal does not close the modal.
 *
 * The wrapper element is what counts as "inside", which is what makes the
 * trigger behave correctly: tapping the button that opened the panel is handled
 * by the button (it toggles), not by the dismissal layer (which would also fire
 * and cancel the toggle out).
 */

import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useDismiss } from './useDismiss';

interface DropdownProps {
  open: boolean;
  onClose: () => void;
  /** The control that opens the panel. */
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  /** Width class for the panel, e.g. `w-64` or `w-80 sm:w-96`. */
  width?: string;
  /** Gap between trigger and panel, e.g. `mt-2`. */
  offset?: string;
  label?: string;
  /** Move focus into the panel when it opens. Defaults to true. */
  autoFocus?: boolean;
  /** Freeze the page behind the panel. Defaults to false. */
  lockScroll?: boolean;
  /** Use the heavier glass surface. Defaults to true. */
  glass?: boolean;
  panelClassName?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  open,
  onClose,
  trigger,
  children,
  align = 'right',
  width = 'w-64',
  offset = 'mt-2',
  label,
  autoFocus = true,
  lockScroll = false,
  glass = true,
  panelClassName = '',
}) => {
  const reduceMotion = useReducedMotion();

  const wrapperRef = useDismiss<HTMLDivElement>({
    active: open,
    onDismiss: onClose,
    lockScroll: open && lockScroll,
  });

  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || !autoFocus) return;
    const raf = window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(raf);
  }, [open, autoFocus]);

  return (
    <div className="relative" ref={wrapperRef}>
      {trigger}

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0.08 } }
                : {
                    opacity: 0,
                    y: -4,
                    scale: 0.98,
                    transition: { duration: 0.13, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: 'spring', stiffness: 460, damping: 32, mass: 0.8 }
            }
            style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
            className={[
              'absolute z-50 outline-none',
              align === 'right' ? 'right-0' : 'left-0',
              offset,
              width,
              glass ? 'jid-glass jid-glass-edge' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800',
              'rounded-2xl p-2',
              panelClassName,
            ].join(' ')}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
