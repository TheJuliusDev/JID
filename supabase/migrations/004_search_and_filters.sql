-- ============================================================================
-- JID — Migration 004: Advanced Search & Filters
-- ----------------------------------------------------------------------------
-- Adds indexed full-text search and server-side filtering for both the
-- marketplace and the accommodation listings, exposed through two RPCs that
-- return fully-joined rows plus a total result count.
--
-- Design notes:
--   * Full-text search uses a STORED `search_vector` generated column, so the
--     index is maintained by Postgres on every write. A trigram GIN index
--     backs fuzzy / partial title matches (e.g. "mac" -> "MacBook").
--   * The RPCs are SECURITY INVOKER: callers still pass through the existing
--     row-level policies. Anonymous visitors can only ever match active rows,
--     because every query filters `status = 'active'`.
--   * Each row is returned as jsonb shaped exactly like the app's existing
--     Supabase embeds (a nested `seller` / `landlord` object), so the existing
--     mapMarketplace() / mapProperty() mappers keep working unchanged.
--
-- Safe to run more than once (guards on every object).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- 1. Generated full-text search vectors
--    Only immutable expressions are allowed in a generated column, so the
--    vector is built from text columns (title / description / location|area).
--    Enum columns (category, condition, room_type) are matched separately.
-- ----------------------------------------------------------------------------
alter table public.marketplace_listings
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location, '')), 'C')
  ) stored;

alter table public.property_listings
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(area, '')), 'C')
  ) stored;

-- ----------------------------------------------------------------------------
-- 2. Indexes
--    - GIN on the tsvector for ranked full-text search
--    - GIN trigram on title for partial / typo-tolerant matching
--    - Composite B-tree indexes for the filter + sort combinations the UI uses
-- ----------------------------------------------------------------------------
create index if not exists idx_market_search
  on public.marketplace_listings using gin (search_vector);
create index if not exists idx_market_title_trgm
  on public.marketplace_listings using gin (title gin_trgm_ops);
create index if not exists idx_market_status_price
  on public.marketplace_listings (status, price);
create index if not exists idx_market_status_category_created
  on public.marketplace_listings (status, category, created_at desc);
create index if not exists idx_market_status_location
  on public.marketplace_listings (status, location);

create index if not exists idx_property_search
  on public.property_listings using gin (search_vector);
create index if not exists idx_property_title_trgm
  on public.property_listings using gin (title gin_trgm_ops);
create index if not exists idx_property_status_price
  on public.property_listings (status, price_per_year);
create index if not exists idx_property_status_area_created
  on public.property_listings (status, area, created_at desc);
create index if not exists idx_property_status_room
  on public.property_listings (status, room_type);
create index if not exists idx_property_status_availability
  on public.property_listings (status, availability);

