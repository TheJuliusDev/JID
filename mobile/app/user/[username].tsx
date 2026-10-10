/**
 * Public profile.
 *
 * A seller/landlord's storefront: their listings, their reviews, and the ways
 * to reach them. Deliberately excludes email, phone, and any private field —
 * `PublicProfile` is built from a read-only view that already strips those, and
 * the phone number on a listing is revealed only inside the thread.
 *
 * The caller is offered a review only if they are signed in, not looking at
 * their own profile, and have not already reviewed this person. An existing
 * review is edited in place via the review form's upsert rather than stacked.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flag, MessageCircle, Star } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  deleteReview,
  getPublicProfileByUsername,
  listMarketplaceByUser,
  listPropertiesByUser,
  listVendorReviews,
  summarizeReviews,
  upsertReview,
} from '@/services/database';
import { humanizeError } from '@/services/supabase';
import { spacing, typography, GUTTER } from '@/constants/theme';
import { Avatar, Card } from '@/components/ui/Card';
import { BackButton, Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Rating, Segmented } from '@/components/ui/Controls';
import { AccommodationTile, ListingTile } from '@/components/ui/ListingCards';
import { ReportSheet } from '@/components/listing/ReportSheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useAsync } from '@/hooks';
import { timeAgo } from '@/utils/time';
import type { MarketplaceItem, PropertyListing, VendorReview } from '@/types';

type Tab = 'listings' | 'reviews';

/** The slice of `useAsync`'s result the reviews tab needs. */
interface ReviewsAsync {
  data: VendorReview[] | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
  refresh: () => void;
}

