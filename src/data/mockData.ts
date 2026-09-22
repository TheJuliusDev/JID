import { MarketplaceItem, PropertyListing, UserProfile, Conversation, NotificationItem, CampusNode, MarketItem, ApartmentListing } from '../types';
import { DEMO_PRODUCT_IMAGES } from '../services/cloudinary';

export const DEMO_USER_JULIUS: UserProfile = {
  id: 'user-julius-adeyemi',
  email: 'julius.adeyemi@oauife.edu.ng',
  fullName: 'Julius Adeyemi',
  matricNumber: 'TEE/2021/089',
  department: 'Electronic & Electrical Engineering',
  level: '400L',
  hallOrArea: 'Fajuyi Hall (Block 3)',
  phoneNumber: '+234 812 345 6789',
  whatsappNumber: '+234 812 345 6789',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  bio: 'Hardware tinkerer & final year robotics project lead. Fajuyi Hall resident.',
  isPremium: true,
  premiumUntil: '2026-12-31T23:59:59Z',
  isVerified: true,
  role: 'student',
  createdAt: '2025-10-15T10:00:00Z'
};

export const DEMO_USER_SELLER_PRAISE: UserProfile = {
  id: 'user-praise-eniola',
  email: 'praise.e@oauife.edu.ng',
  fullName: 'Praise Eniola',
  department: 'Faculty of Law',
  level: '300L',
  hallOrArea: 'Moremi Hall',
  phoneNumber: '+234 803 987 6543',
  whatsappNumber: '+234 803 987 6543',
  avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
  bio: 'Law student & campus creative. Fast handover at Amphitheatre.',
  isPremium: true,
  isVerified: true,
  role: 'student',
  createdAt: '2025-11-01T12:00:00Z'
};

export const DEMO_USER_ADMIN: UserProfile = {
  id: 'user-admin-jid',
  email: 'admin@jidcampus.ng',
  fullName: 'Great Ife Campus Moderator',
  department: 'Campus Safety & Platform Ops',
  level: 'Staff',
  hallOrArea: 'SUB Administrative Wing',
  phoneNumber: '+234 800 000 5432',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  bio: 'Platform administration & student trust officer.',
  isPremium: true,
  isVerified: true,
  role: 'admin',
  createdAt: '2025-01-01T00:00:00Z'
};

