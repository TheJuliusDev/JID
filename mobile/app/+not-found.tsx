/**
 * Not found.
 *
 * Catches any unmatched route, including a deep link to a listing that was
 * removed. Offers the two exits that actually help — back to where you came
 * from, or straight to browsing — rather than stranding the user on an error.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Compass } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Screen scroll={false} edges={['top', 'bottom']}>
        <EmptyState
          icon={Compass}
          title="This page wandered off"
          message="The link may be broken, or the listing could have been sold or removed. Let's get you back to browsing."
          actionLabel="Go home"
          onAction={() => router.replace('/(tabs)')}
          secondaryLabel="Browse listings"
          onSecondary={() => router.replace('/(tabs)/explore')}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
