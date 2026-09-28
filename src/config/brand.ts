/**
 * Centralized Branding Configuration for JID
 * Easily modify brand names, campus information, and platform configurations from this single source.
 */

export const BRAND_CONFIG = {
  name: 'JID',
  fullName: 'JID Campus Marketplace & Accommodation',
  website: 'https://jidapp.ng',
  tagline: 'Your campus. One marketplace.',
  subtagline: 'Buy, sell, and discover student accommodation across Obafemi Awolowo University (OAU), Ile-Ife.',
  institution: {
    name: 'Obafemi Awolowo University',
    shortName: 'OAU',
    sobriquet: 'Great Ife',
    location: 'Ile-Ife, Osun State, Nigeria',
    landmark: 'Amphitheatre, Motion Ground & Hezekiah Oluwasanmi Library'
  },
  currency: {
    symbol: '₦',
    code: 'NGN',
    format: (amount: number) => {
      return `₦${amount.toLocaleString('en-NG')}`;
    }
  },
  /**
   * Direct contact channels.
   *
   * These are intentionally empty: the website must never display a phone
   * number, inbox or social handle that nobody is monitoring. Fill each one in
   * only once it is genuinely live — the Contact page and Footer then render it
   * automatically, and stay quiet while it is blank.
   */
  contact: {
    email: '',
    phone: '',
    whatsapp: '',
    socials: [] as Array<{ label: string; url: string }>
  },
  categories: [
    { id: 'all', label: 'All Items', icon: 'Sparkles' },
    { id: 'electronics', label: 'Electronics', icon: 'Tv' },
    { id: 'phones', label: 'Phones & Gadgets', icon: 'Smartphone' },
    { id: 'computers', label: 'Computers & Laptops', icon: 'Laptop' },
    { id: 'books', label: 'Books & Courseware', icon: 'BookOpen' },
    { id: 'fashion', label: 'Fashion & Wears', icon: 'Shirt' },
    { id: 'furniture', label: 'Hostel Furniture', icon: 'Armchair' },
    { id: 'school-supplies', label: 'School Supplies', icon: 'PenTool' },
    { id: 'other', label: 'Other Items', icon: 'Package' }
  ],
  itemConditions: [
    'Brand New',
    'Like New',
    'Good Condition',
    'Well Used'
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
      'Akintola Hall'
    ],
    offCampusAreas: [
      'Asherifa',
      'Damico (Road 7)',
      'Mayfair',
      'Ede Road',
      'Parakin',
      'Modakeke / Campus Gate',
      'Ilesa Garage / Ibadan Road',
      'Opa / Moro Axis'
    ],
    facultyZones: [
      'Faculty of Technology (Spider Web)',
      'Faculty of Administration',
      'Faculty of Arts',
      'Faculty of Science & White House',
      'Faculty of Social Sciences',
      'Faculty of Law',
      'Faculty of Pharmacy',
      'College of Health Sciences (CHS)',
      'Faculty of Agriculture',
      'Faculty of Environmental Design and Management (EDM)',
      'Faculty of Education'
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
      'Asherifa Central Junction'
    ]
  },
  accommodationTypes: [
    'Self-Con',
    'Single Room',
    '2-Bedroom Shared',
    'Executive Studio',
    'Bed Space / Hostel'
  ] as const,
  availabilityStatuses: [
    'Available Immediately',
    'Next Session (2026/2027)',
    'Roommate Needed'
  ] as const,
  waterSources: [
    'Solar-powered industrial borehole',
    'Dedicated borehole with overhead tanks',
    'Clean well water with filtration',
    'Hostel central supply'
  ],
  powerSetups: [
    'Prepaid meter (Individual unit)',
    'Prepaid meter (Shared between 2-3 flats)',
    'Campus feeder line (High stability)',
    'Estate dedicated transformer',
    'Inverter / Generator ready'
  ],
  boostRules: {
    durationHours: 24,
    requiredAdsCount: 2,
    description: 'Watch 2 short ads to give this listing a 24-hour visibility boost.'
  },
  reportReasons: [
    { id: 'scam', label: 'Suspected Scam or Fraud' },
    { id: 'inappropriate', label: 'Inappropriate or Offensive Content' },
    { id: 'incorrect_info', label: 'Misleading or False Information' },
    { id: 'counterfeit', label: 'Counterfeit or Stolen Item' },
    { id: 'suspicious', label: 'Suspicious Behavior / Unsafe Meeting' },
    { id: 'other', label: 'Other Issue' }
  ]
};

export type ItemCondition = typeof BRAND_CONFIG.itemConditions[number];
export type AccommodationType = typeof BRAND_CONFIG.accommodationTypes[number];
export type AvailabilityStatus = typeof BRAND_CONFIG.availabilityStatuses[number];

/**
 * Direct contact channels that are actually live. Anything blank is hidden by
 * the UI rather than rendered as a dead or invented address.
 */
export const ACTIVE_CONTACT_CHANNELS = [
  { kind: 'email' as const, label: 'Email', value: BRAND_CONFIG.contact.email.trim() },
  { kind: 'phone' as const, label: 'Phone', value: BRAND_CONFIG.contact.phone.trim() },
  { kind: 'whatsapp' as const, label: 'WhatsApp', value: BRAND_CONFIG.contact.whatsapp.trim() },
].filter((channel) => channel.value.length > 0);

export const ACTIVE_SOCIALS = BRAND_CONFIG.contact.socials.filter(
  (social) => social.label.trim().length > 0 && /^https?:\/\//.test(social.url)
);
