/**
 * Listing detail.
 *
 * One route for both kinds — `/listing/[kind]/[id]` — because they share the
 * same shell (gallery, price, description, seller, contact bar, report) and
 * differ only in the facts block. Splitting them would duplicate all of that.
 *
 * What this screen is careful about:
 *
 *   - A view is recorded once per listing, not per render, so a background /
 *     foreground cycle does not inflate the counter.
 *   - Contact actions are gated by the seller's stated `contactPreference`, so a
 *     "phone only" seller never gets a WhatsApp button that reveals nothing.
 *   - Your own listing shows edit and delete instead of "message the seller",
 *     which would otherwise start a conversation with yourself.
 *   - Sold, rented and paused listings drop their contact buttons entirely:
 *     offering to buy something already sold is a dead end.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Ban,
  ChevronRight,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import {
  deleteMarketplace,
  deleteProperty,
  getMarketplace,
  getProperty,
  incrementView,
} from '@/services/database';
import { humanizeError } from '@/services/supabase';
import { BRAND, categoryLabel, categoryIcon } from '@/constants/brand';
import { radius, spacing, typography } from '@/constants/theme';
import { compactNumber, coverImage, listingLink, naira, perYear, statusLabel } from '@/utils/format';
import { callPhone, contactAllowed, openWhatsApp } from '@/utils/links';
import { listedAgo } from '@/utils/time';
import { Screen, DetailRow, Divider } from '@/components/layout/Screen';
import { Avatar, Badge, Card } from '@/components/ui/Card';
import { BackButton, Button, IconButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, ListingDetailSkeleton } from '@/components/ui/States';
import { ImageGallery } from '@/components/listing/ImageGallery';
import { ReportSheet } from '@/components/listing/ReportSheet';
import { BoostSheet } from '@/components/listing/BoostSheet';
import type { ListingKind, MarketplaceItem, PropertyListing } from '@/types';

type Any = MarketplaceItem | PropertyListing;

/**
 * The two listing kinds embed differently-named owners: `seller` for an item,
 * `landlord` for a lodge. This normalises them to one shape, including the
 * subtitle line under their name.
 */
function ownerOf(listing: Any) {
  if ('seller' in listing) {
    const s = listing.seller;
    return {
      id: s.id,
      username: s.username,
      name: s.name,
      avatarUrl: s.avatarUrl,
      subtitle:
        [s.department, s.level].filter(Boolean).join(' · ') || `@${s.username}`,
    };
  }
  const l = listing.landlord;
  return {
    id: l.id,
    username: l.username,
    name: l.name,
    avatarUrl: l.avatarUrl,
    subtitle: `${l.role} · @${l.username}`,
  };
}

