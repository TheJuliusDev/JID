/**
 * Voice message bubble with a waveform.
 *
 * A plain play button and a duration would technically "play voice notes", but it
 * reads as a file attachment rather than as something somebody said to you. The
 * waveform is what makes it feel like speech: you can see how long it is, and —
 * more usefully for a reply to a question you may not have time to listen to —
 * whether the person rushed at the end or paused to think.
 *
 * Implementation notes:
 *
 * - Bars are drawn with plain `View`s, not SVG or a canvas. A dozen 3px views
 *   inside a bubble costs nothing on a mid-range Android, where an SVG per
 *   message is a measurable scroll cost.
 * - The played portion is drawn as a second, brighter layer clipped to the
 *   progress fraction, so progress reads as a fill rather than as a moving
 *   playhead that has to be tracked.
 * - Playback position is driven by the audio player's own events, not a timer,
 *   so it stays correct when the OS throttles timers in the background.
 *
 * Amplitude data is recorded during capture (`VoiceRecorder`), because Cloudinary
 * hands back a plain audio URL with no waveform to read. A note that arrived from
 * another client has none, and falls back to a synthetic evenly-spaced waveform
 * sized from the duration — still a waveform, never a bare button.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Play, Pause, RotateCcw } from 'lucide-react-native';
import { useAudioPlayer, useAudioPlayerStatus, AudioPlayer } from 'expo-audio';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography, HIT_SLOP } from '@/constants/theme';

/** Bars in the drawn waveform. More than this is noise on a phone screen. */
const BAR_COUNT = 34;
const BAR_WIDTH = 3;
const BAR_GAP = 2;

/** Clips audio to this length. Nobody wants to listen to a 6-minute monologue. */
export const MAX_VOICE_MS = 5 * 60 * 1000;
export const MIN_VOICE_MS = 700;

/** Formats a duration as m:ss, the way a voice note is always labelled. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Builds a waveform shape.
 *
 * Real capture amplitudes are used when present. Otherwise a deterministic
 * pseudo-random curve is generated from the duration so the same note always
 * draws the same shape — a bubble that reshuffles its bars on every re-render
 * looks like a glitch.
 */
export function buildWaveform(amplitudes?: number[], seedDurationMs?: number): number[] {
  if (amplitudes && amplitudes.length > 0) {
    // Resample whatever was captured down to a fixed bar count.
    const step = amplitudes.length / BAR_COUNT;
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const value = amplitudes[Math.floor(i * step)] ?? 0;
      return Math.max(0.12, Math.min(1, value));
    });
  }

  // Seeded from the duration so the shape is stable across renders.
  const seed = Math.max(1, Math.round(seedDurationMs ?? 1000));
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const wave = Math.sin(i * 0.7 + seed) * 0.5 + 0.5;
    const swell = 0.55 + 0.45 * Math.sin((i / BAR_COUNT) * Math.PI);
    return Math.max(0.15, Math.min(1, 0.3 + wave * swell * 0.7));
  });
}

interface VoiceMessageProps {
  url: string;
  durationMs?: number;
  mine: boolean;
  /** True while the bubble should show a failed-upload state. */
  failed?: boolean;
  onRetry?: () => void;
  /** Amplitude samples captured while recording, for a true waveform. */
  amplitudes?: number[];
  accessibilityLabel?: string;
}

function VoiceMessageBase({
  url,
  durationMs,
  mine,
  failed,
  onRetry,
  amplitudes,
  accessibilityLabel,
}: VoiceMessageProps) {
  const { colors } = useTheme();
  const player: AudioPlayer = useAudioPlayer({ uri: url });

  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  /**
   * A failed voice note shows its own duration and a retry control rather than
   * pretending to be playable: there is no local file once the upload failed.
   */
  const knownDuration = durationMs ?? (status.duration ? status.duration * 1000 : 0);
  const total = Math.max(knownDuration, 1000);

  // Progress comes from the player's own clock rather than a timer, so it stays
  // correct when the OS throttles JS in the background. Zero when stopped.
  const progress = Math.min(1, (status.currentTime * 1000) / total);

  const playedCount = Math.round(progress * BAR_COUNT);

  const toggle = useCallback(() => {
    if (failed) {
      onRetry?.();
      return;
    }
    if (isPlaying) {
      player.pause();
      return;
    }
    // Restart from the top when the previous play ran to the end.
    if (status.didJustFinish) {
      player.seekTo(0);
    }
    player.play();
  }, [failed, onRetry, isPlaying, player, status.didJustFinish]);

  const stop = useCallback(() => {
    player.pause();
    player.seekTo(0);
  }, [player]);

  // A bubble scrolled out of view should not keep talking. Playback is stopped
  // on unmount so leaving a thread mid-sentence does not follow the user around
  // the app.
  useEffect(() => {
    return () => {
      player.pause();
    };
  }, [player]);

  const waveform = useMemo(
    () => buildWaveform(amplitudes, durationMs),
    [amplitudes, durationMs],
  );

  const label = accessibilityLabel ?? 'Voice message';

  if (failed) {
    return (
      <Pressable
        onPress={toggle}
        style={styles.failedRow}
        accessibilityRole="button"
        accessibilityLabel="Voice message failed to send. Double tap to retry."
      >
        <View style={[styles.failIcon, { backgroundColor: colors.dangerSoft }]}>
          <RotateCcw size={14} color={colors.danger} />
        </View>
        <Text style={[typography.small, { color: colors.danger }]}>
          Voice message not sent · Tap to retry
        </Text>
      </Pressable>
    );
  }

  const idle = mine ? 'rgba(255,255,255,0.42)' : colors.border;
  const active = mine ? colors.onBrand : colors.brand;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatDuration(total)}. ${isPlaying ? 'Pause' : 'Play'} voice message`}
        style={({ pressed }) => [
          styles.playButton,
          { backgroundColor: pressed ? active : active },
        ]}
      >
        {isPlaying ? (
          <Pause size={16} color={mine ? colors.brand : colors.onBrand} fill={mine ? colors.brand : colors.onBrand} />
        ) : (
          <Play size={16} color={mine ? colors.brand : colors.onBrand} fill={mine ? colors.brand : colors.onBrand} />
        )}
      </Pressable>

      <View style={styles.waveArea}>
        <View style={styles.waveRow}>
          {waveform.map((value, index) => (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  height: Math.max(4, value * 22),
                  backgroundColor: index < playedCount ? active : idle,
                  borderRadius: radius.pill,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.metaRow}>
          <Text
            style={[
              typography.caption,
              { color: mine ? 'rgba(255,255,255,0.78)' : colors.textSubtle },
            ]}
          >
            {formatDuration(total)}
          </Text>
          {isPlaying ? (
            <Pressable onPress={stop} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel="Stop playback">
              <Text
                style={[
                  typography.caption,
                  { color: mine ? 'rgba(255,255,255,0.78)' : colors.textSubtle },
                ]}
              >
                Stop
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Memoised because a transcript re-renders every bubble whenever a new message
 * arrives, and a re-render restarts nothing but still costs a waveform rebuild
 * and an audio-status read per row. `url` and `durationMs` are the only inputs
 * that change a bubble's own contents.
 */
export const VoiceMessage = memo(
  VoiceMessageBase,
  (prev, next) =>
    prev.url === next.url &&
    prev.durationMs === next.durationMs &&
    prev.mine === next.mine &&
    prev.failed === next.failed,
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 210,
    paddingVertical: spacing.xxs,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveArea: {
    flex: 1,
    gap: spacing.xs,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  failIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});