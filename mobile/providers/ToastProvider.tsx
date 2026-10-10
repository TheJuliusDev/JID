/**
 * Toast provider.
 *
 * A single, app-wide transient message surface. Chosen over `Alert.alert`
 * because native alerts block the UI thread visually, cannot be styled to match
 * JID, and are the wrong affordance for confirmations ("Saved", "Copied",
 * "Boosted") that should not require acknowledgement.
 *
 * Renders above everything, including modals, via a high z-index absolute
 * layer in the root layout.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react-native';
import { useTheme } from './ThemeProvider';
import { GUTTER, radius, shadows, spacing, typography } from '@/constants/theme';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastOptions {
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. Errors linger, so they default longer. */
  duration?: number;
  /** Optional single action, e.g. "Undo" or "View". */
  action?: { label: string; onPress: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: Omit<ToastOptions, 'tone'>) => void;
  error: (message: string, options?: Omit<ToastOptions, 'tone'>) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_GAP = 10;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const clearTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      setItems((current) => current.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = nextId.current;
      nextId.current += 1;

      const tone = options.tone ?? 'info';
      const item: ToastItem = { id, message, ...options, tone };

      // Cap the stack so a burst of errors cannot cover the whole screen.
      setItems((current) => [...current.slice(-2), item]);

      const duration = options.duration ?? (tone === 'error' ? 5000 : 2800);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );

      // Haptics mirror tone: a soft tick for success, a double for errors.
      void Haptics.notificationAsync(
        tone === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : tone === 'error'
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Warning,
      );
    },
    [dismiss],
  );

  const success = useCallback(
    (message: string, options?: Omit<ToastOptions, 'tone'>) =>
      show(message, { ...options, tone: 'success' }),
    [show],
  );

  const error = useCallback(
    (message: string, options?: Omit<ToastOptions, 'tone'>) =>
      show(message, { ...options, tone: 'error' }),
    [show],
  );

  const hide = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setItems([]);
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ show, success, error, hide }),
    [show, success, error, hide],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastLayer items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastLayer({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const { colors } = useTheme();

  if (items.length === 0) return null;

  const toneColor = (tone: ToastTone): string => {
    if (tone === 'success') return colors.success;
    if (tone === 'error') return colors.danger;
    return colors.info;
  };

  const ToneIcon = ({ tone }: { tone: ToastTone }) => {
    if (tone === 'success') return <CheckCircle2 size={18} color={colors.success} />;
    if (tone === 'error') return <TriangleAlert size={18} color={colors.danger} />;
    return <Info size={18} color={colors.info} />;
  };

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {items.map((item) => (
        <ToastRow
          key={item.id}
          item={item}
          accent={toneColor(item.tone ?? 'info')}
          icon={<ToneIcon tone={item.tone ?? 'info'} />}
          background={colors.bgElevated}
          border={colors.border}
          textColor={colors.text}
          onDismiss={() => onDismiss(item.id)}
        />
      ))}
    </View>
  );
}

function ToastRow({
  item,
  icon,
  accent,
  background,
  border,
  textColor,
  onDismiss,
}: {
  item: ToastItem;
  icon: React.ReactNode;
  accent: string;
  background: string;
  border: string;
  textColor: string;
  onDismiss: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.toast,
        shadows.lg,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.body}>
        {icon}
        <Text style={[typography.small, styles.message, { color: textColor }]} numberOfLines={3}>
          {item.message}
        </Text>
        {item.action ? (
          <Pressable
            onPress={() => {
              item.action?.onPress();
              onDismiss();
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={[typography.smallStrong, styles.action, { color: accent }]}>
              {item.action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <X size={16} color={border} />
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return context;
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingBottom: 96, // clears the floating tab bar
    gap: TOAST_GAP,
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: 0,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    marginVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  message: {
    flex: 1,
  },
  action: {
    marginLeft: spacing.xs,
  },
});