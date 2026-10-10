/**
 * One message in the transcript.
 *
 * Composes the three payload shapes — text, photo, voice — behind a single bubble
 * chrome, and owns the affordances that must not vary by payload: the quoted
 * reply, the timestamp, the delivery ticks, and the pending/failed states.
 *
 * Two rules shape the rendering:
 *
 * 1. **A message's identity is its column, not its colour.** Consecutive
 *    messages from the same sender within a few minutes share a bubble group, and
 *    only the last of a run carries the timestamp. This is what stops a thread
 *    reading as a stack of identical cards.
 *
 * 2. **Failure is visible but not alarming.** A send that failed keeps the user's
 *    own content on screen with a retry, because silently dropping it is worse
 *    than showing a red tick. Only the sender ever sees pending/failed chrome.
 *
 * Note on payloads: photos in flight are *not* represented by `status`/`pending`
 * on a `Message`. They are separate `OptimisticPhoto` placeholders merged into the
 * transcript by `mergeThread`, so a photo stays visible while its bytes upload.
 * This component therefore receives photos as `ThreadItem`s from the screen and
 * never invents an optimistic row of its own.
 */
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from 'react-native';
import {
  Check,
  CheckCheck,
  AlertCircle,
  RotateCcw,
  Clock,
} from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography, HIT_SLOP } from '@/constants/theme';
import type { Message } from '@/types';
import { decodeMessage } from '@/services/messaging/codec';
import { shortTime } from '@/utils/time';
import { PhotoBubble } from './PhotoBubble';
import { VoiceMessage } from './VoiceMessage';

/** How long after a confirmed send we stop showing "sent". */
const SENT_VISIBILITY_MS = 90 * 1000;

interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  /** Current user id, for deciding whether the sender's name is shown. */
  showSender: boolean;
  senderName?: string;
  senderAvatar?: string;
  /** True when this is the newest message in its run, so it carries the meta. */
  isGroupTail: boolean;
  /** True when the previous item is from the same sender within the group window. */
  isGrouped: boolean;
  /** Tapping the bubble opens reply/actions. */
  onPress?: () => void;
  onLongPress?: () => void;
  onRetry?: () => void;
  /** Opens a photo in the full-screen viewer. Supplied by the thread screen. */
  onOpenPhoto?: (url: string) => void;
}

