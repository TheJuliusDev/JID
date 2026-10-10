-- ============================================================================
-- JID — Production Database Schema
-- OAU Student Marketplace & Accommodation Platform (https://jidapp.ng)
-- ----------------------------------------------------------------------------
-- Run this entire file once in the Supabase SQL Editor.
-- It is idempotent-ish: it uses "if not exists" / "drop ... if exists" guards
-- so re-running it is safe during setup.
--
-- Images are hosted on Cloudinary (not Supabase Storage), so no storage
-- buckets/policies are required. See /supabase/README.md.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;      -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('user', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'listing_kind') then
    create type listing_kind as enum ('marketplace', 'property');
  end if;

  if not exists (select 1 from pg_type where typname = 'listing_category') then
    create type listing_category as enum (
      'electronics', 'phones', 'computers', 'books',
      'fashion', 'furniture', 'school-supplies', 'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'item_condition') then
    create type item_condition as enum (
      'Brand New', 'Like New', 'Good Condition', 'Well Used'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'contact_preference') then
    create type contact_preference as enum ('whatsapp', 'phone', 'chat', 'all');
  end if;

  if not exists (select 1 from pg_type where typname = 'marketplace_status') then
    create type marketplace_status as enum ('active', 'paused', 'sold', 'removed');
  end if;

  if not exists (select 1 from pg_type where typname = 'property_room_type') then
    create type property_room_type as enum (
      'Self-Con', 'Single Room', '2-Bedroom Shared',
      'Executive Studio', 'Bed Space / Hostel'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'property_availability') then
    create type property_availability as enum (
      'Available Immediately', 'Next Session (2026/2027)', 'Roommate Needed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'property_status') then
    create type property_status as enum ('active', 'paused', 'rented', 'removed');
  end if;

  if not exists (select 1 from pg_type where typname = 'landlord_role') then
    create type landlord_role as enum (
      'Student Subletter', 'Lodge Caretaker', 'Direct Landlord', 'Campus Agent'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type notification_type as enum (
      'message', 'boost', 'inquiry', 'system', 'report', 'review'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type report_status as enum (
      'pending', 'reviewing', 'resolved', 'dismissed', 'action_taken'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'boost_status') then
    create type boost_status as enum ('active', 'expired', 'cancelled');
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

-- 2.1 Profiles (public-safe fields only; email lives in auth.users,
--     contact phone numbers are opt-in *per listing*, never global)
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique not null,
  full_name     text not null,
  department    text,
  level         text,
  hall_or_area  text,
  avatar_url    text,
  bio           text,
  is_suspended  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$')
);

-- 2.2 User roles (authorization source of truth — NEVER trust client claims)
create table if not exists public.user_roles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        app_role not null default 'user',
  created_at  timestamptz not null default now()
);

-- 2.3 Marketplace listings
create table if not exists public.marketplace_listings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  title              text not null check (char_length(title) between 3 and 120),
  description        text not null check (char_length(description) between 10 and 4000),
  category           listing_category not null,
  price              numeric(12,2) not null check (price >= 0),
  condition          item_condition not null,
  location           text not null,
  pickup_spot        text,
  specs              text[] not null default '{}',
  images             text[] not null default '{}',
  contact_preference contact_preference not null default 'chat',
  phone_or_whatsapp  text,
  status             marketplace_status not null default 'active',
  views_count        integer not null default 0,
  saves_count        integer not null default 0,
  boosted_until      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint marketplace_images_present check (array_length(images, 1) >= 1)
);

-- 2.4 Property (accommodation) listings
create table if not exists public.property_listings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  title              text not null check (char_length(title) between 3 and 120),
  description        text not null check (char_length(description) between 10 and 4000),
  area               text not null,
  distance_to_campus text,
  price_per_year     numeric(12,2) not null check (price_per_year >= 0),
  room_type          property_room_type not null,
  availability       property_availability not null default 'Available Immediately',
  water_source       text,
  power_setup        text,
  security           text,
  proximity_desc     text,
  amenities          text[] not null default '{}',
  images             text[] not null default '{}',
  contact_phone      text,
  contact_whatsapp   text,
  landlord_role      landlord_role not null default 'Student Subletter',
  is_verified        boolean not null default false,   -- admin/moderation controlled only
  status             property_status not null default 'active',
  views_count        integer not null default 0,
  saves_count        integer not null default 0,
  boosted_until      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint property_images_present check (array_length(images, 1) >= 1)
);

-- 2.5 Saved listings (private per user)
create table if not exists public.saved_listings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  listing_type  listing_kind not null,
  listing_id    uuid not null,
  created_at    timestamptz not null default now(),
  unique (user_id, listing_type, listing_id)
);

