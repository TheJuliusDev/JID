/**
 * Listing create/edit form.
 *
 * One component for both kinds and both modes. The route is the only thing that
 * differs: `/create` starts empty, `/create/[id]` loads the existing listing and
 * patches it. Keeping the field set, validation and submit path in one place is
 * what stops "edit" from silently drifting away from "create" — the classic way
 * a listing app ends up letting you edit some fields but not others.
 *
 * Validation mirrors the web form's rules, including the fact that price must
 * be a real number rather than a string that Postgres will silently coerce.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  createMarketplace,
  createProperty,
  getMarketplace,
  getProperty,
  updateMarketplace,
  updateProperty,
  type NewMarketplaceInput,
  type NewPropertyInput,
} from '@/services/database';
import { humanizeError } from '@/services/supabase';
import { BRAND, SELLABLE_CATEGORIES, categoryLabel } from '@/constants/brand';
import { spacing, typography } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ChipRail } from '@/components/ui/Controls';
import { Divider, Screen } from '@/components/layout/Screen';
import { ImagePickerStrip } from '@/components/listing/ImagePickerStrip';
import type { ListingKind, MarketplaceItem, PropertyListing } from '@/types';

/** Everything both forms need, regardless of kind or mode. */
interface FormState {
  title: string;
  description: string;
  price: string;
  images: string[];

  // Marketplace only.
  category: string;
  condition: string;
  location: string;
  pickupSpot: string;
  specs: string;
  contactPreference: NonNullable<NewMarketplaceInput['contactPreference']>;
  phoneOrWhatsapp: string;

  // Property only.
  area: string;
  distanceToCampus: string;
  roomType: string;
  availability: string;
  waterSource: string;
  powerSetup: string;
  security: string;
  proximityDesc: string;
  amenities: string;
  contactPhone: string;
  contactWhatsapp: string;
  landlordRole: string;
}

const EMPTY: FormState = {
  title: '',
  description: '',
  price: '',
  images: [],
  category: '',
  condition: '',
  location: '',
  pickupSpot: '',
  specs: '',
  contactPreference: 'all',
  phoneOrWhatsapp: '',
  area: '',
  distanceToCampus: '',
  roomType: '',
  availability: '',
  waterSource: '',
  powerSetup: '',
  security: '',
  proximityDesc: '',
  amenities: '',
  contactPhone: '',
  contactWhatsapp: '',
  landlordRole: '',
};

/** "a, b, c" -> ["a","b","c"], dropping blanks. */
const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export interface ListingFormProps {
  kind: ListingKind;
  /** Set when editing; the listing to load and patch. */
  listingId?: string;
}