export default function ListingDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { isSaved, toggleSave, startConversation } = useData();

  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const listingKind: ListingKind = kind === 'property' ? 'property' : 'marketplace';
  const isItem = listingKind === 'marketplace';

  const [listing, setListing] = useState<Any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = isItem ? await getMarketplace(id) : await getProperty(id);
      setListing(result);
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  }, [id, isItem]);

  useEffect(() => {
    void load();
  }, [load]);

  // Counted separately from the fetch and keyed on the id alone, so re-renders
  // and background/foreground cycles do not inflate the counter.
  useEffect(() => {
    if (!id) return;
    void incrementView(listingKind, id);
  }, [id, listingKind]);

  /**
   * Contact methods for this listing, filtered by the seller's stated
   * preference. Computed before any early return so hook order stays stable.
   */
  const contacts = useMemo(() => {
    if (!listing) return { phone: null, whatsapp: null, chat: false };
    if (isItem) {
      const item = listing as MarketplaceItem;
      const pref = item.contactPreference;
      const number = item.phoneOrWhatsapp;
      return {
        phone: contactAllowed(pref, 'phone') ? (number ?? null) : null,
        whatsapp: contactAllowed(pref, 'whatsapp') ? (number ?? null) : null,
        chat: contactAllowed(pref, 'chat'),
      };
    }
    const lodge = listing as PropertyListing;
    return {
      phone: lodge.contactPhone || null,
      whatsapp: lodge.contactWhatsapp || null,
      chat: true,
    };
  }, [listing, isItem]);

  const saved = id ? isSaved(listingKind, id) : false;
  const isOwner = Boolean(listing && profile && listing.userId === profile.id);

  const share = useCallback(async () => {
    if (!listing) return;
    const price = isItem
      ? naira((listing as MarketplaceItem).price)
      : perYear((listing as PropertyListing).pricePerYear);
    try {
      await Share.share({
        message: `${listing.title} — ${price} on JID`,
        // The web deep link only makes sense in a browser context.
        url: Platform.OS === 'web' ? listingLink(listingKind, listing.id) : undefined,
      });
    } catch {
      // A dismissed share sheet is not an error worth surfacing.
    }
  }, [listing, isItem, listingKind]);

  /**
   * Opens (or reuses) the 1:1 thread with the other party.
   *
   * The listing is attached as context so the seller can see what the question
   * is about without asking.
   */
  const messageSeller = useCallback(async () => {
    if (!listing) return;
    setBusy(true);
    try {
      const conversationId = await startConversation(listing.userId, {
        id: listing.id,
        title: listing.title,
        price: isItem
          ? (listing as MarketplaceItem).price
          : (listing as PropertyListing).pricePerYear,
        image: coverImage(listing) ?? '',
        type: listingKind,
      });
      if (conversationId) router.push(`/messages/${conversationId}`);
      else Alert.alert('Could not open chat', 'Please try again in a moment.');
    } catch (error) {
      Alert.alert('Could not open chat', humanizeError(error));
    } finally {
      setBusy(false);
    }
  }, [listing, isItem, listingKind, startConversation, router]);

  const confirmDelete = useCallback(() => {
    if (!listing) return;
    Alert.alert(
      'Delete this listing?',
      'It will be removed for everyone and cannot be restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isItem) await deleteMarketplace(listing.id);
              else await deleteProperty(listing.id);
              router.back();
            } catch (error) {
              Alert.alert('Could not delete', humanizeError(error));
            }
          },
        },
      ],
    );
  }, [listing, isItem, router]);

  if (loading) {
    return (
      <Screen scroll={false} gap={0}>
        <ListingDetailSkeleton />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState
          message={error}
          onAction={() => {
            void load();
          }}
        />
      </Screen>
    );
  }

  if (!listing) {
    return (
      <Screen>
        <EmptyState
          icon={Ban}
          title="This listing is gone"
          message="It may have been sold, rented, or removed by its owner."
          actionLabel="Browse the marketplace"
          onAction={() => router.replace('/(tabs)/explore')}
        />
      </Screen>
    );
  }

  const item = listing as MarketplaceItem;
  const lodge = listing as PropertyListing;
  const price = isItem ? naira(item.price) : perYear(lodge.pricePerYear);
  const CategoryIcon = isItem ? categoryIcon(item.category) : null;
  const owner = ownerOf(listing);
  const isActive = listing.status === 'active';

  return (
    <>
      <Screen padded={false} gap={0}>
        {/*
          The header floats over the gallery with a translucent scrim, so the
          controls stay legible against a bright photo as well as a dark one.
        */}
        <View style={styles.topBar} pointerEvents="box-none">
          <BackButton
            variant="scrim"
            fallback="/(tabs)/explore"
            accessibilityLabel="Back"
          />
          <View style={styles.topBarRight}>
            <IconButton
              icon={Heart}
              onPress={() => {
                if (id) void toggleSave(listingKind, id);
              }}
              variant="scrim"
              accessibilityLabel={saved ? 'Remove from saved' : 'Save this listing'}
              iconColor={saved ? colors.accent : undefined}
              iconFilled={saved}
            />
            <IconButton
              icon={Share2}
              onPress={() => void share()}
              variant="scrim"
              accessibilityLabel="Share this listing"
            />
          </View>
        </View>

        <ImageGallery images={listing.images} title={listing.title} />

        <View style={styles.body}>
          <View style={styles.priceRow}>
            <Text style={[typography.display, { color: colors.text }]}>{price}</Text>
            <View style={styles.statusBadges}>
              {listing.isBoosted ? <Badge label="Boosted" tone="accent" icon={Sparkles} /> : null}
              <Badge
                label={statusLabel(listing.status)}
                tone={isActive ? 'success' : listing.status === 'paused' ? 'neutral' : 'danger'}
              />
            </View>
          </View>

          <Text style={[typography.heading, { color: colors.text }]}>{listing.title}</Text>

          <View style={styles.metaRow}>
            {CategoryIcon ? <CategoryIcon size={14} color={colors.textMuted} strokeWidth={2} /> : null}
            <Text style={[typography.small, { color: colors.textMuted }]}>
              {isItem ? categoryLabel(item.category) : lodge.roomType}
            </Text>
            <Dot />
            <MapPin size={14} color={colors.textMuted} strokeWidth={2} />
            <Text style={[typography.small, { color: colors.textMuted }]}>
              {isItem ? item.location : lodge.area}
            </Text>
          </View>

          <Text style={[typography.caption, { color: colors.textSubtle }]}>
            {listedAgo(listing.createdAt)} · {compactNumber(listing.viewsCount)} views ·{' '}
            {compactNumber(listing.savesCount)} saves
          </Text>

          <Divider style={styles.divider} />

          <Card style={styles.facts}>
            {isItem ? (
              <>
                <DetailRow label="Condition" value={item.condition} />
                <DetailRow label="Pickup spot" value={item.pickupSpot} />
                {item.specs.length > 0 ? (
                  <DetailRow label="Details" value={item.specs.join(' · ')} />
                ) : null}
              </>
            ) : (
              <>
                <DetailRow label="Room type" value={lodge.roomType} />
                <DetailRow label="Area" value={lodge.area} />
                <DetailRow label="To campus" value={lodge.distanceToCampus} />
                <DetailRow label="Availability" value={lodge.availability} />
                <DetailRow label="Water" value={lodge.waterSource} />
                <DetailRow label="Power" value={lodge.powerSetup} />
                <DetailRow label="Security" value={lodge.security} />
                {lodge.isVerified ? (
                  <View style={styles.verified}>
                    <ShieldCheck size={16} color={colors.brand} strokeWidth={2.2} />
                    <Text style={[typography.smallStrong, { color: colors.brand }]}>
                      Verified by JID moderation
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </Card>

          <Text style={[typography.subheading, { color: colors.text }]}>About this</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {listing.description}
          </Text>

          {!isItem && lodge.proximityDesc ? (
            <>
              <Text style={[typography.subheading, { color: colors.text }]}>Getting there</Text>
              <Text style={[typography.body, { color: colors.textMuted }]}>
                {lodge.proximityDesc}
              </Text>
            </>
          ) : null}

          <Text style={[typography.subheading, { color: colors.text }]}>
            {isItem ? 'Seller' : 'Landlord'}
          </Text>

          <Card style={styles.seller}>
            <Pressable
              onPress={() => router.push(`/user/${owner.username}`)}
              accessibilityRole="button"
              accessibilityLabel={`View ${owner.name}'s profile`}
              style={styles.sellerRow}
            >
              <Avatar uri={owner.avatarUrl} name={owner.name} size={48} />
              <View style={styles.sellerText}>
                <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                  {owner.name}
                </Text>
                <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={1}>
                  {owner.subtitle}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textSubtle} />
            </Pressable>
          </Card>

          {isOwner ? (
            <View style={styles.actions}>
              <Button
                label="Edit listing"
                icon={Pencil}
                onPress={() =>
                  router.push({
                    pathname: '/create/[id]',
                    params: { kind: listingKind, id: listing.id },
                  })
                }
              />
              <Button
                label="Delete listing"
                icon={Trash2}
                onPress={confirmDelete}
                variant="danger"
              />
            </View>
          ) : isActive ? (
            <View style={styles.actions}>
              {contacts.chat ? (
                <Button
                  label={isItem ? 'Message seller' : 'Message landlord'}
                  icon={MessageCircle}
                  onPress={() => void messageSeller()}
                  loading={busy}
                  size="lg"
                />
              ) : null}
              {contacts.whatsapp ? (
                <Button
                  label="WhatsApp"
                  icon={MessageCircle}
                  onPress={() => void openWhatsApp(contacts.whatsapp as string)}
                  variant="outline"
                />
              ) : null}
              {contacts.phone ? (
                <Button
                  label="Call"
                  icon={Phone}
                  onPress={() => void callPhone(contacts.phone as string)}
                  variant="outline"
                />
              ) : null}
            </View>
          ) : (
            <View style={[styles.unavailable, { backgroundColor: colors.surfaceAlt }]}>
              <AlertTriangle size={18} color={colors.textMuted} />
              <Text style={[typography.small, styles.flex, { color: colors.textMuted }]}>
                This listing is {statusLabel(listing.status).toLowerCase()}, so the seller can no
                longer be contacted through JID.
              </Text>
            </View>
          )}

          {isOwner && isActive && !listing.isBoosted ? (
            <Card
              style={[
                styles.boost,
                { backgroundColor: colors.accentSoft, borderColor: colors.accentSoftBorder },
              ]}
            >
              <View style={styles.boostText}>
                <TrendingUp size={18} color={colors.accent} strokeWidth={2.2} />
                <Text style={[typography.smallStrong, { color: colors.accentText }]}>
                  Want more views?
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {BRAND.boostRules.description}
                </Text>
              </View>
              <Button
                label="Boost"
                onPress={() => setBoostOpen(true)}
                variant="accent"
                size="sm"
                block={false}
              />
            </Card>
          ) : null}

          <Button
            label="Report this listing"
            icon={Flag}
            onPress={() => setReportOpen(true)}
            variant="ghost"
          />

          {/* Verbatim from the web app: the handover advice is the single most
              important safety string in the product. */}
          <Text style={[typography.caption, { color: colors.textSubtle }]}>
            {BRAND.safety.handover}
          </Text>
        </View>
      </Screen>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        target={{
          type: 'listing',
          listingType: listingKind,
          listingId: listing.id,
          listingTitle: listing.title,
        }}
      />

      <BoostSheet
        visible={boostOpen}
        onClose={() => setBoostOpen(false)}
        listingId={listing.id}
        listingTitle={listing.title}
        listingType={listingKind}
        onBoosted={load}
      />
    </>
  );
}

/** Small separator between inline metadata items. */
function Dot() {
  const { colors } = useTheme();
  return <View style={[styles.dot, { backgroundColor: colors.textSubtle }]} />;
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  body: {
    padding: spacing.base,
    gap: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: radius.pill,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  facts: {
    gap: spacing.sm,
  },
  seller: {
    gap: spacing.md,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sellerText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  unavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  boost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  boostText: {
    flex: 1,
    gap: 2,
  },
});