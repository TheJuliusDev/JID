/**
 * The chat composer.
 *
 * Owns input mechanics only: text, attachments in flight, reply targeting, and
 * the voice gesture. It performs no uploads and inserts no rows — every action is
 * emitted upward so the thread screen owns the send lifecycle, the optimistic
 * placeholders, and retry. That split is what lets the same composer be dropped
 * into a thread, a group, or a future listing-inquiry sheet without inheriting a
 * transcript's state.
 *
 * The input row adapts to its context rather than showing every control at once,
 * because a phone-width row cannot hold a text field, four buttons and a send
 * affordance legibly:
 *
 *  - text present   -> attach, camera, growing field, send
 *  - empty, idle    -> attach, camera, field, mic
 *  - recording      -> attach, camera, recording bar (mic morphs in place)
 *
 * The mic morphing *in place* is a correctness requirement, not a styling choice:
 * see the note on the single `PanResponder` in `VoiceRecorder`.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Keyboard,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';
import { ImagePlus, Camera, Send, Mic, ImageOff } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography, HIT_SLOP } from '@/constants/theme';
import { quotePreview } from '@/services/messaging/codec';
import type { Message } from '@/types';
import type { OptimisticPhoto } from '@/utils/chatPhotos';
import { AttachmentPreview } from './AttachmentPreview';
import { QuickReplies } from './QuickReplies';
import { RecordingBar } from './RecordingBar';
import { ReplyPreview } from './ReplyPreview';
import { useVoiceRecorder, type VoiceClip } from './VoiceRecorder';

/** Cap on a single message. Enough for a paragraph, short enough to render. */
export const MAX_CHAT_TEXT = 4000;
/** Single-line height, matching the other controls in the row. */
const FIELD_MIN_HEIGHT = 44;
/** Past this the field scrolls instead of growing, so it cannot eat the transcript. */
const FIELD_MAX_HEIGHT = 120;

interface ComposerProps {
  /** Shown instead of the field, e.g. while the other user is blocked. */
  disabled?: boolean;
  disabledHint?: string;
  /** The message being replied to, if any. */
  replyTo?: Message | null;
  /** Photos queued or uploading. */
  photos?: OptimisticPhoto[];
  /** Contextual suggestions; the rail hides once the user types or sends. */
  quickReplies?: readonly string[];
  /** True while a send is in flight, to stop double submits. */
  busy?: boolean;

  onSendText: (text: string) => void;
  onPickImage: () => void;
  onCaptureImage: () => void;
  onSendVoice: (clip: VoiceClip) => void;
  onCancelReply: () => void;
  onJumpToReply?: () => void;
  onCancelPhoto: (clientId: string) => void;
  onDismissQuickReplies: () => void;
  onError: (message: string) => void;
}

