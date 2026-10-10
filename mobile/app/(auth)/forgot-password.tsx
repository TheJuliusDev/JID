/**
 * Password reset request.
 *
 * Always reports success, whether or not the address exists. Telling a stranger
 * that an email is registered is an account-enumeration leak; Supabase returns
 * the same neutral response server-side, and the UI should match it.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyRound, Mail } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth, isValidEmail } from '@/providers/AuthProvider';
import { AuthHero } from '@/components/ui/AuthHero';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { radius, spacing, typography } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sendPasswordReset, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  const submit = useCallback(async () => {
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setError(undefined);

    const failure = await sendPasswordReset(email);
    if (failure) {
      // A transport failure is worth showing; "no such account" is not.
      setError(failure);
      return;
    }
    setSent(true);
  }, [email, sendPasswordReset]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing['2xl'] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero compact />

        <View style={styles.card}>
          {sent ? (
            <>
              <View style={[styles.icon, { backgroundColor: colors.successSoft }]}>
                <KeyRound size={30} color={colors.success} strokeWidth={2} />
              </View>
              <Text style={[typography.heading, styles.title, { color: colors.text }]}>
                Check your inbox
              </Text>
              <Text style={[typography.body, styles.bodyText, { color: colors.textMuted }]}>
                If an account exists for{' '}
                <Text style={{ color: colors.text, fontWeight: '600' }}>{email.trim()}</Text>,
                we've sent a link to reset your password. It expires in one hour.
              </Text>
              <Button label="Back to sign in" onPress={() => router.replace('/(auth)/login')} size="lg" />
            </>
          ) : (
            <>
              <Text style={[typography.heading, styles.title, { color: colors.text }]}>
                Reset your password
              </Text>
              <Text style={[typography.body, styles.bodyText, { color: colors.textMuted }]}>
                Enter the email address you signed up with and we'll send you a reset link.
              </Text>
              <Input
                label="Email"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(undefined);
                }}
                placeholder="you@student.oauife.edu.ng"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon={<Mail size={17} color={colors.textMuted} />}
                error={error}
              />
              <Button
                label="Send reset link"
                onPress={() => {
                  void submit();
                }}
                loading={loading}
                size="lg"
              />
              <Button
                label="Back to sign in"
                onPress={() => router.replace('/(auth)/login')}
                variant="ghost"
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
});