/**
 * Password settings.
 *
 * Two flows in one screen:
 *   - change the password directly (the user has an active session), and
 *   - send a reset email, for when they would rather verify through their inbox.
 *
 * The direct change uses `supabase.auth.updateUser`, which does not require the
 * current password â€” the live session already proves identity. Confirmation is
 * required so a typo cannot lock the account behind a password nobody knows.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useAuth, PASSWORD_RULES, validatePassword } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { getSupabase, humanizeError } from '@/services/supabase';
import { radius, spacing, typography } from '@/constants/theme';
import { Screen, ScreenHeader } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function PasswordSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { profile, sendPasswordReset } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const passed = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(password) })),
    [password],
  );
  const allPassed = passed.every((r) => r.ok);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = allPassed && matches;

  const change = useCallback(async () => {
    const problem = validatePassword(password);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (password !== confirm) {
      toast.error('The two passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated.');
      setPassword('');
      setConfirm('');
      router.back();
    } catch (error) {
      toast.error(humanizeError(error));
    } finally {
      setSaving(false);
    }
  }, [password, confirm, toast, router]);

  const emailReset = useCallback(async () => {
    if (!profile) return;
    setSendingReset(true);
    const error = await sendPasswordReset(profile.email);
    setSendingReset(false);
    if (error) toast.error(error);
    else toast.success(`Reset link sent to ${profile.email}.`);
  }, [profile, sendPasswordReset, toast]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Password" fallback="/(tabs)" />

      <Screen gap={spacing.lg}>
        <Input
          label="New password"
          value={password}
          onChangeText={setPassword}
          placeholder="Create a strong password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <View style={styles.rules}>
          {passed.map((rule) => (
            <View key={rule.label} style={styles.rule}>
              <View
                style={[
                  styles.ruleDot,
                  {
                    backgroundColor: rule.ok ? colors.success : colors.surfaceAlt,
                    borderColor: rule.ok ? colors.success : colors.borderStrong,
                  },
                ]}
              >
                {rule.ok ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
              <Text
                style={[
                  typography.small,
                  { color: rule.ok ? colors.success : colors.textMuted },
                ]}
              >
                {rule.label}
              </Text>
            </View>
          ))}
        </View>

        <Input
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Repeat the password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          error={confirm.length > 0 && !matches ? 'Passwords do not match.' : undefined}
        />

        <Button
          label="Update password"
          onPress={() => void change()}
          loading={saving}
          disabled={!canSubmit}
          size="lg"
        />

        <View style={[styles.altCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>
            Prefer a reset link?
          </Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            We can email a secure link to {profile?.email ?? 'your inbox'} instead.
          </Text>
          <Button
            label="Email me a reset link"
            variant="outline"
            onPress={() => void emailReset()}
            loading={sendingReset}
          />
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rules: {
    gap: spacing.sm,
    marginTop: -spacing.sm,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ruleDot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.base,
    gap: spacing.sm,
  },
});