export function Composer({
  disabled,
  disabledHint,
  replyTo,
  photos = [],
  quickReplies,
  busy,
  onSendText,
  onPickImage,
  onCaptureImage,
  onSendVoice,
  onCancelReply,
  onJumpToReply,
  onCancelPhoto,
  onDismissQuickReplies,
  onError,
}: ComposerProps) {
  const { colors } = useTheme();

  const [text, setText] = useState('');
  const [fieldHeight, setFieldHeight] = useState(FIELD_MIN_HEIGHT);
  const inputRef = useRef<TextInput>(null);

  const recorder = useVoiceRecorder({
    onSend: onSendVoice,
    // The user slid to cancel; the recorded bytes are simply dropped.
    onCancel: () => undefined,
    onError,
  });

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !busy;
  const hasText = trimmed.length > 0;
  const showQuickReplies = !hasText && photos.length === 0 && !disabled;
  const nearLimit = trimmed.length > MAX_CHAT_TEXT * 0.9;

  const submit = useCallback(() => {
    if (!trimmed || busy) return;
    onSendText(trimmed);
    // Clearing immediately is deliberate: the transcript echoes the message at
    // once, so holding the text would just invite a double send.
    setText('');
    setFieldHeight(FIELD_MIN_HEIGHT);
  }, [trimmed, busy, onSendText]);

  const handleQuickReply = useCallback((suggestion: string) => {
    // Draft rather than send, so an accidental tap is editable rather than
    // an unsendable message.
    setText(suggestion);
    Keyboard.dismiss();
    inputRef.current?.focus();
  }, []);

  const handleContentSize = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      // Grow with the content up to a ceiling, then let the field scroll, so a
      // long paste cannot push the transcript off screen.
      const next = Math.min(
        FIELD_MAX_HEIGHT,
        Math.max(FIELD_MIN_HEIGHT, event.nativeEvent.contentSize.height),
      );
      setFieldHeight(next);
    },
    [],
  );

  const showAttachment = useMemo(
    () =>
      photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.attachments}
        >
          {photos.map((photo) => (
            <AttachmentPreview
              key={photo.clientId}
              photo={photo}
              onCancel={() => onCancelPhoto(photo.clientId)}
            />
          ))}
        </ScrollView>
      ),
    [photos, onCancelPhoto],
  );

  if (disabled) {
    return (
      <View
        style={[
          styles.container,
          styles.disabledWrap,
          { backgroundColor: colors.bgElevated, borderTopColor: colors.border },
        ]}
      >
        <View style={[styles.disabledIcon, { backgroundColor: colors.surfaceAlt }]}>
          <ImageOff size={17} color={colors.textSubtle} />
        </View>
        <Text style={[typography.small, { color: colors.textSubtle }]}>
          {disabledHint ?? 'You can no longer send messages in this chat.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgElevated }]}>
      {showAttachment}

      {replyTo ? (
        <ReplyPreview
          /**
           * `quotePreview` resolves the storage encoding into something a person
           * would recognise: "Photo" or "Voice message" rather than the raw
           * `jid://photo/<url>` string that a photo message stores in `content`.
           * Quoting the encoded value would put a URL in the composer.
           */
          quote={quotePreview(replyTo)}
          deleted={Boolean(replyTo.deletedForEveryoneAt || replyTo.deletedAt)}
          onCancel={onCancelReply}
          onJump={onJumpToReply}
        />
      ) : null}

      {showQuickReplies && quickReplies?.length ? (
        <QuickReplies
          suggestions={quickReplies}
          onSelect={handleQuickReply}
          onDismiss={onDismissQuickReplies}
        />
      ) : null}

      <View style={styles.row}>
        <Pressable
          onPress={onPickImage}
          disabled={busy}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Send a photo"
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
        >
          <ImagePlus size={21} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={onCaptureImage}
          disabled={busy}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
        >
          <Camera size={20} color={colors.textMuted} />
        </Pressable>

        <View
          style={[
            styles.fieldWrap,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={colors.textSubtle}
            multiline
            style={[styles.field, { color: colors.text, height: fieldHeight }]}
            maxLength={MAX_CHAT_TEXT}
            editable={!busy}
            onContentSizeChange={handleContentSize}
            // Chat should keep the keyboard open while the transcript scrolls.
            scrollEnabled={fieldHeight >= FIELD_MAX_HEIGHT}
            textAlignVertical="center"
            accessibilityLabel="Message"
          />

          {nearLimit ? (
            <Text
              style={[
                typography.caption,
                styles.counter,
                { color: trimmed.length >= MAX_CHAT_TEXT ? colors.danger : colors.textSubtle },
              ]}
            >
              {MAX_CHAT_TEXT - trimmed.length}
            </Text>
          ) : null}
        </View>

        {hasText ? (
          <SendButton enabled={canSend} onPress={submit} />
        ) : (
          /**
           * The mic and its recording bar share this one view. Keeping the
           * responder mounted is what guarantees `onPanResponderRelease` fires
           * after a long press, so a recording can always be finished.
           */
          <View {...recorder.panHandlers} style={styles.micSlot}>
            {recorder.isRecording ? (
              <RecordingBar
                durationMs={recorder.durationMs}
                amplitudes={recorder.amplitudes}
                dragX={recorder.dragX}
                cancelArmed={recorder.cancelArmed}
              />
            ) : (
              <Pressable
                onPress={() => Keyboard.dismiss()}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel="Hold to record a voice message"
                style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
              >
                <Mic size={21} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/** Send button with the app's press spring. */
function SendButton({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel="Send message"
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.sendButton,
        {
          backgroundColor: enabled ? colors.brand : colors.surfaceAlt,
          transform: [{ scale: pressed && enabled ? 0.92 : 1 }],
        },
      ]}
    >
      <Send size={18} color={enabled ? colors.onBrand : colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: FIELD_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldWrap: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    minHeight: FIELD_MIN_HEIGHT,
  },
  field: {
    fontSize: 15,
    lineHeight: 20,
    paddingTop: 0,
    paddingBottom: 0,
    // Room for the near-limit counter without shifting the baseline.
    paddingRight: spacing.xl,
  },
  counter: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xs,
  },
  micSlot: {
    // Fills the row while recording so the bar can breathe; collapses to the
    // button's own size otherwise.
    minWidth: 40,
  },
  sendButton: {
    width: FIELD_MIN_HEIGHT,
    height: FIELD_MIN_HEIGHT,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Matches the app's press spring.
    transform: [{ scale: 1 }],
  },
  attachments: {
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xs,
  },
  replySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  replyBar: {
    width: 3,
    height: 34,
    borderRadius: radius.pill,
  },
  replyBody: {
    flex: 1,
    gap: 1,
  },
  disabledWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  disabledIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});