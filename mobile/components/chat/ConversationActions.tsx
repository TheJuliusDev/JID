/**
 * Conversation-level actions, behind the thread header's overflow button.
 *
 * The controls that apply to a *chat* rather than to a single message: pin,
 * archive, mute, search, block and report. They live in a sheet rather than being
 * scattered across the header so the header can stay to two lines and a back
 * arrow. Search is hidden in the open thread, where the header carries its own
 * search button.
 *
 * ## Why mute lives here and not in the notification settings
 *
 * Muting is per conversation and belongs next to the conversation. A global
 * "mute all messages" switch is a different thing and belongs in Settings; mixing
 * the two is how a user ends up with a silent inbox they did not intend.
 *
 * ## Why archived chats can still be unarchived
 *
 * `onUnarchive` is offered when the thread is already archived, which is the only
 * way back out of the Archived section. A one-way archive is a black hole, and
 * people do archive conversations they later need.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import {
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  BellOff,
  Bell,
  Search,
  Ban,
  Flag,
  UserX,
} from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';

export interface ConversationActionsProps {
  visible: boolean;
  /** The other person's display name, for the destructive confirmations. */
  displayName: string;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  /** True when this account has already blocked the other person. */
  blocked: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onToggleMute: () => void;
  onSearch: () => void;
  /** Hide the search row when the surface above already offers search. */
  showSearch?: boolean;
  onBlock: () => void;
  onUnblock: () => void;
  onReport: () => void;
}

interface Row {
  key: string;
  label: string;
  hint?: string;
  icon: typeof Pin;
  onPress: () => void;
  tone?: 'danger';
}

export function ConversationActions({
  visible,
  displayName,
  pinned,
  archived,
  muted,
  blocked,
  onClose,
  onTogglePin,
  onToggleArchive,
  onToggleMute,
  onSearch,
  showSearch = true,
  onBlock,
  onUnblock,
  onReport,
}: ConversationActionsProps) {
  const { colors } = useTheme();

  const rows: Row[] = [
    ...(showSearch
      ? [
          {
            key: 'search',
            label: 'Search in conversation',
            icon: Search,
            onPress: onSearch,
          },
        ]
      : []),
    {
      key: 'pin',
      label: pinned ? 'Unpin chat' : 'Pin chat',
      hint: pinned ? 'Stays at the top of your inbox' : 'Keep this chat at the top',
      icon: pinned ? PinOff : Pin,
      onPress: onTogglePin,
    },
    {
      key: 'mute',
      label: muted ? 'Unmute notifications' : 'Mute notifications',
      hint: muted ? 'You will be notified again' : 'Stop the banner, keep the messages',
      icon: muted ? Bell : BellOff,
      onPress: onToggleMute,
    },
    {
      key: 'archive',
      label: archived ? 'Unarchive chat' : 'Archive chat',
      hint: archived
        ? 'Return this chat to your inbox'
        : 'Remove from your inbox. Nothing is deleted.',
      icon: archived ? ArchiveRestore : Archive,
      onPress: onToggleArchive,
    },
  ];

  // Blocking and reporting are about the *person*, so they are grouped at the
  // bottom under a rule and worded with their consequence spelled out.
  const safetyRows: Row[] = blocked
    ? [
        {
          key: 'unblock',
          label: `Unblock ${displayName}`,
          icon: UserX,
          onPress: onUnblock,
        },
      ]
    : [
        {
          key: 'report',
          label: `Report ${displayName}`,
          icon: Flag,
          onPress: onReport,
        },
        {
          key: 'block',
          label: `Block ${displayName}`,
          hint: 'They cannot message you or see your profile.',
          icon: Ban,
          onPress: onBlock,
          tone: 'danger',
        },
      ];

  const all = [...rows, ...safetyRows];

  return (
    <Sheet
      visible={visible}
      snapPoints={[`${Math.min(76, 16 + all.length * 13 + 8)}%`]}
      onClose={onClose}
      scrollable={false}
    >
      <View style={styles.list}>
        {all.map((row) => {
              const Icon = row.icon;
              const danger = row.tone === 'danger';

              return (
                <Pressable
                  key={row.key}
                  onPress={row.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
                    ]}
                  >
                  <Icon size={19} color={danger ? colors.danger : colors.textMuted} strokeWidth={2} />
                  <View style={styles.rowText}>
                    <Text
                      style={[typography.body, { color: danger ? colors.danger : colors.text }]}
                      >
                      {row.label}
                    </Text>
                    {row.hint ? (
                        <Text style={[typography.caption, { color: colors.textSubtle }]}>
                          {row.hint}
                        </Text>
                      ) : null}
                  </View>
                </Pressable>
              );
            })}
      </View>
    </Sheet>
  );
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
  rowText: {
    flex: 1,
    gap: 1,
  },
});





