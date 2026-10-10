/**
 * Centralized branding configuration for JID Mobile.
 *
 * Ported verbatim from the JID website (`src/config/brand.ts`). The exact
 * string values matter: `location`, `area`, `condition`, `room_type` and
 * `availability` are plain text columns in Postgres, so every filter and
 * option here must match the web app's values character for character or
 * queries silently return zero rows.
 */
import type { LucideIcon } from 'lucide-react-native';
import {
  Armchair,
  BedDouble,
  BookOpen,
  Laptop,
  Package,
  PenTool,
  Shirt,
  Smartphone,
  Sparkles,
  Store,
  Tv,
} from 'lucide-react-native';
import type { ListingKind } from '../types';

export const BRAND = {
  name: 'JID',
  fullName: 'JID Campus Marketplace & Accommodation',
  website: 'https://jidapp.ng',
  /** Deep link scheme registered in app.json, used to build shareable links. */
  scheme: 'jid',
  /**
   * JID is two things at once, and the product treats them as equals: somewhere
   * to live and somewhere to trade. The single-line tagline says so explicitly,
   * because "marketplace" alone made the accommodation half look like a
   * secondary feature.
   */
  tagline: 'Live on campus. Trade on campus.',
  subtagline:
    'Find student accommodation and buy & sell across Obafemi Awolowo University (OAU), Ile-Ife.',
  institution: {
    name: 'Obafemi Awolowo University',
    shortName: 'OAU',
    sobriquet: 'Great Ife',
    location: 'Ile-Ife, Osun State, Nigeria',
  },
  currency: {
    symbol: '₦',
    code: 'NGN',
    format: (amount: number): string => {
      const value = Number.isFinite(amount) ? amount : 0;
      return `₦${value.toLocaleString('en-NG')}`;
    },
    /** Compact form for dense cards: 1.2M / 450k. */
    compact: (amount: number): string => {
      const value = Number.isFinite(amount) ? amount : 0;
      if (Math.abs(value) >= 1_000_000) {
        const m = value / 1_000_000;
        return `₦${Number.isInteger(m) ? m : m.toFixed(1)}M`;
      }
      if (Math.abs(value) >= 1_000) {
        const k = value / 1_000;
        return `₦${Number.isInteger(k) ? k : k.toFixed(0)}k`;
      }
      return `₦${Math.round(value)}`;
    },
  },
  categories: [
    { id: 'all', label: 'All Items', icon: 'Sparkles', Icon: Sparkles },
    { id: 'electronics', label: 'Electronics', icon: 'Tv', Icon: Tv },
    { id: 'phones', label: 'Phones & Gadgets', icon: 'Smartphone', Icon: Smartphone },
    { id: 'computers', label: 'Computers & Laptops', icon: 'Laptop', Icon: Laptop },
    { id: 'books', label: 'Books & Courseware', icon: 'BookOpen', Icon: BookOpen },
    { id: 'fashion', label: 'Fashion & Wears', icon: 'Shirt', Icon: Shirt },
    { id: 'furniture', label: 'Hostel Furniture', icon: 'Armchair', Icon: Armchair },
    { id: 'school-supplies', label: 'School Supplies', icon: 'PenTool', Icon: PenTool },
    { id: 'other', label: 'Other Items', icon: 'Package', Icon: Package },
  ] as const satisfies ReadonlyArray<{
    id: string;
    label: string;
    icon: string;
    Icon: LucideIcon;
  }>,
  itemConditions: [
    'Brand New',
    'Like New',
    'Good Condition',
    'Well Used',
  ] as const,
  campusLocations: {
    halls: [
      'Fajuyi Hall',
      'Awolowo (Awo) Hall',
      'Moremi Hall',
      'Angola Hall',
      'Mozambique Hall',
      'Alumni Hall',
      'ETF Hall',
      'PG Hall',
      'Akintola Hall',
    ],
    offCampusAreas: [
      'Asherifa',
      'Damico (Road 7)',
      'Mayfair',
      'Ede Road',
      'Parakin',
      'Modakeke / Campus Gate',
      'Ilesa Garage / Ibadan Road',
      'Opa / Moro Axis',
    ],
    pickupSpots: [
      'SUB (Students Union Building) Car Park',
      'Hezekiah Library Walkway',
      'Amphitheatre Ground Floor',
      'Motion Ground',
      'Campus Main Gate (Town Service Stand)',
      'Spider Web (Faculty of Tech Quadrangle)',
      'Awo Hall Buttery',
      'Moremi Hall Car Park',
      'Damico Junction Gate',
      'Asherifa Central Junction',
    ],
  },
  accommodationTypes: [
    'Self-Con',
    'Single Room',
    '2-Bedroom Shared',
    'Executive Studio',
    'Bed Space / Hostel',
  ] as const,
  availabilityStatuses: [
    'Available Immediately',
    'Next Session (2026/2027)',
    'Roommate Needed',
  ] as const,
  waterSources: [
    'Solar-powered industrial borehole',
    'Dedicated borehole with overhead tanks',
    'Clean well water with filtration',
    'Hostel central supply',
  ],
  powerSetups: [
    'Prepaid meter (Individual unit)',
    'Prepaid meter (Shared between 2-3 flats)',
    'Campus feeder line (High stability)',
    'Estate dedicated transformer',
    'Inverter / Generator ready',
  ],
  landlordRoles: [
    'Student Subletter',
    'Lodge Caretaker',
    'Direct Landlord',
    'Campus Agent',
  ] as const,
  levels: [
    '100L',
    '200L',
    '300L',
    '400L',
    '500L',
    '600L',
    'Graduating Stalite',
    'Postgraduate',
    'Alumnus',
  ],
  contactPreferences: [
    { id: 'all', label: 'In-app chat, WhatsApp & Call' },
    { id: 'whatsapp', label: 'WhatsApp only' },
    { id: 'phone', label: 'Phone call only' },
    { id: 'chat', label: 'In-app chat only' },
  ] as const satisfies ReadonlyArray<{ id: string; label: string }>,
  boostRules: {
    durationHours: 24,
    requiredAdsCount: 2,
    description:
      'Watch 2 short ads to give this listing a 24-hour visibility boost.',
  },
  reportReasons: [
    { id: 'scam', label: 'Suspected Scam or Fraud' },
    { id: 'inappropriate', label: 'Inappropriate or Offensive Content' },
    { id: 'incorrect_info', label: 'Misleading or False Information' },
    { id: 'counterfeit', label: 'Counterfeit or Stolen Item' },
    { id: 'suspicious', label: 'Suspicious Behavior / Unsafe Meeting' },
    { id: 'other', label: 'Other Issue' },
  ],
  /**
   * The two pillars of the app.
   *
   * Home, Explore and the "post" flow all read their labels, icons and section
   * copy from here, so the platform reads as one balanced product instead of a
   * marketplace with a rentals tab bolted on. `ListingKind` stays the storage
   * and query-level discriminator — this is purely presentation.
   */
  sections: [
    {
      kind: 'marketplace',
      label: 'Marketplace',
      /** Short form for chips and segmented controls. */
      shortLabel: 'Market',
      tagline: 'Buy & sell',
      icon: 'Store',
      Icon: Store,
      blurb: 'Sell what you no longer need. Buy from students on campus.',
      searchHint: 'Search textbooks, phones, furniture...',
      emptyTitle: 'No listings yet',
      emptyBody: 'Be the first to post an item for sale on campus.',
      postLabel: 'Sell an item',
      postHint: 'List something in a minute',
    },
    {
      kind: 'property',
      label: 'Accommodation',
      /** Short form for chips and segmented controls. */
      shortLabel: 'Housing',
      tagline: 'Find a place',
      icon: 'BedDouble',
      Icon: BedDouble,
      blurb: 'Halls, lodges and off-campus rooms, direct from verified listers.',
      searchHint: 'Search by area, room type or price...',
      emptyTitle: 'No rooms listed',
      emptyBody: 'Be the first to list a room or lodge on campus.',
      postLabel: 'List a room',
      postHint: 'Advertise your place',
    },
  ] as const satisfies ReadonlyArray<{
    kind: ListingKind;
    label: string;
    shortLabel: string;
    tagline: string;
    icon: string;
    Icon: LucideIcon;
    blurb: string;
    searchHint: string;
    emptyTitle: string;
    emptyBody: string;
    postLabel: string;
    postHint: string;
  }>,
  safety: {
    handover:
      'Meet at SUB or Hezekiah Library. Never pay before you inspect the item in person.',
    marketplace:
      'Always inspect the item physically at public campus spots like SUB, Hezekiah Library, or Amphitheatre. Never transfer money before seeing the item.',
    accommodation:
      'Never pay rent into any private account without physically inspecting the room, confirming tenancy terms with the caretaker or landlord, and receiving an official receipt.',
  },
} as const;

