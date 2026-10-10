/**
 * The attachment strip above the chat composer.
 *
 * JID sends one photo at a time in chat, so this is a single card rather than a
 * scrolling tray. It covers the whole life cycle of an unsent image: preview,
 * cancel, and — once sent — upload progress with the ability to give up.
 *
 * Cancelling is always available until the upload reaches 100%, because losing
 * a photo the user no longer wants is worse than losing a few seconds of upload.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Loader, X } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';
import type { OptimisticPhoto } from '@/utils/chatPhotos';

export interface AttachmentPreviewProps {
  photo: OptimisticPhoto;
  onCancel: () => void;
}

export function AttachmentPreview({ photo, onCancel }: AttachmentPreviewProps) {
  const { colors } = useTheme();
  const uploading = photo.status === 'uploading';

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]}>
        <Image
          source={{ uri: photo.localUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          accessibilityIgnoresInvertColors
        />

        {uploading ? (
          <>
            <View style={styles.scrim} />
            <View style={styles.centre}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
            <View style={styles.track}>
              {/* Clamped so a reported 1.0 before the response can never overflow. */}
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, Math.round(photo.progress * 100))}%` },
                ]}
              />
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={[typography.smallStrong, { color: colors.text }]} numberOfLines={1}>
          {uploading ? 'Sending photo' : "Couldn't send"}
        </Text>
        <Text
          style={[typography.caption, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {uploading
            ? `${Math.round(photo.progress * 100)}% uploaded`
            : (photo.error ?? 'Tap to try again')}
        </Text>
      </View>

      {uploading ? (
        <ActivityIndicator size="small" color={colors.textSubtle} />
      ) : (
        <Loader size={16} color={colors.textSubtle} />
      )}

      <Pressable
        onPress={onCancel}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={uploading ? 'Cancel sending photo' : 'Remove failed photo'}
        style={[styles.close, { backgroundColor: colors.surfaceAlt }]}
      >
        <X size={15} color={colors.text} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14,13,12,0.4)',
  },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  fill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  body: {
    flex: 1,
    gap: 1,
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});