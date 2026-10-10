/**
 * One dismissal model for every temporary surface in the app.
 *
 * Modals, sheets, dropdowns, filter panels, action sheets, popovers and the
 * image viewer are all "overlays": things that appear over the page and must be
 * easy to leave again. Historically each one re-implemented Escape handling,
 * click-outside and scroll locking on its own, so some trapped the user (a
 * notifications panel that nothing could dismiss) and others fought over
 * `document.body.style.overflow`.
 *
 * This module owns all three concerns:
 *
 *   1. **Escape** closes the topmost overlay, and only the topmost.
 *   2. **Click / tap outside** closes the topmost overlay, unless the pointer
 *      landed inside it or inside a trigger it belongs to.
 *   3. **Background scrolling** is locked with a reference count, so nested
 *      overlays can never restore the page to a scrollable state early.
 *
 * The "topmost only" rule is what makes nesting safe: dismissing a sheet opened
 * from inside a modal closes just the sheet, and the modal underneath is
 * untouched.
 */

import { useEffect, useRef } from 'react';

type DismissFn = () => void;

interface Registration {
  onDismiss: DismissFn;
  /** The panel itself. A pointer inside it must not dismiss it. */
  inside: React.RefObject<HTMLElement | null> | null;
  /** Triggers (a bell button, a menu button) that belong to the overlay. */
  extraInside: Array<React.RefObject<HTMLElement | null>>;
  /** Set false for surfaces a stray Escape should never close. */
  escape: boolean;
  /** Set false for inline surfaces that respond to Escape but not to outside taps. */
  outside: boolean;
}

const registry = new Map<number, Registration>();

/** Registration ids, oldest first. The last entry is the topmost overlay. */
const stack: number[] = [];

let nextId = 1;
let listening = false;

function topmost(): Registration | null {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const found = registry.get(stack[i]);
    if (found) return found;
  }
  return null;
}

function containsPoint(reg: Registration, target: Node): boolean {
  if (reg.inside?.current?.contains(target)) return true;
  return reg.extraInside.some((ref) => ref.current?.contains(target));
}

/**
 * Fires on `pointerdown` rather than `click` so a drag that starts inside a
 * panel and ends outside it still counts as "dismissed" — the gesture the user
 * actually made. Bubble phase (not capture) means React's own handlers have
 * already run, so a trigger that toggles itself does not get closed by the
 * same interaction that opened it.
 */
function handlePointerDown(event: PointerEvent) {
  const reg = topmost();
  if (!reg || !reg.outside) return;
  const target = event.target as Node | null;
  if (target && containsPoint(reg, target)) return;
  reg.onDismiss();
}

/**
 * Capture phase, so the topmost overlay claims Escape before any nested
 * listener can act on it a second time.
 */
function handleKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  const reg = topmost();
  if (!reg || !reg.escape) return;
  event.stopPropagation();
  event.preventDefault();
  reg.onDismiss();
}

function ensureListening() {
  if (listening) return;
  listening = true;
  document.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('keydown', handleKeyDown, true);
}

export interface UseDismissOptions {
  /** Only listen while true. */
  active: boolean;
  onDismiss: DismissFn;
  /** Panel element. A pointer inside it must not dismiss it. */
  insideRef?: React.RefObject<HTMLElement | null>;
  /** Triggers that should read as "inside", e.g. the button opening a panel. */
  extraInsideRefs?: Array<React.RefObject<HTMLElement | null> | null | undefined>;
  /** Set false to make the surface Escape-proof. Defaults to true. */
  escape?: boolean;
  /** Set false so only Escape closes it. Defaults to true. */
  outside?: boolean;
  /** Lock background scrolling while active. Defaults to false. */
  lockScroll?: boolean;
}

/**
 * Registers an overlay for the lifetime of `active`.
 *
 * Returns the ref to put on the panel. Ordering is mount order, so an overlay
 * mounted later (a sheet opened from a modal) is automatically the topmost and
 * gets the next Escape / outside tap.
 */
export function useDismiss<T extends HTMLElement = HTMLElement>({
  active,
  onDismiss,
  insideRef,
  extraInsideRefs,
  escape = true,
  outside = true,
  lockScroll = false,
}: UseDismissOptions): React.RefObject<T | null> {
  const fallbackRef = useRef<T | null>(null);
  const panelRef = (insideRef ?? fallbackRef) as React.RefObject<T | null>;

  // Kept in a ref so re-renders never re-register the overlay, which would
  // move it to the top of the stack and make a parent swallow its child's
  // dismissal.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const extraRef = useRef(extraInsideRefs);
  extraRef.current = extraInsideRefs;
  const outsideRef = useRef(outside);
  outsideRef.current = outside;

  useScrollLock(active && lockScroll);

  useEffect(() => {
    if (!active) return;
    ensureListening();

    const id = nextId++;
    registry.set(id, {
      onDismiss: () => onDismissRef.current(),
      inside: panelRef,
      extraInside: (extraRef.current ?? []).filter(Boolean) as Array<React.RefObject<HTMLElement | null>>,
      escape,
      outside: outsideRef.current,
    });
    stack.push(id);

    return () => {
      const at = stack.indexOf(id);
      if (at !== -1) stack.splice(at, 1);
      registry.delete(id);
    };
    // `escape` is a stable boolean per call site; re-registering on it would be
    // a behaviour change, which is exactly when re-registration is wanted.
  }, [active, panelRef, escape]);

  return panelRef;
}

// ---------------------------------------------------------------------------
// Background scroll lock
// ---------------------------------------------------------------------------

let lockCount = 0;
let previousOverflow: string | null = null;
let previousPaddingRight: string | null = null;

/**
 * Freezes page scrolling while `locked`, reference counted so overlapping
 * overlays cannot unlock each other. Always restores the value that was there
 * before the first lock, so a modal opened from a scroll-locked sheet leaves the
 * page exactly as it found it.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const body = document.body;
    const html = document.documentElement;

    if (lockCount === 0) {
      previousOverflow = body.style.overflow;
      previousPaddingRight = body.style.paddingRight;

      // Hiding the scrollbar would otherwise narrow the page and shift every
      // centred overlay sideways as it opens.
      const gap = window.innerWidth - html.clientWidth;
      body.style.overflow = 'hidden';
      if (gap > 0) body.style.paddingRight = `${gap}px`;
      html.classList.add('jid-scroll-locked');
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount > 0) return;
      body.style.overflow = previousOverflow ?? '';
      body.style.paddingRight = previousPaddingRight ?? '';
      previousOverflow = null;
      previousPaddingRight = null;
      html.classList.remove('jid-scroll-locked');
    };
  }, [locked]);
}