export const INITIAL_MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'item-1',
    userId: 'user-julius-adeyemi',
    title: 'Apple MacBook Air M1 (8GB RAM / 256GB SSD, Space Gray)',
    description: 'Selling because I am upgrading to 16GB for my final year machine learning model training. Kept in a hard shell case since day one. No screen dents, flawless keyboard, and battery cycle count is only 142.',
    category: 'computers',
    price: 540000,
    condition: 'Like New',
    location: 'Fajuyi Hall',
    pickupSpot: 'SUB Car Park or Tech Quadrangle (Spider Web)',
    specs: [
      'Battery Health: 92% (142 cycles)',
      'Apple Silicon M1 8-Core CPU',
      'Includes original 30W USB-C brick & braided cable',
      'Free protective case included'
    ],
    images: [
      DEMO_PRODUCT_IMAGES.macbook,
      DEMO_PRODUCT_IMAGES.macbook2
    ],
    contactPreference: 'all',
    phoneOrWhatsapp: '+234 812 345 6789',
    status: 'active',
    viewsCount: 284,
    savesCount: 38,
    isBoosted: true,
    boostedUntil: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(), // 18 hours left
    createdAt: '2026-09-21T14:30:00Z',
    seller: {
      name: 'Julius Adeyemi',
      department: 'Elect/Elect Engineering',
      level: '400L',
      hallOrArea: 'Fajuyi Hall',
      avatarUrl: DEMO_USER_JULIUS.avatarUrl,
      isPremium: true,
      isVerified: true
    }
  },
  {
    id: 'item-2',
    userId: 'user-praise-eniola',
    title: 'Samsung Galaxy S22 5G (128GB, Phantom Black, Dual SIM)',
    description: 'Direct clean foreign-used device. Cameras, 120Hz AMOLED display, ultrasonic fingerprint and dual SIM functionality are 100% working. Never repaired or opened. Comes with 2 free silicone bumpers.',
    category: 'phones',
    price: 355000,
    condition: 'Like New',
    location: 'Damico (Road 7)',
    pickupSpot: 'Amphitheatre Ground Floor or Damico Gate',
    specs: [
      'Snapdragon 8 Gen 1 Processor',
      'Dual Physical Nano SIM',
      'Tempered Glass pre-installed',
      'Super Fast 25W Charging supported'
    ],
    images: [
      DEMO_PRODUCT_IMAGES.samsung,
      DEMO_PRODUCT_IMAGES.iphone
    ],
    contactPreference: 'whatsapp',
    phoneOrWhatsapp: '+234 803 987 6543',
    status: 'active',
    viewsCount: 195,
    savesCount: 22,
    isBoosted: false,
    createdAt: '2026-09-21T09:15:00Z',
    seller: {
      name: 'Praise Eniola',
      department: 'Faculty of Law',
      level: '300L',
      hallOrArea: 'Damico / Moremi',
      avatarUrl: DEMO_USER_SELLER_PRAISE.avatarUrl,
      isPremium: true,
      isVerified: true
    }
  },
  {
    id: 'item-3',
    userId: 'user-tobi-mth',
    title: 'Calculus & Engineering Mathematics (Bird 8th Ed) + Tested Past Qs',
    description: 'Distinction pack for STEM students in 100L–200L. Clean spiral-bound hardcopy with handwritten annotations for difficult derivation steps in mechanics, vector calculus, and ODE.',
    category: 'books',
    price: 16500,
    condition: 'Good Condition',
    location: 'Angola Hall',
    pickupSpot: 'Hezekiah Library Walkway',
    specs: [
      'Covers MTH 101, MTH 102, MTH 201 & PHY 105',
      'Full step-by-step solutions for 2018–2025 tested questions',
      'No missing or torn pages'
    ],
    images: [
      DEMO_PRODUCT_IMAGES.textbooks
    ],
    contactPreference: 'whatsapp',
    phoneOrWhatsapp: '+234 814 111 2233',
    status: 'active',
    viewsCount: 142,
    savesCount: 19,
    isBoosted: false,
    createdAt: '2026-09-20T16:45:00Z',
    seller: {
      name: 'Bukunmi A.',
      department: 'Computer Science & Mathematics',
      level: '200L',
      hallOrArea: 'Angola Hall',
      isPremium: false,
      isVerified: true
    }
  },
  {
    id: 'item-4',
    userId: 'user-femi-desk',
    title: 'Solid Hardwood Study Desk & Ergonomic Mesh Swivel Chair',
    description: 'Moving out of my off-campus room after final exams. The table has 3 deep lockable drawers and a dedicated power cable grommet. Chair lumbar support is intact and adjusts smoothly.',
    category: 'furniture',
    price: 45000,
    condition: 'Good Condition',
    location: 'Awolowo (Awo) Hall',
    pickupSpot: 'Awo Hall Block 4 (Assistance with campus bike carrier available)',
    specs: [
      'Heavy hardwood frame (does not wobble)',
      'Breathable mesh back with gas-lift height adjustment',
      '3 smooth drawer compartments with master key'
    ],
    images: [
      DEMO_PRODUCT_IMAGES.desk,
      DEMO_PRODUCT_IMAGES.chair
    ],
    contactPreference: 'all',
    phoneOrWhatsapp: '+234 809 444 5566',
    status: 'active',
    viewsCount: 310,
    savesCount: 47,
    isBoosted: true,
    boostedUntil: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-09-21T18:00:00Z',
    seller: {
      name: 'Femi K.',
      department: 'Economics',
      level: 'Graduating Stalite',
      hallOrArea: 'Awo Hall',
      isPremium: false,
      isVerified: true
    }
  },
  {
    id: 'item-5',
    userId: 'user-zainab-fan',
    title: 'Rechargeable 16" Solar/AC Mist Fan with Emergency LED Study Light',
    description: 'Lifesaver for Ife heat and hostel power outages during exam periods. Battery runs up to 7 hours continuously on medium speed. Includes solar input socket and USB output to charge your phone.',
    category: 'electronics',
    price: 28500,
    condition: 'Like New',
    location: 'Mozambique Hall',
    pickupSpot: 'Mozambique Hall Buttery / Motion Ground',
    specs: [
      '7-8 Hours Battery Runtime',
      'Dual Mist Sprayers with 1.5L water tank',
      'USB Port for phone charging during blackout',
      'Whisper-quiet brushless motor'
    ],
    images: [
      DEMO_PRODUCT_IMAGES.fan
    ],
    contactPreference: 'whatsapp',
    phoneOrWhatsapp: '+234 816 777 8899',
    status: 'active',
    viewsCount: 220,
    savesCount: 34,
    isBoosted: false,
    createdAt: '2026-09-20T11:20:00Z',
    seller: {
      name: 'Zainab M.',
      department: 'Pharmacy',
      level: '400L',
      hallOrArea: 'Mozambique Hall',
      isPremium: true,
      isVerified: true
    }
  },
  {
    id: 'item-6',
    userId: 'user-tobi-fashion',
    title: 'Heavyweight Great Ife College Vintage Jacket & Cargo Pants',
    description: 'Limited edition streetwear collection made by OAU student designers. 100% heavyweight 360GSM brushed fleece. Never worn, comes sealed in official packaging.',
    category: 'fashion',
    price: 22000,
    condition: 'Brand New',
    location: 'Asherifa',
    pickupSpot: 'Campus Gate or SUB Walkway',
    specs: [
      '360 GSM Heavyweight Terry Cotton',
      'Embroidery detail on chest and cuff',
      'Unisex Relaxed Fit (Sizes M, L, XL available)'
    ],
    images: [
      DEMO_PRODUCT_IMAGES.fashion
    ],
    contactPreference: 'chat',
    status: 'active',
    viewsCount: 165,
    savesCount: 18,
    isBoosted: false,
    createdAt: '2026-09-19T15:00:00Z',
    seller: {
      name: 'Tobi D.',
      department: 'Architecture (EDM)',
      level: '300L',
      hallOrArea: 'Asherifa',
      isPremium: true,
      isVerified: true
    }
  }
];

