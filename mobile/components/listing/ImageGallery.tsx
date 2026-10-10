/**
 * Listing image gallery.
 *
 * A paged `FlatList` of `expo-image` rather than a gallery dependency: the
 * whole interaction needed here is a horizontal pager plus a full-screen viewer,
 * and hand-rolling it keeps `expo-image`'s disk caching and blurhash-free
 * progressive loading instead of routing every image through another library.
 *
 * The first image is used as the pager's `initialScrollIndex`, so opening the
 * listing lands on the cover shot.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { cloudinaryTiny } from '@/utils/format';

export interface ImageGalleryProps {
  images: string[];
  /** Height of the inline pager. Defaults to a 4:3 frame. */
  height?: number;
  /** Title shown in the full-screen viewer. */
  title?: string;
}

export function ImageGallery({ images, height, title }: ImageGalleryProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const listRef = useRef<FlatList<string>>(null);

  const frameHeight = height ?? Math.round((width * 3) / 4);

  // Nothing to show: the caller decides whether that is an error or expected.
  if (images.length === 0) return null;

  const openViewer = useCallback((at: number) => {
    setIndex(at);
    setViewerOpen(true);
  }, []);

  const paginateWidth = useMemo(() => width, [width]);

  return (
    <>
      <Pressable
        onPress={() => openViewer(index)}
        accessibilityRole="imagebutton"
        accessibilityLabel={
          images.length > 1
            ? `Photo ${index + 1} of ${images.length}. Tap to view full screen.`
            : 'Listing photo. Tap to view full screen.'
        }
      >
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          horizontal
          pagingEnabled
          // Paging maths needs the real on-screen width, not the scroll offset,
          // because the list is not full-bleed when it sits inside a card.
          getItemLayout={(_, i) => ({ length: paginateWidth, offset: paginateWidth * i, index: i })}
          initialScrollIndex={0}
          showsHorizontalScrollIndicator={false}
          style={{ width }}
          onMomentumScrollEnd={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / paginateWidth);
            setIndex(Math.max(0, Math.min(images.length - 1, next)));
          }}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={{ width: paginateWidth, height: frameHeight }}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              placeholder={cloudinaryTiny(item)}
              placeholderContentFit="cover"
              accessibilityIgnoresInvertColors
            />
          )}
        />
      </Pressable>

      {/* Page dots. Hidden for a single image — the counter would be noise. */}
      {images.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {images.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? colors.bg : 'transparent',
                  borderColor: i === index ? colors.bg : colors.text,
                  opacity: i === index ? 0.95 : 0.55,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      <Modal
        visible={viewerOpen}
        animationType="fade"
        // Full-screen imagery needs to own the whole window, status bar included.
        statusBarTranslucent
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={[styles.viewer, { backgroundColor: colors.bg }]}>
          <FlatList
            data={images}
            keyExtractor={(uri, i) => `${uri}-${i}`}
            horizontal
            pagingEnabled
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setIndex(Math.max(0, Math.min(images.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))));
            }}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item }}
                style={{ width, height: '100%' }}
                contentFit="contain"
                cachePolicy="memory-disk"
                placeholder={cloudinaryTiny(item)}
                placeholderContentFit="contain"
                accessibilityIgnoresInvertColors
              />
            )}
          />

          <Pressable
            onPress={() => setViewerOpen(false)}
            hitSlop={12}
            style={[styles.close, { top: insets.top + spacing.sm }]}
            accessibilityRole="button"
            accessibilityLabel="Close full screen photo"
          >
            <View style={[styles.closeInner, { backgroundColor: colors.surfaceAlt }]}>
              <X size={20} color={colors.text} />
            </View>
          </Pressable>

          {title ? (
            <Text
              numberOfLines={1}
              style={[
                typography.small,
                styles.viewerTitle,
                { bottom: insets.bottom + spacing.md, color: colors.text },
              ]}
            >
              {title}
            </Text>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  viewer: {
    flex: 1,
  },
  close: {
    position: 'absolute',
    left: spacing.base,
  },
  closeInner: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerTitle: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    textAlign: 'center',
  },
});