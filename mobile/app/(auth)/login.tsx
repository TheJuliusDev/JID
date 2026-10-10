/**
 * Sign in.
 *
 * Validates locally before touching the network, because Supabase's rate
 * limiter counts failed attempts from the client and a user fat-fingering their
 * password offline should not burn one.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth, isValidEmail } from '@/providers/AuthProvider';
import { AuthHero } from '@/components/ui/AuthHero';
import { Input, PasswordInput } from '@/components/ui/Input';
import { Button, TextButton } from '@/components/ui/Button';
import { spacing, typography } from '@/constants/theme';

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const submit = useCallback(async () => {
    const next: typeof errors = {};

    if (!email.trim()) next.email = 'Enter your email address.';
    else if (!isValidEmail(email)) next.email = "That doesn't look like an email address.";

    if (!password) next.password = 'Enter your password.';

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const error = await signIn(email, password);
    // A successful sign-in needs no redirect here: the auth gate in the root
    // layout swaps routes as soon as the session lands, and navigating
    // manually would race it.
    if (error) setErrors({ form: error });
  }, [email, password, signIn]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing['2xl'] },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero />

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
            }}
            placeholder="you@student.oauife.edu.ng"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            leftIcon={<Mail size={17} color={colors.textMuted} />}
            error={errors.email}
            returnKeyType="next"
          />

          <PasswordInput
            label="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
            }}
            placeholder="Your password"
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            error={errors.password}
            returnKeyType="go"
            onSubmitEditing={() => {
              void submit();
            }}
          />

          {errors.form ? (
            <View style={[styles.formError, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder }]}>
              <Text style={[typography.small, { color: colors.danger }]}>{errors.form}</Text>
            </View>
          ) : null}

          <Button
            label="Sign in"
            onPress={() => {
              void submit();
            }}
            loading={loading}
            size="lg"
          />

          <View style={styles.forgot}>
            <TextButton label="Forgot password?" onPress={() => router.push('/(auth)/forgot-password')} />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.footer}>
            <Text style={[typography.body, { color: colors.textMuted }]}>New to JID?</Text>
            <Link href="/(auth)/signup" asChild>
              <Pressable hitSlop={8} accessibilityRole="link">
                <Text style={[typography.bodyStrong, { color: colors.brand }]}>
                  Create an account
                </Text>
              </Pressable>
            </Link>
          </View>
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
  form: {
    paddingHorizontal: spacing.lg,
    gap: spacing.base,
  },
  forgot: {
    alignItems: 'center',
    marginTop: -spacing.xs,
  },
  formError: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});