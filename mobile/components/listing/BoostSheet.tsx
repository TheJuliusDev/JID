/**
 * Listing boost sheet.
 *
 * A boost is the app's only monetisation: watch `BRAND.boostRules.requiredAdsCount`
 * rewarded ads to get `BRAND.boostRules.durationHours` hours at the top of
 * Explore and Home.
 *
 * The rule this screen exists to enforce: a reward is only recorded when an ad
 * provider actually confirmed it. If no provider is bundled (`boostsAvailable()`
 * is false) the sheet says so and offers nothing to buy — an app that silently
 * grants a "paid" boost for free is worse than one that admits it cannot.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Play, Sparkles, VideoOff } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { boostsAvailable, getRewardedAdProvider } from '@/services/ads';
import { applyBoostToListing, createBoost } from '@/services/database';
import { humanizeError } from '@/services/supabase';
import { BRAND } from '@/constants/brand';
import { radius, spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/Controls';

export interface BoostSheetProps {
  visible: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  listingType?: 'marketplace' | 'property';
  /** Called after a successful boost so the screen can re-read the listing. */
  onBoosted?: () => void;
}

export function BoostSheet({
  visible,
  onClose,
  listingId,
  listingTitle,
  listingType = 'marketplace',
  onBoosted,
}: BoostSheetProps) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const toast = useToast();

  const required = BRAND.boostRules.requiredAdsCount;

  const [watched, setWatched] = useState(0);
  const [watching, setWatching] = useState(false);
  const [applying, setApplying] = useState(false);

  // Reset the earned-ad counter each time the sheet opens, so a previous
  // boost's progress does not carry over into the next attempt.
  useEffect(() => {
    if (visible) {
      setWatched(0);
      setWatching(false);
      setApplying(false);
    }
  }, [visible]);

  // Warm the ad cache once so the first tap is not a dead wait.
  useEffect(() => {
    if (visible) getRewardedAdProvider()?.preload();
  }, [visible]);

  /**
   * Plays one ad and credits it.
   *
   * `earned === false` means the user dismissed the ad without completing it;
   * the counter deliberately does not advance, because a boost must only be
   * paid for with completed views.
   */
  const watchOne = useCallback(async () => {
    const provider = getRewardedAdProvider();
    if (!provider || watching) return;

    setWatching(true);
    try {
      const earned = await provider.show();
      if (earned) {
        setWatched((n) => Math.min(required, n + 1));
      } else {
        toast.error('Ad not completed. Watch it all the way through to earn the boost.');
      }
    } catch {
      toast.error('The ad could not be shown. Please try again.');
    } finally {
      setWatching(false);
    }
  }, [watching, required, toast]);

  const applyBoost = useCallback(async () => {
    if (!profile || watched < required) return;
    setApplying(true);
    try {
      await createBoost(listingType, listingId, profile.id);
      // The listing row carries `boosted_until`; set it too so the badge shows
      // immediately even if Explore has the boosts table cached.
      await applyBoostToListing(listingType, listingId);
      toast.success(
        `"${listingTitle}" is boosted for ${BRAND.boostRules.durationHours} hours.`,
      );
      onBoosted?.();
      onClose();
    } catch (error) {
      toast.error(humanizeError(error));
    } finally {
      setApplying(false);
    }
  }, [profile, watched, required, listingType, listingId, listingTitle, toast, onBoosted, onClose]);

  const available = boostsAvailable();
  const ready = watched >= required;

  // Hoisted out of the footer so the JSX there reads as "button, with optional
  // status line above it" instead of a nested ternary.
  const busyLabel = watching ? 'Playing ad…' : applying ? 'Applying boost…' : null;

  return (
    <Sheet
      visible={visible}
      snapPoints={['62%']}
      onClose={onClose}
      header={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Sparkles size={22} color={colors.accent} strokeWidth={2.2} />
            <Text style={[typography.heading, { color: colors.text }]}>Boost this listing</Text>
          </View>
          <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={2}>
            {BRAND.boostRules.description}
          </Text>
        </View>
      }
      footer={
        available ? (
          <View>
            {busyLabel ? (
              <View style={styles.busyRow}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {busyLabel}
                </Text>
              </View>
            ) : null}
            <Button
              label={`Boost for ${BRAND.boostRules.durationHours} hours`}
              onPress={() => void applyBoost()}
              loading={applying}
              disabled={!ready}
              size="lg"
            />
          </View>
        ) : null
      }
    >
        {!available ? (
            <View style={[styles.unavailable, { backgroundColor: colors.surfaceAlt }]}>
              <VideoOff size={20} color={colors.textMuted} />
              <View style={styles.flex}>
                <Text style={[typography.smallStrong, { color: colors.text }]}>
                  Boosts are unavailable in this build
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  No rewarded ad provider is bundled, so a boost cannot be earned honestly here.
                  Your listing is live and visible to everyone regardless.
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[typography.smallStrong, { color: colors.text }]}>
                  {watched} of {required} ads watched
                </Text>
                <ProgressBar value={watched / required} />
                <Text style={[typography.caption, { color: colors.textSubtle }]}>
                  Your listing stays at the top for {BRAND.boostRules.durationHours} hours after the
                  last ad.
                </Text>
              </View>

              <Button
                label={ready ? 'All ads watched' : `Watch ad ${watched + 1} of ${required}`}
                icon={Play}
                onPress={() => void watchOne()}
                loading={watching}
                disabled={ready || watching}
                size="lg"
              />
              </>
            )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
    gap: spacing.xs,
  },
  unavailable: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  progressCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});






