/**
 * Saved.
 *
 * `saved_listings` stores only `(user_id, listing_type, listing_id)` — the
 * listing itself is not copied. So the saved list is resolved by fetching the
 * referenced rows and keeping only those that still exist.
 *
 * That means a listing deleted or sold on the web app disappears from here too,
 * which is correct: a saved item you can no longer open is worse than an honest
 * omission. Deleted references are silently dropped rather than shown as
 * "unavailable" placeholders.
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bookmark } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useData } from '@/providers/DataProvider';
import { getMarketplace, getProperty } from '@/services/database';
import { humanizeError } from '@/services/supabase';
import { spacing, typography, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, RowSkeleton } from '@/components/ui/States';
import { AccommodationTile, ListingTile } from '@/components/ui/ListingCards';
import { useAsync } from '@/hooks';
import type { MarketplaceItem, PropertyListing, SavedItem } from '@/types';

/** A saved reference resolved to its live listing. */
type Resolved =
  | { saved: SavedItem; listing: MarketplaceItem; kind: 'marketplace' }
  | { saved: SavedItem; listing: PropertyListing; kind: 'property' };

export default function SavedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { saved, refreshSaved, unsaveAll } = useData();
  const { width } = useWindowDimensions();

  const cardWidth = (width - spacing.base * 2 - spacing.md) / 2;

  /**
   * Resolves saved references concurrently.
   *
   * Missing rows (deleted on the web app) resolve to `null` and are filtered
   * out; a rejected fetch resolves to `null` too, so one stale reference cannot
   * blank the whole screen.
   */
  const resolve = useCallback(async (): Promise<Resolved[]> => {
    const results = await Promise.all(
      saved.map(async (item): Promise<Resolved | null> => {
        try {
          if (item.listingType === 'marketplace') {
            const listing = await getMarketplace(item.listingId);
            return listing ? { saved: item, listing, kind: 'marketplace' as const } : null;
          }
          const listing = await getProperty(item.listingId);
          return listing ? { saved: item, listing, kind: 'property' as const } : null;
        } catch {
          return null;
        }
      }),
    );
    return results.filter((r): r is Resolved => r !== null);
  }, [saved]);

  const { data, loading, refreshing, error, reload, refresh } = useAsync<Resolved[]>(resolve, [
    saved,
  ]);

  useFocusEffect(
    useCallback(() => {
      // A saved item can be removed from the detail screen while this tab is in
      // the background, so re-read the list on every focus.
      void refreshSaved();
    }, [refreshSaved]),
  );

  const items = data ?? [];

  /**
   * Splits into marketplace items and lodges so each renders with its own
   * card shape. An empty group is skipped.
   */
  const groups = useMemo(
    () => [
      { key: 'marketplace', title: 'Items', rows: items.filter((i) => i.kind === 'marketplace') },
      { key: 'property', title: 'Lodges', rows: items.filter((i) => i.kind === 'property') },
    ].filter((g) => g.rows.length > 0),
    [items],
  );

  const total = groups.reduce((sum, g) => sum + g.rows.length, 0);

  /**
   * Unsaves everything. Confirmed first, because deleting the whole saved list
   * is the one action on this screen that cannot be undone from here.
   */
  const confirmUnsaveAll = useCallback(() => {
    Alert.alert(
      'Unsave everything?',
      `This removes all ${items.length} saved item${items.length === 1 ? '' : 's'} from your saved list. The listings themselves stay on JID.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unsave all', style: 'destructive', onPress: () => void unsaveAll() },
      ],
    );
  }, [items.length, unsaveAll]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={[typography.title, { color: colors.text }]}>Saved</Text>
            {total > 0 && !loading ? (
              <Text style={[typography.small, { color: colors.textMuted }]}>
                {total} item{total === 1 ? '' : 's'} you saved
              </Text>
            ) : null}
          </View>
          {total > 0 ? (
            <Button
              label="Unsave all"
              onPress={confirmUnsaveAll}
              variant="ghost"
              size="sm"
              block={false}
            />
          ) : null}
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.key}
        contentContainerStyle={{
          padding: spacing.base,
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletons}>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : error ? (
            <ErrorState message={humanizeError(error)} onAction={reload} />
          ) : saved.length > 0 ? (
            <EmptyState
              icon={Bookmark}
              title="None of your saved items are available"
              message="They may have been sold or removed by the seller. Browse the marketplace for something else."
              actionLabel="Browse marketplace"
              onAction={() => router.push('/(tabs)/explore')}
            />
          ) : (
            <EmptyState
              icon={Bookmark}
              title="Nothing saved yet"
              message="Tap the heart on any item or lodge to keep it here. Saved items are private to you."
              actionLabel="Start browsing"
              onAction={() => router.push('/(tabs)/explore')}
            />
          )
        }
        renderItem={({ item: group }) => (
          <View style={styles.group}>
            <Text style={[typography.subheading, { color: colors.text }]}>{group.title}</Text>
            <View style={styles.grid}>
              {group.rows.map((row) =>
                row.kind === 'marketplace' ? (
                  <ListingTile
                    key={row.saved.id}
                    listing={row.listing}
                    width={cardWidth}
                    onPress={() => router.push(`/listing/marketplace/${row.listing.id}`)}
                  />
                ) : (
                  <AccommodationTile
                    key={row.saved.id}
                    listing={row.listing}
                    width={cardWidth}
                    onPress={() => router.push(`/listing/property/${row.listing.id}`)}
                  />
                ),
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleText: {
    flex: 1,
    gap: 2,
  },
  group: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  skeletons: {
    gap: spacing.md,
  },
});