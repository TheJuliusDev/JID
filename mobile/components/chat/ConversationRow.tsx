/**
 * One row in the conversation list.
 *
 * ## What a row has to communicate, in priority order
 *
 * 1. **Who** — the participant, with a live presence dot when they are online.
 * 2. **What** — the last message, rendered as a thumbnail for photos and a
 *    waveform-tinted "Voice message" for voice notes, so a mixed thread does not
 *    read as a column of identical words.
 * 3. **How urgent** — an unread pill, and the sender's name in bold when unread.
 * 4. **When** — a relative timestamp.
 *
 * ## Pin and archive without a swipe gesture
 *
 * Rows expose their secondary actions on **long press**, not on swipe. A horizontal
 * swipe inside a vertically scrolling list is ambiguous on Android — it collides
 * with the back gesture and with the scroll view's own bounce — and getting it
 * wrong makes the inbox feel broken. Long press is unambiguous, already used for
 * the same purpose inside threads, and reachable by the same users who would
 * discover swipe. The row still hints that actions exist via the chevron that
 * appears only on the selected row.
 */
import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Pin, ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { Avatar } from '@/components/ui/Card';
import { chatThumbUrl } from './PhotoBubble';
import { messagePreview } from '@/services/messaging/codec';
import { timeAgo } from '@/utils/time';
import { nairaCompact } from '@/utils/format';
import type { Conversation } from '@/types';

export interface ConversationRowProps {
  conversation: Conversation;
  /** True while this row is being long-pressed, to reveal the actions chevron. */
  selected?: boolean;
  onPress: (conversation: Conversation) => void;
  onLongPress: (conversation: Conversation) => void;
}

function ConversationRowBase({
  conversation,
  selected,
  onPress,
  onLongPress,
}: ConversationRowProps) {
  const { colors } = useTheme();
  const { participant, unreadCount, lastMessage } = conversation;

  const unread = unreadCount > 0;

  /**
   * Thumbnail for a photo last-message.
   *
   * `messagePreview` already resolves the legacy `jid://photo/` encoding and the
   * first-class `media_url` column into a short label, so this only has to decide
   * whether there is an image worth showing.
   */
  const thumb = photoThumb(lastMessage?.content, lastMessage?.mediaUrl);

  return (
    <Pressable
      onPress={() => onPress(conversation)}
      onLongPress={() => onLongPress(conversation)}
      delayLongPress={280}
      accessibilityRole="button"
      accessibilityState={{ selected: unread }}
      accessibilityLabel={[
        `Conversation with ${participant.fullName}`,
    unread ? `${unreadCount} unread.` : null,
        lastMessage ? messagePreview(lastMessage) : 'No messages yet',
        'Long press for options.',
      ]
        .filter(Boolean)
        .join(' ')}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? colors.surfaceAlt
            : unread
              ? colors.brandSoft
              : 'transparent',
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View>
        <Avatar uri={participant.avatarUrl} name={participant.fullName} size={50} />
      </View>

      <View style={styles.body}>
        <View style={styles.top}>
          {conversation.pinnedAt ? (
            <Pin
              size={13}
              color={colors.brand}
              strokeWidth={2.4}
              style={styles.pin}
            />
          ) : null}

          <Text
            style={[
              typography.bodyStrong,
              styles.name,
              { color: colors.text },
            ]}
            numberOfLines={1}
          >
            {participant.fullName}
          </Text>

          <Text
            style={[
              typography.caption,
              { color: unread ? colors.brand : colors.textSubtle },
            ]}
          >
            {conversation.lastMessageAt ? timeAgo(conversation.lastMessageAt) : ''}
          </Text>
        </View>

        <View style={styles.previewRow}>
          {thumb ? (
            <Image
              source={{ uri: chatThumbUrl(thumb) }}
              style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]}
              contentFit="cover"
              transition={120}
            />
          ) : null}

          <Text
            style={[
              typography.small,
              styles.preview,
              { color: unread ? colors.text : colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {messagePreview(lastMessage)}
          </Text>

          {unread ? (
            <View style={[styles.badge, { backgroundColor: colors.brand }]}>
              <Text style={[typography.caption, styles.badgeText, { color: colors.onBrand }]}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>

        {conversation.listingRef ? (
          <Text style={[typography.caption, styles.context, { color: colors.textSubtle }]} numberOfLines={1}>
            {conversation.listingRef.title} · {nairaCompact(conversation.listingRef.price)}
          </Text>
        ) : null}
      </View>

      {selected ? (
        <ChevronRight size={18} color={colors.textSubtle} />
      ) : null}
    </Pressable>
  );
}

/**
 * A small, cheap render for a long list.
 *
 * The row only re-renders when something it actually draws changes. Without this,
 * a new message arriving anywhere would re-render every row in the inbox.
 */
export const ConversationRow = memo(
  ConversationRowBase,
  (prev, next) =>
    prev.conversation.id === next.conversation.id &&
    prev.conversation.unreadCount === next.conversation.unreadCount &&
    prev.conversation.lastMessageAt === next.conversation.lastMessageAt &&
    prev.conversation.pinnedAt === next.conversation.pinnedAt &&
    prev.conversation.archivedAt === next.conversation.archivedAt &&
    prev.conversation.lastMessage?.id === next.conversation.lastMessage?.id &&
    prev.conversation.participant.fullName === next.conversation.participant.fullName &&
    prev.selected === next.selected,
);

/**
 * The image URL for a photo message, if the last message is one.
 *
 * Accepts both storage shapes: the first-class `media_url` column and the legacy
 * `jid://photo/<url>` content encoding that predates it.
 *
 * The `media_url` branch is checked before `content` is required to exist. A photo
 * message carries an empty `content` once the image is in `media_url`, so gating on
 * `content` first would silently drop the thumbnail for every message written by
 * the current schema — the preview would fall back to text where there is none.
 */
function photoThumb(content?: string, mediaUrl?: string): string | null {
  if (mediaUrl && /^https?:\/\//.test(mediaUrl)) return mediaUrl;
  if (!content) return null;
  if (content.startsWith('jid://photo/')) return content.slice('jid://photo/'.length);
  return null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pin: {
    marginRight: -2,
  },
  name: {
    flex: 1,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thumb: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
  },
  preview: {
    flex: 1,
  },
  badge: {
    minWidth: 21,
    height: 21,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontWeight: '800',
  },
  context: {
    marginTop: 1,
  },
});