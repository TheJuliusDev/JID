/**
 * Search inside one conversation.
 *
 * ## Why this is a header overlay rather than a screen
 *
 * Search results are only meaningful next to the conversation they came from. A
 * separate route would lose the transcript the user is trying to recall and make
 * "tap a result to jump to it" a navigation event rather than a glance. So the bar
 * replaces the chat header while active, and a result tap closes the bar and
 * scrolls the transcript to the hit.
 *
 * ## Highlighting
 *
 * Matches are wrapped in bold rather than coloured. Bold survives both themes and
 * both colour-vision types, and inside a bubble that is already tinted by sender
 * it does not fight the bubble's own background the way a highlight colour would.
 *
 * ## Performance
 *
 * `searchMessages` is an indexed server-side query debounced by `useThreadSearch`,
 * so this component only ever renders the returned page — never the whole
 * transcript. That is what keeps search usable in a thread with thousands of
 * messages on a mid-range Android.
 */
import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search as SearchIcon, CornerDownLeft } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography, HIT_SLOP } from '@/constants/theme';
import { groupMessagesByDay } from '@/utils/time';
import type { Message } from '@/types';

export interface ThreadSearchProps {
  query: string;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  results: Message[];
  searching: boolean;
  /** The signed-in user, so results can say who sent the hit. */
  selfId?: string;
  /** Sender display name for the other participant. */
  participantName: string;
  /** Jumps the transcript to a message and closes the bar. */
  onSelectResult: (message: Message) => void;
}

export function ThreadSearch({
  query,
  onChangeQuery,
  onClose,
  results,
  searching,
  selfId,
  participantName,
  onSelectResult,
}: ThreadSearchProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  /** Newest hit first: people are usually looking for something just above. */
  const ordered = useMemo(() => [...results].reverse(), [results]);

  /** Day headers, so a hit from last month is distinguishable from today. */
  const grouped = useMemo(
    () =>
      groupMessagesByDay(
        ordered.map((message) => ({ createdAt: message.createdAt, message })),
      ),
    [ordered],
  );

  const onSubmit = useCallback(() => inputRef.current?.focus(), []);

  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 2;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + spacing.sm,
          backgroundColor: colors.bg,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.bar}>
        <SearchIcon size={18} color={colors.textSubtle} />

        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onChangeQuery}
          onSubmitEditing={onSubmit}
          placeholder="Search this chat"
          placeholderTextColor={colors.textSubtle}
          style={[typography.body, styles.input, { color: colors.text }]}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search this conversation"
        />

        {searching ? (
          <ActivityIndicator size="small" color={colors.textSubtle} />
        ) : null}

        <Pressable
          onPress={onClose}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Close search"
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
        >
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      <Text style={[typography.caption, styles.status, { color: colors.textSubtle }]}>
        {statusLine(trimmed, tooShort, results.length, searching)}
      </Text>

      {ordered.length > 0 ? (
        <ScrollView
          style={styles.results}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {grouped.map((group) => (
            <View key={group.day} style={styles.group}>
              <Text style={[typography.caption, styles.day, { color: colors.textSubtle }]}>
                {group.day}
              </Text>

              {group.messages.map(({ message }) => (
                <Pressable
                  key={message.id}
                  onPress={() => onSelectResult(message)}
                  accessibilityRole="button"
                  accessibilityLabel={`Jump to message from ${
                    message.senderId === selfId ? 'you' : participantName
                  }`}
                  style={({ pressed }) => [
                    styles.result,
                    {
                      backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.resultTop}>
                    <Text style={[typography.caption, styles.sender, { color: colors.brand }]}>
                      {message.senderId === selfId ? 'You' : participantName}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSubtle }]}>
                      {message.createdAt.slice(11, 16)}
                    </Text>
                  </View>

                  <Text
                    style={[typography.small, { color: colors.text }]}
                    numberOfLines={3}
                  >
                    <Highlighted text={message.content} needle={trimmed} />
                  </Text>

                  <View style={styles.jumpRow}>
                    <CornerDownLeft size={12} color={colors.textSubtle} />
                    <Text style={[typography.caption, { color: colors.textSubtle }]}>
                      Tap to jump to this message
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

/** One line telling the user what the search is doing, including the empty case. */
function statusLine(
  needle: string,
  tooShort: boolean,
  count: number,
  searching: boolean,
): string {
  if (needle.length === 0) return 'Type at least two characters';
  if (tooShort) return 'Keep typing';
  if (searching) return 'Searching…';
  if (count === 0) return `No messages match “${needle}”`;
  return count === 1 ? '1 message' : `${count} messages`;
}

/**
 * Wraps every case-insensitive occurrence of `needle` in bold.
 *
 * `Text` nesting keeps this to a single native text node, which matters: a long
 * result built from many sibling `Text` elements is measurably slower to measure
 * on Android than one string with inline styling.
 */
export function Highlighted({ text, needle }: { text: string; needle: string }) {
  const query = needle.trim();
  if (query.length < 2) return <>{text}</>;

  const lower = text.toLowerCase();
  const target = query.toLowerCase();

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    const hit = lower.indexOf(target, cursor);
    if (hit === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (hit > cursor) parts.push(text.slice(cursor, hit));
    parts.push(
      <Text key={`hit-${key++}`} style={styles.hit}>
        {text.slice(hit, hit + target.length)}
      </Text>,
    );
    cursor = hit + target.length;
  }

  return <>{parts}</>;
}

const styles = StyleSheet.create({
  root: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  results: {
    maxHeight: 320,
  },
  group: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  day: {
    paddingTop: spacing.xs,
  },
  result: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sender: {
    fontWeight: '700',
  },
  jumpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  hit: {
    fontWeight: '800',
  },
});