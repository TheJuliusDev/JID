/**
 * Full-screen photo viewer.
 *
 * Zoom is built directly on `GestureDetector` from react-native-gesture-handler
 * plus Reanimated shared values rather than pulled in as a dependency. Two
 * gestures cover what people actually do: pinch, and double-tap to toggle
 * between fit and a comfortable 2.5x. Pan is clamped to the scaled frame so the
 * photo can never be dragged off-screen.
 *
 * Everything runs on the UI thread, so the transform keeps tracking while the
 * full-resolution image is still decoding — which matters on the mid-range
 * Android this app targets.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { cloudinaryTiny } from '@/utils/format';

const DOUBLE_TAP_SCALE = 2.5;
const MAX_SCALE = 4;
const ZOOMED = 1.05;

export interface PhotoViewerProps {
  visible: boolean;
  /** URLs to page through. */
  images: string[];
  /** Starting position. */
  index?: number;
  onClose: () => void;
  /** Optional caption pinned to the bottom. */
  caption?: string;
  /** Fired as the user pages, so the caller can keep its own index in step. */
  onIndexChange?: (index: number) => void;
}

/** How far a scaled image may travel on one axis before its edge shows. */
const overflowFor = (scale: number, dimension: number): number =>
  Math.max(0, ((scale - 1) * dimension) / 2);

/** Fades chrome out while zoomed in; `invert` fades it back when zoomed. */
function useChromeFade(scale: SharedValue<number>, invert = false) {
  return useAnimatedStyle(() => {
    const hidden = scale.value > ZOOMED ? 0 : 1;
    return { opacity: withTiming(invert ? 1 - hidden : hidden, { duration: 180 }) };
  });
}

export function PhotoViewer({
  visible,
  images,
  index = 0,
  onClose,
  caption,
  onIndexChange,
}: PhotoViewerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset zoom when the viewer closes, otherwise the next photo opens already
  // pinched out from the last one.
  useEffect(() => {
    if (visible) return;
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [visible, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  const pagerRef = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(index);

  // Follow the caller when it opens the viewer at a new position (a chat thread
  // typically opens at whichever photo was tapped).
  useEffect(() => {
    if (!visible) return;
    setCurrent(index);
    if (pagerRef.current) {
      pagerRef.current.scrollTo({ x: index * width, animated: false });
    }
  }, [visible, index, width]);

  const resetZoom = useCallback(() => {
    'worklet';
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
    savedScale.value = 1;
    translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  const pan = Gesture.Pan()
    .minDistance(8)
    .onUpdate((event) => {
      // Below 1x the pager owns horizontal drags, so we ignore them entirely.
      if (scale.value <= 1) return;
      const limitX = overflowFor(scale.value, width);
      const limitY = overflowFor(scale.value, height);
      const nextX = savedTranslateX.value + event.translationX;
      const nextY = savedTranslateY.value + event.translationY;
      translateX.value = Math.min(limitX, Math.max(-limitX, nextX));
      translateY.value = Math.min(limitY, Math.max(-limitY, nextY));
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = Math.min(MAX_SCALE, Math.max(1, savedScale.value * event.scale));
      scale.value = next;
      // Recentring on the way back to fit stops a photo ending up half off-screen.
      if (next === 1) {
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) {
        resetZoom();
        return;
      }
      // Settle back inside the bounds in case the lift ended out past an edge.
      const limitX = overflowFor(scale.value, width);
      const limitY = overflowFor(scale.value, height);
      translateX.value = withSpring(
        Math.min(limitX, Math.max(-limitX, translateX.value)),
      );
      translateY.value = withSpring(
        Math.min(limitY, Math.max(-limitY, translateY.value)),
      );
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      if (scale.value > ZOOMED) {
        resetZoom();
        return;
      }
      scale.value = withSpring(DOUBLE_TAP_SCALE, { damping: 18, stiffness: 220 });
      savedScale.value = DOUBLE_TAP_SCALE;
    });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const topBarStyle = useChromeFade(scale);
  const captionStyle = useChromeFade(scale);

  // Zoomed in: the pager must not steal horizontal drags.
  const zoomed = useZoomedState(scale);

  if (images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      // Full-screen imagery owns the whole window, status bar included.
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.heroTo }]}>
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
          <Animated.View style={[styles.pager, imageStyle]}>
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              scrollEnabled={!zoomed}
              showsHorizontalScrollIndicator={false}
              // A translucent scrim keeps the photo legible under the chrome.
              style={styles.pagerInner}
              onMomentumScrollEnd={(event) => {
                const next = Math.round(
                  event.nativeEvent.contentOffset.x / Math.max(width, 1),
                );
                const clamped = Math.max(0, Math.min(images.length - 1, next));
                setCurrent(clamped);
                onIndexChange?.(clamped);
              }}
            >
              {images.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={{ width, height }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={120}
                  placeholder={cloudinaryTiny(uri)}
                  placeholderContentFit="contain"
                  accessibilityIgnoresInvertColors
                />
              ))}
            </ScrollView>
          </Animated.View>
        </GestureDetector>

        <Animated.View
          style={[
            styles.topBar,
            {
              top: insets.top + spacing.sm,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.sm,
            },
            topBarStyle,
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={[styles.circle, { backgroundColor: 'rgba(20,20,20,0.55)' }]}
            accessibilityRole="button"
            accessibilityLabel="Close full screen photo"
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>

          {images.length > 1 ? (
            <View style={[styles.counter, { backgroundColor: 'rgba(20,20,20,0.55)' }]}>
              <Text style={[typography.caption, styles.counterText]}>
                {current + 1} / {images.length}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {caption ? (
          <Animated.View
            style={[
              styles.captionWrap,
              { bottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.base },
              captionStyle,
            ]}
            pointerEvents="none"
          >
            <View style={styles.caption}>
              <Text style={[typography.small, { color: '#FFFFFF' }]} numberOfLines={2}>
                {caption}
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * Mirrors the shared scale into React state.
 *
 * The only thing that has to cross to JS is "are we zoomed", because that
 * decides whether the horizontal pager stays scrollable — a prop a worklet
 * cannot read directly. Crossing on a threshold rather than every frame keeps
 * this to one JS call per zoom gesture instead of one per frame.
 */
function useZoomedState(scale: SharedValue<number>): boolean {
  const [zoomed, setZoomed] = useState(false);

  useAnimatedReaction(
    () => scale.value > 1.02,
    (isZoomed, wasZoomed) => {
      if (isZoomed !== wasZoomed) runOnJS(setZoomed)(isZoomed);
    },
    [setZoomed],
  );

  return zoomed;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  pagerInner: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  counterText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  captionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  caption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(20,20,20,0.55)',
  },
});