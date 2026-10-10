/**
 * Create account.
 *
 * Collects the five profile fields that the `handle_new_user` database trigger
 * uses to build the `profiles` and `user_roles` rows. Those values are passed as
 * `options.data` at sign-up — the trigger runs server-side, so a modified
 * client cannot grant itself a role or forge a profile.
 *
 * The username field checks availability on a debounce, because username is the
 * one field with a uniqueness constraint that would otherwise surface only as a
 * failed submit after the whole form is filled in.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { AtSign, Mail, User } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth, isValidEmail, validatePassword, validateUsername, PASSWORD_RULES } from '@/providers/AuthProvider';
import { AuthHero } from '@/components/ui/AuthHero';
import { Input, PasswordInput } from '@/components/ui/Input';
import { Button, TextButton } from '@/components/ui/Button';
import { Checkbox as JidCheckbox, ChipRail, Segmented } from '@/components/ui/Controls';
import { useDebouncedValue } from '@/hooks';
import { isUsernameAvailable } from '@/services/database';
import { BRAND } from '@/constants/brand';
import { radius, spacing, typography } from '@/constants/theme';

type UsernameState = 'idle' | 'checking' | 'available' | 'taken';

export default function SignupScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, loading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState<string | null>(null);
  const [residence, setResidence] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');

  const debouncedUsername = useDebouncedValue(username.trim().toLowerCase(), 500);

  /**
   * Availability probe.
   *
   * `isUsernameAvailable` returns false for both "taken" and "network error",
   * so a failure is deliberately reported as `idle` rather than "taken" — the
   * user should not be told their username is unavailable when Supabase is
   * simply unreachable.
   */
  useEffect(() => {
    const name = debouncedUsername;
    if (!name || validateUsername(name)) {
      setUsernameState('idle');
      return;
    }

    let cancelled = false;
    setUsernameState('checking');

    void (async () => {
      try {
        const available = await isUsernameAvailable(name);
        if (!cancelled) setUsernameState(available ? 'available' : 'taken');
      } catch {
        if (!cancelled) setUsernameState('idle');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedUsername]);

  const residenceOptions = useMemo(
    () => [...BRAND.campusLocations.halls, ...BRAND.campusLocations.offCampusAreas],
    [],
  );

  const validate = useCallback((): boolean => {
    const next: Record<string, string | undefined> = {};

    if (!fullName.trim()) next.fullName = 'Enter your full name.';
    else if (fullName.trim().length < 2) next.fullName = 'That name looks too short.';

    const usernameError = validateUsername(username);
    if (usernameError) next.username = usernameError;
    else if (usernameState === 'taken') next.username = 'That username is taken.';

    if (!email.trim()) next.email = 'Enter your email address.';
    else if (!isValidEmail(email)) next.email = "That doesn't look like an email address.";

    const passwordError = validatePassword(password);
    if (passwordError) next.password = passwordError;

    if (!department.trim()) next.department = 'Enter your department.';

    if (!accepted) next.accepted = 'Please accept the Terms and Privacy Policy.';

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [fullName, username, usernameState, email, password, department, accepted]);

  const submit = useCallback(async () => {
    if (!validate()) return;

    const error = await signUp({
      email,
      password,
      fullName,
      username: username.trim().toLowerCase(),
      department: department.trim(),
      level: level ?? '',
      hallOrArea: residence ?? '',
    });

    if (!error) return;

    if (error === 'CHECK_EMAIL') {
      // Supabase is configured to require email confirmation. There is no
      // session yet, so tell the user what to do rather than dumping them on a
      // login screen they would fail.
      router.replace('/(auth)/check-email?email=' + encodeURIComponent(email.trim()));
      return;
    }

    setErrors({ form: error });
  }, [validate, signUp, email, password, fullName, username, department, level, residence, router]);

  const usernameFeedback =
    usernameState === 'checking'
      ? 'Checking availability…'
      : usernameState === 'available'
        ? 'Username available'
        : usernameState === 'taken'
          ? 'Already taken — try another'
          : '3–20 letters, numbers or underscores';

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
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
        <AuthHero compact />

        <View style={styles.form}>
          <Input
            label="Full name"
            value={fullName}
            onChangeText={(t) => {
              setFullName(t);
              setErrors((e) => ({ ...e, fullName: undefined }));
            }}
            placeholder="Adesola Adeyemi"
            autoCapitalize="words"
            autoComplete="name"
            leftIcon={<User size={17} color={colors.textMuted} />}
            error={errors.fullName}
          />

          <Input
            label="Username"
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              setErrors((e) => ({ ...e, username: undefined }));
            }}
            placeholder="adesola_200"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<AtSign size={17} color={colors.textMuted} />}
            helperText={usernameFeedback}
            error={errors.username}
          />

          <Input
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setErrors((e) => ({ ...e, email: undefined }));
            }}
            placeholder="you@student.oauife.edu.ng"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={<Mail size={17} color={colors.textMuted} />}
            error={errors.email}
          />

          <Input
            label="Department"
            value={department}
            onChangeText={(t) => {
              setDepartment(t);
              setErrors((e) => ({ ...e, department: undefined }));
            }}
            placeholder="Computer Science"
            autoCapitalize="words"
            error={errors.department}
          />

          <Field label="Level">
            <Segmented
              options={[
                { value: '100L–200L', label: '100L–200L' },
                { value: '300L–400L', label: '300L–400L' },
                { value: '500L+', label: '500L+' },
              ]}
              value={level ?? ''}
              onChange={(v) => setLevel(v === level ? null : v)}
            />
          </Field>

          <Field label="Hall / Area">
            <ChipRail
              options={residenceOptions}
              value={residence}
              onChange={setResidence}
              size="sm"
              contentStyle={styles.railFlush}
            />
          </Field>

          <PasswordInput
            label="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setErrors((e) => ({ ...e, password: undefined }));
            }}
            placeholder="Create a strong password"
            autoCapitalize="none"
            autoComplete="new-password"
            error={errors.password}
          />

          <PasswordRules value={password} />

          <JidCheckbox
            checked={accepted}
            onToggle={() => {
              setAccepted((v) => !v);
              setErrors((e) => ({ ...e, accepted: undefined }));
            }}
            label=""
          />
          <View style={styles.consent}>
            <Text style={[typography.small, { color: colors.textMuted }]}>
              I agree to JID's{' '}
            </Text>
            <TextButton label="Terms of Use" onPress={() => router.push('/settings/terms')} />
            <Text style={[typography.small, { color: colors.textMuted }]}> and </Text>
            <TextButton label="Privacy Policy" onPress={() => router.push('/settings/terms')} />
            <Text style={[typography.small, { color: colors.textMuted }]}>.</Text>
          </View>
          {errors.accepted ? (
            <Text style={[typography.small, { color: colors.danger }]}>{errors.accepted}</Text>
          ) : null}

          {errors.form ? (
            <View style={[styles.formError, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder }]}>
              <Text style={[typography.small, { color: colors.danger }]}>{errors.form}</Text>
            </View>
          ) : null}

          <Button
            label="Create account"
            onPress={() => {
              void submit();
            }}
            loading={loading}
            size="lg"
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.footer}>
            <Text style={[typography.body, { color: colors.textMuted }]}>Already on JID?</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable hitSlop={8} accessibilityRole="link">
                <Text style={[typography.bodyStrong, { color: colors.brand }]}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Label wrapper so form fields have consistent spacing without a `label` prop. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[typography.smallStrong, { color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * Live password policy checklist.
 *
 * Turns an opaque "passwords don't match" into four concrete, checkable
 * requirements that update as the user types.
 */
function PasswordRules({ value }: { value: string }) {
  const { colors } = useTheme();

  return (
    <Animated.View style={styles.rules} entering={FadeIn.duration(180)}>
      {PASSWORD_RULES.map((rule) => {
        const passed = value.length > 0 && rule.test(value);
        return (
          <View key={rule.label} style={styles.rule}>
            <View
              style={[
                styles.ruleDot,
                {
                  backgroundColor: passed ? colors.brand : colors.surfaceAlt,
                  borderColor: passed ? colors.brand : colors.borderStrong,
                },
              ]}
            />
            <Text
              style={[
                typography.caption,
                { color: passed ? colors.brandText : colors.textSubtle },
              ]}
            >
              {rule.label}
            </Text>
          </View>
        );
      })}
    </Animated.View>
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
  field: {
    gap: spacing.sm,
  },
  railFlush: {
    paddingHorizontal: 0,
    marginHorizontal: -spacing.xs,
  },
  rules: {
    gap: spacing.sm,
    marginTop: -spacing.xs,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ruleDot: {
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  consent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
    marginTop: -spacing.sm,
  },
  formError: {
    borderRadius: radius.md,
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