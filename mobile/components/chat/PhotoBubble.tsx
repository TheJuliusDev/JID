/**
 * The photo bubble used in the chat transcript.
 *
 * Handles both halves of an image message's life cycle:
 *
 *  - **Confirmed** — a Cloudinary URL, rendered through a thumbnail
 *    transformation so a chat full of photos does not pull multi-megabyte
 *    originals onto a phone data plan, tappable to open the full-screen viewer.
 *  - **In flight** — a local file URI from the picker, dimmed under a progress
 *    ring, or an explicit retry affordance if the upload failed.
 *
 * The pending state deliberately keeps the image visible. A blank grey box with
 * a spinner reads as "broken"; the real photo with a subtle scrim reads as
 * "sending", which is what is actually happening.
 */
import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { cloudinaryThumb, cloudinaryTiny } from '@/utils/format';
import { RefreshCw, TriangleAlert } from 'lucide-react-native';

export interface PhotoBubbleProps {
  /** Cloudinary URL, or a local file URI while the upload is in flight. */
  uri: string;
  /** True while uploading or after a failure. */
  pending: boolean;
  /** 0..1 while uploading. */
  progress: number;
  /** Failure detail; when present the bubble offers a retry. */
  error?: string;
  onPress: () => void;
  onRetry?: () => void;
  /** Prevents opening the viewer for a photo that has no remote copy yet. */
  canOpen?: boolean;
  /** Rendered under the image inside the bubble (timestamp, read receipt). */
  footer?: React.ReactNode;
  accessibilityLabel?: string;
}

/**
 * Fixed 4:5 portrait frame — tall enough for a room photo to read clearly in a
 * thread, but still narrow enough that text bubbles beside it stay readable.
 */
const ASPECT_RATIO = 4 / 5;

function PhotoBubbleComponent({
  uri,
  pending,
  progress,
  error,
  onPress,
  onRetry,
  canOpen = true,
  footer,
  accessibilityLabel,
}: PhotoBubbleProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.bubble}>
      <Pressable
        onPress={canOpen ? onPress : undefined}
        disabled={!canOpen}
        accessibilityRole={canOpen ? 'imagebutton' : 'image'}
        accessibilityLabel={
          accessibilityLabel ??
          (pending ? 'Photo sending' : error ? 'Photo failed to send' : 'Photo. Tap to view full screen.')
        }
        style={[styles.frame, { backgroundColor: colors.surfaceAlt }]}
      >
        <Image
          source={{ uri: chatThumbUrl(uri) }}
          style={styles.image}
          contentFit="cover"
          transition={pending ? 0 : 160}
          cachePolicy="memory-disk"
          // Only remote images have a Cloudinary URL to derive a blur-up from.
          placeholder={pending ? undefined : cloudinaryTiny(uri)}
          placeholderContentFit="cover"
          accessibilityIgnoresInvertColors
        />

        {pending ? (
          // Dim rather than hide: the user recognises what they sent, so the
          // pending state reads as "on its way" instead of "failed".
          <View style={[styles.scrim, { backgroundColor: 'rgba(14,13,12,0.42)' }]}>
            <View style={styles.progressWrap}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={[typography.caption, styles.progressText]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.scrim, { backgroundColor: 'rgba(14,13,12,0.55)' }]}>
            <TriangleAlert size={22} color="#FFFFFF" />
            <Text style={[typography.caption, styles.errorText]} numberOfLines={2}>
              {error}
            </Text>
            {onRetry ? (
              <Pressable
                onPress={onRetry}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Retry sending photo"
                style={[styles.retry, { backgroundColor: 'rgba(255,255,255,0.18)' }]}
              >
                <RefreshCw size={13} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={[typography.caption, styles.retryText]}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      {footer}
    </View>
  );
}

export const PhotoBubble = memo(PhotoBubbleComponent);

/** Builds the compact URL a chat thumbnail should request. */
export const chatThumbUrl = (url: string): string => cloudinaryThumb(url, 520);

/** True when the asset has a remote copy the viewer can open. */
export const isRemote = (uri: string): boolean => /^https?:\/\//.test(uri);

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '74%',
  },
  frame: {
    width: 216,
    aspectRatio: ASPECT_RATIO,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  track: {
    width: '72%',
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});