export const INITIAL_PROPERTY_LISTINGS: PropertyListing[] = [
  {
    id: 'apt-1',
    userId: 'user-landlord-bisi',
    title: 'Sunview Lodge Executive Self-Con Apartment',
    description: 'Modern fenced student complex built specifically for serious OAU students. Features uninterrupted solar-pumped borehole water, dedicated prepaid meter per unit, paved interlock compound, and a resident daytime caretaker and night security guard.',
    area: 'Asherifa',
    distanceToCampus: '6 mins bike ride to OAU Main Gate',
    pricePerYear: 280000,
    roomType: 'Self-Con',
    availability: 'Available Immediately',
    waterSource: 'Solar-powered industrial borehole with 4 overhead tanks',
    powerSetup: 'Dedicated prepaid meter per room (direct transformer line)',
    security: 'Perimeter razor fencing, heavy security gate, and night guard',
    proximityDesc: '2 mins walk to Asherifa central bike stand and Danfo junction. Supermarkets and laundry within 100 meters.',
    amenities: [
      'Full POP ceiling',
      'Fully tiled bathroom & kitchen',
      'Prepaid Meter',
      'Solar Water Backup',
      'Fenced Compound',
      'Personal Balcony',
      'Motorcycle Parking'
    ],
    images: [
      DEMO_PRODUCT_IMAGES.lodge1,
      DEMO_PRODUCT_IMAGES.lodgeExterior
    ],
    contactPhone: '+234 803 212 9090',
    contactWhatsapp: '+234 803 212 9090',
    isVerified: true,
    status: 'active',
    viewsCount: 640,
    savesCount: 88,
    isBoosted: true,
    boostedUntil: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-09-20T08:00:00Z',
    landlord: {
      name: 'Engr. Bisi Adeleke',
      role: 'Lodge Caretaker',
      phone: '+234 803 212 9090',
      isVerified: true
    }
  },
  {
    id: 'apt-2',
    userId: 'user-roommate-damico',
    title: 'Cedar Heights Single Room with Private Kitchenette',
    description: 'Looking for a calm, hygienic male tech or STEM student roommate to share a large two-room wing in Damico. High-speed fibre internet connection already wired, clean running water, and reliable power neighborhood.',
    area: 'Damico (Road 7)',
    distanceToCampus: '7 mins bike to Road 7 Campus Gate',
    pricePerYear: 230000,
    roomType: 'Single Room',
    availability: 'Roommate Needed',
    waterSource: 'Constant borehole supply with automatic float switch',
    powerSetup: 'Campus feeder line zone (18-22 hrs daily average)',
    security: 'Gated student close with 24/7 community vigilante',
    proximityDesc: 'Walkable to Damico junction. Quiet, studious environment favored by software developers and medical students.',
    amenities: [
      'Kitchenette with sink & shelf',
      'Fibre Internet Ready',
      'Constant Water',
      'Quiet Study Atmosphere',
      'Tiled Floor'
    ],
    images: [
      DEMO_PRODUCT_IMAGES.lodge2
    ],
    contactPhone: '+234 812 888 3322',
    contactWhatsapp: '+234 812 888 3322',
    isVerified: true,
    status: 'active',
    viewsCount: 420,
    savesCount: 51,
    isBoosted: false,
    createdAt: '2026-09-21T11:00:00Z',
    landlord: {
      name: 'Kayode V.',
      role: 'Student Subletter',
      phone: '+234 812 888 3322',
      isVerified: true
    }
  },
  {
    id: 'apt-3',
    userId: 'user-mayfair-owner',
    title: 'Royal Heritage 2-Bedroom Shared Flat',
    description: 'Spacious flat suitable for two friends or course mates. Large living room, two en-suite bedrooms, separate kitchen with outdoor utility balcony, and individual prepaid electricity meter.',
    area: 'Mayfair',
    distanceToCampus: '10 mins town service / Danfo bus ride',
    pricePerYear: 320000,
    roomType: '2-Bedroom Shared',
    availability: 'Next Session (2026/2027)',
    waterSource: 'Dual borehole with filtration system',
    powerSetup: 'Prepaid meter (split between flatmates)',
    security: 'Iron burglary proofs on all windows, solid metal entrance door',
    proximityDesc: 'Behind Bovas Filling Station Mayfair. Extremely close to grocery stores, banks, pharmacies and bus parks.',
    amenities: [
      'Two En-suite Bedrooms',
      'Large Living Area',
      'Running Borehole',
      'Prepaid Meter',
      'Spacious Kitchen'
    ],
    images: [
      DEMO_PRODUCT_IMAGES.lodge3,
      DEMO_PRODUCT_IMAGES.lodge4
    ],
    contactPhone: '+234 805 123 4567',
    contactWhatsapp: '+234 805 123 4567',
    isVerified: true,
    status: 'active',
    viewsCount: 380,
    savesCount: 43,
    isBoosted: false,
    createdAt: '2026-09-18T14:20:00Z',
    landlord: {
      name: 'Chief A. Oladipo',
      role: 'Direct Landlord',
      phone: '+234 805 123 4567',
      isVerified: true
    }
  },
  {
    id: 'apt-4',
    userId: 'user-ede-owner',
    title: 'Pinnacle Court Studio Apartment',
    description: 'Affordable and well-finished studio apartment along Ede Road. Direct Danfo bus route to OAU gate. Very good option for students seeking peace and budget-friendly living.',
    area: 'Ede Road',
    distanceToCampus: '12 mins direct bus ride',
    pricePerYear: 185000,
    roomType: 'Executive Studio',
    availability: 'Available Immediately',
    waterSource: 'Deep motorized borehole with constant pressure',
    powerSetup: 'Direct feeder line, steady power rotation',
    security: 'Compound caretaker on site with perimeter wall',
    proximityDesc: 'Along the main expressway, safe return route even during late night reading sessions.',
    amenities: [
      'Motorized Borehole',
      'Modern Tiles',
      'Low Agent Charges',
      'Close to Transit'
    ],
    images: [
      DEMO_PRODUCT_IMAGES.lodge4
    ],
    contactPhone: '+234 802 333 4455',
    contactWhatsapp: '+234 802 333 4455',
    isVerified: true,
    status: 'active',
    viewsCount: 290,
    savesCount: 31,
    isBoosted: false,
    createdAt: '2026-09-17T17:10:00Z',
    landlord: {
      name: 'Brother Samuel',
      role: 'Campus Agent',
      phone: '+234 802 333 4455',
      isVerified: true
    }
  }
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    participant: {
      id: 'user-praise-eniola',
      fullName: 'Praise Eniola',
      department: 'Faculty of Law',
      level: '300L',
      hallOrArea: 'Damico / Moremi',
      avatarUrl: DEMO_USER_SELLER_PRAISE.avatarUrl,
      isPremium: true
    },
    lastMessage: {
      id: 'msg-1',
      senderId: 'user-praise-eniola',
      receiverId: 'user-julius-adeyemi',
      listingId: 'item-2',
      listingTitle: 'Samsung Galaxy S22 5G',
      content: 'Yes bro, I can meet you at Amphitheatre ground floor by 4:30 PM today after my jurisprudence lecture. Is that fine?',
      isRead: false,
      createdAt: '2026-09-22T02:15:00Z'
    },
    unreadCount: 1,
    listingRef: {
      id: 'item-2',
      title: 'Samsung Galaxy S22 5G (128GB, Phantom Black)',
      price: 355000,
      image: DEMO_PRODUCT_IMAGES.samsung,
      type: 'marketplace'
    }
  },
  {
    id: 'conv-2',
    participant: {
      id: 'user-landlord-bisi',
      fullName: 'Engr. Bisi Adeleke',
      department: 'Sunview Lodge Caretaker',
      level: 'Caretaker',
      hallOrArea: 'Asherifa Central',
      isPremium: false
    },
    lastMessage: {
      id: 'msg-2',
      senderId: 'user-julius-adeyemi',
      receiverId: 'user-landlord-bisi',
      listingId: 'apt-1',
      listingTitle: 'Sunview Lodge Executive Self-Con',
      content: 'Good morning sir, I would like to inspect room 4 this Saturday afternoon. Is the room still vacant?',
      isRead: true,
      createdAt: '2026-09-21T16:20:00Z'
    },
    unreadCount: 0,
    listingRef: {
      id: 'apt-1',
      title: 'Sunview Lodge Executive Self-Con Apartment',
      price: 280000,
      image: DEMO_PRODUCT_IMAGES.lodge1,
      type: 'property'
    }
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    userId: 'user-julius-adeyemi',
    title: 'Listing Boost Active 🚀',
    message: 'Your Apple MacBook Air M1 is currently boosted and pinned near the top of the Great Ife marketplace.',
    type: 'boost',
    link: 'my-listings',
    isRead: false,
    createdAt: '2026-09-22T01:00:00Z'
  },
  {
    id: 'notif-2',
    userId: 'user-julius-adeyemi',
    title: 'New Inquiry on MacBook Air',
    message: 'A student from Faculty of Pharmacy saved and viewed your MacBook listing.',
    type: 'inquiry',
    link: 'my-listings',
    isRead: false,
    createdAt: '2026-09-21T21:40:00Z'
  },
  {
    id: 'notif-3',
    userId: 'user-julius-adeyemi',
    title: 'Welcome to JID Premium Member Perks',
    message: 'You have active Premium Member status. Enjoy 3x listing visibility and priority buyer badges.',
    type: 'system',
    link: 'premium',
    isRead: true,
    createdAt: '2026-09-20T10:00:00Z'
  }
];

