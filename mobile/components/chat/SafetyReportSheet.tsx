/**
 * Reporting flow for the messaging surfaces.
 *
 * Distinct from `components/listing/ReportSheet`, which reports a *listing* and
 * sources its categories from `BRAND.reportReasons`. This one reports a person,
 * a single message, or a whole conversation, and it writes through
 * `services/messaging/safety` so a chat report lands in the same moderation queue
 * a profile report does.
 *
 * Three targets, one sheet:
 *
 *   - `user`        — "this person is a problem", no message context.
 *   - `message`     — "this specific line is a problem", snapshots the message id
 *                     and its conversation so a moderator sees it in context.
 *   - `conversation`— the middle ground: something is wrong here but no single
 *                     message is the culprit.
 *
 * The user is shown a confirmation and nothing else. There is deliberately no
 * status to check and no queue to read: moderation state is not something a
 * normal account should be able to observe, and being able to watch a report
 * being ignored is worse than not filing one.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { ShieldCheck } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  REPORT_REASONS,
  reportMessage,
  reportUser,
  type SafetyReportTarget,
} from '@/services/messaging/safety';
import type { SafetyReportReason } from '@/types';

export interface SafetyReportSheetProps {
  visible: boolean;
  target: SafetyReportTarget | null;
  /** Called after a successful submit, with a message worth showing as a toast. */
  onSubmitted: (message: string) => void;
  onClose: () => void;
  /** Injected so the sheet can surface failures without owning a toast context. */
  onError: (message: string) => void;
}

export function SafetyReportSheet({
  visible,
  target,
  onSubmitted,
  onClose,
  onError,
}: SafetyReportSheetProps) {
  const { colors } = useTheme();

  const [reason, setReason] = useState<SafetyReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset on every open. A reason carried over from a previous report would
  // silently re-file the same complaint against someone new.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setDetails('');
      setSubmitting(false);
    }
  }, [visible]);

  const submit = useCallback(async () => {
    if (!reason || !target) return;
    setSubmitting(true);

    try {
      if (target.type === 'message') {
        await reportMessage(target.userId, {
          reason,
          details: details.trim() || undefined,
          messageId: target.messageId,
          conversationId: target.conversationId,
        });
      } else if (target.type === 'conversation') {
        // Carries the conversation id so moderation can read the thread the
        // report is about. Without it this arrives as a bare "this user is a
        // problem" with nothing to triage against.
        await reportUser(target.userId, {
          reason,
          details: details.trim() || undefined,
          conversationId: target.conversationId,
        });
      } else {
        // A report about a person with no conversation in view — a profile, or a
        // listing comment. There is no thread to point at, so none is sent.
        await reportUser(target.userId, { reason, details: details.trim() || undefined });
      }

      // Past this point the report is filed and there is nothing further to show
      // the user, by design.
      onSubmitted('Report sent. Our moderators will review it.');
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not send your report.');
    } finally {
      setSubmitting(false);
    }
  }, [reason, details, target, onSubmitted, onClose, onError]);

  const description = describe(target);

  return (
    <Sheet
      visible={visible}
      snapPoints={['78%']}
      onClose={onClose}
      header={
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: colors.brandSoft }]}>
            <ShieldCheck size={19} color={colors.brand} />
          </View>
          <Text style={[typography.heading, { color: colors.text }]}>Report</Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>{description}</Text>
        </View>
      }
      footer={
        <View>
          <Button
            label="Submit report"
            onPress={() => void submit()}
            loading={submitting}
            disabled={!reason}
            size="lg"
            />
          </View>
        }
    >
        <View style={styles.reasons}>
          {REPORT_REASONS.map((option) => {
                const selected = reason === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setReason(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.label}. ${option.help}`}
                    style={({ pressed }) => [
                      styles.reasonCard,
                      {
                        backgroundColor: selected ? colors.brandSoft : colors.surface,
                        borderColor: selected ? colors.brand : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                      ]}
                    >
                    <View style={styles.reasonText}>
                      <Text
                        style={[
                          typography.bodyStrong,
                          { color: selected ? colors.brand : colors.text },
                          ]}
                        >
                        {option.label}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSubtle }]}>
                        {option.help}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radio,
                        { borderColor: selected ? colors.brand : colors.borderStrong },
                        ]}
                      >
                      {selected ? (
                          <View style={[styles.radioDot, { backgroundColor: colors.brand }]} />
                        ) : null}
                    </View>
                  </Pressable>
                );
              })}
        </View>

        <Input
          label="Anything else? (optional)"
          value={details}
          onChangeText={setDetails}
          placeholder="Add detail that helps us understand what happened"
          multiline
          numberOfLines={4}
          maxLength={500}
        />

          <Text style={[typography.caption, styles.note, { color: colors.textSubtle }]}>
            The person you are reporting is not told who reported them. We review every report, and
            confirmed reports lead to account suspension.
          </Text>
    </Sheet>
  );
}

/** One line telling the user exactly what they are reporting. */
function describe(target: SafetyReportTarget | null): string {
  if (!target) return 'Tell us what went wrong.';
  const who = target.displayName ? `${target.displayName}'s ` : '';
  if (target.type === 'message') return `Tell us what is wrong with this message from ${who}account.`;
  if (target.type === 'conversation') return `Tell us what is wrong with your conversation with ${who}account.`;
  return `Tell us what is wrong with ${who}account.`;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  reasons: {
    gap: spacing.sm,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  reasonText: {
    flex: 1,
    gap: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
  },
  note: {
    lineHeight: 16,
  },
});





