-- ============================================================================
-- JID — Migration 005: Saved Searches & Alerts
-- ----------------------------------------------------------------------------
-- Lets a signed-in user persist the marketplace / accommodation filters they
-- care about and receive notifications when:
--   * a listing they bookmarked drops in price        -> category 'price_drop'
--   * a new listing matches one of their saved searches -> category 'saved_search'
--
-- Alert identity is carried on `notifications.category` (a plain text column)
-- rather than new enum values. This keeps the existing `notification_type`
-- enum untouched and makes the feature safe to run in a single SQL execution.
--
-- New-listing matches are generated on demand by `generate_saved_search_alerts()`
-- (SECURITY DEFINER) which the client calls after sign-in / when refreshing the
-- notification centre. Price drops are pushed immediately by a trigger.
--
-- Safe to run more than once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Saved searches (private per user)
-- ----------------------------------------------------------------------------
create table if not exists public.saved_searches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  listing_type     listing_kind not null,
  label            text not null check (char_length(label) between 1 and 120),
  -- The persisted filter set, e.g. {search, category, location, minPrice, ...}
  filters          jsonb not null default '{}'::jsonb,
  notify           boolean not null default true,
  last_notified_at timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_saved_searches_user
  on public.saved_searches (user_id, created_at desc);

alter table public.saved_searches enable row level security;

drop policy if exists saved_searches_all on public.saved_searches;
create policy saved_searches_all on public.saved_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. Notification category (alert sub-type)
-- ----------------------------------------------------------------------------
alter table public.notifications
  add column if not exists category text;

create index if not exists idx_notif_user_unread
  on public.notifications (user_id, created_at desc)
  where is_read = false;

-- ----------------------------------------------------------------------------
-- 3. Does a listing satisfy a saved search's filters?
--    Mirrors the client-side filter semantics used by the explorers. Kept as a
--    small, explicit function so both new-listing matching and tests reason
--    about one definition.
-- ----------------------------------------------------------------------------
create or replace function public.saved_search_matches(
  p_kind    listing_kind,
  p_filters jsonb,
  p_listing jsonb
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_filters->>'search', '')), '');
begin
  -- Full-text + partial match over the same text columns the RPC indexes.
  if v_search is not null then
    if not (
      to_tsvector(
        'english',
        coalesce(p_listing->>'title', '') || ' ' ||
        coalesce(p_listing->>'description', '') || ' ' ||
        coalesce(p_listing->>'location', '') || ' ' ||
        coalesce(p_listing->>'area', '')
      ) @@ websearch_to_tsquery('english', v_search)
      or coalesce(p_listing->>'title', '') ilike '%' || v_search || '%'
      or coalesce(p_listing->>'location', '') ilike '%' || v_search || '%'
      or coalesce(p_listing->>'area', '') ilike '%' || v_search || '%'
    ) then
      return false;
    end if;
  end if;

  if p_kind = 'marketplace' then
    if lower(coalesce(p_filters->>'category', 'all')) not in ('all', '')
       and coalesce(p_listing->>'category', '') <> p_filters->>'category' then
      return false;
    end if;
    if lower(coalesce(p_filters->>'condition', 'all')) not in ('all', '')
       and coalesce(p_listing->>'condition', '') <> p_filters->>'condition' then
      return false;
    end if;
    if lower(coalesce(p_filters->>'location', 'all')) not in ('all', '')
       and coalesce(p_listing->>'location', '') <> p_filters->>'location' then
      return false;
    end if;
    if nullif(p_filters->>'minPrice', '') is not null
       and coalesce((p_listing->>'price')::numeric, 0) < (p_filters->>'minPrice')::numeric then
      return false;
    end if;
    if nullif(p_filters->>'maxPrice', '') is not null
       and coalesce((p_listing->>'price')::numeric, 0) > (p_filters->>'maxPrice')::numeric then
      return false;
    end if;
  else
    if lower(coalesce(p_filters->>'area', 'all')) not in ('all', '')
       and coalesce(p_listing->>'area', '') <> p_filters->>'area' then
      return false;
    end if;
    if lower(coalesce(p_filters->>'roomType', 'all')) not in ('all', '')
       and coalesce(p_listing->>'room_type', '') <> p_filters->>'roomType' then
      return false;
    end if;
    if lower(coalesce(p_filters->>'availability', 'all')) not in ('all', '')
       and coalesce(p_listing->>'availability', '') <> p_filters->>'availability' then
      return false;
    end if;
    if nullif(p_filters->>'minPrice', '') is not null
       and coalesce((p_listing->>'price_per_year')::numeric, 0) < (p_filters->>'minPrice')::numeric then
      return false;
    end if;
    if nullif(p_filters->>'maxPrice', '') is not null
       and coalesce((p_listing->>'price_per_year')::numeric, 0) > (p_filters->>'maxPrice')::numeric then
      return false;
    end if;
    if coalesce((p_filters->>'verifiedOnly')::boolean, false)
       and coalesce((p_listing->>'is_verified')::boolean, false) is not true then
      return false;
    end if;
  end if;

  if coalesce((p_filters->>'boostedOnly')::boolean, false)
     and (
       p_listing->>'boosted_until' is null
       or (p_listing->>'boosted_until')::timestamptz <= now()
     ) then
    return false;
  end if;

  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Price-drop alerts for bookmarked listings (immediate, cross-user)