export type ItemCondition = (typeof BRAND.itemConditions)[number];
export type AccommodationType = (typeof BRAND.accommodationTypes)[number];
export type AvailabilityStatus = (typeof BRAND.availabilityStatuses)[number];
export type LandlordRoleValue = (typeof BRAND.landlordRoles)[number];
export type Level = (typeof BRAND.levels)[number];
export type AppSection = (typeof BRAND.sections)[number];

/** The two pillars, in display order. */
export const SECTIONS = BRAND.sections;

/**
 * The section Home and Explore open on.
 *
 * Accommodation leads by default because it is the higher-intent half of the
 * product: someone opening JID is usually looking for a room, and the
 * marketplace is what they browse afterwards.
 */
export const DEFAULT_SECTION: ListingKind = 'property';

/** Looks up a section's presentation by storage kind. */
export const sectionFor = (kind: ListingKind): AppSection =>
  SECTIONS.find((s) => s.kind === kind) ?? SECTIONS[1];

/** Username rule enforced by the DB (`profiles_username_format` check). */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

/** The categories a seller can actually pick (the `all` pseudo-option is excluded). */
export const SELLABLE_CATEGORIES = BRAND.categories.filter((c) => c.id !== 'all');

/** Every hall + off-campus value, used by the "Hall / Area" pickers. */
export const ALL_RESIDENTIAL_AREAS = [
  ...BRAND.campusLocations.halls,
  ...BRAND.campusLocations.offCampusAreas,
];

/** Human label for a stored category id (falls back to a title-cased id). */
export const categoryLabel = (id: string): string => {
  const found = BRAND.categories.find((c) => c.id === id);
  return found ? found.label : id.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
};

/** Icon for a stored category id. */
export const categoryIcon = (id: string): LucideIcon =>
  BRAND.categories.find((c) => c.id === id)?.Icon ?? Package;