-- 2.6 Conversations
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  listing_type    listing_kind,
  listing_id      uuid,
  listing_title   text,
  listing_price   numeric(12,2),
  listing_image   text,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

-- 2.7 Conversation participants
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- 2.8 Messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 4000),
  created_at      timestamptz not null default now()
);

alter table public.messages
  add column if not exists read_at timestamptz;

-- Soft-deletes: a sender wipes the content and stamps deleted_at (the row
-- stays so ordering, read receipts and realtime updates keep working).
alter table public.messages
  add column if not exists deleted_at timestamptz;

-- Read receipts: find unread messages sent to a student quickly.
create index if not exists messages_read_pending_idx
  on public.messages (conversation_id)
  where read_at is null;

-- 2.9 Notifications
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  body        text not null,
  type        notification_type not null default 'system',
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 2.10 Vendor reviews (one review per reviewer per vendor)
create table if not exists public.vendor_reviews (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.profiles (id) on delete cascade,
  reviewer_id  uuid not null references public.profiles (id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  comment      text check (comment is null or char_length(comment) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (vendor_id, reviewer_id),
  constraint no_self_review check (vendor_id <> reviewer_id)
);

-- 2.11 Listing reports (marketplace / property)
create table if not exists public.listing_reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid references public.profiles (id) on delete set null,
  listing_type  listing_kind not null,
  listing_id    uuid not null,
  listing_title text,
  reason        text not null,
  details       text,
  status        report_status not null default 'pending',
  resolved_by   uuid references public.profiles (id) on delete set null,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- 2.12 User reports (report a person / profile)
create table if not exists public.user_reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid references public.profiles (id) on delete set null,
  reported_user_id  uuid not null references public.profiles (id) on delete cascade,
  reason            text not null,
  details           text,
  status            report_status not null default 'pending',
  resolved_by       uuid references public.profiles (id) on delete set null,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- 2.13 Listing boosts (watch 2 ads -> 24h visibility)
create table if not exists public.listing_boosts (
  id            uuid primary key default gen_random_uuid(),
  listing_type  listing_kind not null,
  listing_id    uuid not null,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  status        boost_status not null default 'active',
  created_at    timestamptz not null default now()
);

-- Only one ACTIVE boost per listing at a time
create unique index if not exists one_active_boost_per_listing
  on public.listing_boosts (listing_type, listing_id)
  where status = 'active';

-- 2.14 Admin audit log
create table if not exists public.admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references public.profiles (id) on delete set null,
  action       text not null,
  target_type  text,
  target_id    text,
  details      jsonb,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_market_user        on public.marketplace_listings (user_id);
create index if not exists idx_market_status       on public.marketplace_listings (status);
create index if not exists idx_market_category     on public.marketplace_listings (category);
create index if not exists idx_market_created      on public.marketplace_listings (created_at desc);
create index if not exists idx_market_boost        on public.marketplace_listings (boosted_until);

create index if not exists idx_property_user       on public.property_listings (user_id);
create index if not exists idx_property_status     on public.property_listings (status);
create index if not exists idx_property_area       on public.property_listings (area);
create index if not exists idx_property_created    on public.property_listings (created_at desc);
create index if not exists idx_property_boost      on public.property_listings (boosted_until);

create index if not exists idx_saved_user          on public.saved_listings (user_id);
create index if not exists idx_msg_conversation    on public.messages (conversation_id, created_at);
create index if not exists idx_cp_user             on public.conversation_participants (user_id);
create index if not exists idx_conv_last_message   on public.conversations (last_message_at desc);
create index if not exists idx_notif_user          on public.notifications (user_id, created_at desc);
create index if not exists idx_reviews_vendor      on public.vendor_reviews (vendor_id);
create index if not exists idx_boost_listing       on public.listing_boosts (listing_type, listing_id);
create index if not exists idx_reports_status      on public.listing_reports (status);

-- ----------------------------------------------------------------------------
-- 4. Functions
-- ----------------------------------------------------------------------------

-- 4.1 Generic updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4.2 Role check (SECURITY DEFINER to avoid RLS recursion inside policies)
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role = 'admin'
  );
$$;

-- 4.3 Conversation membership check (SECURITY DEFINER, avoids recursive RLS)
create or replace function public.is_conversation_participant(conv_id uuid, uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = uid
  );
$$;

-- 4.4 Do two users already share a conversation? (used for review anti-spam)
create or replace function public.users_share_conversation(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversation_participants p1
    join public.conversation_participants p2
      on p1.conversation_id = p2.conversation_id
    where p1.user_id = a and p2.user_id = b
  );
$$;

-- 4.5 Ownership check for a listing of either kind
create or replace function public.owns_listing(kind listing_kind, lid uuid, uid uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  owner uuid;
begin
  if kind = 'marketplace' then
    select user_id into owner from public.marketplace_listings where id = lid;
  else
    select user_id into owner from public.property_listings where id = lid;
  end if;
  return owner is not null and owner = uid;
end;
$$;

-- 4.6 Create a profile + default role automatically on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := lower(coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    split_part(new.email, '@', 1)
  ));
  -- sanitize to allowed characters
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  if char_length(base_username) < 3 then
    base_username := 'user' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base_username := substr(base_username, 1, 20);
  final_username := base_username;

  -- ensure uniqueness
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := substr(base_username, 1, 16) || suffix::text;
  end loop;

  insert into public.profiles (id, username, full_name, department, level, hall_or_area)
  values (
    new.id,
    final_username,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), final_username),
    nullif(new.raw_user_meta_data->>'department', ''),
    nullif(new.raw_user_meta_data->>'level', ''),
    nullif(new.raw_user_meta_data->>'hall_or_area', '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- 4.7 Apply a boost: stamp boosted_until on the target listing
-- The jid.trusted_write flag marks this SECURITY DEFINER writer as legitimate
-- for protect_listing_privileged_columns() below. auth.uid() still returns the
-- calling user inside a definer function, so an is_admin() check alone would
-- wrongly block a legitimate boost. Transaction-local, so clients cannot forge it.
create or replace function public.apply_boost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('jid.trusted_write', 'on', true);

  if new.status = 'active' then
    if new.listing_type = 'marketplace' then
      update public.marketplace_listings
        set boosted_until = new.expires_at
        where id = new.listing_id;
    else
      update public.property_listings
        set boosted_until = new.expires_at
        where id = new.listing_id;
    end if;
  end if;
  return new;
end;
$$;

-- 4.8 Expire boosts whose window has passed (call from pg_cron or on demand)
create or replace function public.expire_boosts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('jid.trusted_write', 'on', true);

  update public.listing_boosts
    set status = 'expired'
    where status = 'active' and expires_at <= now();

  update public.marketplace_listings
    set boosted_until = null
    where boosted_until is not null and boosted_until <= now();

  update public.property_listings
    set boosted_until = null
    where boosted_until is not null and boosted_until <= now();
end;
$$;

-- 4.9 Notify other participants when a message is sent
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select full_name into sender_name from public.profiles where id = new.sender_id;

  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;

  insert into public.notifications (user_id, title, body, type, link)
  select
    cp.user_id,
    coalesce(sender_name, 'New message'),
    left(new.content, 140),
    'message',
    'messages'
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id <> new.sender_id;

  return new;
end;
$$;

-- 4.10 Start or fetch a 1:1 conversation atomically (bypasses insert-RLS safely)
create or replace function public.get_or_create_direct_conversation(
  other_user   uuid,
  p_listing_type  listing_kind default null,
  p_listing_id    uuid default null,
  p_listing_title text default null,
  p_listing_price numeric default null,
  p_listing_image text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if other_user is null or other_user = me then
    raise exception 'Invalid conversation target';
  end if;

  -- find an existing 1:1 conversation shared by exactly these two users
  select c.id into conv_id
  from public.conversations c
  join public.conversation_participants p1 on p1.conversation_id = c.id and p1.user_id = me
  join public.conversation_participants p2 on p2.conversation_id = c.id and p2.user_id = other_user
  where (
    select count(*) from public.conversation_participants p where p.conversation_id = c.id
  ) = 2
  order by c.created_at asc
  limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  insert into public.conversations
    (listing_type, listing_id, listing_title, listing_price, listing_image, created_by)
  values
    (p_listing_type, p_listing_id, p_listing_title, p_listing_price, p_listing_image, me)
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (conv_id, me), (conv_id, other_user);

  return conv_id;
end;
$$;

-- 4.11 Increment a listing view counter (safe, avoids RLS write on read paths)
create or replace function public.increment_listing_view(kind listing_kind, lid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Views are incremented on read paths, including for anonymous visitors, so
  -- this cannot require is_admin(). Flag it as a trusted writer instead, or
  -- protect_listing_privileged_columns() would reject every legitimate view.
  perform set_config('jid.trusted_write', 'on', true);

  if kind = 'marketplace' then
    update public.marketplace_listings set views_count = views_count + 1 where id = lid;
  else
    update public.property_listings set views_count = views_count + 1 where id = lid;
  end if;
end;
$$;

-- 4.12 Aggregated conversation list for the signed-in user (1:1 threads)
create or replace function public.get_my_conversations()
returns table (
  conversation_id     uuid,
  other_id            uuid,
  other_username      text,
  other_full_name     text,
  other_avatar_url    text,
  other_department    text,
  other_level         text,
  other_hall_or_area  text,
  listing_type        listing_kind,
  listing_id          uuid,
  listing_title       text,
  listing_price       numeric,
  listing_image       text,
  last_message_at     timestamptz,
  last_message        text,
  last_sender_id      uuid,
  unread_count        bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with my as (
    select conversation_id, last_read_at
    from public.conversation_participants
    where user_id = auth.uid()
  )
  select
    c.id,
    op.user_id,
    pr.username,
    pr.full_name,
    pr.avatar_url,
    pr.department,
    pr.level,
    pr.hall_or_area,
    c.listing_type,
    c.listing_id,
    c.listing_title,
    c.listing_price,
    c.listing_image,
    c.last_message_at,
    lm.content,
    lm.sender_id,
    coalesce(uc.cnt, 0)
  from my
  join public.conversations c on c.id = my.conversation_id
  join public.conversation_participants op
    on op.conversation_id = c.id and op.user_id <> auth.uid()
  join public.profiles pr on pr.id = op.user_id
  left join lateral (
    select content, sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*) as cnt
    from public.messages m
    where m.conversation_id = c.id
      and m.created_at > my.last_read_at
      and m.sender_id <> auth.uid()
  ) uc on true
  order by c.last_message_at desc;
$$;

-- 4.13 Mark a conversation as read for the current user
create or replace function public.mark_conversation_read(conv_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversation_participants
    set last_read_at = now()
    where conversation_id = conv_id and user_id = auth.uid();
$$;

-- 4.x Let a signed-in user permanently delete their own account.
-- Deleting the auth.users row cascades to profiles and all owned data.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Triggers
-- ----------------------------------------------------------------------------
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_market_updated on public.marketplace_listings;
create trigger trg_market_updated before update on public.marketplace_listings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_property_updated on public.property_listings;
create trigger trg_property_updated before update on public.property_listings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_reviews_updated on public.vendor_reviews;
create trigger trg_reviews_updated before update on public.vendor_reviews
  for each row execute function public.set_updated_at();

-- Prevent non-admins from changing their own suspension flag
create or replace function public.protect_suspension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_suspended is distinct from old.is_suspended and not public.is_admin(auth.uid()) then
    raise exception 'Only administrators can change suspension status';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_suspension on public.profiles;
create trigger trg_protect_suspension before update on public.profiles
  for each row execute function public.protect_suspension();

-- RLS is row-level only: it cannot restrict WHICH COLUMNS a listing owner may
-- update, so without this guard any logged-in user can PATCH their own row and
-- set is_verified, or flip status back to 'active' and undo an admin takedown.
-- Fields are read via to_jsonb() rather than new.<col>: record field resolution
-- is runtime, so new.is_verified would error on marketplace_listings, which has
-- no such column. A missing key yields NULL, and NULL IS DISTINCT FROM NULL is
-- false, so absent columns are skipped.
create or replace function public.protect_listing_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin_user boolean := public.is_admin(auth.uid());
  is_trusted    boolean := coalesce(current_setting('jid.trusted_write', true), 'off') = 'on';
  new_status     text    := new.status::text;
  old_status     text    := old.status::text;
  -- status values a non-admin owner is allowed to set
  owner_statuses text[]  := case
                             when tg_table_name = 'property_listings'
                               then array['active', 'paused', 'rented']
                             else array['active', 'paused', 'sold']
                           end;
begin
  if is_admin_user or is_trusted then
    return new;
  end if;

  -- Verified badge: moderation-controlled only (property_listings).
  if (to_jsonb(new) ->> 'is_verified')::boolean
     is distinct from (to_jsonb(old) ->> 'is_verified')::boolean then
    raise exception 'Only administrators can change is_verified'
      using errcode = '42501';
  end if;

  -- Search ranking / social proof metrics.
  if (to_jsonb(new) ->> 'views_count')::integer
     is distinct from (to_jsonb(old) ->> 'views_count')::integer then
    raise exception 'views_count is server-managed and cannot be edited'
      using errcode = '42501';
  end if;

  if (to_jsonb(new) ->> 'saves_count')::integer
     is distinct from (to_jsonb(old) ->> 'saves_count')::integer then
    raise exception 'saves_count is server-managed and cannot be edited'
      using errcode = '42501';
  end if;

  -- Reward/promotion visibility window.
  if (to_jsonb(new) ->> 'boosted_until')::timestamptz
     is distinct from (to_jsonb(old) ->> 'boosted_until')::timestamptz then
    raise exception 'boosted_until is set by the boost system and cannot be edited'
      using errcode = '42501';
  end if;

  -- Moderation state. An owner may relist (active <-> paused <-> sold/rented)
  -- but may never enter 'removed', nor lift a row an admin has removed.
  if new_status is distinct from old_status then
    if new_status = 'removed' then
      raise exception 'Only administrators can remove a listing'
        using errcode = '42501';
    end if;

    if old_status = 'removed' then
      raise exception 'This listing was removed by a moderator and cannot be restored'
        using errcode = '42501';
    end if;

    if not (new_status = any (owner_statuses)) then
      raise exception 'Invalid status for a listing owner'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_listing_columns on public.marketplace_listings;
create trigger trg_protect_listing_columns
  before update on public.marketplace_listings
  for each row execute function public.protect_listing_privileged_columns();

drop trigger if exists trg_protect_listing_columns on public.property_listings;
create trigger trg_protect_listing_columns
  before update on public.property_listings
  for each row execute function public.protect_listing_privileged_columns();

-- Create profile on new auth user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Apply boost window to the listing
drop trigger if exists trg_apply_boost on public.listing_boosts;
create trigger trg_apply_boost after insert on public.listing_boosts
  for each row execute function public.apply_boost();

-- Message fan-out (notifications + conversation bump)
drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message after insert on public.messages
  for each row execute function public.notify_new_message();

-- ----------------------------------------------------------------------------
-- 6. Views  (public storefront profile — no private data)
-- ----------------------------------------------------------------------------
create or replace view public.public_profiles as
  select
    p.id,
    p.username,
    p.full_name,
    p.department,
    p.level,
    p.hall_or_area,
    p.avatar_url,
    p.bio,
    p.created_at,
    coalesce(r.avg_rating, 0)::numeric(3,2) as avg_rating,
    coalesce(r.review_count, 0)             as review_count
  from public.profiles p
  left join (
    select vendor_id, avg(rating) as avg_rating, count(*) as review_count
    from public.vendor_reviews
    group by vendor_id
  ) r on r.vendor_id = p.id
  where p.is_suspended = false;

-- ----------------------------------------------------------------------------
-- 7. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles                 enable row level security;
alter table public.user_roles               enable row level security;
alter table public.marketplace_listings     enable row level security;
alter table public.property_listings        enable row level security;
alter table public.saved_listings           enable row level security;
alter table public.conversations            enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;
alter table public.notifications             enable row level security;
alter table public.vendor_reviews            enable row level security;
alter table public.listing_reports           enable row level security;
alter table public.user_reports              enable row level security;
alter table public.listing_boosts            enable row level security;
alter table public.admin_audit_log           enable row level security;

-- ---- profiles ----
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);  -- only public-safe columns live in this table

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- user_roles ----
drop policy if exists roles_select_own on public.user_roles;
create policy roles_select_own on public.user_roles
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists roles_admin_write on public.user_roles;
create policy roles_admin_write on public.user_roles
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- marketplace_listings ----
drop policy if exists market_select on public.marketplace_listings;
create policy market_select on public.marketplace_listings
  for select using (
    status <> 'removed' or auth.uid() = user_id or public.is_admin(auth.uid())
  );

drop policy if exists market_insert on public.marketplace_listings;
create policy market_insert on public.marketplace_listings
  for insert with check (auth.uid() = user_id);

drop policy if exists market_update on public.marketplace_listings;
create policy market_update on public.marketplace_listings
  for update using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists market_delete on public.marketplace_listings;
create policy market_delete on public.marketplace_listings
  for delete using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ---- property_listings ----
drop policy if exists property_select on public.property_listings;
create policy property_select on public.property_listings
  for select using (
    status <> 'removed' or auth.uid() = user_id or public.is_admin(auth.uid())
  );

drop policy if exists property_insert on public.property_listings;
create policy property_insert on public.property_listings
  for insert with check (auth.uid() = user_id);

drop policy if exists property_update on public.property_listings;
create policy property_update on public.property_listings
  for update using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists property_delete on public.property_listings;
create policy property_delete on public.property_listings
  for delete using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ---- saved_listings (private) ----
drop policy if exists saved_all on public.saved_listings;
create policy saved_all on public.saved_listings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- conversations ----
drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations
  for select using (
    public.is_conversation_participant(id, auth.uid()) or public.is_admin(auth.uid())
  );

-- inserts happen via get_or_create_direct_conversation() (security definer)

-- ---- conversation_participants ----
drop policy if exists cp_select on public.conversation_participants;
create policy cp_select on public.conversation_participants
  for select using (
    public.is_conversation_participant(conversation_id, auth.uid())
    or public.is_admin(auth.uid())
  );

drop policy if exists cp_update_own on public.conversation_participants;
create policy cp_update_own on public.conversation_participants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- messages ----
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (
    public.is_conversation_participant(conversation_id, auth.uid())
    or public.is_admin(auth.uid())
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Participants may only stamp the read_at on messages they received
-- (never on their own sent messages).
drop policy if exists messages_update_read_at on public.messages;
create policy messages_update_read_at on public.messages
  for update using (
    public.is_conversation_participant(conversation_id, auth.uid())
    and sender_id <> auth.uid()
  )
  with check (
    public.is_conversation_participant(conversation_id, auth.uid())
    and sender_id <> auth.uid()
  );

-- A student may soft-delete (wipe + stamp deleted_at) only the messages they
-- sent. The read_at policy above keeps read receipts stamping separate.
drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages
  for update using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

-- ---- notifications ----
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notif_insert_self on public.notifications;
create policy notif_insert_self on public.notifications
  for insert with check (auth.uid() = user_id);
-- cross-user notifications are created by SECURITY DEFINER triggers

-- ---- vendor_reviews ----
drop policy if exists reviews_select on public.vendor_reviews;
create policy reviews_select on public.vendor_reviews
  for select using (true);

drop policy if exists reviews_insert on public.vendor_reviews;
create policy reviews_insert on public.vendor_reviews
  for insert with check (
    auth.uid() = reviewer_id
    and reviewer_id <> vendor_id
    and public.users_share_conversation(auth.uid(), vendor_id)  -- anti-spam: must have interacted
  );

drop policy if exists reviews_update_own on public.vendor_reviews;
create policy reviews_update_own on public.vendor_reviews
  for update using (auth.uid() = reviewer_id) with check (auth.uid() = reviewer_id);

drop policy if exists reviews_delete on public.vendor_reviews;
create policy reviews_delete on public.vendor_reviews
  for delete using (auth.uid() = reviewer_id or public.is_admin(auth.uid()));

-- ---- listing_reports ----
drop policy if exists lreports_insert on public.listing_reports;
create policy lreports_insert on public.listing_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists lreports_select on public.listing_reports;
create policy lreports_select on public.listing_reports
  for select using (auth.uid() = reporter_id or public.is_admin(auth.uid()));

drop policy if exists lreports_update_admin on public.listing_reports;
create policy lreports_update_admin on public.listing_reports
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- user_reports ----
drop policy if exists ureports_insert on public.user_reports;
create policy ureports_insert on public.user_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists ureports_select on public.user_reports;
create policy ureports_select on public.user_reports
  for select using (auth.uid() = reporter_id or public.is_admin(auth.uid()));

drop policy if exists ureports_update_admin on public.user_reports;
create policy ureports_update_admin on public.user_reports
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- listing_boosts ----
drop policy if exists boosts_select on public.listing_boosts;
create policy boosts_select on public.listing_boosts
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists boosts_insert on public.listing_boosts;
create policy boosts_insert on public.listing_boosts
  for insert with check (
    auth.uid() = user_id
    and public.owns_listing(listing_type, listing_id, auth.uid())
  );

drop policy if exists boosts_update on public.listing_boosts;
create policy boosts_update on public.listing_boosts
  for update using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ---- admin_audit_log ----
drop policy if exists audit_admin_only on public.admin_audit_log;
create policy audit_admin_only on public.admin_audit_log
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 8. Grants
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

-- Column-level UPDATE on listings. The trigger above is the control that works;
-- this layer means a protected column cannot even be named in a request. Only
-- the columns the app actually sends are granted (see updateMarketplace /
-- updateProperty in src/services/database.ts).
-- SECURITY DEFINER writers are unaffected: apply_boost / expire_boosts run as
-- the table owner, and owner privileges are implicit.
-- `status` is deliberately still granted, because the admin console sets
-- status='removed' from the browser as an authenticated user (database.ts:970);
-- revoking it would break moderation. The trigger enforces its value instead.
revoke update on public.marketplace_listings from anon, authenticated;
grant update (
  title, description, category, price, condition, location, pickup_spot,
  specs, images, contact_preference, phone_or_whatsapp, status
) on public.marketplace_listings to authenticated;

revoke update on public.property_listings from anon, authenticated;
grant update (
  title, description, area, distance_to_campus, price_per_year, room_type,
  availability, water_source, power_setup, security, proximity_desc,
  amenities, images, contact_phone, contact_whatsapp, landlord_role, status
) on public.property_listings to authenticated;

-- ----------------------------------------------------------------------------
-- 9. Realtime
--    Add the messages + conversations tables to the realtime publication so
--    the client can subscribe to live inserts.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.conversations;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
  end if;
end$$;

-- ============================================================================
-- Done. Next: create your first admin — see /supabase/README.md section 7.
--   update public.user_roles set role = 'admin' where user_id = '<uuid>';
-- ============================================================================