-- ----------------------------------------------------------------------------
create or replace function public.notify_price_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind listing_kind;
  v_old  numeric;
  v_new  numeric;
begin
  if tg_table_name = 'marketplace_listings' then
    v_kind := 'marketplace';
    v_old  := old.price;
    v_new  := new.price;
  else
    v_kind := 'property';
    v_old  := old.price_per_year;
    v_new  := new.price_per_year;
  end if;

  if new.status = 'active' and v_new < v_old then
    insert into public.notifications (user_id, title, body, type, category, link)
    select
      sl.user_id,
      'Price drop on a saved listing',
      '"' || new.title || '" is now listed at a lower price.',
      'system',
      'price_drop',
      'saved'
    from public.saved_listings sl
    where sl.listing_type = v_kind
      and sl.listing_id = new.id
      and sl.user_id <> new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_market_price_drop on public.marketplace_listings;
create trigger trg_market_price_drop
  after update of price on public.marketplace_listings
  for each row execute function public.notify_price_drop();

drop trigger if exists trg_property_price_drop on public.property_listings;
create trigger trg_property_price_drop
  after update of price_per_year on public.property_listings
  for each row execute function public.notify_price_drop();

-- ----------------------------------------------------------------------------
-- 5. New-listing match alerts (on demand, for the current user)
--    Scans the caller's saved searches, matches listings created since the
--    search was last checked, raises a notification per match and stamps
--    `last_notified_at`. Returns how many notifications were created.
-- ----------------------------------------------------------------------------
create or replace function public.generate_saved_search_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      uuid := auth.uid();
  v_search  record;
  v_listing record;
  v_since   timestamptz;
  v_created integer := 0;
begin
  if v_me is null then
    return 0;
  end if;

  for v_search in
    select * from public.saved_searches
    where user_id = v_me and notify = true
  loop
    v_since := coalesce(v_search.last_notified_at, v_search.created_at);

    if v_search.listing_type = 'marketplace' then
      for v_listing in
        select *
        from public.marketplace_listings
        where status = 'active'
          and created_at > v_since
          and user_id <> v_me
        order by created_at desc
        limit 20
      loop
        if public.saved_search_matches('marketplace', v_search.filters, to_jsonb(v_listing)) then
          insert into public.notifications (user_id, title, body, type, category, link)
          values (v_me, 'New match: ' || v_search.label, v_listing.title,
                  'system', 'saved_search', 'marketplace');
          v_created := v_created + 1;
        end if;
      end loop;
    else
      for v_listing in
        select *
        from public.property_listings
        where status = 'active'
          and created_at > v_since
          and user_id <> v_me
        order by created_at desc
        limit 20
      loop
        if public.saved_search_matches('property', v_search.filters, to_jsonb(v_listing)) then
          insert into public.notifications (user_id, title, body, type, category, link)
          values (v_me, 'New match: ' || v_search.label, v_listing.title,
                  'system', 'saved_search', 'accommodation');
          v_created := v_created + 1;
        end if;
      end loop;
    end if;

    update public.saved_searches
      set last_notified_at = now()
      where id = v_search.id;
  end loop;

  return v_created;
end;
$$;

revoke all on function public.generate_saved_search_alerts() from public, anon;
grant execute on function public.generate_saved_search_alerts() to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Realtime: notifications already published. Saved searches are polled on
--    demand, so no publication change is required here.
-- ============================================================================
