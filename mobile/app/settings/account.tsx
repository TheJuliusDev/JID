/**
 * Account settings.
 *
 * Edits the public half of the user's profile: name, username, department,
 * level, hall/area, bio and avatar. Email and password are deliberately *not*
 * editable here â€” email changes go through Supabase confirmation, and password
 * has its own screen â€” so this form can never lock a user out of their account.
 *
 * `saveProfile` writes the `profiles` row and reloads it, so a successful save
 * repaints the tab bar avatar without leaving the screen. Username uniqueness is
 * enforced by the database; the client validates the format first for instant
 * feedback.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { ALL_RESIDENTIAL_AREAS, BRAND, USERNAME_PATTERN } from '@/constants/brand';
import { radius, spacing, typography } from '@/constants/theme';
import { Screen, ScreenHeader } from '@/components/layout/Screen';
import { Avatar } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ChipRail } from '@/components/ui/Controls';
import { pickImages, uploadImage } from '@/services/cloudinary';
import { humanizeError } from '@/services/supabase';

export default function AccountSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { profile, saveProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [department, setDepartment] = useState(profile?.department ?? '');
  const [level, setLevel] = useState(profile?.level ?? '');
  const [area, setArea] = useState(profile?.hallOrArea ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const pickAvatar = useCallback(async () => {
    if (!profile) return;
    try {
      const [asset] = await pickImages(1);
      if (!asset) return;
      setUploading(true);
      const uploaded = await uploadImage(asset, { folder: `avatars/${profile.id}` });
      setAvatarUrl(uploaded.url);
    } catch (error) {
      toast.error(humanizeError(error));
    } finally {
      setUploading(false);
    }
  }, [profile, toast]);

  const save = useCallback(async () => {
    const next: Record<string, string | undefined> = {};
    if (!fullName.trim()) next.fullName = 'Enter your full name.';
    if (!USERNAME_PATTERN.test(username.trim())) {
      next.username = '3â€“20 characters: letters, numbers and underscores only.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const error = await saveProfile({
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      department: department.trim(),
      level,
      hallOrArea: area,
      bio: bio.trim(),
      avatarUrl: avatarUrl || undefined,
    });
    setSaving(false);

    if (error) {
      // A taken username surfaces as a unique-constraint violation; point at the
      // field rather than showing a generic banner.
      if (/username/i.test(error)) setErrors({ username: error });
      else toast.error(error);
      return;
    }
    toast.success('Profile updated.');
    router.back();
  }, [fullName, username, department, level, area, bio, avatarUrl, saveProfile, toast, router]);

  if (!profile) return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Account" fallback="/(tabs)" />

      <Screen gap={spacing.lg}>
        <View style={styles.avatarRow}>
          <Pressable
            onPress={() => void pickAvatar()}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={styles.avatarPress}
          >
            <Avatar uri={avatarUrl} name={fullName || profile.username} size={88} showRing />
            <View
              style={[
                styles.camera,
                { backgroundColor: colors.brand, borderColor: colors.bg },
              ]}
            >
              <Camera size={16} color={colors.onBrand} />
            </View>
          </Pressable>
          <View style={styles.avatarText}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>
              {uploading ? 'Uploading photoâ€¦' : 'Profile photo'}
            </Text>
            <Text style={[typography.small, { color: colors.textMuted }]}>
              A clear face or logo helps buyers trust you. Optional.
            </Text>
          </View>
        </View>

        <Input
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full name"
          autoCapitalize="words"
          error={errors.fullName}
        />

        <Input
          label="Username"
          value={username}
          onChangeText={(t) => {
            setUsername(t);
            setErrors((e) => ({ ...e, username: undefined }));
          }}
          placeholder="e.g. greatife_deals"
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.username}
          helperText="Your public handle. Letters, numbers and underscores."
        />

        <Input
          label="Department"
          value={department}
          onChangeText={setDepartment}
          placeholder="Computer Science"
          autoCapitalize="words"
        />

        <View style={styles.field}>
          <Text style={[typography.smallStrong, { color: colors.text }]}>Level</Text>
          <ChipRail options={BRAND.levels} value={level} onChange={(v) => setLevel(v ?? '')} size="sm" />
        </View>

        <View style={styles.field}>
          <Text style={[typography.smallStrong, { color: colors.text }]}>Hall / Area</Text>
          <ChipRail
            options={ALL_RESIDENTIAL_AREAS}
            value={area}
            onChange={(v) => setArea(v ?? '')}
            size="sm"
          />
        </View>

        <Input
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Tell buyers a little about yourself"
          multiline
          numberOfLines={4}
          maxLength={280}
        />

        <Button label="Save changes" onPress={() => void save()} loading={saving} size="lg" />

        <Text style={[typography.caption, { color: colors.textSubtle }]}>
          Your email ({profile.email}) is used for sign-in and never shown on your profile.
        </Text>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  avatarPress: {
    position: 'relative',
  },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    flex: 1,
    gap: spacing.xs,
  },
  field: {
    gap: spacing.sm,
  },
});
