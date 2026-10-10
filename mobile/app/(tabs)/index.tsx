/**
 * Home.
 *
 * The first screen after sign-in, so it answers three questions immediately:
 * what is happening on campus, what can I post, and where do I go next.
 *
 * ## Structure
 *
 * The screen is organised around JID's two pillars rather than around one of
 * them. It used to open with a marketplace category rail and a "Fresh on
 * campus" grid, with accommodation tucked in as a small rail at the bottom —
 * which made the product read as "a marketplace with a rentals tab". Now:
 *
 *   hero            brand, greeting, inline search entry
 *   two pillars     Accommodation and Marketplace side by side, equal weight
 *   safety strip    the platform's trust message, a real differentiator
 *   accommodation   newest rooms, as a full-width grid
 *   marketplace     newest items, as a full-width grid
 *   category rail   marketplace categories, scoped to the marketplace
 *   post CTA        both ways of posting
 *
 * The two feeds get the same card count, the same grid treatment and the same
 * section heading, so neither half looks like the afterthought.
 *
 * Uses a plain ScrollView with a flex-wrap grid rather than a FlatList. The
 * feed is capped at six cards and the rest of the page is mixed content, so a
 * single scrolling surface beats nesting virtualised lists — nested lists break
 * scroll performance on Android and warn outright in development.
 *
 * Both feeds render proper empty states: the live project has only a couple of
 * marketplace listings and very few properties, so an empty rail is the
 * expected first-run experience and must not look broken.
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Bell,
  ChevronRight,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { listMarketplace, listProperties } from '@/services/database';
import { BRAND, SECTIONS, type AppSection } from '@/constants/brand';
import { radius, shadows, spacing, typography, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { Button, IconButton } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Card';
import { ListingCardSkeleton, ErrorState } from '@/components/ui/States';
import { StaggeredRise } from '@/components/ui/Enter';
import { ListingTile, AccommodationTile } from '@/components/ui/ListingCards';
import { useAsync } from '@/hooks';
import type { MarketplaceItem, PropertyListing } from '@/types';

/** Cards per feed. Small on purpose: this is a phone feed, not a catalogue. */
const FEED_SIZE = 4;

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { unreadMessagesCount, unreadNotificationsCount } = useData();
  const { width } = useWindowDimensions();

  // Two columns inside the standard page gutter, with a 12pt gutter between.
  const cardWidth = (width - spacing.base * 2 - spacing.md) / 2;

  const accommodation = useAsync<PropertyListing[]>(
    useCallback(() => listProperties({ sort: 'newest', limit: FEED_SIZE }), []),
    [],
  );

  const marketplace = useAsync<MarketplaceItem[]>(
    useCallback(() => listMarketplace({ sort: 'newest', limit: FEED_SIZE }), []),
    [],
  );

  /**
   * Refresh on focus, not on mount, so a listing created in the create modal is
   * already there on the way back rather than after a manual pull.
   */
  useFocusEffect(
    useCallback(() => {
      accommodation.refresh();
      marketplace.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
    // Recomputed only when the user changes, which is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const firstName = (profile?.fullName || '').split(' ')[0];

  const refreshAll = useCallback(() => {
    accommodation.refresh();
    marketplace.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = accommodation.refreshing || marketplace.refreshing;

  const openSection = useCallback(
    (kind: AppSection['kind']) =>
      router.push({ pathname: '/(tabs)/explore', params: { kind } }),
    [router],
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={busy}
          onRefresh={refreshAll}
          tintColor={colors.brand}
          colors={[colors.brand]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      {/* ---------------------------------------------------------------- hero */}
      <LinearGradient
        colors={[colors.heroFrom, colors.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}
      >
        <View
          style={[styles.heroGlow, { backgroundColor: colors.heroGlow }]}
          pointerEvents="none"
        />

        <View style={styles.heroTop}>
          <View style={styles.heroBrand}>
            <View style={styles.heroMark}>
              <Image
                source={require('../../assets/jid-logo.png')}
                style={styles.heroMarkImage}
                contentFit="cover"
              />
            </View>
            <View style={styles.heroText}>
              <Text style={[typography.subheading, styles.heroName]} numberOfLines={1}>
                {greeting}
                {firstName ? `, ${firstName}` : ''}
              </Text>
              <Text style={[typography.small, styles.heroSub]} numberOfLines={1}>
                {BRAND.institution.shortName} · {BRAND.institution.location}
              </Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            {/*
              Chat lives here, at the top of the feed, rather than inside the
              notifications page: a reply is something you open and act on, not
              something you scroll past. Search needs no icon — the field
              directly below opens the same screen.
            */}
            <IconButton
              icon={MessageCircle}
              onPress={() => router.push('/messages')}
              variant="ghost"
              accessibilityLabel={
                unreadMessagesCount > 0
                  ? `Messages, ${unreadMessagesCount} unread`
                  : 'Messages'
              }
              badge={unreadMessagesCount}
              badgeTone="brand"
              style={styles.heroIcon}
            />
            <IconButton
              icon={Bell}
              onPress={() => router.push('/settings/notifications')}
              variant="ghost"
              accessibilityLabel={
                unreadNotificationsCount > 0
                  ? `Notifications, ${unreadNotificationsCount} new`
                  : 'Notifications'
              }
              badge={unreadNotificationsCount}
              style={styles.heroIcon}
            />
            <Avatar uri={profile?.avatarUrl} name={profile?.fullName ?? 'J'} size={36} />
          </View>
        </View>

        {/*
          Tapping opens the real browse screen rather than hosting a second,
          half-working search field here — one search surface, full filters.
        */}
        <Pressable
          onPress={() => router.push('/(tabs)/explore')}
          accessibilityRole="search"
          accessibilityLabel="Search items and accommodation"
          style={[styles.heroSearch, { backgroundColor: colors.heroSearchBg }]}
        >
          <Search size={17} color="#B4B2AA" />
          <Text style={[typography.body, styles.heroSearchText]} numberOfLines={1}>
            Search rooms, textbooks, phones…
          </Text>
          <View style={styles.heroSearchGo}>
            <ChevronRight size={16} color="#FFFFFF" />
          </View>
        </Pressable>
      </LinearGradient>

      {/* ------------------------------------------------------------- pillars */}
      {/*
        The orientation device for the whole screen. Both halves of JID get the
        same size, the same weight and the same position, which is what stops
        one reading as the "real" feature and the other as a side quest.
      */}
      <View style={[styles.pillars, { paddingTop: spacing.lg }]}>
        {SECTIONS.map((section, index) => (
          <PillarCard
            key={section.kind}
            section={section}
            // A small stagger on entry; short enough not to delay first paint
            // on a mid-range phone.
            enteringDelay={index * 70}
            onPress={() => openSection(section.kind)}
            onPost={() => router.push({ pathname: '/create', params: { kind: section.kind } })}
          />
        ))}
      </View>

      {/* ---------------------------------------------------------- safety strip */}
      <Pressable
        onPress={() => router.push('/settings/terms')}
        accessibilityRole="button"
        accessibilityLabel="Read JID's safety guidelines"
        style={[
          styles.safety,
          { backgroundColor: colors.brandSoft, borderColor: colors.brandSoftBorder },
        ]}
      >
        <ShieldCheck size={18} color={colors.brand} strokeWidth={2.2} />
        <Text
          style={[typography.small, styles.safetyText, { color: colors.brandText }]}
          numberOfLines={2}
        >
          Meet at SUB or Hezekiah Library. Never pay before you inspect in person.
        </Text>
        <ChevronRight size={16} color={colors.brandText} />
      </Pressable>

      {/* -------------------------------------------------------- accommodation */}
      {/*
        Deliberately above the marketplace feed. Accommodation is the
        higher-intent half of the product, and leading with it reflects how
        people actually arrive at the app.
      */}
      <View style={[styles.section, styles.sectionSpaced]}>
        <SectionTitle
          title="New accommodation"
          actionLabel="See all"
          onAction={() => openSection('property')}
        />

        {accommodation.loading ? (
          <View style={styles.grid}>
            <ListingCardSkeleton width={cardWidth} />
            <ListingCardSkeleton width={cardWidth} />
          </View>
        ) : accommodation.error ? (
          <ErrorState message={accommodation.error} onAction={accommodation.reload} />
        ) : accommodation.data && accommodation.data.length > 0 ? (
          <View style={styles.grid}>
            {accommodation.data.map((listing, index) => (
              <StaggeredRise key={listing.id} index={index} style={{ width: cardWidth }}>
                <AccommodationTile
                  listing={listing}
                  width={cardWidth}
                  onPress={() => router.push(`/listing/property/${listing.id}`)}
                />
              </StaggeredRise>
            ))}
          </View>
        ) : (
          <SectionEmpty
            section={SECTIONS[1]}
            onPost={() => router.push({ pathname: '/create', params: { kind: 'property' } })}
          />
        )}
      </View>

      {/* ---------------------------------------------------------- marketplace */}
      <View style={[styles.section, styles.sectionSpaced]}>
        <SectionTitle
          title="Fresh on campus"
          actionLabel="See all"
          onAction={() => openSection('marketplace')}
        />

        {marketplace.loading ? (
          <View style={styles.grid}>
            <ListingCardSkeleton width={cardWidth} />
            <ListingCardSkeleton width={cardWidth} />
          </View>
        ) : marketplace.error ? (
          <ErrorState message={marketplace.error} onAction={marketplace.reload} />
        ) : marketplace.data && marketplace.data.length > 0 ? (
          <View style={styles.grid}>
            {marketplace.data.map((item, index) => (
              <StaggeredRise key={item.id} index={index} style={{ width: cardWidth }}>
                <ListingTile
                  listing={item}
                  width={cardWidth}
                  onPress={() => router.push(`/listing/marketplace/${item.id}`)}
                />
              </StaggeredRise>
            ))}
          </View>
        ) : (
          <SectionEmpty
            section={SECTIONS[0]}
            onPost={() => router.push({ pathname: '/create', params: { kind: 'marketplace' } })}
          />
        )}
      </View>

      {/* ------------------------------------------------------------ categories */}
      {/*
        Scoped to the marketplace and placed after both feeds. Previously this
        rail was the second thing on the page, which read as "JID is a
        marketplace" before anyone had seen a room.
      */}
      <View style={[styles.section, styles.sectionSpaced]}>
        <SectionTitle
          title="Browse marketplace categories"
          actionLabel="See all"
          onAction={() => openSection('marketplace')}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRail}
        >
          {BRAND.categories.slice(1, 8).map((category) => (
            <CategoryTile
              key={category.id}
              id={category.id}
              label={category.label}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/explore',
                  params: { kind: 'marketplace', category: category.id },
                })
              }
            />
          ))}
        </ScrollView>
      </View>

      {/* --------------------------------------------------------------- post CTA */}
      <View
        style={[
          styles.cta,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Sparkles size={22} color={colors.brand} strokeWidth={2} />
        <View style={styles.ctaText}>
          <Text style={[typography.subheading, { color: colors.text }]}>
            Got something to sell, or a room to let?
          </Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            Post it free and reach the whole campus.
          </Text>
        </View>
        <Button
          label="Post"
          onPress={() => router.push('/create')}
          size="sm"
          block={false}
          style={styles.ctaButton}
        />
      </View>
    </ScrollView>
  );
}

/**
 * One of the two pillars.
 *
 * Sized and styled identically to its sibling so the pairing reads as "two
 * halves of one thing" rather than a feature and a submenu. Each card offers
 * both the browse destination and the post destination, because someone opening
 * JID is as likely to have a room to let as an item to buy.
 */
function PillarCard({
  section,
  onPress,
  onPost,
  enteringDelay = 0,
}: {
  section: AppSection;
  onPress: () => void;
  onPost: () => void;
  enteringDelay?: number;
}) {
  const { colors } = useTheme();
  const Icon = section.Icon;

  return (
    <Animated.View entering={FadeInDown.delay(enteringDelay).duration(320)} style={styles.pillar}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Browse ${section.label}`}
        style={({ pressed }) => [
          styles.pillarPress,
          shadows.sm,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={[styles.pillarIcon, { backgroundColor: colors.brandSoft }]}>
          <Icon size={20} color={colors.brand} strokeWidth={2.1} />
        </View>

        <Text
          style={[typography.subheading, styles.pillarTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {section.label}
        </Text>
        <Text
          style={[typography.caption, { color: colors.textMuted }]}
          numberOfLines={3}
        >
          {section.blurb}
        </Text>

        <View style={styles.pillarCta}>
          <Text style={[typography.smallStrong, { color: colors.brand }]}>Browse</Text>
          <ChevronRight size={14} color={colors.brand} strokeWidth={2.4} />
        </View>
      </Pressable>

      {/*
        A separate target rather than a long-press or a chevron-only affordance:
        posting is a distinct intent from browsing, and on the phone it is
        easier to hit a full-width row than a 14pt icon.
      */}
      <Pressable
        onPress={onPost}
        accessibilityRole="button"
        accessibilityLabel={section.postLabel}
        style={({ pressed }) => [
          styles.pillarPost,
          {
            backgroundColor: colors.brandSoft,
            borderTopColor: colors.brandSoftBorder,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[typography.caption, styles.pillarPostText, { color: colors.brandText }]}>
          {section.postLabel}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Section heading with a "see all" affordance. */
function SectionTitle({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[typography.subheading, { color: colors.text }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={[typography.smallStrong, { color: colors.brand }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Square category tile with its lucide icon. */
function CategoryTile({
  id,
  label,
  onPress,
}: {
  id: string;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const Icon = BRAND.categories.find((c) => c.id === id)?.Icon ?? Sparkles;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${label}`}
      style={({ pressed }) => [
        styles.category,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.categoryIcon, { backgroundColor: colors.brandSoft }]}>
        <Icon size={19} color={colors.brand} strokeWidth={2.2} />
      </View>
      <Text
        numberOfLines={2}
        style={[typography.caption, { color: colors.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Zero-listing state for one of the two sections.
 *
 * The live project genuinely has next to no listings in either half, so this
 * gets honest, distinct copy per section rather than one vague message. That
 * turns a thin feed into an obvious invitation to be the first post.
 */
function SectionEmpty({ section, onPost }: { section: AppSection; onPost: () => void }) {
  const { colors } = useTheme();
  const Icon = section.Icon;

  return (
    <View
      style={[
        styles.empty,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: colors.brandSoft }]}>
        {section.kind === 'property' ? (
          <MapPin size={20} color={colors.brand} strokeWidth={1.9} />
        ) : (
          <Icon size={20} color={colors.brand} strokeWidth={1.9} />
        )}
      </View>
      <Text style={[typography.subheading, styles.emptyTitle, { color: colors.text }]}>
        {section.emptyTitle}
      </Text>
      <Text style={[typography.small, styles.emptyBody, { color: colors.textMuted }]}>
        {section.kind === 'property'
          ? `Know a lodge, room or bed space near ${BRAND.institution.shortName}? Listing it is free and reaches every student looking.`
          : section.emptyBody}
      </Text>
      <Button
        label={section.postLabel}
        onPress={onPost}
        size="sm"
        style={styles.emptyButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 200,
    opacity: 0.55,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  heroText: {
    flex: 1,
  },
  heroMark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#0F7358',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMarkImage: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
  },
  heroName: {
    color: '#F5F4F0',
  },
  heroSub: {
    color: '#A8A79C',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroIcon: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    height: 48,
    borderRadius: radius.pill,
  },
  heroSearchText: {
    flex: 1,
    color: '#85837B',
  },
  heroSearchGo: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: '#0F7358',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillars: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
  },
  pillar: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pillarPress: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 158,
  },
  pillarIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarTitle: {
    // Colour is supplied per theme by the caller.
  },
  pillarCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 'auto',
  },
  pillarPost: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pillarPostText: {
    fontWeight: '700',
  },
  section: {
    gap: spacing.md,
  },
  sectionSpaced: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.base,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoryRail: {
    gap: spacing.md,
    paddingRight: spacing.base,
    // Cancel the section's horizontal padding for the rail so cards can bleed
    // to the screen edge while scrolled.
    marginHorizontal: -spacing.base,
    paddingLeft: spacing.base,
  },
  category: {
    width: 92,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safety: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.base,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  safetyText: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  empty: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.base,
    marginTop: spacing.xl,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaText: {
    flex: 1,
    gap: 2,
  },
  ctaButton: {
    paddingHorizontal: spacing.lg,
  },
});