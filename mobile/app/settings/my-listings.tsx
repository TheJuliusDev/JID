/**
 * My listings.
 *
 * The seller's own inventory, split by kind, with the quick actions a seller
 * actually performs: pause/resume, mark sold or rented, edit, and delete.
 *
 * Status changes are optimistic for the *label* (the row updates immediately)
 * but the screen still refetches after the write so a failed RLS check reverts
 * to the true server state rather than leaving a lie on screen.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Store, Tag } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  deleteMarketplace,
  deleteProperty,
  listMarketplaceByUser,
  listPropertiesByUser,
  updateMarketplace,
  updateProperty,
} from '@/services/database';
import { humanizeError } from '@/services/supabase';
import { radius, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/layout/Screen';
import { Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { EmptyState, ErrorState, RowSkeleton } from '@/components/ui/States';
import { useAsync } from '@/hooks';
import { statusLabel, naira, perYear } from '@/utils/format';
import type { MarketplaceItem, PropertyListing } from '@/types';

type Kind = 'marketplace' | 'property';

type Row =
  | { kind: 'marketplace'; item: MarketplaceItem }
  | { kind: 'property'; item: PropertyListing };

export default function MyListingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useAuth();

  const [tab, setTab] = useState<Kind>('marketplace');

  const load = useCallback(async (): Promise<Row[]> => {
    if (!profile) return [];
    const [items, lodges] = await Promise.all([
      listMarketplaceByUser(profile.id),
      listPropertiesByUser(profile.id),
    ]);
    return [
      ...items.map((item): Row => ({ kind: 'marketplace', item })),
      ...lodges.map((item): Row => ({ kind: 'property', item })),
    ];
  }, [profile]);

  const listings = useAsync(load, [profile]);
  const { data, loading, refreshing, error, reload, refresh } = listings;

  // Refetch on focus so a listing created or edited on another screen appears
  // here without a manual pull.
  useFocusEffect(
    React.useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const rows = useMemo(() => (data ?? []).filter((r) => r.kind === tab), [data, tab]);

  const changeStatus = useCallback(
    async (row: Row, status: string) => {
      try {
        if (row.kind === 'marketplace') await updateMarketplace(row.item.id, { status });
        else await updateProperty(row.item.id, { status });
        toast.success(`Marked as ${statusLabel(status).toLowerCase()}.`);
        refresh();
      } catch (err) {
        toast.error(humanizeError(err));
      }
    },
    [toast, refresh],
  );

  const confirmDelete = useCallback(
    (row: Row) => {
      const title = row.item.title;
      Alert.alert('Delete listing?', `"${title}" will be removed for good.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                if (row.kind === 'marketplace') await deleteMarketplace(row.item.id);
                else await deleteProperty(row.item.id);
                toast.success('Listing deleted.');
                refresh();
              } catch (err) {
                toast.error(humanizeError(err));
              }
            })();
          },
        },
      ]);
    },
    [toast, refresh],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="My listings"
        fallback="/(tabs)"
        action={
          <Button
            label="New"
            icon={Plus}
            size="sm"
            block={false}
            onPress={() => router.push('/create')}
          />
        }
      />

      <View style={styles.tabs}>
        <Segmented
          options={[
            { value: 'marketplace' as Kind, label: 'Items' },
            { value: 'property' as Kind, label: 'Lodges' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.kind}-${r.item.id}`}
        contentContainerStyle={styles.list}
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
              <RowSkeleton avatar={false} />
              <RowSkeleton avatar={false} />
            </View>
          ) : error ? (
            <ErrorState message={error} onAction={reload} />
          ) : (
            <EmptyState
              icon={tab === 'marketplace' ? Tag : Store}
              title={tab === 'marketplace' ? 'No items listed' : 'No lodges listed'}
              message={
                tab === 'marketplace'
                  ? 'Sell the laptop, phone or textbook you no longer need.'
                  : 'List a room or bed space and reach students off-campus.'
              }
              actionLabel="Post a listing"
              onAction={() => router.push('/create')}
            />
          )
        }
        renderItem={({ item: row }) => {
          const active = row.item.status === 'active';
          const soldOrRented =
            row.item.status === 'sold' || row.item.status === 'rented';
          const price =
            row.kind === 'marketplace'
              ? naira((row.item as MarketplaceItem).price)
              : perYear((row.item as PropertyListing).pricePerYear);
          const statusTone =
            active ? 'success' : soldOrRented ? 'danger' : 'neutral';

          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <Text style={[typography.bodyStrong, styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                  {row.item.title}
                </Text>
                <Badge label={statusLabel(row.item.status)} tone={statusTone} />
              </View>

              <Text style={[typography.subheading, { color: colors.brand }]}>{price}</Text>

              <View style={styles.actions}>
                <Button
                  label="Edit"
                  size="sm"
                  variant="outline"
                  block={false}
                  onPress={() =>
                    router.push({
                      pathname: '/create/[id]',
                      params: { kind: row.kind, id: row.item.id },
                    })
                  }
                />
                {active ? (
                  <Button
                    label="Pause"
                    size="sm"
                    variant="ghost"
                    block={false}
                    onPress={() => void changeStatus(row, 'paused')}
                  />
                ) : (
                  <Button
                    label="Resume"
                    size="sm"
                    variant="ghost"
                    block={false}
                    onPress={() => void changeStatus(row, 'active')}
                  />
                )}
                {row.kind === 'marketplace' ? (
                  <Button
                    label="Sold"
                    size="sm"
                    variant="ghost"
                    block={false}
                    disabled={row.item.status === 'sold'}
                    onPress={() => void changeStatus(row, 'sold')}
                  />
                ) : (
                  <Button
                    label="Rented"
                    size="sm"
                    variant="ghost"
                    block={false}
                    disabled={row.item.status === 'rented'}
                    onPress={() => void changeStatus(row, 'rented')}
                  />
                )}
                <Button
                  label="Delete"
                  size="sm"
                  variant="ghost"
                  block={false}
                  onPress={() => confirmDelete(row)}
                />
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabs: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  skeletons: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
