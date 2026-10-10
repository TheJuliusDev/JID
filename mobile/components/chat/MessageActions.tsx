/**
 * Long-press context menu for one message.
 *
 * ## Which actions appear, and why
 *
 * The set is derived from the message rather than being a fixed list, because a
 * menu offering "Copy text" on a photo is the kind of small dishonesty that makes
 * an app feel unfinished:
 *
 *   - **Reply** — offered for anything still readable. A reply to a deleted
 *     message is meaningless, so deleted rows drop it.
 *   - **Copy text** — text only.
 *   - **Delete for me** — always. Removes the row from *this* account only, and
 *     is always available, including on someone else's message.
 *   - **Delete for everyone** — own messages only, and only inside the window the
 *     server enforces. Offered unconditionally rather than hidden behind an error:
 *     the RPC is the authority on the window, and a refusal surfaces as a toast.
 *   - **Report** — someone else's messages only. Reporting your own message is not
 *     a thing anyone needs.
 *
 * The destructive options are visually separated from the harmless ones and the
 * sheet is dismissed by tapping the backdrop, so a mis-tap cannot delete anything
 * without a deliberate second one.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import {
  Reply,
  Copy,
  Trash2,
  Flag,
  Ban,
  Pencil,
} from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { decodeMessage } from '@/services/messaging/codec';
import type { Message } from '@/types';

export interface MessageActionsProps {
  visible: boolean;
  message: Message | null;
  /** True when the message is the signed-in user's own. */
  mine: boolean;
  onClose: () => void;
  onReply: (message: Message) => void;
  onCopy: (message: Message) => void;
  onDeleteForMe: (message: Message) => void;
  onDeleteForEveryone: (message: Message) => void;
  onReport: (message: Message) => void;
  /** Reported directly from this menu, for the sender of a reported message. */
  onBlockUser?: () => void;
}

interface Action {
  key: string;
  label: string;
  icon: typeof Reply;
  onPress: () => void;
  tone?: 'danger';
}

export function MessageActions({
  visible,
  message,
  mine,
  onClose,
  onReply,
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
  onReport,
  onBlockUser,
}: MessageActionsProps) {
  const { colors } = useTheme();

  if (!message) return null;

  const decoded = decodeMessage(message);
  const deleted = Boolean(message.deletedForEveryoneAt) || decoded.kind === 'deleted';

  const actions: Action[] = [];

  if (!deleted) {
    actions.push({
      key: 'reply',
      label: 'Reply',
      icon: Reply,
      onPress: () => onReply(message),
    });
  }

  if (!deleted && decoded.kind === 'text' && decoded.text.trim().length > 0) {
    actions.push({
      key: 'copy',
      label: 'Copy text',
      icon: Copy,
      onPress: () => onCopy(message),
    });
  }

  if (mine && !deleted) {
    actions.push({
      key: 'delete-everyone',
      label: 'Delete for everyone',
      icon: Pencil,
      onPress: () => onDeleteForEveryone(message),
    });
  }

  if (!mine) {
    actions.push({
      key: 'report',
      label: 'Report message',
      icon: Flag,
      onPress: () => onReport(message),
    });

    if (onBlockUser) {
      actions.push({
        key: 'block',
        label: 'Block user',
        icon: Ban,
        onPress: onBlockUser,
      });
    }
  }

  actions.push({
    key: 'delete-me',
    label: 'Delete for me',
    icon: Trash2,
    onPress: () => onDeleteForMe(message),
    tone: 'danger',
  });

  return (
    <Sheet
      visible={visible}
      snapPoints={snapPointsFor(actions.length)}
      onClose={onClose}
      scrollable={false}
    >
      <View style={styles.list}>
        {actions.map((action, index) => {
              const destructive = action.tone === 'danger';
              // A hairline above the destructive group, so "delete" never reads as
              // another neutral action.
              const separated = index > 0 && actions[index - 1].tone !== 'danger' && destructive;
              const Icon = action.icon;

              return (
                <Pressable
                  key={action.key}
                  onPress={action.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  style={({ pressed }) => [
                    styles.row,
                    separated && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
                    ]}
                  >
                  <Icon
                    size={19}
                    color={destructive ? colors.danger : colors.textMuted}
                    strokeWidth={2}
                  />
                    <Text
                      style={[
                        typography.body,
                        { color: destructive ? colors.danger : colors.text },
                        ]}
                      >
                      {action.label}
                    </Text>
                  </Pressable>
                );
              })}
        </View>
    </Sheet>
  );
}

/**
 * Sheet height for a given number of rows.
 *
 * Header handle plus one row per action, clamped so a long menu still fits a short
 * screen. A plain function rather than a hook: it derives from the action count
 * alone and must stay callable before the early return below.
 */
function snapPointsFor(count: number): string[] {
  const height = Math.min(78, 18 + count * 52);
  return [`${height}%`];
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
  },
  list: {
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
});