function MessageBubbleBase({
  message,
  mine,
  showSender,
  senderName,
  senderAvatar,
  isGroupTail,
  isGrouped,
  onPress,
  onLongPress,
  onRetry,
  onOpenPhoto,
}: MessageBubbleProps) {
  const { colors } = useTheme();

  const decoded = useMemo(() => decodeMessage(message), [message]);
  const isDeleted = message.deletedForEveryoneAt != null || decoded.kind === 'deleted';
  const failed = message.status === 'failed';
  const sending = message.status === 'sending';

  /**
   * A voice note renders its own play/stop `<button>`s inside the bubble. On web
   * that would put a `<button>` inside the bubble's own `<button>` (which
   * `accessibilityRole="button"` produces), and nested buttons are invalid HTML.
   * Dropping the bubble's button role for that case leaves the play control as
   * the sole interactive element; hovering still opens the actions.
   */
  const hasInnerButton = !isDeleted && decoded.kind === 'voice' && Boolean(decoded.url);
  const bubbleRole = Platform.OS === 'web' && hasInnerButton ? undefined : 'button';

  /**
   * The bubble body while pending still renders the real payload — a photo
   * placeholder or the typed text — rather than a spinner, because the user has
   * already seen and approved this content.
   */
  const body = isDeleted ? (
    <Text style={[typography.small, { color: colors.textSubtle, fontStyle: 'italic' }]}>
      This message was deleted
    </Text>
  ) : decoded.kind === 'image' && decoded.url ? (
    <PhotoBubble
      uri={decoded.url}
      pending={sending}
      progress={sending ? 0.5 : 1}
      canOpen={!sending && Boolean(onOpenPhoto)}
      onPress={() => onOpenPhoto?.(decoded.url as string)}
      accessibilityLabel={senderName ? `Photo from ${senderName}` : 'Photo'}
      footer={isGroupTail ? <BubbleMeta message={message} mine={mine} sending={sending} failed={failed} /> : null}
    />
  ) : decoded.kind === 'voice' && decoded.url ? (
    <>
      <VoiceMessage
        url={decoded.url}
        durationMs={decoded.durationMs ?? message.durationMs}
        mine={mine}
        failed={failed}
        onRetry={onRetry}
        accessibilityLabel={senderName ? `Voice message from ${senderName}` : 'Voice message'}
      />
      {isGroupTail ? <BubbleMeta message={message} mine={mine} sending={sending} failed={failed} /> : null}
    </>
  ) : (
    <Text style={[typography.body, { color: mine ? colors.onBrand : colors.text }]} selectable>
      {decoded.text}
    </Text>
  );

  const bubbleTone = mine ? colors.brand : colors.surface;
  const borderTone = mine ? 'transparent' : colors.border;

  return (
    <View
      style={[
        styles.row,
        mine ? styles.rowMine : styles.rowTheirs,
        // The grouped run keeps its previous spacing so the gap between a sender's
        // own bubbles is smaller than the gap between speakers.
        isGrouped && (mine ? styles.gapGroupedMine : styles.gapGroupedTheirs),
        !isGrouped && styles.gapSpoken,
      ]}
    >
      {!mine && !isGrouped && showSender ? (
        <View style={styles.avatarSlot}>
          {senderAvatar ? (
            <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[typography.caption, { color: colors.textSubtle }]}>
                {(senderName ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.bubbleColumn}>
        {!mine && showSender && !isGrouped && senderName ? (
          <Text style={[typography.caption, { color: colors.textSubtle, marginBottom: 2 }]}>
            {senderName}
          </Text>
        ) : null}

        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          disabled={!onPress && !onLongPress}
          accessibilityRole={bubbleRole}
          accessibilityLabel={
            isDeleted
              ? 'Deleted message'
              : `${senderName ? `${senderName}: ` : ''}${
                  decoded.kind === 'image' ? 'Photo' : decoded.kind === 'voice' ? 'Voice message' : decoded.text
                } at ${shortTime(message.createdAt)}`
          }
          style={({ pressed }) => [
            styles.bubble,
            {
              backgroundColor: isDeleted ? colors.surfaceSunken : bubbleTone,
              borderColor: isDeleted ? colors.border : borderTone,
            },
            bubbleCorners(mine, isGrouped, isGroupTail),
            pressed ? { opacity: 0.85 } : null,
          ]}
        >
          {message.replyPreview ? (
            <QuoteBar
              preview={message.replyPreview}
              mine={mine}
              deleted={Boolean(message.replyToId) && message.replyPreview === ''}
            />
          ) : null}

          {body}

          {/* Text and voice carry their own meta; photos render theirs via footer. */}
          {decoded.kind !== 'image' && isGroupTail ? (
            <BubbleMeta message={message} mine={mine} sending={sending} failed={failed} />
          ) : null}
        </Pressable>

        {/* A failed send is the one state where the message must be tappable to retry,
            so the retry sits outside the bubble it styles. */}
        {failed ? (
          <Pressable
            onPress={onRetry}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Message failed to send. Tap to retry."
            style={styles.retryRow}
          >
            <RotateCcw size={13} color={colors.danger} />
            <Text style={[typography.caption, { color: colors.danger }]}>Not sent · Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Timestamp and delivery ticks.
 *
 * Read receipts are deliberately restrained: a single tick for queued/sent, a
 * double tick once delivered, and nothing at all for the other user's read state.
 * Showing "read" per bubble is noise — people read messages in batches.
 */
function BubbleMeta({
  message,
  mine,
  sending,
  failed,
}: {
  message: Message;
  mine: boolean;
  sending: boolean;
  failed: boolean;
}) {
  const { colors } = useTheme();
  const tickColor = mine ? 'rgba(255,255,255,0.82)' : colors.textSubtle;

  return (
    <View style={styles.meta}>
      <Text
        style={[
          typography.caption,
          { color: mine ? 'rgba(255,255,255,0.78)' : colors.textSubtle },
        ]}
      >
        {shortTime(message.createdAt)}
      </Text>
      {mine ? (
        <View style={styles.tick} accessibilityLabel={readLabel(message, sending, failed)}>
          {sending || failed ? (
            failed ? (
              <AlertCircle size={13} color={colors.danger} />
            ) : (
              <Clock size={13} color={tickColor} />
            )
          ) : message.deliveredAt ? (
            <CheckCheck size={14} color={tickColor} />
          ) : (
            <Check size={14} color={tickColor} />
          )}
        </View>
      ) : null}
    </View>
  );
}

function readLabel(message: Message, sending: boolean, failed: boolean): string {
  if (failed) return 'Failed to send';
  if (sending) return 'Sending';
  if (message.deliveredAt) return 'Delivered';
  return 'Sent';
}

/** The leading bar on a quoted reply inside a bubble. */
function QuoteBar({ preview, mine, deleted }: { preview: string; mine: boolean; deleted: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.quoteWrap}>
      <View
        style={[
          styles.quoteBar,
          { backgroundColor: deleted ? colors.textSubtle : mine ? colors.onBrand : colors.brand },
        ]}
      />
      <Text
        style={[
          typography.caption,
          { color: mine ? 'rgba(255,255,255,0.82)' : colors.textMuted, flex: 1 },
        ]}
        numberOfLines={1}
      >
        {preview || 'Deleted message'}
      </Text>
    </View>
  );
}

/**
 * Corner radii that group consecutive bubbles.
 *
 * A run from one speaker keeps its outer corners rounded and squares the corners
 * that touch the neighbouring bubble, so the group reads as a single block. A
 * bubble on its own keeps the base pill-ish rounding from `styles.bubble`. The
 * properties are top-level `border*Radius` keys because a per-corner object inside
 * `borderRadius` is silently ignored by React Native.
 */
function bubbleCorners(mine: boolean, grouped: boolean, isTail: boolean): ViewStyle {
  if (!grouped) return {};
  return {
    borderTopLeftRadius: mine ? radius.xs : radius.lg,
    borderTopRightRadius: mine ? radius.lg : radius.xs,
    borderBottomLeftRadius: isTail && !mine ? radius.lg : radius.xs,
    borderBottomRightRadius: isTail && mine ? radius.lg : radius.xs,
  };
}

export const MessageBubble = memo(MessageBubbleBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  rowMine: {
    justifyContent: 'flex-end',
    paddingLeft: 52,
  },
  rowTheirs: {
    justifyContent: 'flex-start',
    paddingRight: 52,
  },
  gapSpoken: { marginTop: spacing.md },
  gapGroupedMine: { marginTop: spacing.xxs },
  gapGroupedTheirs: { marginTop: spacing.xxs },
  avatarSlot: { width: 28 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleColumn: {
    maxWidth: '86%',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    gap: spacing.xxs,
    // Never stretch a short line across the column; long text wraps here.
    alignSelf: 'flex-start',
  },
  quoteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  quoteBar: {
    width: 3,
    height: 16,
    borderRadius: radius.pill,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  tick: {
    flexDirection: 'row',
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
});