export const CAMPUS_ECOSYSTEM_NODES: CampusNode[] = [
  {
    id: 'sub',
    name: 'SUB (Students’ Union Building)',
    subtitle: 'The epicenter of commerce & student community',
    type: 'academic',
    vibe: 'High energy, vibrant trade, student meetings',
    typicalActivity: 'Where quick handovers, phone exchanges, and textbook swaps naturally happen.'
  },
  {
    id: 'amphi',
    name: 'Amphitheatre & Motion Ground',
    subtitle: 'Cultural crossroad & gathering space',
    type: 'academic',
    vibe: 'Expansive open-air, creative hub',
    typicalActivity: 'Meetup spot for evening deals and creative campus brand drops.'
  },
  {
    id: 'halls',
    name: 'Fajuyi, Awo, Moremi & Mozambique',
    subtitle: 'The historic undergraduate residential halls',
    type: 'hall',
    vibe: 'Thriving student brotherhood & sisterhood',
    typicalActivity: 'Graduating stalites pass down reading desks, fans, and mini-fridges directly to juniors.'
  },
  {
    id: 'asherifa-damico',
    name: 'Asherifa & Damico Off-Campus Axis',
    subtitle: 'The sprawling private student housing neighborhoods',
    type: 'off-campus',
    vibe: 'Independent living, cafes, tech workstations',
    typicalActivity: 'Students searching for self-contained lodges without paying ₦100k agent fees.'
  },
  {
    id: 'gate',
    name: 'OAU Campus Gate & Town Service',
    subtitle: 'The transport artery connecting Ife town and campus',
    type: 'transit',
    vibe: 'Constant motion, Danfo buses, bike drops',
    typicalActivity: 'The daily commute route between Mayfair, Ede Road, and campus lecture halls.'
  }
];

