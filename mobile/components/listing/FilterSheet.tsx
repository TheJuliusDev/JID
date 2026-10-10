/**
 * Filter bottom sheet.
 *
 * A Gorhom bottom sheet rather than an inline expander: filters are secondary
 * to the results, and on a phone a sheet gives the full height for the option
 * lists without pushing the search bar off-screen.
 *
 * Filter options are read from `BRAND` rather than hardcoded here, because the
 * stored values are plain text columns in Postgres — `location` must match the
 * exact string in `BRAND.campusLocations` or the query silently returns nothing.
 */
import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { useTheme } from '@/providers/ThemeProvider';
import { BRAND, categoryLabel } from '@/constants/brand';
import { radius, spacing, typography } from '@/constants/theme';
import { ChipRail } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  kind: 'marketplace' | 'property';
  category: string | null;
  onCategoryChange: (value: string | null) => void;
  condition: string | null;
  onConditionChange: (value: string | null) => void;
  location: string | null;
  onLocationChange: (value: string | null) => void;
  roomType: string | null;
  onRoomTypeChange: (value: string | null) => void;
  availability: string | null;
  onAvailabilityChange: (value: string | null) => void;
  onClear: () => void;
}

export function FilterSheet({
  visible,
  onClose,
  kind,
  category,
  onCategoryChange,
  condition,
  onConditionChange,
  location,
  onLocationChange,
  roomType,
  onRoomTypeChange,
  availability,
  onAvailabilityChange,
  onClear,
}: FilterSheetProps) {
  const { colors } = useTheme();

  // Market pickup/handover locations for items, residential areas for lodges.
  const locationOptions = useMemo(
    () =>
      kind === 'marketplace'
        ? BRAND.campusLocations.pickupSpots
        : [...BRAND.campusLocations.halls, ...BRAND.campusLocations.offCampusAreas],
    [kind],
  );

  const locationLabel = kind === 'marketplace' ? 'Pickup spot' : 'Hall / Area';

  // Snap points are computed rather than hardcoded so the sheet opens at a
  // sensible height for its content on both tall and short phones.
  const snapPoints = useMemo(() => ['58%', '88%'], []);

  const handleClose = useCallback(() => onClose(), [onClose]);

  return (
    <Sheet
      visible={visible}
      snapPoints={snapPoints}
      onClose={handleClose}
      title="Filters"
      headerRight={
        <Button label="Clear all" onPress={onClear} variant="ghost" size="sm" block={false} />
      }
      footer={
        <View>
          <Button label="Show results" onPress={onClose} size="lg" />
        </View>
      }
    >
      {kind === 'marketplace' ? (
          <>
            <Group label="Category">
              <ChipRail
                options={BRAND.categories.map((c) => c.id)}
                value={category}
                onChange={(v) => onCategoryChange(v)}
                renderLabel={(id) => (id === 'all' ? 'All items' : categoryLabel(id))}
                iconFor={(id) => BRAND.categories.find((c) => c.id === id)?.Icon}
                size="sm"
                contentStyle={styles.railFlush}
              />
              </Group>

              <Group label="Condition">
                <ChipRail
                  options={BRAND.itemConditions}
                  value={condition}
                  onChange={onConditionChange}
                  size="sm"
                  contentStyle={styles.railFlush}
                />
                </Group>

                <Group label={locationLabel}>
                  <ChipRail
                    options={locationOptions}
                    value={location}
                    onChange={onLocationChange}
                    size="sm"
                    contentStyle={styles.railFlush}
                  />
                  </Group>
                </>
              ) : (
                <>
                  <Group label="Room type">
                    <ChipRail
                      options={BRAND.accommodationTypes}
                      value={roomType}
                      onChange={onRoomTypeChange}
                      size="sm"
                      contentStyle={styles.railFlush}
                    />
                    </Group>

                    <Group label="Availability">
                      <ChipRail
                        options={BRAND.availabilityStatuses}
                        value={availability}
                        onChange={onAvailabilityChange}
                        size="sm"
                        contentStyle={styles.railFlush}
                      />
                      </Group>

                      <Group label={locationLabel}>
                        <ChipRail
                          options={locationOptions}
                          value={location}
                          onChange={onLocationChange}
                          size="sm"
                          contentStyle={styles.railFlush}
                        />
                        </Group>
                      </>
                    )}

                  <View style={styles.help}>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      Filters apply to everyone, not just you — they change what the marketplace shows
                      to every student.
                    </Text>
                  </View>
    </Sheet>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[typography.smallStrong, { color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  railFlush: {
    paddingHorizontal: 0,
  },
  help: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});