-- ----------------------------------------------------------------------------
-- 3. Marketplace search RPC
--    Matches full words (ranked) OR partial text (title/location/specs). Every
--    row carries `total_count` via a window function so the UI can display
--    "showing X of Y" without a second request.
-- ----------------------------------------------------------------------------
create or replace function public.search_marketplace(
  p_search       text     default null,
  p_category     text     default null,
  p_condition    text     default null,
  p_location     text     default null,
  p_min_price    numeric  default null,
  p_max_price    numeric  default null,
  p_boosted_only boolean  default false,
  p_sort         text     default 'boosted',
  p_limit        integer  default 24,
  p_offset       integer  default 0
)
returns setof jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      m.*,
      case
        when coalesce(p_search, '') <> ''
          then ts_rank(m.search_vector, websearch_to_tsquery('english', p_search))
        else 0
      end as rank
    from public.marketplace_listings m
    where m.status = 'active'
      and (p_category  is null or m.category::text = p_category)
      and (p_condition is null or m.condition::text = p_condition)
      and (p_location  is null or m.location = p_location)
      and (p_min_price is null or m.price >= p_min_price)
      and (p_max_price is null or m.price <= p_max_price)
      and (
        not p_boosted_only
        or (m.boosted_until is not null and m.boosted_until > now())
      )
      and (
        coalesce(p_search, '') = ''
        or m.search_vector @@ websearch_to_tsquery('english', p_search)
        or m.title ilike '%' || p_search || '%'
        or m.location ilike '%' || p_search || '%'
        or array_to_string(m.specs, ' ') ilike '%' || p_search || '%'
      )
  )
  select
    (to_jsonb(t) - 'search_vector') || jsonb_build_object(
      'seller', (
        select to_jsonb(p)
        from (
          select username, full_name, department, level, hall_or_area, avatar_url
          from public.profiles
          where id = t.user_id
        ) p
      ),
      'total_count', count(*) over ()
    )
  from base t
  order by
    (case when p_sort = 'relevance'  then t.rank end) desc nulls last,
    (case when p_sort = 'price-asc'  then t.price end) asc nulls last,
    (case when p_sort = 'price-desc' then t.price end) desc nulls last,
    (case when p_sort = 'boosted'
          then (t.boosted_until is not null and t.boosted_until > now())::int end) desc nulls last,
    (case when p_sort = 'boosted' then t.boosted_until end) desc nulls last,
    t.created_at desc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_marketplace(
  text, text, text, text, numeric, numeric, boolean, text, integer, integer
) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Accommodation search RPC
-- ----------------------------------------------------------------------------
create or replace function public.search_properties(
  p_search        text     default null,
  p_area          text     default null,
  p_room_type     text     default null,
  p_availability  text     default null,
  p_min_price     numeric  default null,
  p_max_price     numeric  default null,
  p_verified_only boolean  default false,
  p_boosted_only  boolean  default false,
  p_sort          text     default 'boosted',
  p_limit         integer  default 24,
  p_offset        integer  default 0
)
returns setof jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      pl.*,
      case
        when coalesce(p_search, '') <> ''
          then ts_rank(pl.search_vector, websearch_to_tsquery('english', p_search))
        else 0
      end as rank
    from public.property_listings pl
    where pl.status = 'active'
      and (p_area         is null or pl.area = p_area)
      and (p_room_type    is null or pl.room_type::text = p_room_type)
      and (p_availability is null or pl.availability::text = p_availability)
      and (p_min_price    is null or pl.price_per_year >= p_min_price)
      and (p_max_price    is null or pl.price_per_year <= p_max_price)
      and (not p_verified_only or pl.is_verified)
      and (
        not p_boosted_only
        or (pl.boosted_until is not null and pl.boosted_until > now())
      )
      and (
        coalesce(p_search, '') = ''
        or pl.search_vector @@ websearch_to_tsquery('english', p_search)
        or pl.title ilike '%' || p_search || '%'
        or pl.area ilike '%' || p_search || '%'
        or array_to_string(pl.amenities, ' ') ilike '%' || p_search || '%'
      )
  )
  select
    (to_jsonb(t) - 'search_vector') || jsonb_build_object(
      'landlord', (
        select to_jsonb(p)
        from (
          select username, full_name, avatar_url
          from public.profiles
          where id = t.user_id
        ) p
      ),
      'total_count', count(*) over ()
    )
  from base t
  order by
    (case when p_sort = 'relevance'  then t.rank end) desc nulls last,
    (case when p_sort = 'price-asc'  then t.price_per_year end) asc nulls last,
    (case when p_sort = 'price-desc' then t.price_per_year end) desc nulls last,
    (case when p_sort = 'boosted'
          then (t.boosted_until is not null and t.boosted_until > now())::int end) desc nulls last,
    (case when p_sort = 'boosted' then t.boosted_until end) desc nulls last,
    t.created_at desc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_properties(
  text, text, text, text, numeric, numeric, boolean, boolean, text, integer, integer
) to anon, authenticated;

-- ============================================================================
-- Done.
-- ============================================================================