export const SAMPLE_MARKET_ITEMS: MarketItem[] = [
  {
    id: 'item-1',
    title: 'Apple MacBook Air M1 (8GB / 256GB SSD)',
    category: 'Laptops',
    price: 540000,
    condition: 'Like New',
    sellerName: 'Damilola O.',
    department: 'Elect/Elect Engineering',
    hallOrArea: 'Fajuyi Hall',
    timeAgo: '2h ago',
    badge: 'Final Year Student',
    specs: ['Battery Health 91%', 'Cycle Count 142', 'US Keyboard with original 30W adapter'],
    description: 'Selling because I am upgrading to 16GB for my final year machine learning project. No screen scratch or dent.',
    pickupSpot: 'SUB Car Park or Faculty of Tech Quadrangle'
  },
  {
    id: 'item-2',
    title: 'Engineering Mathematics (Bird 8th Ed) + PHY 101/102 Annotated Past Questions',
    category: 'Textbooks',
    price: 16500,
    condition: 'Good Condition',
    sellerName: 'Bukunmi A.',
    department: 'Computer Science & Maths',
    hallOrArea: 'Moremi Hall',
    timeAgo: '4h ago',
    badge: 'Stalite 300L',
    specs: ['Clean spiral binding', 'Includes 2018–2025 tested questions with step-by-step solutions'],
    description: 'Guaranteed distinction saver for Part 1 & 2 STEM students. Hand-written study tips on mechanics and calculus included.',
    pickupSpot: 'Hezekiah Library Walkway'
  },
  {
    id: 'item-3',
    title: 'Samsung Galaxy S22 5G (128GB, Phantom Black)',
    category: 'Phones',
    price: 360000,
    condition: 'Like New',
    sellerName: 'Praise E.',
    department: 'Faculty of Law',
    hallOrArea: 'Damico (Road 7)',
    timeAgo: '6h ago',
    badge: 'Verified Student',
    specs: ['Snapdragon 8 Gen 1', 'Dual SIM', 'Tempered glass pre-installed + 2 free cases'],
    description: 'Clean foreign used device. Everything working 100% including ultrasonic fingerprint and camera.',
    pickupSpot: 'Amphitheatre Ground Floor or Damico Gate'
  },
  {
    id: 'item-4',
    title: 'Solid Hardwood Study Desk & Ergonomic Mesh Swivel Chair',
    category: 'Furniture',
    price: 42000,
    condition: 'Good Condition',
    sellerName: 'Femi K.',
    department: 'Economics',
    hallOrArea: 'Awolowo (Awo) Hall',
    timeAgo: '1d ago',
    badge: 'Graduating Stalite',
    specs: ['3 Drawers with key', 'Smooth swivel', 'Sturdy iron frame'],
    description: 'Bought last year for my off-campus room, leaving Ife after final exams. Must go this weekend.',
    pickupSpot: 'Awo Hall Block 4 (Can assist with campus bike carrier)'
  },
  {
    id: 'item-5',
    title: 'Heavyweight Graphic Tee & Cargo Pant Set',
    category: 'Fashion',
    price: 18000,
    condition: 'Brand New',
    sellerName: 'Tobi D.',
    department: 'Architecture',
    hallOrArea: 'Asherifa',
    timeAgo: '1d ago',
    badge: 'Campus Brand Creator',
    specs: ['100% 280GSM Cotton', 'Size XL/L Available', 'Limited Ife batch'],
    description: 'Fresh drop from our design studio. Unworn, still in packaging.',
    pickupSpot: 'Motion Ground or Campus Gate'
  },
  {
    id: 'item-6',
    title: 'Rechargeable 16" Solar/AC Mist Fan + LED Emergency Study Lamp',
    category: 'School Supplies',
    price: 29500,
    condition: 'Like New',
    sellerName: 'Zainab M.',
    department: 'Pharmacy',
    hallOrArea: 'Angola Hall',
    timeAgo: '2d ago',
    badge: 'Stalite 400L',
    specs: ['6-8 hours battery runtime', 'Remote control', 'USB phone charging port'],
    description: 'Indispensable companion for Ife heat and irregular hostel power during exams.',
    pickupSpot: 'Angola Buttery or SUB'
  }
];

