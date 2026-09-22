-- ==============================================================================
-- JID Campus Marketplace & Accommodation Platform
-- Production PostgreSQL Database Schema for Supabase
-- Target Institution: Obafemi Awolowo University (OAU), Ile-Ife
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES (Extends Supabase auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  matric_number TEXT,
  department TEXT NOT NULL,
  level TEXT NOT NULL, -- e.g. '100L', '200L', '300L', '400L', '500L', 'Graduating / Stalite'
  hall_or_area TEXT NOT NULL, -- e.g. 'Fajuyi Hall', 'Damico', 'Asherifa'
  phone_number TEXT,
  whatsapp_number TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT FALSE, -- reserved for future genuine ID card verification
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'landlord', 'agent', 'moderator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. MARKETPLACE LISTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'electronics', 'phones', 'computers', 'books', 'fashion', 'furniture', 'school-supplies', 'other'
  )),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  condition TEXT NOT NULL CHECK (condition IN (
    'Brand New', 'Like New', 'Good Condition', 'Well Used'
  )),
  location TEXT NOT NULL, -- Hall or campus spot
  pickup_spot TEXT NOT NULL, -- Recommended meeting spot
  specs JSONB DEFAULT '[]'::jsonb,
  images TEXT[] NOT NULL DEFAULT '{}',
  contact_preference TEXT DEFAULT 'whatsapp' CHECK (contact_preference IN ('whatsapp', 'phone', 'chat', 'all')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'sold', 'removed')),
  views_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  is_boosted BOOLEAN DEFAULT FALSE,
  boosted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. PROPERTY / ACCOMMODATION LISTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.property_listings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  area TEXT NOT NULL, -- 'Asherifa', 'Damico', 'Mayfair', 'Ede Road', etc.
  distance_to_campus TEXT NOT NULL, -- e.g. '6 mins bike to Campus Gate'
  price_per_year NUMERIC(12, 2) NOT NULL CHECK (price_per_year > 0),
  room_type TEXT NOT NULL CHECK (room_type IN (
    'Self-Con', 'Single Room', '2-Bedroom Shared', 'Executive Studio', 'Bed Space / Hostel'
  )),
  availability TEXT NOT NULL CHECK (availability IN (
    'Available Immediately', 'Next Session (2026/2027)', 'Roommate Needed'
  )),
  water_source TEXT NOT NULL,
  power_setup TEXT NOT NULL,
  security TEXT NOT NULL,
  proximity_desc TEXT NOT NULL,
  amenities TEXT[] DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  contact_phone TEXT NOT NULL,
  contact_whatsapp TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'rented', 'removed')),
  views_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  is_boosted BOOLEAN DEFAULT FALSE,
  boosted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. SAVED LISTINGS (Bookmarks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_listings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('marketplace', 'property')),
  listing_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_type, listing_id)
);

-- ------------------------------------------------------------------------------
-- 5. MESSAGES (Campus In-App Chat)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  listing_type TEXT CHECK (listing_type IN ('marketplace', 'property')),
  listing_id UUID,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. NOTIFICATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('message', 'boost', 'inquiry', 'system', 'report')),
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. BOOSTS (Voluntary Rewarded Ad Monetization)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boosts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('marketplace', 'property')),
  listing_id UUID NOT NULL,
  ads_completed INTEGER NOT NULL DEFAULT 5,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. PREMIUM SUBSCRIPTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'semester', 'annual')),
  amount NUMERIC(10, 2) NOT NULL,
  payment_reference TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. REPORTS & SAFETY MODERATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('marketplace', 'property', 'user')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
  moderator_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- ==============================================================================
-- INDEXES FOR FAST CAMPUS SEARCHES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON public.marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_location ON public.marketplace_listings(location);
CREATE INDEX IF NOT EXISTS idx_marketplace_status ON public.marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_boosted ON public.marketplace_listings(is_boosted);

CREATE INDEX IF NOT EXISTS idx_property_area ON public.property_listings(area);
CREATE INDEX IF NOT EXISTS idx_property_room_type ON public.property_listings(room_type);
CREATE INDEX IF NOT EXISTS idx_property_status ON public.property_listings(status);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_saved_user ON public.saved_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can view profiles, users can update only their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Marketplace Listings: Anyone can view active listings, owners manage their own
CREATE POLICY "Active marketplace listings are public" ON public.marketplace_listings
  FOR SELECT USING (status = 'active' OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own marketplace listings" ON public.marketplace_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own marketplace listings" ON public.marketplace_listings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own marketplace listings" ON public.marketplace_listings
  FOR DELETE USING (auth.uid() = user_id);

-- Property Listings: Public can view active, owners manage their own
CREATE POLICY "Active properties are public" ON public.property_listings
  FOR SELECT USING (status = 'active' OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own property listings" ON public.property_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own property listings" ON public.property_listings
  FOR UPDATE USING (auth.uid() = user_id);

-- Saved Listings: Users view and manage only their own bookmarks
CREATE POLICY "Users can view own saved listings" ON public.saved_listings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved listings" ON public.saved_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved listings" ON public.saved_listings
  FOR DELETE USING (auth.uid() = user_id);

-- Messages: Users can see messages where they are sender or receiver
CREATE POLICY "Users can view their conversations" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Notifications: Only recipient can view
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- ==============================================================================
-- AUTOMATIC PROFILE TRIGGER ON SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, department, level, hall_or_area)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Great Ife Student'),
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'department', 'Undergraduate'),
    COALESCE(new.raw_user_meta_data->>'level', '300L'),
    COALESCE(new.raw_user_meta_data->>'hall_or_area', 'Fajuyi Hall')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
