/**
 * "Check your email" confirmation.
 *
 * Reached when the project has email confirmation enabled: `signUp` returns no
 * session, so the user is not signed in yet. Sending them to the login screen
 * instead would be actively misleading, because they cannot log in until they
 * click the link.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MailCheck, RotateCw } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { AuthHero } from '@/components/ui/AuthHero';
import { Button } from '@/components/ui/Button';
import { radius, spacing, typography } from '@/constants/theme';

export default function CheckEmailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const goToLogin = useCallback(() => {
    router.replace('/(auth)/login');
  }, [router]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing['2xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AuthHero compact />

        <View style={styles.card}>
          <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}>
            <MailCheck size={30} color={colors.brand} strokeWidth={2} />
          </View>
          <Text style={[typography.heading, styles.title, { color: colors.text }]}>
            Confirm your email
          </Text>
          <Text style={[typography.body, styles.bodyText, { color: colors.textMuted }]}>
            We sent a confirmation link to
          </Text>
          <Text style={[typography.bodyStrong, styles.email, { color: colors.brand }]}>
            {email || 'your email address'}
          </Text>
          <Text style={[typography.small, styles.hint, { color: colors.textMuted }]}>
            Open the link to activate your account, then come back and sign in. If it doesn't
            arrive within a few minutes, check your spam folder.
          </Text>

          <Button
            label="Back to sign in"
            onPress={goToLogin}
            variant="secondary"
            size="lg"
          />
          <Button
            label="Resend email"
            icon={RotateCw}
            onPress={goToLogin}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
  },
  card: {
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.xl,
    gap: spacing.base,
    alignItems: 'center',
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  bodyText: {
    textAlign: 'center',
  },
  email: {
    textAlign: 'center',
    marginTop: -spacing.md,
  },
  hint: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});