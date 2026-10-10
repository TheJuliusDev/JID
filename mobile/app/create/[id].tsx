/**
 * Edit listing.
 *
 * Loads the target listing (marketplace or property), enforces ownership via the
 * form's guard (RLS will also reject writes), and reuses `<ListingForm>` in edit
 * mode. Presented as a modal to match the create flow.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/providers/ThemeProvider';
import { Screen, ScreenHeader } from '@/components/layout/Screen';
import { ListingForm } from '@/components/listing/ListingForm';
import type { ListingKind } from '@/types';

export default function EditListingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: string }>();

  const listingId = Array.isArray(id) ? id[0] : id;
  const listingKind = (Array.isArray(kind) ? kind[0] : kind) as ListingKind | undefined;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Edit listing" fallback="/(tabs)" />
      <Screen gap={0}>
        {listingId && listingKind ? (
          <ListingForm kind={listingKind} listingId={listingId} />
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});