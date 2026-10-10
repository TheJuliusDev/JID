/**
 * Small, focused hooks used across screens.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  ScrollView,
  type KeyboardEvent as RNKeyboardEvent,
} from 'react-native';

/**
 * Delays propagating a fast-changing value.
 *
 * Drives search-as-you-type. Without this every keystroke fires a PostgREST
 * request, which on a phone uplink means results flicker between states and
 * burn data.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** True while the soft keyboard is visible. */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hideEvent = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      showEvent.remove();
      hideEvent.remove();
    };
  }, []);

  return visible;
}

/**
 * Wraps a callback so its identity is stable forever while always invoking the
 * latest version.
 *
 * This is what lets `DataProvider` expose async handlers that read current auth
 * state without being re-created on every render — otherwise the `useEffect`
 * that loads data on sign-in would tear down and re-run constantly.
 */
export function useStableCallback<Args extends unknown[], R>(
  callback: (...args: Args) => R,
): (...args: Args) => R {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback((...args: Args) => ref.current(...args), []);
}

/**
 * Tracks a chat transcript's scroll position so we only auto-scroll when the
 * user is already at the bottom.
 *
 * Without this, reading scrollback while a new message arrives yanks the view
 * down mid-read.
 */
export function useStickyBottom(): {
  /** Read inside the scroll handler; a ref so reads never re-render. */
  atBottom: React.RefObject<boolean>;
  onScroll: (offset: number, contentHeight: number) => void;
  scrollToBottom: (listRef: React.RefObject<ScrollView | null>, animated?: boolean) => void;
} {
  const atBottom = useRef(true);

  const onScroll = useCallback((offset: number, contentHeight: number) => {
    atBottom.current = contentHeight - offset <= 64;
  }, []);

  const scrollToBottom = useCallback(
    (listRef: React.RefObject<ScrollView | null>, animated = true) => {
      listRef.current?.scrollToEnd({ animated });
      atBottom.current = true;
    },
    [],
  );

  return { atBottom, onScroll, scrollToBottom };
}

/**
 * Copies a value into a ref that also drives state, for use inside event
 * handlers that must read the latest value without re-subscribing.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * Runs an async loader and exposes the four states every data screen needs.
 *
 * Deliberately does not cancel in-flight requests; instead it ignores results
 * from stale runs via a request id, which is the behaviour screens want when a
 * filter changes faster than the network responds.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
  refresh: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runId = useRef(0);
  const mounted = useRef(true);
  const loaderRef = useLatest(loader);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (mode: 'load' | 'refresh') => {
      const id = runId.current + 1;
      runId.current = id;

      if (mode === 'load') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const result = await loaderRef.current();
        // A newer run started while this one was in flight; its result wins.
        if (!mounted.current || runId.current !== id) return;
        setData(result);
      } catch (err) {
        if (!mounted.current || runId.current !== id) return;
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        if (mounted.current && runId.current === id) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaderRef],
  );

  useEffect(() => {
    void run('load');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => {
    void run('load');
  }, [run]);

  const refresh = useCallback(() => {
    void run('refresh');
  }, [run]);

  return { data, loading, refreshing, error, reload, refresh, setData };
}

/** Fires once after the first render — useful for "navigate after mount". */
export function useAfterMount(effect: () => void): void {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Routes the Android hardware back button to `onDismiss` while `open`.
 *
 * ## Why this exists at all
 *
 * A sheet or menu rendered as a sibling rather than a route gets no automatic back
 * handling: the hardware back is delivered to the navigator, which pops the whole
 * screen *behind* the overlay. The user taps a filter, presses back to close it,
 * and loses their place on the browse screen instead — the overlay stays open on a
 * screen that has already navigated away.
 *
 * Returning `true` marks the event handled, which suppresses that navigator
 * behaviour and lets the overlay close instead. When the overlay is closed the hook
 * registers nothing at all, so back keeps its normal meaning on that screen.
 *
 * ## Stacking
 *
 * Only the most recently mounted *open* handler wins, because
 * `BackHandler.addEventListener` runs subscriptions in reverse registration order.
 * That is what makes a menu opened from inside a sheet dismiss the menu first,
 * leaving the sheet — the correct order, and the one users expect from Android.
 *
 * ## iOS
 *
 * A no-op by design. iOS has no hardware back; swipe-back from the edge is the
 * platform's own gesture and is handled by the navigator. Claiming it here would
 * break it.
 */
export function useDismissable(open: boolean, onDismiss: () => void): void {
  // The handler must always see the latest `onDismiss` without re-registering;
  // re-registering on every render would churn the subscription list.
  const handler = useLatest(onDismiss);

  useEffect(() => {
    if (!open) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handler.current();
      return true;
    });
    return () => subscription.remove();
  }, [open, handler]);
}