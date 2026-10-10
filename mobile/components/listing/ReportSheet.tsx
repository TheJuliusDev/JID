/**
 * Report sheet.
 *
 * Reporting is offered for both listings and users, and the reason list is
 * fixed by moderation policy (`BRAND.reportReasons`) rather than free text — a
 * structured reason is what makes the admin triage queue usable. An optional
 * free-text box is still offered for the "other" case.
 *
 * The submit itself lives in `DataContext.reportListing` / `reportUser` so the
 * RLS-backed insert and its toast handling stay in one place.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';

import { useTheme } from '@/providers/ThemeProvider';
import { useData } from '@/providers/DataProvider';
import { BRAND } from '@/constants/brand';
import { spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Controls';

export interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Listing reports and user reports have different payloads. */
  target:
    | { type: 'listing'; listingType: 'marketplace' | 'property'; listingId: string; listingTitle: string }
    | { type: 'user'; userId: string; displayName: string };
}

export function ReportSheet({ visible, onClose, target }: ReportSheetProps) {
  const { colors } = useTheme();
  const { reportListing, reportUser } = useData();

  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset on every open so a previous submission's reason does not pre-select
  // itself for the next report.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setDetails('');
      setSubmitting(false);
    }
  }, [visible]);

  const submit = useCallback(async () => {
    if (!reason) return;
    setSubmitting(true);

    const ok =
      target.type === 'listing'
        ? await reportListing({
            listingType: target.listingType,
            listingId: target.listingId,
            listingTitle: target.listingTitle,
            reason,
            details: details.trim() || undefined,
          })
        : await reportUser({
            reportedUserId: target.userId,
            reason,
            details: details.trim() || undefined,
          });

    setSubmitting(false);
    if (ok) onClose();
  }, [reason, details, target, reportListing, reportUser, onClose]);

  const description =
    target.type === 'listing'
      ? `Tell us what's wrong with "${target.listingTitle}".`
      : `Tell us what's wrong with ${target.displayName}'s account.`;

  return (
    <Sheet
      visible={visible}
      snapPoints={['70%']}
      onClose={onClose}
      title="Report"
      subtitle={description}
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
          {BRAND.reportReasons.map((r) => (
                <Chip
                  key={r.id}
                  label={r.label}
                  selected={reason === r.id}
                  onPress={() => setReason(r.id)}
                />
                ))}
          </View>

          <Input
            label="Anything else? (optional)"
            value={details}
            onChangeText={setDetails}
            placeholder="Add detail that helps our moderators"
            multiline
            numberOfLines={4}
            maxLength={500}
          />

            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              Reports are anonymous to the person you are reporting. We review every one, and repeated
              confirmed reports lead to suspension.
            </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reasons: {
    gap: spacing.sm,
  },
});





