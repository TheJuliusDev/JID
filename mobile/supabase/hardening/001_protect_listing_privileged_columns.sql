-- =============================================================================
-- 001 — Protect privileged columns on listings
-- =============================================================================
-- Threat: RLS is ROW-level only. Supabase grants ALL on tables in public to
-- anon/authenticated by default, so `market_update` / `property_update` let a
-- listing owner issue an unrestricted UPDATE on their own row. Any logged-in
-- user could therefore run, from the browser console:
--
--     PATCH /rest/v1/property_listings?id=eq.<own-id>   {"is_verified":true}
--     PATCH /rest/v1/marketplace_listings?id=eq.<own-id> {"status":"active"}
--
-- giving themselves a forged "verified" trust badge, or reversing an admin
-- takedown (`status = 'removed'`), which un-publishes the listing because
-- `market_select` only hides removed rows from *other* users.
--
-- Fix, two layers:
--   1. A BEFORE UPDATE trigger that pins privileged columns. Column checks in a
--      trigger can call is_admin(auth.uid()), unlike column privileges -- and
--      column privileges CANNOT be used for `status`, because the admin console
--      writes it from the browser as `authenticated` (src/services/database.ts:970).
--   2. Column-level grants, so an owner cannot even name a protected column.
--
-- Safety: touches no rows. Existing listings, takedowns and suspension flags
-- are left exactly as they are.
-- Run: Supabase Dashboard -> SQL Editor -> paste -> Run. Idempotent; re-running
-- is a no-op. Supabase also snapshots the DB before each SQL Editor run, so you
-- can roll back from Dashboard -> Database -> Backups if needed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 Trusted-write escape hatch for SECURITY DEFINER writers
-- -----------------------------------------------------------------------------
-- apply_boost, expire_boosts and increment_listing_view all legitimately write
-- columns that the guard in 1.2 protects. They are SECURITY DEFINER, but
-- auth.uid() still returns the *caller*, so a plain is_admin() check would
-- block them too -- increment_listing_view in particular runs on read paths for
-- anonymous visitors. They announce themselves with a transaction-local GUC
-- (the `true` third argument = reset at commit), which a client cannot forge:
-- custom variables cannot be set through PostgREST.
-- -----------------------------------------------------------------------------
create or replace function public.increment_listing_view(kind listing_kind, lid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('jid.trusted_write', 'on', true);

  if kind = 'marketplace' then
    update public.marketplace_listings set views_count = views_count + 1 where id = lid;
  else
    update public.property_listings set views_count = views_count + 1 where id = lid;
  end if;
end;
$$;

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

-- -----------------------------------------------------------------------------
-- 1.2 The guard trigger
-- -----------------------------------------------------------------------------
-- Fields are read via to_jsonb() rather than new.<col> on purpose: record field
-- resolution happens at runtime, so a single function referencing
-- new.is_verified would raise "record new has no field is_verified" on
-- marketplace_listings, which has no such column. A missing key yields NULL,
-- and NULL IS DISTINCT FROM NULL is false, so absent columns are skipped.
-- -----------------------------------------------------------------------------
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

  -- Paid/rewarded visibility window.
  if (to_jsonb(new) ->> 'boosted_until')::timestamptz
     is distinct from (to_jsonb(old) ->> 'boosted_until')::timestamptz then
    raise exception 'boosted_until is set by the boost system and cannot be edited'
      using errcode = '42501';
  end if;

  -- Moderation state. An owner may relist (active <-> paused <-> sold/rented)
  -- but may never enter `removed`, nor lift a row an admin has removed.
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

-- -----------------------------------------------------------------------------
-- 1.3 Attach the trigger
-- -----------------------------------------------------------------------------
drop trigger if exists trg_protect_listing_columns on public.marketplace_listings;
create trigger trg_protect_listing_columns
  before update on public.marketplace_listings
  for each row execute function public.protect_listing_privileged_columns();

drop trigger if exists trg_protect_listing_columns on public.property_listings;
create trigger trg_protect_listing_columns
  before update on public.property_listings
  for each row execute function public.protect_listing_privileged_columns();

-- -----------------------------------------------------------------------------
-- 1.4 Column-level privileges (defence in depth)
-- -----------------------------------------------------------------------------
-- The trigger is the control that works; this layer means a protected column
-- cannot even be named in a request. Only `authenticated` gets UPDATE, and
-- only for the columns the app actually sends (see updateMarketplace /
-- updateProperty in src/services/database.ts).
--
-- SECURITY DEFINER writers are unaffected: apply_boost and expire_boosts run
-- as the table owner, and owner privileges are implicit.
--
-- `status` is deliberately still granted to authenticated -- the admin console
-- sets status='removed' from the browser as an authenticated user, so revoking
-- it would break moderation. The trigger enforces its value instead.
-- -----------------------------------------------------------------------------
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

-- =============================================================================
-- Verify after running (expect 0 rows):
--
--   select is_verified, count(*) from public.property_listings
--   group by 1;                    -- any true row outside admin control = exploit
--
--   select status, count(*) from public.marketplace_listings group by 1;
--
--   -- as a logged-in non-admin, this must now fail with 42501:
--   -- PATCH /rest/v1/property_listings?id=eq.<own-id>  {"is_verified":true}
--
--   -- ...but this must still succeed:
--   -- PATCH /rest/v1/marketplace_listings?id=eq.<own-id> {"status":"sold"}
-- =============================================================================