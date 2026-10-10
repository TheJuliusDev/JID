/**
 * Create listing.
 *
 * A modal route with one job: pick the kind, then hand off to `<ListingForm>`.
 * The kind is a *query* param rather than a path segment so "sell an item" and
 * "list a lodge" share one route and one form, and so the tab bar's centre button
 * can open it without knowing which kind the user wants yet.
 *
 * Presented as a modal rather than a push: posting is a task you finish and
 * dismiss, not a step you back out of. A suspended account never reaches the
 * form at all â€” posting into a void the user cannot see is a dead end.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, Laptop, Store } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { Screen, ScreenHeader } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { Segmented } from '@/components/ui/Controls';
import { ListingForm } from '@/components/listing/ListingForm';
import type { ListingKind } from '@/types';

export default function CreateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ kind?: string }>();

  // Deep-linked as `/create?kind=property` from the empty lodges rail, so the
  // picker starts on the right kind instead of making the user re-choose.
  const [kind, setKind] = React.useState<ListingKind>(
    params.kind === 'property' ? 'property' : 'marketplace',
  );

  const changeKind = useCallback((next: ListingKind) => setKind(next), []);

  if (!profile) return null;

  if (profile.isSuspended) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <ScreenHeader title="Post a listing" fallback="/(tabs)" />
        <Screen scroll={false}>
          <EmptyState
            icon={Ban}
            title="Your account is suspended"
            message="Your listings are hidden and posting is disabled while your account is under review. Contact support if you think this is a mistake."
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Post a listing"
        subtitle="Free for every JID student"
        fallback="/(tabs)"
      />

      <Screen gap={spacing.base}>
        {/*
          The kind switcher sits above the form rather than inside it: it
          changes which field set renders below, so it belongs in the chrome the
          user can see is not part of the listing itself.
        */}
        <Segmented
          options={[
            { value: 'marketplace' as ListingKind, label: 'Sell an item' },
            { value: 'property' as ListingKind, label: 'List a lodge' },
          ]}
          value={kind}
          onChange={changeKind}
        />

        <View style={styles.hint}>
          <Card style={[styles.hintCard, { backgroundColor: colors.brandSoft, borderColor: colors.brandSoftBorder }]} padded={false}>
            <View style={styles.hintInner}>
              {kind === 'marketplace' ? (
                <Laptop size={18} color={colors.brand} strokeWidth={2} />
              ) : (
                <Store size={18} color={colors.brand} strokeWidth={2} />
              )}
              <Text style={[typography.small, { color: colors.brandText }]}>
                {kind === 'marketplace'
                  ? 'For laptops, phones, textbooks, furniture and anything else you want off your hands.'
                  : 'For rooms, bed spaces and lodges around Asherifa, Damico, Mayfair, Ede Road and Parakin.'}
              </Text>
            </View>
          </Card>
        </View>

        <ListingForm kind={kind} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hint: {
    marginBottom: -spacing.sm,
  },
  hintCard: {
    borderRadius: radius.md,
  },
  hintInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
  },
});