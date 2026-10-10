/**
 * Listing cards.
 *
 * Three shapes, one data contract:
 *  - `<ListingTile>`     the 2-column grid card used in feeds
 *  - `<ListingRow>`     compact horizontal row (my listings, search results on
 *                       property browse, admin tables)
 *  - `<AccommodationTile>`  the richer lodge card with rent-first layout
 *
 * All three render a real image or a branded placeholder, show the boost and
 * status badges, and expose an accessible label that includes price and title
 * so the feed is navigable with TalkBack/VoiceOver.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, type StyleProp, type ViewStyle, type DimensionValue } from 'react-native';
import { Image } from 'expo-image';
import { Eye, Heart, MapPin, Sparkles, BadgeCheck, Zap } from 'lucide-react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { Badge, Avatar } from './Card';
import { radius, shadows, spacing, typography } from '@/constants/theme';
import { compactNumber, naira, perYear, cloudinaryTiny } from '@/utils/format';
import { timeAgo } from '@/utils/time';
import { categoryIcon, categoryLabel } from '@/constants/brand';
import type { MarketplaceItem, PropertyListing } from '@/types';
import { useData } from '@/providers/DataProvider';
import { motion } from '@/constants/theme';

/**
 * Image with a warm placeholder and blur-up, sized so the grid never jumps.
 * Cloudinary serves a tiny blurred version as the placeholder, which is why a
 * slow connection shows the right colours immediately instead of a grey box.
 */
function CoverImage({
  uri,
  width,
  height,
  radius: r = radius.lg,
}: {
  uri?: string;
  width: DimensionValue;
  height: DimensionValue;
  radius?: number;
}) {
  const { colors } = useTheme();

  if (!uri) {
    const CategoryIcon = categoryIcon('other');
    return (
      <View
        style={[
          styles.placeholder,
          { width, height, borderRadius: r, backgroundColor: colors.surfaceAlt },
        ]}
      >
        <CategoryIcon size={28} color={colors.textSubtle} strokeWidth={1.5} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius: r, backgroundColor: colors.surfaceAlt }}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      // A 24px Cloudinary crop of the same image, so the correct colours and
      // rough composition appear immediately on a slow connection instead of a
      // grey box.
      placeholder={cloudinaryTiny(uri)}
      placeholderContentFit="cover"
      accessibilityIgnoresInvertColors
    />
  );
}

/** Boost pill, shown on boosted listings. */
function BoostBadge({ expires }: { expires?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.boost, { backgroundColor: colors.accentSoft, borderColor: colors.accentSoftBorder }]}>
      <Zap size={11} color={colors.accentText} fill={colors.accentText} strokeWidth={2} />
      <Text style={[typography.caption, { color: colors.accentText }]}>Boosted</Text>
    </View>
  );
}

/** Small heart toggle with spring bounce micro-interaction. */
function SaveButton({
  saved,
  onToggle,
  size = 32,
}: {
  saved: boolean;
  onToggle: () => void;
  size?: number;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.35, motion.bounce),
      withSpring(1, motion.bounce),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  }, [onToggle, scale]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from saved' : 'Save listing'}
        accessibilityState={{ selected: saved }}
        style={[
          styles.save,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.isDark ? 'rgba(28,27,25,0.85)' : 'rgba(255,255,255,0.92)',
            borderColor: colors.border,
          },
        ]}
      >
        <Heart
          size={size * 0.48}
          color={saved ? colors.danger : colors.textMuted}
          fill={saved ? colors.danger : 'transparent'}
          strokeWidth={2.2}
        />
      </Pressable>
    </Animated.View>
  );
}

/**
 * 2-column marketplace grid tile.
 *
 * Cards clearly display:
 * - Product image with rounded corners
 * - Product price (prominent)
 * - Title
 * - Location & Condition
 * - Seller mini preview
 * - Save button with micro-interaction
 */
