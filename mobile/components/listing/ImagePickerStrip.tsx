/**
 * Listing image picker.
 *
 * Photos are uploaded the moment they are added rather than at submit time.
 * Two reasons: a five-photo upload can take a while, and a form that silently
 * loses everything if you leave the screen mid-upload is a bad trade for the
 * seconds saved.
 *
 * Because the images already exist in Cloudinary by the time the form is
 * submitted, editing is a plain array of URLs — no upload state is carried in
 * the saved listing, and removing a photo here just drops its URL.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Camera, X } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_BYTES,
  pickImages,
  uploadMany,
} from '@/services/cloudinary';
import { humanizeError } from '@/services/supabase';
import { cloudinaryTiny } from '@/utils/format';
import { radius, spacing, typography } from '@/constants/theme';
import { ProgressBar } from '@/components/ui/Controls';

export interface ImagePickerStripProps {
  images: string[];
  onChange: (images: string[]) => void;
  /** Cloudinary folder tag, e.g. `marketplace/<id>`. */
  folder: string;
  /** Whether at least one photo is required. Mirrors the web form. */
  required?: boolean;
  error?: string;
}

interface Pending {
  /** Local preview URI, shown while the upload runs. */
  preview: string;
  progress: number;
}

export function ImagePickerStrip({
  images,
  onChange,
  folder,
  required = true,
  error,
}: ImagePickerStripProps) {
  const { colors } = useTheme();
  const toast = useToast();

  const [pending, setPending] = useState<Pending[]>([]);
  const [picking, setPicking] = useState(false);

  // Lets an in-flight upload be cancelled by removing its tile or leaving the
  // screen, so a slow upload cannot resurrect a photo the user deleted.
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const busy = pending.length > 0;
  const slotsLeft = MAX_IMAGES_PER_LISTING - images.length;

  const add = useCallback(async () => {
    if (busy || slotsLeft <= 0) return;
    setPicking(true);
    try {
      const assets = await pickImages(slotsLeft);
      if (assets.length === 0) return;

      abortRef.current = { aborted: false };
      const signal = abortRef.current;

      setPending(
        assets.map((a) => ({ preview: a.uri, progress: 0 })),
      );

      const uploaded = await uploadMany(assets, {
        folder,
        signal,
        onProgress: ({ progress }) => {
          // `uploadMany` reports combined progress, so the last tile is the one
          // that visibly moves.
          setPending((current) => {
            if (current.length === 0) return current;
            const next = [...current];
            next[next.length - 1] = { ...next[next.length - 1], progress };
            return next;
          });
        },
      });

      if (signal.aborted) return;
      onChange([...images, ...uploaded.map((u) => u.url)]);
    } catch (uploadError) {
      if (!abortRef.current.aborted) toast.error(humanizeError(uploadError));
    } finally {
      setPending([]);
      setPicking(false);
    }
  }, [busy, slotsLeft, folder, images, onChange, toast]);

  const remove = useCallback(
    (index: number) => {
      abortRef.current = { aborted: true };
      setPending([]);
      onChange(images.filter((_, i) => i !== index));
    },
    [images, onChange],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[typography.smallStrong, { color: colors.text }]}>Photos</Text>
        <Text style={[typography.caption, { color: colors.textSubtle }]}>
          {images.length}/{MAX_IMAGES_PER_LISTING}
          {required ? ' · at least 1 required' : ''}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {images.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.tile}>
            <Image
              source={{ uri }}
              style={styles.image}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              placeholder={cloudinaryTiny(uri)}
              placeholderContentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <Pressable
              onPress={() => remove(index)}
              hitSlop={6}
              style={[styles.remove, { backgroundColor: 'rgba(14,13,12,0.6)' }]}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
            >
              <X size={13} color="#FFFFFF" strokeWidth={2.6} />
            </Pressable>
          </View>
        ))}

        {/* Upload placeholders: the local preview plus a progress bar, so the
            photo is visible immediately instead of after the round trip. */}
        {pending.map((p, index) => (
          <View key={`pending-${index}`} style={styles.tile}>
            <Image source={{ uri: p.preview }} style={styles.image} contentFit="cover" />
            <View style={styles.pendingOverlay}>
              <ProgressBar value={p.progress} height={4} tint={colors.brand} />
            </View>
          </View>
        ))}

        {slotsLeft > 0 && !busy ? (
          <Pressable
            onPress={() => void add()}
            disabled={picking}
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            style={[
              styles.addTile,
              {
                borderColor: error ? colors.dangerBorder : colors.borderStrong,
                backgroundColor: colors.surfaceAlt,
              },
            ]}
          >
            <Camera size={22} color={colors.textMuted} strokeWidth={1.8} />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {images.length === 0 ? 'Add photos' : 'Add more'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {busy ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Uploading photos…
        </Text>
      ) : error ? (
        <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text>
      ) : (
        <Text style={[typography.caption, { color: colors.textSubtle }]}>
          JPG, PNG or WebP up to {MAX_IMAGE_BYTES / 1024 / 1024}MB. The first photo is your cover.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  strip: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  tile: {
    width: 96,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingOverlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
  },
  addTile: {
    width: 96,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});