export const SAMPLE_APARTMENTS: ApartmentListing[] = [
  {
    id: 'apt-1',
    title: 'Sunview Lodge Executive Self-Con',
    area: 'Asherifa',
    distanceToCampus: '6 mins bike to Campus Gate',
    pricePerYear: 280000,
    roomType: 'Self-Con',
    availability: 'Next Session (2026/2027)',
    waterSource: 'Solar-powered industrial borehole',
    powerSetup: 'Dedicated transformer line + Inverter ready',
    security: 'Fenced compound, security gate & night guard',
    proximityDesc: 'Close to Asherifa Central Junction, 2 mins walk to bike and Danfo stand',
    isVerified: true
  },
  {
    id: 'apt-2',
    title: 'Royal Heritage 2-Bedroom Shared Flat',
    area: 'Mayfair',
    distanceToCampus: '10 mins town-service / Danfo',
    pricePerYear: 220000,
    roomType: '2-Bedroom Shared',
    availability: 'Available Immediately',
    waterSource: 'Constant running borehole water',
    powerSetup: 'Prepaid meter (shared between 2 students)',
    security: 'Perimeter fencing with razor wire & metal gate',
    proximityDesc: 'Behind Bovas Filling Station, walkable to supermarkets, quiet study atmosphere',
    isVerified: true
  },
  {
    id: 'apt-3',
    title: 'Cedar Heights Single Room with Private Kitchenette',
    area: 'Damico',
    distanceToCampus: '7 mins bike to Campus Gate (Road 7)',
    pricePerYear: 245000,
    roomType: 'Single Room',
    availability: 'Roommate Needed',
    waterSource: 'Dual storage overhead tanks with booster pump',
    powerSetup: 'Direct campus feeder line',
    security: 'Gated student community with resident caretaker',
    proximityDesc: 'Fast access to Campus Gate via Road 7, quiet neighborhood favored by tech students',
    isVerified: true
  },
  {
    id: 'apt-4',
    title: 'Pinnacle Court Studio Apartment',
    area: 'Ede Road',
    distanceToCampus: '12 mins direct bus ride',
    pricePerYear: 190000,
    roomType: 'Executive Studio',
    availability: 'Next Session (2026/2027)',
    waterSource: 'Clean borehole with water filtration',
    powerSetup: 'Stable transformer zone',
    security: '24/7 vigilante patrol & gated entrance',
    proximityDesc: 'Right off the major expressway, very spacious room with modern POP finishing',
    isVerified: true
  }
];

