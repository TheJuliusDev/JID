/**
 * Chat thread header.
 *
 * Three pieces of information compete for the two lines under the title, and this
 * component decides what wins:
 *
 *  1. **Typing** — strictly the most useful thing to know, and transient, so it
 *     takes the subtitle slot outright while it lasts.
 *  2. **Online** — a live presence fact, free of any database read.
 *  3. **Last seen** — a coarse bucket from `utils/presence`, or nothing at all
 *     when the other person has turned last-seen off.
 *
 * The three are mutually exclusive by construction: `presenceLabel` returns one
 * label, and `typingSubtitle` overrides it only while somebody is actually
 * typing. Nothing here polls — presence arrives on a channel event and last seen
 * from the inbox row, so an idle thread costs nothing.
 */
import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MoreVertical, ChevronLeft, Search } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography, HIT_SLOP } from '@/constants/theme';
import { presenceText, typingSubtitle } from '@/utils/presence';
import type { PresenceState, TypingState } from '@/types';

export interface ChatHeaderProps {
  name: string;
  avatarUrl?: string;
  username?: string;
  presence: PresenceState;
  typing?: TypingState | null;
  /** Whether the other person has shared their last-seen at all. */
  showLastSeen: boolean;
  onBack: () => void;
  onOpenProfile?: () => void;
  onOpenActions: () => void;
  /** Opens the in-thread search. */
  onSearch?: () => void;
  /** True when the other person has blocked this user, so the composer is inert. */
  blocked?: boolean;
}

function ChatHeaderBase({
  name,
  avatarUrl,
  username,
  presence,
  typing,
  showLastSeen,
  onBack,
  onOpenProfile,
  onOpenActions,
  onSearch,
  blocked,
}: ChatHeaderProps) {
  const { colors } = useTheme();

  /**
   * The subtitle.
   *
   * `typing` wins while fresh. Presence formatting is skipped entirely when
   * `showLastSeen` is false, which is what makes the opt-out honest rather than
   * cosmetic — there is no stale "last seen" left over from before the switch was
   * flipped.
   */
  const subtitle = useCallback((): { text: string; tone: 'online' | 'muted' | 'none' } => {
    // A blocked participant gets no typing line. There is only ever one other
    // person in a thread, so `blocked` is the whole test — and a blocked user
    // should never appear to be waiting on a reply they cannot send.
    if (!blocked && typing) {
      return { text: typingSubtitle(typing.name), tone: 'online' };
    }
    if (!showLastSeen) return { text: '', tone: 'none' };

    const text = presenceText({
      isOnline: presence.isOnline,
      lastSeenAt: presence.lastSeenAt,
      visible: presence.visible,
    });
    if (!text) return { text: '', tone: 'none' };
    return { text, tone: presence.isOnline ? 'online' : 'muted' };
  }, [typing, showLastSeen, presence]);

  const line = subtitle();
  const subtitleColor =
    line.tone === 'online' ? colors.brand : line.tone === 'muted' ? colors.textMuted : 'transparent';

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View style={styles.root}>
      <Pressable
        onPress={onBack}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Back to messages"
        style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
      >
        <ChevronLeft size={24} color={colors.text} />
      </Pressable>

      <Pressable
        onPress={onOpenProfile}
        disabled={!onOpenProfile}
        accessibilityRole={onOpenProfile ? 'button' : undefined}
        accessibilityLabel={username ? `Open ${name}'s profile` : name}
        style={styles.identity}
      >
        <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[typography.smallStrong, { color: colors.textMuted }]}>{initials}</Text>
          {/* A live dot rather than a text-only state, so the header reads at a
              glance without occupying a line to say "Online". */}
          {presence.isOnline ? <View style={[styles.onlineDot, { borderColor: colors.bg }]} /> : null}
        </View>

        <View style={styles.text}>
          <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {blocked ? `${name} (blocked)` : name}
          </Text>
          {line.text ? (
            <Text style={[typography.caption, { color: subtitleColor }]} numberOfLines={1}>
              {line.text}
            </Text>
          ) : username ? (
            <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
              @{username}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {onSearch ? (
        <Pressable
          onPress={onSearch}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Search this conversation"
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
        >
          <Search size={20} color={colors.text} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={onOpenActions}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Conversation options"
        style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
      >
        <MoreVertical size={21} color={colors.text} />
      </Pressable>
    </View>
  );
}

/**
 * Memoised on the fields that change what it draws.
 *
 * The header sits above the transcript, so re-rendering it on every keystroke in
 * the composer would be visible on a mid-range Android as a stutter in the input
 * row's own layout pass.
 */
export const ChatHeader = memo(
  ChatHeaderBase,
  (prev, next) =>
    prev.name === next.name &&
    prev.avatarUrl === next.avatarUrl &&
    prev.username === next.username &&
    prev.showLastSeen === next.showLastSeen &&
    prev.blocked === next.blocked &&
    prev.typing?.userId === next.typing?.userId &&
    prev.presence.isOnline === next.presence.isOnline &&
    prev.presence.lastSeenAt === next.presence.lastSeenAt &&
    prev.presence.visible === next.presence.visible,
);

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: '#22C55E',
    borderWidth: 2,
  },
  text: {
    flex: 1,
  },
});