export function ListingForm({ kind, listingId }: ListingFormProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useAuth();

  const isItem = kind === 'marketplace';
  const editing = Boolean(listingId);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Patch a field. `set` is called on every keystroke; `touch` marks the form dirty for validation display. */
  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const existing = isItem ? await getMarketplace(listingId) : await getProperty(listingId);
        if (cancelled) return;

        if (!existing) {
          setLoadError('That listing no longer exists.');
          return;
        }
        // Editing someone else's listing is not an error the form can fix — RLS
        // would reject the write anyway — so say so and stop.
        if (profile && existing.userId !== profile.id) {
          setLoadError('You can only edit listings you posted.');
          return;
        }

        setForm(toFormState(existing, isItem));
      } catch (error) {
        if (!cancelled) setLoadError(humanizeError(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listingId, isItem, profile]);

  /**
   * Validation.
   *
   * Returns per-field messages so each input can show its own error, which is
   * far more useful than one summary at the bottom on a long form.
   */
  const errors = useMemo(() => validate(form, isItem), [form, isItem]);
  const hasErrors = Object.keys(errors).length > 0;

  const submit = useCallback(async () => {
    setTouched(true);
    if (hasErrors) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Take the user to the first problem rather than making them hunt.
      const firstBad = Object.keys(errors)[0];
      toast.error(errors[firstBad as keyof FormState] ?? 'Check the highlighted fields.');
      return;
    }
    if (!profile) {
      toast.error('You need to be signed in to post.');
      return;
    }

    setSubmitting(true);
    try {
      if (isItem) {
        const payload: NewMarketplaceInput = {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category as NewMarketplaceInput['category'],
          price: Number(form.price),
          condition: form.condition as NewMarketplaceInput['condition'],
          location: form.location,
          pickupSpot: form.pickupSpot || undefined,
          specs: splitList(form.specs),
          images: form.images,
          contactPreference: form.contactPreference,
          phoneOrWhatsapp: form.phoneOrWhatsapp.trim() || undefined,
        };
        if (editing) await updateMarketplace(listingId as string, payload);
        else await createMarketplace(profile.id, payload);
      } else {
        const payload: NewPropertyInput = {
          title: form.title.trim(),
          description: form.description.trim(),
          area: form.area,
          distanceToCampus: form.distanceToCampus || undefined,
          pricePerYear: Number(form.price),
          roomType: form.roomType,
          availability: form.availability,
          waterSource: form.waterSource || undefined,
          powerSetup: form.powerSetup || undefined,
          security: form.security || undefined,
          proximityDesc: form.proximityDesc || undefined,
          amenities: splitList(form.amenities),
          images: form.images,
          contactPhone: form.contactPhone.trim(),
          contactWhatsapp: form.contactWhatsapp.trim() || undefined,
          landlordRole: form.landlordRole || undefined,
        };
        if (editing) await updateProperty(listingId as string, payload);
        else await createProperty(profile.id, payload);
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(editing ? 'Listing updated.' : 'Your listing is live.');
      router.back();
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(humanizeError(error));
    } finally {
      setSubmitting(false);
    }
  }, [hasErrors, errors, profile, isItem, editing, listingId, form, toast, router]);

  /** Confirm before discarding, since the form can hold uploaded photos. */
  const confirmLeave = useCallback(() => {
    if (!touched) {
      router.back();
      return;
    }
    Alert.alert(
      'Discard changes?',
      'Your edits, including any photos you uploaded, will be lost.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setTouched(false);
            router.back();
          },
        },
      ],
    );
  }, [touched, router]);

  const show = (key: keyof FormState) => (touched ? errors[key as keyof typeof errors] : undefined);

  if (loading) {
    return (
      <Screen>
        <Text style={[typography.body, { color: colors.textMuted }]}>Loading listing…</Text>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <Text style={[typography.body, { color: colors.danger }]}>{loadError}</Text>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen gap={spacing.lg}>
        <View style={styles.intro}>
          <Text style={[typography.title, { color: colors.text }]}>
            {editing ? 'Edit listing' : isItem ? 'Sell something' : 'List a lodge'}
          </Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            {isItem
              ? 'Be honest about the condition and the price — it saves everyone a wasted trip.'
              : 'Lodges are the most requested thing on JID. Fill in what you actually know.'}
          </Text>
        </View>

        <View style={styles.group}>
          <Input
            label="Title"
            value={form.title}
            onChangeText={(v) => set('title', v)}
            onBlur={() => setTouched(true)}
            placeholder={isItem ? 'e.g. HP Pavilion 15, 500GB SSD' : 'e.g. 2-seater room in Unity Hall'}
            error={show('title')}
            maxLength={90}
          />

          <Input
            label="Description"
            value={form.description}
            onChangeText={(v) => set('description', v)}
            onBlur={() => setTouched(true)}
            placeholder="Condition, age, reason for selling, anything a buyer should know"
            error={show('description')}
            multiline
            numberOfLines={5}
            maxLength={2000}
          />

          <Input
            label={isItem ? 'Price (₦)' : 'Price per year (₦)'}
            value={form.price}
            onChangeText={(v) => set('price', v.replace(/[^\d.]/g, ''))}
            onBlur={() => setTouched(true)}
            placeholder="0"
            keyboardType="numeric"
            error={show('price')}
            helperText={
              isItem ? 'Enter 0 for a free item.' : 'Most campus lodges are well under this.'
            }
          />
        </View>

        <ImagePickerStrip
          images={form.images}
          onChange={(images) => set('images', images)}
          folder={isItem ? 'marketplace' : 'property'}
          error={show('images')}
        />

        <Divider />

        {isItem ? (
          <View style={styles.group}>
            <Field label="Category" error={show('category')}>
              <ChipRail
                options={SELLABLE_CATEGORIES.map((c) => c.id)}
                value={form.category}
                onChange={(v) => set('category', v ?? '')}
                renderLabel={(id) => categoryLabel(id)}
                iconFor={(id) => BRAND.categories.find((c) => c.id === id)?.Icon}
              />
            </Field>

            <Field label="Condition" error={show('condition')}>
              <ChipRail
                options={[...BRAND.itemConditions]}
                value={form.condition}
                onChange={(v) => set('condition', v ?? '')}
              />
            </Field>

            <Field label="Where are you on campus?" error={show('location')}>
              <ChipRail
                options={[...BRAND.campusLocations.halls, ...BRAND.campusLocations.offCampusAreas]}
                value={form.location}
                onChange={(v) => set('location', v ?? '')}
              />
            </Field>

            <Field label="Pickup spot">
              <ChipRail
                options={[...BRAND.campusLocations.pickupSpots]}
                value={form.pickupSpot}
                onChange={(v) => set('pickupSpot', v ?? '')}
              />
            </Field>

            <Input
              label="Details (optional)"
              value={form.specs}
              onChangeText={(v) => set('specs', v)}
              placeholder="Comma separated, e.g. Intel i5, 16GB RAM, 1TB"
              helperText="Anything spec-like that helps a buyer decide."
            />

            <Field label="How should buyers contact you?">
              <ChipRail
                options={BRAND.contactPreferences.map((c) => c.id)}
                value={form.contactPreference}
                onChange={(v) =>
                  set('contactPreference', v as FormState['contactPreference'])
                }
                renderLabel={(id) =>
                  BRAND.contactPreferences.find((c) => c.id === id)?.label ?? id
                }
              />
            </Field>

            <Input
              label="Phone or WhatsApp number"
              value={form.phoneOrWhatsapp}
              onChangeText={(v) => set('phoneOrWhatsapp', v)}
              keyboardType="phone-pad"
              placeholder="0803 000 0000"
              helperText="Only shared with someone who contacts you. Leave blank to keep contact in-app only."
            />
          </View>
        ) : (
          <View style={styles.group}>
            <Field label="Room type" error={show('roomType')}>
              <ChipRail
                options={[...BRAND.accommodationTypes]}
                value={form.roomType}
                onChange={(v) => set('roomType', v ?? '')}
              />
            </Field>

            <Field label="Availability" error={show('availability')}>
              <ChipRail
                options={[...BRAND.availabilityStatuses]}
                value={form.availability}
                onChange={(v) => set('availability', v ?? '')}
              />
            </Field>

            <Field label="Hall or area" error={show('area')}>
              <ChipRail
                options={[...BRAND.campusLocations.halls, ...BRAND.campusLocations.offCampusAreas]}
                value={form.area}
                onChange={(v) => set('area', v ?? '')}
              />
            </Field>

            <Input
              label="Distance to campus"
              value={form.distanceToCampus}
              onChangeText={(v) => set('distanceToCampus', v)}
              placeholder="e.g. 5 minutes' walk to the library"
            />

            <Field label="Water source">
              <ChipRail
                options={[...BRAND.waterSources]}
                value={form.waterSource}
                onChange={(v) => set('waterSource', v ?? '')}
              />
            </Field>

            <Field label="Power setup">
              <ChipRail
                options={[...BRAND.powerSetups]}
                value={form.powerSetup}
                onChange={(v) => set('powerSetup', v ?? '')}
              />
            </Field>

            <Input
              label="Security"
              value={form.security}
              onChangeText={(v) => set('security', v)}
              placeholder="e.g. Gated, CCTV, security guard on duty"
            />

            <Input
              label="How do I get there?"
              value={form.proximityDesc}
              onChangeText={(v) => set('proximityDesc', v)}
              placeholder="Landmarks, bus stop, what is nearby"
              multiline
              numberOfLines={3}
            />

            <Input
              label="Amenities (optional)"
              value={form.amenities}
              onChangeText={(v) => set('amenities', v)}
              placeholder="Comma separated, e.g. WiFi, Study room, Water storage"
            />

            <Field label="Your role">
              <ChipRail
                options={[...BRAND.landlordRoles]}
                value={form.landlordRole}
                onChange={(v) => set('landlordRole', v ?? '')}
              />
            </Field>

            <Input
              label="Contact phone"
              value={form.contactPhone}
              onChangeText={(v) => set('contactPhone', v)}
              keyboardType="phone-pad"
              placeholder="0803 000 0000"
              error={show('contactPhone')}
              helperText="Required, so students can call you about the lodge."
            />

            <Input
              label="WhatsApp number (optional)"
              value={form.contactWhatsapp}
              onChangeText={(v) => set('contactWhatsapp', v)}
              keyboardType="phone-pad"
              placeholder="0803 000 0000"
            />
          </View>
        )}

        <Button
          label={editing ? 'Save changes' : 'Publish listing'}
          onPress={() => void submit()}
          loading={submitting}
          size="lg"
        />

        <Button label="Cancel" onPress={confirmLeave} variant="ghost" />

        {/*
          Suspended accounts cannot post. Saying this before they fill in a form
          is kinder than letting them write everything and failing on submit.
        */}
        {profile?.isSuspended ? (
          <Text style={[typography.caption, { color: colors.danger }]}>
            Your account is suspended, so this listing will not be published.
          </Text>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Label + error + child, used for the chip-based fields. */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[typography.smallStrong, { color: colors.text }]}>{label}</Text>
      {children}
      {error ? <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

/** Fills the form from an existing listing. */
function toFormState(listing: MarketplaceItem | PropertyListing, isItem: boolean): FormState {
  if (isItem) {
    const item = listing as MarketplaceItem;
    return {
      ...EMPTY,
      title: item.title,
      description: item.description,
      price: String(item.price),
      images: item.images,
      category: item.category,
      condition: item.condition,
      location: item.location,
      pickupSpot: item.pickupSpot,
      specs: item.specs.join(', '),
      contactPreference: item.contactPreference,
      phoneOrWhatsapp: item.phoneOrWhatsapp ?? '',
    };
  }
  const lodge = listing as PropertyListing;
  return {
    ...EMPTY,
    title: lodge.title,
    description: lodge.description,
    price: String(lodge.pricePerYear),
    images: lodge.images,
    area: lodge.area,
    distanceToCampus: lodge.distanceToCampus,
    roomType: lodge.roomType,
    availability: lodge.availability,
    waterSource: lodge.waterSource,
    powerSetup: lodge.powerSetup,
    security: lodge.security,
    proximityDesc: lodge.proximityDesc,
    amenities: lodge.amenities.join(', '),
    contactPhone: lodge.contactPhone,
    contactWhatsapp: lodge.contactWhatsapp ?? '',
    landlordRole: lodge.landlord.role,
  };
}

/**
 * Per-field validation.
 *
 * Only what the database would reject, plus the two rules that protect other
 * users: a listing needs at least one photo, and a lodge needs a phone number
 * because that is the only way a student can actually enquire about it.
 */
function validate(form: FormState, isItem: boolean): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};

  if (form.title.trim().length < 5) errors.title = 'Give it a title of at least 5 characters.';
  if (form.description.trim().length < 20) {
    errors.description = 'Write at least 20 characters so buyers know what they are getting.';
  }

  const price = Number(form.price);
  if (!form.price.trim()) errors.price = 'Enter a price.';
  else if (Number.isNaN(price) || price < 0) errors.price = 'Enter a valid price.';
  else if (!isItem && price <= 0) errors.price = 'A lodge cannot be free — enter the yearly rent.';

  if (form.images.length === 0) errors.images = 'Add at least one photo.';

  if (isItem) {
    if (!form.category) errors.category = 'Pick a category.';
    if (!form.condition) errors.condition = 'Say what condition it is in.';
    if (!form.location) errors.location = 'Pick where you are on campus.';
  } else {
    if (!form.roomType) errors.roomType = 'Pick a room type.';
    if (!form.availability) errors.availability = 'Say when it is available.';
    if (!form.area) errors.area = 'Pick the hall or area.';
    if (form.contactPhone.trim().length < 7) {
      errors.contactPhone = 'Enter a phone number students can call.';
    }
  }

  return errors;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  intro: {
    gap: spacing.xs,
  },
  group: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
});