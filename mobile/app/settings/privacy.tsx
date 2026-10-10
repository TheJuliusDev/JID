/**
 * Privacy.
 *
 * One switch, deliberately. Last-seen sharing is the only privacy control that
 * affects what *other* people can infer about you in JID, and it is the one users
 * ask for. Everything else here is either already enforced or would be a promise
 * the app cannot keep.
 *
 * ## The switch is honest about what it changes
 *
 * Turning this off stops other people seeing when you were last active. It does
 * not make you invisible: they can still tell you are online while you have a
 * chat open, because that comes from a live Realtime presence connection and
 * suppressing it would mean lying about the connection the app already has. The
 * copy says so, because a privacy screen that quietly does less than it appears to
 * is worse than no screen at all.
 *
 * ## Enforced in the database, not here
 *
 * The change goes through `set_last_seen_visibility`, and the read path returns
 * `null` rather than a hidden timestamp once it is off. The data does not cross
 * the wire, so nothing already-fetched can keep rendering a stale "last seen" —
 * there is nothing to render.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Clock, Info } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useMessaging } from '@/providers/MessagingProvider';
import {
  getMyPresenceSettings,
  setLastSeenVisible,
} from '@/services/messaging/presence';
import { spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';

export default function PrivacySettingsScreen() {
  const { colors } = useTheme();
  const { capabilities } = useMessaging();

  const [visible, setVisible] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-read on focus so the switch reflects what is actually stored, rather than
  // an in-memory value that could drift from the database.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getMyPresenceSettings().then((settings) => {
        if (!cancelled) setVisible(settings.lastSeenVisible);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  /**
   * Optimistic toggle with rollback.
   *
   * The switch moves immediately because waiting on a round-trip makes the control
   * feel broken. If the write fails the value goes back and the user is told, rather
   * than being left looking at a setting the database never accepted.
   */
  const change = useCallback((next: boolean) => {
    if (saving) return;
    setVisible(next);
    setSaving(true);

    void setLastSeenVisible(next)
      .then(() => {
        if (next) return;
        Alert.alert(
          'Last seen is now private',
          'Nobody will be able to see when you were last active.',
        );
      })
      .catch(() => {
        setVisible(!next);
        Alert.alert(
          'Could not save',
          'Your last-seen setting was not changed. Please try again.',
        );
      })
      .finally(() => setSaving(false));
  }, [saving]);

  /**
   * Nothing to configure without the presence columns.
   *
   * Explains rather than rendering a dead switch, so an un-migrated database looks
   * like a missing feature instead of a preference that silently does nothing.
   */
  if (capabilities.resolved && !capabilities.presence) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <ScreenHeader title="Privacy" fallback="/settings" />
        <View style={styles.padded}>
          <Card padded>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>
              Privacy settings are not available yet
            </Text>
            <Text style={[typography.small, { color: colors.textMuted }]}>
              This needs the latest JID messaging update. Nothing about your profile is
              currently shared.
            </Text>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Privacy" subtitle="What other people can tell about you" fallback="/settings" />

      <View style={styles.padded}>
        <Card padded style={styles.switchCard}>
          <View style={styles.switchRow}>
            <View style={[styles.iconWell, { backgroundColor: colors.brandSoft }]}>
              <Clock size={17} color={colors.brand} />
            </View>

            <View style={styles.switchBody}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Last seen</Text>
              <Text style={[typography.small, { color: colors.textMuted }]}>
                Let people see when you were last active in the app.
              </Text>
            </View>

            {/**
             * Hidden rather than disabled while loading: a switch rendered in the
             * default position before the real value is read would show the wrong
             * answer for a moment, and for a privacy setting a momentary wrong
             * answer is the whole problem.
             */}
            {visible === null ? (
              <View style={{ width: 51, height: 31 }} />
            ) : (
              <Switch
                value={visible}
                onValueChange={change}
                disabled={saving}
                trackColor={{ false: colors.border, true: colors.brand }}
                thumbColor="#fff"
                accessibilityLabel="Show my last seen to other people"
              />
            )}
          </View>
        </Card>

        <Card padded style={styles.note}>
          <View style={styles.noteHeader}>
            <Info size={15} color={colors.textSubtle} />
            <Text style={[typography.bodyStrong, { color: colors.text }]}>What this does not hide</Text>
          </View>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            People can still see that you are online while you have a chat open. That comes
            from a live connection the app already has, and hiding it would mean reporting
            something untrue. Your profile, listings and saved items are always visible.
          </Text>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  padded: {
    padding: spacing.base,
    gap: spacing.md,
  },
  switchCard: {
    marginBottom: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBody: {
    flex: 1,
    gap: 2,
  },
  note: {
    marginBottom: 0,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
});