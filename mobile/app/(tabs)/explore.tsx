/**
 * Explore.
 *
 * The app's main search surface: one screen covering both listing kinds, with
 * the filters for whichever kind is selected. Filtering happens server-side
 * (`listMarketplace` / `listProperties` build the PostgREST filter), so results
 * are correct for anyone else looking at the same data and survive a cold start
 * of the app.
 *
 * Deep-linked from Home with `?kind=`, `?category=`, `?search=` params, so the
 * category tiles and the "see all" affordances land pre-filtered.
 *
 * The header is written to be read at a glance on a phone: what you searched
 * for, how many things matched, and the one-tap way out when nothing did.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Bed,
  Clock3,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';
import { listMarketplace, listProperties, PAGE_SIZE } from '@/services/database';
import { BRAND } from '@/constants/brand';
import { radius, spacing, typography, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { ChipRail, SearchBar, Segmented } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { ListingCardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { AccommodationTile, ListingTile } from '@/components/ui/ListingCards';
import { FilterSheet } from '@/components/listing/FilterSheet';
import { useDebouncedValue } from '@/hooks';
import type { ListingKind, MarketplaceItem, PropertyListing } from '@/types';

type Sort = 'boosted' | 'newest' | 'price-asc' | 'price-desc';

type SortOption = {
  value: Sort;
  label: string;
  icon: LucideIcon;
};

const SORT_OPTIONS: readonly SortOption[] = [
  { value: 'boosted', label: 'Featured first', icon: Sparkles },
  { value: 'newest', label: 'Newest', icon: Clock3 },
  { value: 'price-asc', label: 'Price: low to high', icon: ArrowUpNarrowWide },
  { value: 'price-desc', label: 'Price: high to low', icon: ArrowDownWideNarrow },
];

export default function ExploreScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind?: string;
    category?: string;
    search?: string;
  }>();
  const { width } = useWindowDimensions();

  const cardWidth = (width - spacing.base * 2 - spacing.md) / 2;

  const [kind, setKind] = useState<ListingKind>(
    params.kind === 'property' ? 'property' : 'marketplace',
  );
  const [search, setSearch] = useState(params.search ?? '');
  const [category, setCategory] = useState<string | null>(params.category ?? null);
  const [condition, setCondition] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [roomType, setRoomType] = useState<string | null>(null);
  const [availability, setAvailability] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('boosted');

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [lodges, setLodges] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 400);

  // Count of active filters, shown as a badge on the filter button.
  const activeFilterCount = useMemo(() => {
    if (kind === 'property') {
      return [roomType, location, availability].filter(Boolean).length;
    }
    return [category, condition, location].filter(Boolean).length;
  }, [kind, category, condition, location, roomType, availability]);

  /**
   * Loads the current result set.
   *
   * A monotonically increasing request id discards stale responses: with a
   * debounced search box plus taps of filter chips, an earlier, slower query can
   * otherwise resolve last and overwrite newer results.
   */
  const loadId = useRef(0);

  const fetchResults = useCallback(
    async (mode: 'load' | 'refresh') => {
      loadId.current += 1;
      const id = loadId.current;

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        if (kind === 'marketplace') {
          const result = await listMarketplace({
            search: debouncedSearch || undefined,
            category: category ?? undefined,
            condition: condition ?? undefined,
            location: location ?? undefined,
            sort,
          });
          if (id === loadId.current) {
            setItems(result);
            setLodges([]);
          }
        } else {
          const result = await listProperties({
            search: debouncedSearch || undefined,
            roomType: roomType ?? undefined,
            area: location ?? undefined,
            availability: availability ?? undefined,
            sort,
          });
          if (id === loadId.current) {
            setLodges(result);
            setItems([]);
          }
        }
      } catch (err) {
        if (id === loadId.current) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
        }
      } finally {
        if (id === loadId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [kind, debouncedSearch, category, condition, location, roomType, availability, sort, loadId],
  );

  useEffect(() => {
    void fetchResults('load');
  }, [fetchResults]);

  const clearFilters = useCallback(() => {
    if (kind === 'property') {
      setRoomType(null);
      setAvailability(null);
    } else {
      setCategory(null);
      setCondition(null);
    }
    setLocation(null);
  }, [kind]);

  const clearEverything = useCallback(() => {
    clearFilters();
    setSearch('');
  }, [clearFilters]);

  const data: Array<MarketplaceItem | PropertyListing> =
    kind === 'marketplace' ? items : lodges;

  const hasFilters = activeFilterCount > 0;
  const hasQuery = Boolean(debouncedSearch) || hasFilters;

  const noun = kind === 'marketplace' ? 'item' : 'lodge';
  const plural = `${noun}s`;

  /**
   * Results are paged, so the count on screen is a floor, never a total. Saying
   * "6 items" when 40 match would be a lie the user can disprove in one tap;
   * "24+" plus a hint to narrow the search is honest and still reassuring.
   */
  const atPageLimit = data.length >= PAGE_SIZE;
  const resultSummary = ((): string => {
    if (loading) return 'Finding matches…';
    if (error || data.length === 0) return '';
    const count = `${data.length}${atPageLimit ? '+' : ''} ${
      data.length === 1 ? noun : plural
    }`;
    if (debouncedSearch) return `${count} for “${debouncedSearch}”`;
    if (hasFilters) return `${count} match your filters`;
    return `Showing ${count}`;
  })();

  const emptyCopy = ((): { title: string; message: string } => {
    if (kind === 'marketplace') {
      return hasQuery
        ? {
            title: 'Nothing matched that search',
            message:
              'Check the spelling, or clear a filter or two to widen the results. You can also search a different category.',
          }
        : {
            title: 'No items posted yet',
            message:
              'Nobody has posted an item yet. Be the first — it takes a photo and a price.',
          };
    }
    return hasQuery
      ? {
          title: 'No lodges matched that search',
          message:
            'Try a different area, room type, or availability. Fewer filters means more places to choose from.',
        }
      : {
          title: 'No lodges listed yet',
          message:
            'Know a lodge or room space nearby? List it free and every student searching will see it.',
        };
  })();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* ------------------------------------------------------------- header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={[typography.title, { color: colors.text }]}>Explore</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchFlex}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder={
                kind === 'marketplace'
                  ? 'Search for an item or category'
                  : 'Search lodges by area or room type'
              }
              onCancel={() => setSearch('')}
            />
          </View>
          <View>
            <IconButton
              icon={SlidersHorizontal}
              onPress={() => setFiltersOpen(true)}
              variant={hasFilters ? 'brand' : 'surface'}
              accessibilityLabel={`Filters${hasFilters ? `, ${activeFilterCount} applied` : ''}`}
              badge={hasFilters ? activeFilterCount : undefined}
            />
          </View>
        </View>

        <Segmented
          options={[
            { value: 'marketplace' as ListingKind, label: 'Items' },
            { value: 'property' as ListingKind, label: 'Lodges' },
          ]}
          value={kind}
          onChange={(next) => {
            setKind(next);
            // Filters are kind-specific; carrying them across would silently
            // apply a marketplace category to a lodge search.
            clearFilters();
          }}
        />

        {/* Sort. A scrolling rail rather than a four-up control so every label
            stays readable on a narrow phone instead of being truncated. */}
        <ChipRail
          options={SORT_OPTIONS.map((o) => o.value)}
          value={sort}
          onChange={(next) => {
            // The rail toggles an already-selected chip off; sort always has a
            // value, so a `null` here is a no-op rather than a reset.
            if (next) setSort(next as Sort);
          }}
          iconFor={(option) => SORT_OPTIONS.find((o) => o.value === option)?.icon}
          renderLabel={(option) => SORT_OPTIONS.find((o) => o.value === option)?.label ?? option}
          contentStyle={styles.sortRail}
        />

        {/* Active filter chips, each individually removable. */}
        {hasFilters ? (
          <View style={styles.activeChips}>
            {kind === 'marketplace' && category ? (
              <FilterPill
                label={BRAND.categories.find((c) => c.id === category)?.label ?? category}
                onClear={() => setCategory(null)}
              />
            ) : null}
            {kind === 'marketplace' && condition ? (
              <FilterPill label={condition} onClear={() => setCondition(null)} />
            ) : null}
            {kind === 'property' && roomType ? (
              <FilterPill label={roomType} onClear={() => setRoomType(null)} />
            ) : null}
            {kind === 'property' && availability ? (
              <FilterPill label={availability} onClear={() => setAvailability(null)} />
            ) : null}
            {location ? (
              <FilterPill label={location} onClear={() => setLocation(null)} />
            ) : null}
            <Button
              label="Clear all"
              onPress={clearFilters}
              variant="ghost"
              size="sm"
              block={false}
            />
          </View>
        ) : null}

        {/* Result count doubles as the answer to "did my search work?" */}
        {resultSummary ? (
          <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={1}>
            {resultSummary}
          </Text>
        ) : null}
      </View>

      {/* ------------------------------------------------------------ results */}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        // Switching kind changes the row shape, so the list must remount rather
        // than reconcile two different card layouts.
        key={kind}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void fetchResults('refresh');
            }}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.grid}>
              <ListingCardSkeleton width={cardWidth} />
              <ListingCardSkeleton width={cardWidth} />
              <ListingCardSkeleton width={cardWidth} />
              <ListingCardSkeleton width={cardWidth} />
            </View>
          ) : error ? (
            <ErrorState
              message={error}
              onAction={() => {
                void fetchResults('load');
              }}
            />
          ) : (
            <EmptyState
              icon={kind === 'marketplace' ? Search : Bed}
              title={emptyCopy.title}
              message={emptyCopy.message}
              actionLabel={hasQuery ? 'Clear search and filters' : undefined}
              onAction={hasQuery ? clearEverything : undefined}
              secondaryLabel={hasQuery ? undefined : 'Post a listing'}
              onSecondary={hasQuery ? undefined : () => router.push('/create')}
            />
          )
        }
        ListFooterComponent={
          atPageLimit ? (
            <Text style={[typography.caption, styles.pageNote, { color: colors.textSubtle }]}>
              That is the first {PAGE_SIZE}. Add a filter or a keyword to narrow the list.
            </Text>
          ) : null
        }
        renderItem={({ item }) =>
          kind === 'marketplace' ? (
            <ListingTile
              listing={item as MarketplaceItem}
              width={cardWidth}
              onPress={() => router.push(`/listing/marketplace/${item.id}`)}
            />
          ) : (
            <AccommodationTile
              listing={item as PropertyListing}
              width={cardWidth}
              onPress={() => router.push(`/listing/property/${item.id}`)}
            />
          )
        }
      />

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        kind={kind}
        category={category}
        onCategoryChange={setCategory}
        condition={condition}
        onConditionChange={setCondition}
        location={location}
        onLocationChange={setLocation}
        roomType={roomType}
        onRoomTypeChange={setRoomType}
        availability={availability}
        onAvailabilityChange={setAvailability}
        onClear={clearFilters}
      />
    </View>
  );
}

/** Removable chip representing one active filter. */
function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  const { colors } = useTheme();
  return (
    <Animated.View
      layout={LinearTransition}
      style={[styles.pill, { backgroundColor: colors.brandSoft, borderColor: colors.brandSoftBorder }]}
    >
      <Text style={[typography.caption, { color: colors.brandText }]} numberOfLines={1}>
        {label}
      </Text>
      <Pressable
        onPress={onClear}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label} filter`}
      >
        <X size={13} color={colors.brandText} strokeWidth={2.4} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchFlex: {
    flex: 1,
  },
  sortRail: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginHorizontal: -spacing.xs,
  },
  activeChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 200,
  },
  column: {
    gap: spacing.md,
  },
  pageNote: {
    textAlign: 'center',
    paddingTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});