export function ListingTile({
  listing,
  width,
  onPress,
}: {
  listing: MarketplaceItem;
  width: number;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const { isSaved, toggleSave } = useData();
  const saved = isSaved('marketplace', listing.id);
  const scale = useSharedValue(1);

  const imageHeight = width * 0.82;

  const handleSave = useCallback(() => {
    void toggleSave('marketplace', listing.id);
  }, [toggleSave, listing.id]);

  const animatedPress = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[{ width }, animatedPress]}>
      <View
        style={[
          styles.tile,
          shadows.subtle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            scale.value = withSpring(0.975, motion.press);
          }}
          onPressOut={() => {
            scale.value = withSpring(1, motion.press);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${listing.title}, ${naira(listing.price)}, ${listing.condition}`}
        >
        <View style={styles.imageContainer}>
          <CoverImage uri={listing.images?.[0]} width={width} height={imageHeight} radius={0} />
          {listing.isBoosted ? (
            <View style={styles.tileTopLeft}>
              <BoostBadge expires={listing.boostedUntil} />
            </View>
          ) : null}
          {listing.status !== 'active' ? (
            <View style={styles.soldOverlay}>
              <View style={[styles.statusTag, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
                <Text style={[typography.smallStrong, { color: '#FFFFFF' }]}>
                  {listing.status === 'sold' ? 'Sold' : listing.status === 'paused' ? 'Paused' : 'Removed'}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.tileBody}>
          <Text style={[typography.price, { color: colors.brandText }]} numberOfLines={1}>
            {naira(listing.price)}
          </Text>

          <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
            {listing.title}
          </Text>

          <View style={styles.tileMetaRow}>
            <View style={[styles.conditionPill, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {listing.condition}
              </Text>
            </View>
            <View style={styles.locationSnippet}>
              <MapPin size={10} color={colors.textSubtle} />
              <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
                {listing.location.split(' ')[0]}
              </Text>
            </View>
          </View>

          {listing.seller ? (
            <View style={styles.tileSellerSnippet}>
              <Avatar uri={listing.seller.avatarUrl} name={listing.seller.name} size={18} />
              <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
                {listing.seller.name.split(' ')[0]}
              </Text>
              <Text style={[typography.caption, { color: colors.textSubtle }]}>
                {timeAgo(listing.createdAt)}
              </Text>
            </View>
          ) : null}
        </View>
        </Pressable>

        <View style={styles.tileTopRight}>
          <SaveButton saved={saved} onToggle={handleSave} />
        </View>
      </View>
    </Animated.View>
  );
}

/** Horizontal row — inventory, admin, search list. */
export function ListingRow({
  listing,
  kind,
  onPress,
  right,
  subtitle,
}: {
  listing: MarketplaceItem | PropertyListing;
  kind: 'marketplace' | 'property';
  onPress?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  const { isSaved, toggleSave } = useData();
  const saved = isSaved(kind, listing.id);

  const price =
    kind === 'marketplace'
      ? naira((listing as MarketplaceItem).price)
      : perYear((listing as PropertyListing).pricePerYear);

  const location =
    kind === 'marketplace'
      ? (listing as MarketplaceItem).location
      : (listing as PropertyListing).area;

  const handleSave = useCallback(() => {
    void toggleSave(kind, listing.id);
  }, [toggleSave, kind, listing.id]);

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${listing.title}, ${price}`}
        style={({ pressed }) => [styles.rowPress, pressed && { backgroundColor: colors.surfaceAlt }]}
      >
      <CoverImage uri={listing.images?.[0]} width={76} height={76} radius={radius.md} />

      <View style={styles.rowBody}>
        <View style={styles.rowTopLine}>
          <Text style={[typography.bodyStrong, styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
            {listing.title}
          </Text>
          {listing.isBoosted ? <BoostBadge /> : null}
        </View>
        <Text style={[typography.price, { color: colors.brandText }]}>{price}</Text>
        <View style={styles.rowMeta}>
          <MapPin size={11} color={colors.textSubtle} />
          <Text style={[typography.caption, styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
            {location}
          </Text>
        </View>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      </Pressable>

      {right ?? <SaveButton saved={saved} onToggle={handleSave} />}
    </View>
  );
}

/**
 * Accommodation tile.
 *
 * Visually distinct from marketplace goods while adhering to the same JID design system:
 * - Emphasizes property photos, rent per year, room type, location, and distance.
 * - Displays moderation verification and availability status.
 */
export function AccommodationTile({
  listing,
  width,
  onPress,
}: {
  listing: PropertyListing;
  width: number;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const { isSaved, toggleSave } = useData();
  const saved = isSaved('property', listing.id);
  const scale = useSharedValue(1);

  const handleSave = useCallback(() => {
    void toggleSave('property', listing.id);
  }, [toggleSave, listing.id]);

  const animatedPress = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[{ width }, animatedPress]}>
      <View
        style={[
          styles.tile,
          shadows.subtle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            scale.value = withSpring(0.975, motion.press);
          }}
          onPressOut={() => {
            scale.value = withSpring(1, motion.press);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${listing.title}, ${perYear(listing.pricePerYear)}, in ${listing.area}`}
        >
        <View style={styles.imageContainer}>
          <CoverImage uri={listing.images?.[0]} width={width} height={width * 0.72} radius={0} />
          <View style={styles.tileTopLeft}>
            {listing.isVerified ? (
              <View style={[styles.verifiedPill, { backgroundColor: colors.brand }]}>
                <BadgeCheck size={11} color={colors.onBrand} strokeWidth={2.4} />
                <Text style={[typography.caption, { color: colors.onBrand, fontWeight: '700' }]}>Verified</Text>
              </View>
            ) : listing.isBoosted ? (
              <BoostBadge />
            ) : null}
          </View>
        </View>

        <View style={styles.tileBody}>
          <Text style={[typography.price, { color: colors.brandText }]} numberOfLines={1}>
            {perYear(listing.pricePerYear)}
          </Text>

          <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {listing.title}
          </Text>

          <View style={styles.rowMeta}>
            <MapPin size={11} color={colors.textSubtle} />
            <Text style={[typography.caption, styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
              {listing.area}
              {listing.distanceToCampus ? ` · ${listing.distanceToCampus}` : ''}
            </Text>
          </View>

          <View style={styles.propertyBadgesRow}>
            <View style={[styles.tagPill, { backgroundColor: colors.brandSoft, borderColor: colors.brandSoftBorder }]}>
              <Text style={[typography.caption, { color: colors.brandText, fontWeight: '600' }]} numberOfLines={1}>
                {listing.roomType}
              </Text>
            </View>
            <View style={[styles.tagPill, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {listing.availability.includes('Immediately') ? 'Available now' : listing.availability}
              </Text>
            </View>
          </View>
        </View>
        </Pressable>

        <View style={styles.tileTopRight}>
          <SaveButton saved={saved} onToggle={handleSave} />
        </View>
      </View>
    </Animated.View>
  );
}

/** Circular avatar + name row used on detail screens. */
export function SellerRow({
  name,
  meta,
  avatarUrl,
  onPress,
  children,
}: {
  name: string;
  meta?: string;
  avatarUrl?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sellerRow}>
      <Pressable onPress={onPress} style={styles.sellerInfo} accessibilityRole="button">
        <Avatar uri={avatarUrl} name={name} size={42} showRing />
        <View style={styles.sellerText}>
          <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          {meta ? (
            <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  tileBody: {
    padding: spacing.md,
    gap: 4,
  },
  tileTopLeft: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    zIndex: 2,
  },
  tileTopRight: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
  },
  soldOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20,20,18,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  tileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  conditionPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  locationSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tileSellerSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  propertyBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  save: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  boost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: {
    flex: 1,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    flex: 1,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  sellerText: {
    flex: 1,
    gap: 2,
  },
});