export default function PublicProfileScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile: me } = useAuth();
  const { startConversation } = useData();

  const { username } = useLocalSearchParams<{ username?: string }>();
  const handle = Array.isArray(username) ? username[0] : username;

  const [tab, setTab] = useState<Tab>('listings');
  const [reportOpen, setReportOpen] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const cardWidth = (width - GUTTER * 2 - spacing.md) / 2;

  const loadPerson = useCallback(async () => {
    if (!handle) throw new Error('No profile specified.');
    return getPublicProfileByUsername(handle);
  }, [handle]);

  const profile = useAsync(loadPerson, [handle]);

  const loadListings = useCallback(async (): Promise<{
    items: MarketplaceItem[];
    lodges: PropertyListing[];
  }> => {
    if (!profile.data) return { items: [], lodges: [] };
    const [items, lodges] = await Promise.all([
      listMarketplaceByUser(profile.data.id),
      listPropertiesByUser(profile.data.id),
    ]);
    return { items, lodges };
  }, [profile.data]);

  const listings = useAsync(loadListings, [profile.data?.id]);

  const loadReviews = useCallback(
    async (): Promise<VendorReview[]> => {
      if (!profile.data) return [];
      return listVendorReviews(profile.data.id);
    },
    [profile.data],
  );

  const reviews = useAsync(loadReviews, [profile.data?.id]);

  const summary = useMemo(() => summarizeReviews(reviews.data ?? []), [reviews.data]);

  const myReview = useMemo(
    () => (reviews.data ?? []).find((r) => r.reviewerId === me?.id) ?? null,
    [reviews.data, me?.id],
  );

  const isSelf = Boolean(me && profile.data && me.id === profile.data.id);

  const message = useCallback(async () => {
    if (!profile.data) return;
    setStartingChat(true);
    const id = await startConversation(profile.data.id);
    setStartingChat(false);
    if (id) router.push(`/messages/${id}`);
  }, [profile.data, startConversation, router]);

  const submitReview = useCallback(
    async (rating: number, comment: string) => {
      if (!profile.data || !me) return;
      try {
        await upsertReview(profile.data.id, me.id, rating, comment.trim() || undefined);
        toast.success('Review saved.');
        reviews.reload();
      } catch (error) {
        toast.error(humanizeError(error));
      }
    },
    [profile.data, me, toast, reviews],
  );

  const removeReview = useCallback(() => {
    if (!myReview) return;
    Alert.alert('Delete your review?', 'You can write a new one at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteReview(myReview.id);
              reviews.reload();
            } catch (error) {
              toast.error(humanizeError(error));
            }
          })();
        },
      },
    ]);
  }, [myReview, toast, reviews]);

  if (profile.loading) return <LoadingState label="Loading profile" />;

  if (profile.error || !profile.data) {
    return (
      <ErrorState
        title="Profile not found"
        message={profile.error ?? 'This account may have been removed.'}
        onAction={profile.reload}
      />
    );
  }

  const person = profile.data;
  const meta = [person.department, person.level, person.hallOrArea].filter(Boolean).join(' · ');
  const allListings = listings.data;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.hero,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {/* The hero doubles as the screen's top bar, so it owns the safe-area
            inset and the back affordance rather than faking top padding. */}
        <View style={[styles.heroNav, { paddingTop: insets.top + spacing.xs }]}>
          <BackButton fallback="/(tabs)/explore" />
        </View>

        <Avatar uri={person.avatarUrl} name={person.fullName} size={80} showRing />
        <Text style={[typography.title, styles.name, { color: colors.text }]}>
          {person.fullName}
        </Text>
        <Text style={[typography.small, { color: colors.textMuted }]}>@{person.username}</Text>
        {meta ? (
          <Text style={[typography.small, styles.meta, { color: colors.textMuted }]}>
            {meta}
          </Text>
        ) : null}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <View style={styles.statValue}>
              <Star size={15} color={colors.accent} fill={colors.accent} />
              <Text style={[typography.subheading, { color: colors.text }]}>
                {summary.average ? summary.average.toFixed(1) : '—'}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {summary.count} review{summary.count === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[typography.subheading, { color: colors.text }]}>
              {(allListings?.items.length ?? 0) + (allListings?.lodges.length ?? 0)}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>listings</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[typography.subheading, { color: colors.text }]}>
              {new Date(person.createdAt).getFullYear()}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>joined</Text>
          </View>
        </View>

        {person.bio ? (
          <Text style={[typography.body, styles.bio, { color: colors.textMuted }]}>
            {person.bio}
          </Text>
        ) : null}

        {!isSelf ? (
          <View style={styles.actions}>
            <Button
              label="Message"
              icon={MessageCircle}
              onPress={() => void message()}
              loading={startingChat}
              block={false}
              style={styles.actionButton}
            />
            <IconButton
              icon={Flag}
              onPress={() => setReportOpen(true)}
              accessibilityLabel="Report this account"
              variant="surface"
            />
          </View>
        ) : null}
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <Segmented
          options={[
            { value: 'listings' as Tab, label: 'Listings' },
            { value: 'reviews' as Tab, label: 'Reviews' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'listings' ? (
        listings.loading ? (
          <LoadingState label="Loading listings" />
        ) : listings.error ? (
          <ErrorState message={listings.error} onAction={listings.reload} />
        ) : !allListings || allListings.items.length + allListings.lodges.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No active listings"
            message={`${person.fullName} has nothing up right now. Check back later.`}
          />
        ) : (
          <View style={styles.content}>
            {allListings.items.length > 0 ? (
              <View style={styles.section}>
                <Text style={[typography.subheading, { color: colors.text }]}>Items for sale</Text>
                <View style={styles.grid}>
                  {allListings.items.map((item) => (
                    <ListingTile
                      key={item.id}
                      listing={item}
                      width={cardWidth}
                      onPress={() => router.push(`/listing/marketplace/${item.id}`)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {allListings.lodges.length > 0 ? (
              <View style={styles.section}>
                <Text style={[typography.subheading, { color: colors.text }]}>Lodges</Text>
                <View style={styles.grid}>
                  {allListings.lodges.map((lodge) => (
                    <AccommodationTile
                      key={lodge.id}
                      listing={lodge}
                      width={cardWidth}
                      onPress={() => router.push(`/listing/property/${lodge.id}`)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        )
      ) : (
        <ReviewTab
          reviews={reviews}
          summary={summary}
          myReview={myReview}
          canReview={Boolean(me) && !isSelf}
          onSubmit={submitReview}
          onDelete={removeReview}
        />
      )}

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        target={{ type: 'user', userId: person.id, displayName: person.fullName }}
      />
    </View>
  );
}

/** Reviews tab: summary histogram, the caller's review form, and the list. */
function ReviewTab({
  reviews,
  summary,
  myReview,
  canReview,
  onSubmit,
  onDelete,
}: {
  reviews: ReviewsAsync;
  summary: ReturnType<typeof summarizeReviews>;
  myReview: VendorReview | null;
  canReview: boolean;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [comment, setComment] = useState(myReview?.comment ?? '');
  const [editing, setEditing] = useState(false);

  // Keep the form in sync the first time the caller's own review resolves.
  React.useEffect(() => {
    if (myReview && !editing) {
      setRating(myReview.rating);
      setComment(myReview.comment ?? '');
    }
  }, [myReview, editing]);

  if (reviews.loading) return <LoadingState label="Loading reviews" />;
  if (reviews.error) return <ErrorState message={reviews.error} onAction={reviews.reload} />;

  const rows = reviews.data ?? [];
  const showForm = canReview && (editing || !myReview);

  return (
    <View style={styles.content}>
      {summary.count > 0 ? (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={[typography.title, { color: colors.text }]}>
              {summary.average.toFixed(1)}
            </Text>
            <View style={styles.summaryMeta}>
              <Rating value={summary.average} size={16} />
              <Text style={[typography.small, { color: colors.textMuted }]}>
                {summary.count} review{summary.count === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = summary.distribution[star];
            const pct = summary.count ? count / summary.count : 0;
            return (
              <View key={star} style={styles.histogramRow}>
                <Text style={[typography.caption, { color: colors.textMuted, width: 12 }]}>
                  {star}
                </Text>
                <View style={[styles.histogramTrack, { backgroundColor: colors.surfaceAlt }]}>
                  <View
                    style={[
                      styles.histogramFill,
                      { width: `${pct * 100}%`, backgroundColor: colors.accent },
                    ]}
                  />
                </View>
                <Text style={[typography.caption, { color: colors.textMuted, width: 22, textAlign: 'right' }]}>
                  {count}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      {canReview ? (
        <Card style={styles.reviewForm}>
          {showForm ? (
            <>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>
                {myReview ? 'Edit your review' : 'Leave a review'}
              </Text>
              <Text style={[typography.small, { color: colors.textMuted }]}>
                Rate your experience dealing with this seller or landlord.
              </Text>
              <Rating value={rating} size={30} onRate={setRating} />
              <Input
                label="Comment (optional)"
                value={comment}
                onChangeText={setComment}
                placeholder="Was the item as described? Was pickup smooth?"
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <View style={styles.formActions}>
                {myReview ? (
                  <Button
                    label="Cancel"
                    variant="ghost"
                    size="sm"
                    block={false}
                    onPress={() => {
                      setEditing(false);
                      setRating(myReview.rating);
                      setComment(myReview.comment ?? '');
                    }}
                  />
                ) : null}
                <Button
                  label="Submit review"
                  size="sm"
                  block={false}
                  disabled={rating === 0}
                  onPress={() => void onSubmit(rating, comment).then(() => setEditing(false))}
                />
              </View>
            </>
          ) : (
            <View style={styles.myReviewHeader}>
              <Text style={[typography.bodyStrong, { flex: 1, color: colors.text }]}>
                Your review
              </Text>
              <Button label="Edit" variant="ghost" size="sm" block={false} onPress={() => setEditing(true)} />
              <Button label="Delete" variant="ghost" size="sm" block={false} onPress={onDelete} />
            </View>
          )}
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No reviews yet"
          message="Reviews are left by people who have dealt with this account. Be the first once you have."
        />
      ) : (
        rows.map((review) => (
          <View key={review.id} style={[styles.review, { borderBottomColor: colors.border }]}>
            <View style={styles.reviewHead}>
              <Avatar
                uri={review.reviewer?.avatarUrl}
                name={review.reviewer?.fullName ?? 'JID Student'}
                size={34}
              />
              <View style={styles.reviewWho}>
                <Text style={[typography.smallStrong, { color: colors.text }]} numberOfLines={1}>
                  {review.reviewer?.fullName ?? 'JID Student'}
                </Text>
                <View style={styles.reviewRating}>
                  <Rating value={review.rating} size={12} />
                  <Text style={[typography.caption, { color: colors.textSubtle }]}>
                    {timeAgo(review.createdAt)}
                  </Text>
                </View>
              </View>
            </View>
            {review.comment ? (
              <Text style={[typography.body, { color: colors.text }]}>{review.comment}</Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: GUTTER,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  heroNav: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  meta: {
    textAlign: 'center',
  },
  bio: {
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.base,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
    minWidth: 64,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  actionButton: {
    flex: 1,
  },
  tabs: {
    paddingHorizontal: GUTTER,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    padding: GUTTER,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryCard: {
    gap: spacing.sm,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginBottom: spacing.xs,
  },
  summaryMeta: {
    gap: 2,
  },
  histogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  histogramTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  histogramFill: {
    height: '100%',
    borderRadius: 3,
  },
  reviewForm: {
    gap: spacing.md,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  myReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  review: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  reviewWho: {
    flex: 1,
    gap: 2,
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
