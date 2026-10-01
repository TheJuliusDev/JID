-- ============================================================================
-- JID - Admin Panel: server-side authorization layer
-- ----------------------------------------------------------------------------
-- Run this file ONCE in the Supabase SQL Editor, AFTER schema.sql.
-- It is idempotent (guards + create or replace), so it is safe to re-run.
--
-- WHY THIS FILE EXISTS
-- -------------------
-- The admin panel must never let the browser decide what is allowed. Every
-- privileged operation is therefore exposed as a SECURITY DEFINER function
-- that, inside a single transaction:
--
--   1. re-verifies the caller's role against public.user_roles (the source of
--      truth) using auth.uid() - the JWT subject, which a client cannot forge;
--   2. performs the mutation;
--   3. appends a row to public.admin_audit_log.
--
-- The browser only ever supplies *intent* (which target, which new value). It
-- can never supply authority. Because the audit insert is in the same
-- transaction as the mutation, an action can never succeed without leaving a
-- trace - the previous implementation logged from the browser after the fact,
-- so a failed or blocked write could leave no record at all.
--
-- Row Level Security remains the backstop: these functions are a second,
-- explicit layer, not a replacement. No service_role key is involved anywhere.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Additive columns
-- ----------------------------------------------------------------------------

-- Moderation notes on profiles. Both are guarded by protect_suspension() below
-- so a user cannot write their own justification for being suspended.
alter table public.profiles
  add column if not exists suspension_reason text;
alter table public.profiles
  add column if not exists suspended_at timestamptz;

-- Moderator's closing note on a resolved report.
alter table public.listing_reports
  add column if not exists resolution_note text;
alter table public.user_reports
  add column if not exists resolution_note text;

-- Audit-log indexes for the admin console's filtered, paginated reads.
create index if not exists idx_audit_created    on public.admin_audit_log (created_at desc);
create index if not exists idx_audit_action     on public.admin_audit_log (action);
create index if not exists idx_audit_admin      on public.admin_audit_log (admin_id, created_at desc);
create index if not exists idx_ureports_status  on public.user_reports (status);
create index if not exists idx_profiles_suspend on public.profiles (is_suspended) where is_suspended;

-- ----------------------------------------------------------------------------
-- 2. The guard
--
-- admin_require_admin() is the single choke point every admin function calls
-- first. It is NOT executable by clients (see the grants section) - it exists
-- only so the check cannot be forgotten or subtly weakened in one function.
-- ----------------------------------------------------------------------------

create or replace function public.admin_require_admin()
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.is_admin(v_uid) then
    raise exception 'Administrator privileges required' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Audit writer
--
-- Internal only. Revoked from anon/authenticated at the end of this file so a
-- client cannot insert a forged row into admin_audit_log; the admin functions
-- call it as the table owner, so owner privileges still apply.
--
-- admin_id is always auth.uid() - the acting admin is taken from the verified
-- JWT, never from a parameter.
-- ----------------------------------------------------------------------------

create or replace function public.admin_audit_write(
  p_action      text,
  p_target_type text default null,
  p_target_id   text default null,
  p_details     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_details);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Denied-access logging
--
-- Callable by any signed-in user so that a non-admin poking at the admin area is
-- recorded. The row is written by a definer function that stamps the caller's
-- own uid, so it cannot be used to frame someone else. `anon` is deliberately
-- NOT granted execute on this (see the grants section): an unauthenticated
-- endpoint would otherwise be a free write-amplification vector anyone could
-- spam. Signing in as any throwaway account is enough to show up here.
-- ----------------------------------------------------------------------------

create or replace function public.admin_log_access_denied(p_context text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    'admin.access_denied',
    'admin_console',
    null,
    jsonb_build_object(
      'context', left(coalesce(p_context, ''), 200),
      'authenticated', auth.uid() is not null
    )
  );
exception
  when others then
    -- Logging must never be the reason a request fails.
    null;
end;
$$;


-- ============================================================================
-- 5. Read APIs
-- ============================================================================

-- 5.1 Authoritative session/role probe.
--
-- This is the ONLY thing the browser is allowed to use to decide whether to
-- render the console. It reads the role from the database, so a tampered
-- client-side `isAdmin` flag is irrelevant. Returns is_admin=false (never an
-- error) for signed-in non-admins so the console can render a clean
-- "access denied" screen; an expired/missing session returns an explicit flag.
-- ----------------------------------------------------------------------------
create or replace function public.admin_session()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('authenticated', false, 'is_admin', false);
  end if;

  return jsonb_build_object(
    'authenticated', true,
    'is_admin',       public.is_admin(v_uid),
    'user_id',        v_uid,
    'username',       (select p.username from public.profiles p where p.id = v_uid),
    'full_name',      (select p.full_name from public.profiles p where p.id = v_uid),
    'avatar_url',     (select p.avatar_url from public.profiles p where p.id = v_uid),
    'email',          (select au.email from auth.users au where au.id = v_uid),
    'role',           (select coalesce(ur.role, 'user'::app_role) from public.user_roles ur where ur.user_id = v_uid),
    'server_time',    now()
  );
end;
$$;

-- 5.2 Dashboard statistics.
-- ----------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  perform public.admin_require_admin();

  return jsonb_build_object(
    'users_total',       (select count(*) from public.profiles),
    'users_suspended',   (select count(*) from public.profiles where is_suspended),
    'users_admins',      (select count(*) from public.user_roles where role = 'admin'),
    'users_new_24h',     (select count(*) from public.profiles where created_at >= v_now - interval '24 hours'),
    'users_new_7d',      (select count(*) from public.profiles where created_at >= v_now - interval '7 days'),
    'market_total',      (select count(*) from public.marketplace_listings),
    'market_active',     (select count(*) from public.marketplace_listings where status = 'active'),
    'market_removed',    (select count(*) from public.marketplace_listings where status = 'removed'),
    'property_total',    (select count(*) from public.property_listings),
    'property_active',   (select count(*) from public.property_listings where status = 'active'),
    'property_removed',  (select count(*) from public.property_listings where status = 'removed'),
    'property_verified', (select count(*) from public.property_listings where is_verified),
    'reports_total',     (select count(*) from public.listing_reports)
                       + (select count(*) from public.user_reports),
    'reports_pending',   (select count(*) from public.listing_reports where status in ('pending', 'reviewing'))
                       + (select count(*) from public.user_reports where status in ('pending', 'reviewing')),
    'reports_24h',       (select count(*) from public.listing_reports where created_at >= v_now - interval '24 hours')
                       + (select count(*) from public.user_reports where created_at >= v_now - interval '24 hours'),
    'reviews_total',     (select count(*) from public.vendor_reviews),
    'reviews_7d',        (select count(*) from public.vendor_reviews where created_at >= v_now - interval '7 days'),
    'boosts_active',     (select count(*) from public.listing_boosts where status = 'active'),
    'audit_24h',         (select count(*) from public.admin_audit_log where created_at >= v_now - interval '24 hours'),
    'denied_24h',        (select count(*) from public.admin_audit_log
                            where action = 'admin.access_denied' and created_at >= v_now - interval '24 hours')
  );
end;
$$;

-- 5.3 Recent platform activity (last 30 days, newest first).
-- Merges the organic product events an admin would want to see at a glance
-- with the moderation/audit trail.
-- ----------------------------------------------------------------------------
create or replace function public.admin_activity_feed(p_limit int default 25)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  perform public.admin_require_admin();

  return coalesce((
    with feed as (
      select 'user_signup'::text as kind,
             p.created_at         as occurred_at,
             p.full_name          as actor,
             p.username           as actor_handle,
             p.avatar_url         as actor_avatar,
             'created a JID account'::text as summary,
             'user'::text         as target_type,
             p.id::text           as target_id
      from public.profiles p
      where p.created_at >= now() - interval '30 days'

      union all

      select 'listing_created', m.created_at,
             coalesce(pr.full_name, 'A student'), coalesce(pr.username, ''), pr.avatar_url,
             'listed "' || left(m.title, 70) || '"  /  ' || m.category::text,
             'marketplace', m.id::text
      from public.marketplace_listings m
      left join public.profiles pr on pr.id = m.user_id
      where m.created_at >= now() - interval '30 days'

      union all

      select 'listing_created', pr2.created_at,
             coalesce(p2.full_name, 'A student'), coalesce(p2.username, ''), p2.avatar_url,
             'listed "' || left(pr2.title, 70) || '"  /  ' || pr2.area,
             'property', pr2.id::text
      from public.property_listings pr2
      left join public.profiles p2 on p2.id = pr2.user_id
      where pr2.created_at >= now() - interval '30 days'

      union all

      select 'listing_removed', m.updated_at,
             coalesce(pr.full_name, 'A student'), coalesce(pr.username, ''), pr.avatar_url,
             'listing removed: "' || left(m.title, 70) || '"',
             'marketplace', m.id::text
      from public.marketplace_listings m
      left join public.profiles pr on pr.id = m.user_id
      where m.status = 'removed' and m.updated_at >= now() - interval '30 days'

      union all

      select 'listing_removed', pr2.updated_at,
             coalesce(p2.full_name, 'A student'), coalesce(p2.username, ''), p2.avatar_url,
             'listing removed: "' || left(pr2.title, 70) || '"',
             'property', pr2.id::text
      from public.property_listings pr2
      left join public.profiles p2 on p2.id = pr2.user_id
      where pr2.status = 'removed' and pr2.updated_at >= now() - interval '30 days'

      union all

      select 'report_filed', r.created_at,
             coalesce(pr.full_name, 'A student'), coalesce(pr.username, ''), pr.avatar_url,
             'reported a listing  /  ' || r.reason,
             'report', r.id::text
      from public.listing_reports r
      left join public.profiles pr on pr.id = r.reporter_id
      where r.created_at >= now() - interval '30 days'

      union all

      select 'report_filed', r.created_at,
             coalesce(pr.full_name, 'A student'), coalesce(pr.username, ''), pr.avatar_url,
             'reported a user  /  ' || r.reason,
             'report', r.id::text
      from public.user_reports r
      left join public.profiles pr on pr.id = r.reporter_id
      where r.created_at >= now() - interval '30 days'

      union all

      select 'review_posted', v.created_at,
             coalesce(pr.full_name, 'A student'), coalesce(pr.username, ''), pr.avatar_url,
             'left a ' || v.rating::text || ' star review',
             'review', v.id::text
      from public.vendor_reviews v
      left join public.profiles pr on pr.id = v.reviewer_id
      where v.created_at >= now() - interval '30 days'

      union all

      select 'admin_action', l.created_at,
             coalesce(ap.full_name, 'Administrator'), coalesce(ap.username, ''), ap.avatar_url,
             l.action,
             coalesce(l.target_type, 'admin'), coalesce(l.target_id, '')
      from public.admin_audit_log l
      left join public.profiles ap on ap.id = l.admin_id
      where l.created_at >= now() - interval '30 days'
    ),
    ranked as (
      select feed.*, row_number() over (order by occurred_at desc, kind, target_id) as rn
      from feed
    )
    select jsonb_agg(to_jsonb(r) - 'rn' order by r.rn)
    from ranked r
    where r.rn <= v_limit
  ), '[]'::jsonb);
end;
$$;

-- 5.4 Paginated user directory.
--
-- `profiles` deliberately holds no email (it is a public-safe table), so the
-- admin directory joins auth.users to resolve one. That is only possible from
-- here, in a SECURITY DEFINER function - a plain browser query cannot see it.
-- Search uses strpos() (a literal substring test) rather than ILIKE so user
-- input cannot smuggle in wildcard characters.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_search text default null,
  p_role   text default 'all',
  p_status text default 'all',
  p_sort   text default 'newest',
  p_limit  int  default 25,
  p_offset int  default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit  int  := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.admin_require_admin();

  return (
    with filtered as materialized (
      select
        p.id,
        p.username,
        p.full_name,
        p.department,
        p.level,
        p.hall_or_area,
        p.avatar_url,
        p.bio,
        p.is_suspended,
        p.suspension_reason,
        p.suspended_at,
        p.created_at,
        p.updated_at,
        coalesce(ur.role, 'user'::app_role)             as role,
        au.email,
        au.email_confirmed_at,
        au.last_sign_in_at,
        (select count(*) from public.marketplace_listings m where m.user_id = p.id) as marketplace_count,
        (select count(*) from public.property_listings pl  where pl.user_id = p.id) as property_count,
        (select count(*) from public.vendor_reviews vr      where vr.vendor_id = p.id) as review_count,
        (select count(*) from public.user_reports ur2
          where ur2.reported_user_id = p.id and ur2.status in ('pending', 'reviewing')) as open_reports
      from public.profiles p
      left join public.user_roles ur on ur.user_id = p.id
      left join auth.users au         on au.id = p.id
      where (
              v_search is null
           or strpos(lower(p.username), lower(v_search)) > 0
           or strpos(lower(p.full_name),  lower(v_search)) > 0
           or strpos(lower(coalesce(au.email, '')), lower(v_search)) > 0
           or p.id::text = v_search
          )
        and (p_role   = 'all' or coalesce(ur.role, 'user'::app_role)::text = p_role)
        and (
             p_status = 'all'
          or (p_status = 'suspended' and p.is_suspended)
          or (p_status = 'active'   and not p.is_suspended)
        )
    ),
    paged as (
      select
        f.*,
        row_number() over (
          order by
            case when p_sort = 'oldest'   then f.created_at end asc,
            case when p_sort = 'name'     then lower(f.full_name) end asc,
            case when p_sort = 'listings' then (f.marketplace_count + f.property_count) end desc nulls last,
            f.created_at desc,
            f.id
        ) as ord
      from filtered f
      order by
        case when p_sort = 'oldest'   then f.created_at end asc,
        case when p_sort = 'name'     then lower(f.full_name) end asc,
        case when p_sort = 'listings' then (f.marketplace_count + f.property_count) end desc nulls last,
        f.created_at desc,
        f.id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows',  coalesce((select jsonb_agg(to_jsonb(g) - 'ord' order by g.ord) from paged g), '[]'::jsonb)
    )
  );
end;
$$;

-- 5.5 Full profile view for the user detail panel.
-- ----------------------------------------------------------------------------
create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_admin();

  if p_user_id is null then
    raise exception 'A user id is required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    return null;
  end if;

  return jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'id', p.id, 'username', p.username, 'full_name', p.full_name,
        'department', p.department, 'level', p.level, 'hall_or_area', p.hall_or_area,
        'avatar_url', p.avatar_url, 'bio', p.bio,
        'is_suspended', p.is_suspended,
        'suspension_reason', p.suspension_reason, 'suspended_at', p.suspended_at,
        'created_at', p.created_at, 'updated_at', p.updated_at,
        'role', coalesce((select ur.role from public.user_roles ur where ur.user_id = p.id), 'user'::app_role),
        'email', (select au.email from auth.users au where au.id = p.id),
        'email_confirmed_at', (select au.email_confirmed_at from auth.users au where au.id = p.id),
        'last_sign_in_at', (select au.last_sign_in_at from auth.users au where au.id = p.id)
      )
      from public.profiles p
      where p.id = p_user_id
    ),
    'listings', coalesce((
      select jsonb_agg(x.obj order by x.occurred_at desc)
      from (
        select m.created_at as occurred_at,
               jsonb_build_object(
                 'id', m.id, 'kind', 'marketplace', 'title', m.title,
                 'price', m.price, 'status', m.status, 'category', m.category::text,
                 'image', (m.images)[1], 'created_at', m.created_at,
                 'views_count', m.views_count
               ) as obj
        from public.marketplace_listings m
        where m.user_id = p_user_id
        union all
        select pl.created_at,
               jsonb_build_object(
                 'id', pl.id, 'kind', 'property', 'title', pl.title,
                 'price', pl.price_per_year, 'status', pl.status, 'category', pl.area,
                 'image', (pl.images)[1], 'created_at', pl.created_at,
                 'views_count', pl.views_count, 'is_verified', pl.is_verified
               )
        from public.property_listings pl
        where pl.user_id = p_user_id
      ) x
    ), '[]'::jsonb),
    'reviews_received', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'rating', v.rating, 'comment', v.comment,
               'created_at', v.created_at,
               'reviewer', (select p3.full_name from public.profiles p3 where p3.id = v.reviewer_id)
             ) order by v.created_at desc)
      from public.vendor_reviews v
      where v.vendor_id = p_user_id
      limit 50
    ), '[]'::jsonb),
    'reviews_given', (select count(*) from public.vendor_reviews where reviewer_id = p_user_id),
    'avg_rating', (select coalesce(round(avg(v.rating)::numeric, 2), 0) from public.vendor_reviews v where v.vendor_id = p_user_id),
    'reports_against', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'reason', r.reason, 'details', r.details,
               'status', r.status, 'created_at', r.created_at,
               'reporter', (select p4.full_name from public.profiles p4 where p4.id = r.reporter_id)
             ) order by r.created_at desc)
      from public.user_reports r
      where r.reported_user_id = p_user_id
      limit 50
    ), '[]'::jsonb),
    'reports_filed', (select count(*) from public.listing_reports where reporter_id = p_user_id)
                   + (select count(*) from public.user_reports where reporter_id = p_user_id),
    'messages_sent', (select count(*) from public.messages where sender_id = p_user_id)
  );
end;
$$;

-- 5.6 Paginated listing moderation queues.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_marketplace_listings(
  p_search  text default null,
  p_status  text default 'all',
  p_category text default 'all',
  p_user_id uuid default null,
  p_sort    text default 'newest',
  p_limit   int  default 25,
  p_offset  int  default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit  int  := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.admin_require_admin();

  return (
    with filtered as materialized (
      select
        m.id, m.title, m.description, m.category, m.price, m.condition, m.location,
        m.pickup_spot, m.images, m.status, m.views_count, m.saves_count,
        m.boosted_until, m.created_at, m.updated_at, m.user_id,
        p.username, p.full_name, p.avatar_url, p.is_suspended,
        (m.images)[1] as image
      from public.marketplace_listings m
      left join public.profiles p on p.id = m.user_id
      where (
              v_search is null
           or strpos(lower(m.title), lower(v_search)) > 0
           or strpos(lower(m.description), lower(v_search)) > 0
           or strpos(lower(m.location), lower(v_search)) > 0
           or strpos(lower(coalesce(p.username, '')), lower(v_search)) > 0
           or strpos(lower(coalesce(p.full_name, '')), lower(v_search)) > 0
          )
        and (p_status   = 'all' or m.status::text = p_status)
        and (p_category = 'all' or m.category::text = p_category)
        and (p_user_id is null or m.user_id = p_user_id)
    ),
    paged as (
      select
        f.*,
        row_number() over (
          order by
            case when p_sort = 'oldest'    then f.created_at end asc,
            case when p_sort = 'price-asc'  then f.price end asc nulls last,
            case when p_sort = 'price-desc' then f.price end desc nulls last,
            case when p_sort = 'views'      then f.views_count end desc nulls last,
            f.created_at desc,
            f.id
        ) as ord
      from filtered f
      order by
        case when p_sort = 'oldest'    then f.created_at end asc,
        case when p_sort = 'price-asc'  then f.price end asc nulls last,
        case when p_sort = 'price-desc' then f.price end desc nulls last,
        case when p_sort = 'views'      then f.views_count end desc nulls last,
        f.created_at desc,
        f.id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows',  coalesce((select jsonb_agg(to_jsonb(g) - 'ord' order by g.ord) from paged g), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.admin_list_property_listings(
  p_search text default null,
  p_status text default 'all',
  p_area   text default 'all',
  p_room_type text default 'all',
  p_user_id uuid default null,
  p_sort   text default 'newest',
  p_limit  int  default 25,
  p_offset int  default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit  int  := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.admin_require_admin();

  return (
    with filtered as materialized (
      select
        pl.id, pl.title, pl.description, pl.area, pl.distance_to_campus, pl.price_per_year,
        pl.room_type, pl.availability, pl.amenities, pl.images, pl.status, pl.is_verified,
        pl.landlord_role, pl.views_count, pl.saves_count, pl.boosted_until,
        pl.created_at, pl.updated_at, pl.user_id,
        p.username, p.full_name, p.avatar_url, p.is_suspended,
        (pl.images)[1] as image
      from public.property_listings pl
      left join public.profiles p on p.id = pl.user_id
      where (
              v_search is null
           or strpos(lower(pl.title), lower(v_search)) > 0
           or strpos(lower(pl.description), lower(v_search)) > 0
           or strpos(lower(pl.area), lower(v_search)) > 0
           or strpos(lower(coalesce(p.username, '')), lower(v_search)) > 0
           or strpos(lower(coalesce(p.full_name, '')), lower(v_search)) > 0
          )
        and (p_status    = 'all' or pl.status::text = p_status)
        and (p_area      = 'all' or pl.area = p_area)
        and (p_room_type = 'all' or pl.room_type::text = p_room_type)
        and (p_user_id is null or pl.user_id = p_user_id)
    ),
    paged as (
      select
        f.*,
        row_number() over (
          order by
            case when p_sort = 'oldest'    then f.created_at end asc,
            case when p_sort = 'price-asc'  then f.price_per_year end asc nulls last,
            case when p_sort = 'price-desc' then f.price_per_year end desc nulls last,
            case when p_sort = 'views'      then f.views_count end desc nulls last,
            f.created_at desc,
            f.id
        ) as ord
      from filtered f
      order by
        case when p_sort = 'oldest'    then f.created_at end asc,
        case when p_sort = 'price-asc'  then f.price_per_year end asc nulls last,
        case when p_sort = 'price-desc' then f.price_per_year end desc nulls last,
        case when p_sort = 'views'      then f.views_count end desc nulls last,
        f.created_at desc,
        f.id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows',  coalesce((select jsonb_agg(to_jsonb(g) - 'ord' order by g.ord) from paged g), '[]'::jsonb)
    )
  );
end;
$$;

-- 5.6b Distinct accommodation areas.
--
-- property_listings.area is free text (no enum, no check constraint), so the
-- console cannot ship a hardcoded list: it must offer the values that are
-- actually in use, or the filter silently returns nothing.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_property_areas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_admin();

  return coalesce((
    select jsonb_agg(to_jsonb(a) order by a.area)
    from (
      select trim(pl.area) as area, count(*) as listing_count
      from public.property_listings pl
      where pl.area is not null and btrim(pl.area) <> ''
      group by trim(pl.area)
    ) a
  ), '[]'::jsonb);
end;
$$;

-- 5.7 Unified report queue across both report tables.
-- `kind` is 'listing' or 'user'; the row carries the target the report is
-- about, so the console can act on it without a second lookup.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_reports(
  p_kind   text default 'all',
  p_status text default 'all',
  p_search text default null,
  p_sort   text default 'newest',
  p_limit  int  default 25,
  p_offset int  default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit  int  := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.admin_require_admin();

  return (
    with filtered as materialized (
      select
        r.id, 'listing_reports'::text as report_table, r.listing_type as listing_kind,
        r.listing_id as target_id,
        coalesce(r.listing_title, r.listing_id::text) as target_title,
        r.reason, r.details, r.status, r.resolution_note,
        r.created_at, r.resolved_at,
        r.reporter_id, rp.full_name as reporter_name, rp.username as reporter_username,
        r.resolved_by, ap.full_name as resolved_by_name,
        false as is_user_report, true  as is_listing_report
      from public.listing_reports r
      left join public.profiles rp on rp.id = r.reporter_id
      left join public.profiles ap on ap.id = r.resolved_by

      union all

      select
        r.id, 'user_reports'::text, null::listing_kind,
        r.reported_user_id,
        coalesce(tp.full_name, r.reported_user_id::text),
        r.reason, r.details, r.status, r.resolution_note,
        r.created_at, r.resolved_at,
        r.reporter_id, rp2.full_name, rp2.username,
        r.resolved_by, ap2.full_name,
        true, false
      from public.user_reports r
      left join public.profiles rp2 on rp2.id = r.reporter_id
      left join public.profiles ap2 on ap2.id = r.resolved_by
      left join public.profiles tp  on tp.id = r.reported_user_id
    ),
    matched as (
      select *
      from filtered f
      where (p_kind   = 'all' or (p_kind = 'user' and f.is_user_report)
                              or (p_kind = 'listing' and f.is_listing_report)
                              or (p_kind = 'marketplace' and f.listing_kind = 'marketplace')
                              or (p_kind = 'property' and f.listing_kind = 'property'))
        and (p_status = 'all'
             or (p_status = 'open'   and f.status in ('pending', 'reviewing'))
             or f.status::text = p_status)
        and (
              v_search is null
           or strpos(lower(f.target_title), lower(v_search)) > 0
           or strpos(lower(f.reason), lower(v_search)) > 0
           or strpos(lower(coalesce(f.details, '')), lower(v_search)) > 0
           or strpos(lower(coalesce(f.reporter_name, '')), lower(v_search)) > 0
        )
    ),
    paged as (
      select
        m.*,
        row_number() over (
          order by
            case when p_sort = 'oldest' then m.created_at end asc nulls last,
            m.created_at desc,
            m.id
        ) as ord
      from matched m
      order by
        case when p_sort = 'oldest' then m.created_at end asc nulls last,
        m.created_at desc,
        m.id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from matched),
      'rows',  coalesce((select jsonb_agg(to_jsonb(g) - 'ord' order by g.ord) from paged g), '[]'::jsonb)
    )
  );
end;
$$;

-- 5.8 Vendors - anyone with at least one listing, with trade aggregates.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_vendors(
  p_search text default null,
  p_filter text default 'all',
  p_sort   text default 'listings',
  p_limit  int  default 25,
  p_offset int  default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit  int  := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.admin_require_admin();

  return (
    with agg as (
      select
        p.id, p.username, p.full_name, p.avatar_url, p.department, p.level,
        p.hall_or_area, p.is_suspended, p.suspension_reason, p.created_at,
        coalesce((select ur.role from public.user_roles ur where ur.user_id = p.id), 'user'::app_role) as role,
        (select count(*) from public.marketplace_listings m  where m.user_id = p.id) as marketplace_count,
        (select count(*) from public.property_listings pl   where pl.user_id = p.id) as property_count,
        (select count(*) from public.marketplace_listings m2 where m2.user_id = p.id and m2.status = 'active') as marketplace_active,
        (select count(*) from public.property_listings pl2  where pl2.user_id = p.id and pl2.status = 'active') as property_active,
        (select count(*) from public.marketplace_listings m3 where m3.user_id = p.id and m3.status = 'removed') as marketplace_removed,
        (select count(*) from public.property_listings pl3  where pl3.user_id = p.id and pl3.status = 'removed') as property_removed,
        (select coalesce(sum(m4.price), 0) from public.marketplace_listings m4 where m4.user_id = p.id) as marketplace_value,
        (select coalesce(sum(pl4.price_per_year), 0) from public.property_listings pl4 where pl4.user_id = p.id) as property_value,
        (select count(*) from public.vendor_reviews vr where vr.vendor_id = p.id) as review_count,
        (select coalesce(round(avg(vr2.rating)::numeric, 2), 0) from public.vendor_reviews vr2 where vr2.vendor_id = p.id) as avg_rating,
        (select count(*) from public.user_reports ur2
          where ur2.reported_user_id = p.id and ur2.status in ('pending', 'reviewing')) as open_reports
      from public.profiles p
    ),
    filtered as materialized (
      select *
      from agg
      where (agg.marketplace_count + agg.property_count) > 0
        and (
              v_search is null
           or strpos(lower(agg.username), lower(v_search)) > 0
           or strpos(lower(agg.full_name), lower(v_search)) > 0
        )
        and (
             p_filter = 'all'
          or (p_filter = 'suspended' and agg.is_suspended)
          or (p_filter = 'reported'  and agg.open_reports > 0)
          or (p_filter = 'flagged'   and (agg.marketplace_removed + agg.property_removed) > 0)
          or (p_filter = 'active'    and not agg.is_suspended
                                     and (agg.marketplace_active + agg.property_active) > 0)
          or (p_filter = 'inactive'  and (agg.marketplace_active + agg.property_active) = 0)
        )
    ),
    paged as (
      select
        f.*,
        row_number() over (
          order by
            case when p_sort = 'name'    then lower(f.full_name) end asc,
            case when p_sort = 'rating'  then f.avg_rating end desc nulls last,
            case when p_sort = 'value'   then (f.marketplace_value + f.property_value) end desc nulls last,
            case when p_sort = 'newest'  then f.created_at end desc nulls last,
            case when p_sort = 'listings' then (f.marketplace_count + f.property_count) end desc nulls last,
            f.created_at desc,
            f.id
        ) as ord
      from filtered f
      order by
        case when p_sort = 'name'    then lower(f.full_name) end asc,
        case when p_sort = 'rating'  then f.avg_rating end desc nulls last,
        case when p_sort = 'value'   then (f.marketplace_value + f.property_value) end desc nulls last,
        case when p_sort = 'newest'  then f.created_at end desc nulls last,
        case when p_sort = 'listings' then (f.marketplace_count + f.property_count) end desc nulls last,
        f.created_at desc,
        f.id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows',  coalesce((select jsonb_agg(to_jsonb(g) - 'ord' order by g.ord) from paged g), '[]'::jsonb)
    )
  );
end;
$$;

-- 5.9 Review moderation.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_reviews(
  p_search text default null,
  p_rating int  default null,
  p_sort   text default 'newest',
  p_limit  int  default 25,
  p_offset int  default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit  int  := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.admin_require_admin();

  return (
    with filtered as materialized (
      select
        v.id, v.rating, v.comment, v.created_at, v.updated_at,
        v.vendor_id, vp.username as vendor_username, vp.full_name as vendor_name, vp.avatar_url as vendor_avatar,
        v.reviewer_id, rp.username as reviewer_username, rp.full_name as reviewer_name, rp.avatar_url as reviewer_avatar
      from public.vendor_reviews v
      left join public.profiles vp on vp.id = v.vendor_id
      left join public.profiles rp on rp.id = v.reviewer_id
      where (p_rating is null or v.rating = p_rating)
        and (
              v_search is null
           or strpos(lower(coalesce(v.comment, '')), lower(v_search)) > 0
           or strpos(lower(coalesce(vp.full_name, '')), lower(v_search)) > 0
           or strpos(lower(coalesce(vp.username, '')), lower(v_search)) > 0
           or strpos(lower(coalesce(rp.full_name, '')), lower(v_search)) > 0
        )
    ),
    paged as (
      select
        f.*,
        row_number() over (
          order by
            case when p_sort = 'oldest' then f.created_at end asc,
            case when p_sort = 'lowest' then f.rating end asc,
            case when p_sort = 'highest' then f.rating end desc,
            f.created_at desc,
            f.id
        ) as ord
      from filtered f
      order by
        case when p_sort = 'oldest' then f.created_at end asc,
        case when p_sort = 'lowest' then f.rating end asc,
        case when p_sort = 'highest' then f.rating end desc,
        f.created_at desc,
        f.id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows',  coalesce((select jsonb_agg(to_jsonb(g) - 'ord' order by g.ord) from paged g), '[]'::jsonb)
    )
  );
end;
$$;

-- 5.10 Audit log browser.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_audit_log(
  p_action_prefix text default null,
  p_admin_id      uuid default null,
  p_limit  int default 25,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_prefix text := nullif(trim(coalesce(p_action_prefix, '')), '');
begin
  perform public.admin_require_admin();

  return (
    with filtered as materialized (
      select
        l.id, l.action, l.target_type, l.target_id, l.details, l.created_at, l.admin_id,
        p.username, p.full_name, p.avatar_url
      from public.admin_audit_log l
      left join public.profiles p on p.id = l.admin_id
      where (v_prefix is null or l.action ilike v_prefix || '%')
        and (p_admin_id is null or l.admin_id = p_admin_id)
    ),
    paged as (
      select f.*, row_number() over (order by f.created_at desc, f.id) as ord
      from filtered f
      order by f.created_at desc, f.id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows',  coalesce((select jsonb_agg(to_jsonb(g) - 'ord' order by g.ord) from paged g), '[]'::jsonb)
    )
  );
end;
$$;

-- 5.11 Distinct admin actors, for the audit-log filter dropdown.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_audit_actors()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_admin();

  return coalesce((
    select jsonb_agg(to_jsonb(a) order by a.full_name)
    from (
      select
        l.admin_id as id,
        coalesce(p.full_name, 'Unknown') as full_name,
        coalesce(p.username, '')        as username,
        p.avatar_url,
        count(*) as action_count,
        max(l.created_at) as last_action_at
      from public.admin_audit_log l
      left join public.profiles p on p.id = l.admin_id
      group by l.admin_id, p.full_name, p.username, p.avatar_url
    ) a
  ), '[]'::jsonb);
end;
$$;


-- ============================================================================
-- 6. Write APIs - every one is guarded AND audited in the same transaction
-- ============================================================================

-- 6.1 Suspend / restore a user.
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_user_suspended(
  p_user_id  uuid,
  p_suspended boolean,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_role  app_role;
begin
  v_admin := public.admin_require_admin();

  if p_user_id is null then
    raise exception 'A user id is required' using errcode = '22023';
  end if;

  -- No self-lockout, ever.
  if p_user_id = v_admin then
    raise exception 'You cannot suspend or restore your own account'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'That user no longer exists' using errcode = 'P0002';
  end if;

  -- Admin accounts are protected from suspension: demote first, then suspend.
  -- Without this, one admin could lock the whole team out of moderation.
  v_role := coalesce((select ur.role from public.user_roles ur where ur.user_id = p_user_id), 'user');
  if p_suspended and v_role = 'admin' then
    raise exception 'This account is an administrator. Remove the admin role before suspending it.'
      using errcode = '42501';
  end if;

  update public.profiles
     set is_suspended    = coalesce(p_suspended, false),
         suspension_reason = case when p_suspended then nullif(trim(coalesce(p_reason, '')), '') else null end,
         suspended_at     = case when p_suspended then now() else null end
   where id = p_user_id;

  perform public.admin_audit_write(
    case when p_suspended then 'user.suspend' else 'user.restore' end,
    'user',
    p_user_id::text,
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), ''))
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'is_suspended', coalesce(p_suspended, false)
  );
end;
$$;

-- 6.2 Grant / revoke the admin role.
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin     uuid;
  v_new_role  app_role;
  v_old_role  app_role;
  v_admin_ct  bigint;
begin
  v_admin := public.admin_require_admin();

  if p_user_id is null then
    raise exception 'A user id is required' using errcode = '22023';
  end if;
  if p_user_id = v_admin then
    raise exception 'You cannot change your own role'
      using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('user', 'admin') then
    raise exception 'Role must be either user or admin' using errcode = '22023';
  end if;

  v_new_role := p_role::app_role;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'That user no longer exists' using errcode = 'P0002';
  end if;

  v_old_role := coalesce((select ur.role from public.user_roles ur where ur.user_id = p_user_id), 'user');

  -- Never let the last administrator demote themselves out of the console -
  -- that is unrecoverable without direct database access.
  if v_old_role = 'admin' and v_new_role = 'user' then
    select count(*) into v_admin_ct from public.user_roles where role = 'admin';
    if v_admin_ct <= 1 then
      raise exception 'This is the last administrator account - promote another admin first'
        using errcode = '42501';
    end if;
  end if;

  insert into public.user_roles (user_id, role)
  values (p_user_id, v_new_role)
  on conflict (user_id) do update set role = excluded.role;

  perform public.admin_audit_write(
    case when v_new_role = 'admin' then 'user.promote' else 'user.demote' end,
    'user',
    p_user_id::text,
    jsonb_build_object('from', v_old_role::text, 'to', v_new_role::text)
  );

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'role', v_new_role::text);
end;
$$;

-- 6.3 Admin edit of a user's public profile.
-- ----------------------------------------------------------------------------
create or replace function public.admin_update_profile(
  p_user_id     uuid,
  p_full_name   text default null,
  p_username    text default null,
  p_department  text default null,
  p_level       text default null,
  p_hall_or_area text default null,
  p_bio         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
begin
  v_admin := public.admin_require_admin();

  if p_user_id is null then
    raise exception 'A user id is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'That user no longer exists' using errcode = 'P0002';
  end if;
  if p_full_name is not null and char_length(trim(p_full_name)) < 1 then
    raise exception 'Full name cannot be empty' using errcode = '22023';
  end if;
  if p_username is not null and p_username !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 letters, numbers or underscores' using errcode = '22023';
  end if;

  update public.profiles
     set full_name    = coalesce(nullif(trim(p_full_name), ''), full_name),
         username     = coalesce(nullif(trim(p_username), ''), username),
         department   = p_department,
         level        = p_level,
         hall_or_area = p_hall_or_area,
         bio          = p_bio
   where id = p_user_id;

  perform public.admin_audit_write(
    'user.edit_profile', 'user', p_user_id::text,
    jsonb_build_object('fields', jsonb_build_array(
      case when p_full_name    is not null then 'full_name' end,
      case when p_username     is not null then 'username' end,
      case when p_department   is not null then 'department' end,
      case when p_level        is not null then 'level' end,
      case when p_hall_or_area is not null then 'hall_or_area' end,
      case when p_bio          is not null then 'bio' end
    ))
  );

  return jsonb_build_object('ok', true, 'user_id', p_user_id);
end;
$$;

-- 6.4 Change a listing's status (approve / pause / remove / restore).
--
-- JID listings publish the moment they are created - there is no `pending`
-- state in the schema - so "approve" here means reinstating a listing that was
-- paused or taken down, and "reject" means status = 'removed'. The console
-- labels the buttons accordingly rather than pretending a queue exists.
--
-- p_kind and p_status arrive as text and are validated before being cast, so a
-- bad value produces a readable error instead of an enum cast failure.
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_listing_status(
  p_kind      text,
  p_listing_id uuid,
  p_status    text,
  p_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin    uuid;
  v_reason   text := nullif(trim(coalesce(p_reason, '')), '');
  v_allowed  text[];
  v_exists   boolean;
begin
  v_admin := public.admin_require_admin();

  if p_kind not in ('marketplace', 'property') then
    raise exception 'Listing type must be marketplace or property' using errcode = '22023';
  end if;
  if p_listing_id is null then
    raise exception 'A listing id is required' using errcode = '22023';
  end if;

  v_allowed := case when p_kind = 'marketplace'
                   then array['active', 'paused', 'sold', 'removed']
                   else array['active', 'paused', 'rented', 'removed'] end;

  if p_status is null or not (p_status = any (v_allowed)) then
    raise exception 'Invalid status "%" for a % listing', coalesce(p_status, ''), p_kind
      using errcode = '22023';
  end if;

  if p_kind = 'marketplace' then
    select exists (select 1 from public.marketplace_listings where id = p_listing_id) into v_exists;
    if not v_exists then
      raise exception 'That listing no longer exists' using errcode = 'P0002';
    end if;
    update public.marketplace_listings set status = p_status::marketplace_status where id = p_listing_id;
  else
    select exists (select 1 from public.property_listings where id = p_listing_id) into v_exists;
    if not v_exists then
      raise exception 'That listing no longer exists' using errcode = 'P0002';
    end if;
    update public.property_listings set status = p_status::property_status where id = p_listing_id;
  end if;

  perform public.admin_audit_write(
    case when p_status = 'removed' then 'listing.remove'
         when p_status = 'active'  then 'listing.approve'
         else 'listing.status_change' end,
    p_kind,
    p_listing_id::text,
    jsonb_build_object('to', p_status, 'reason', v_reason)
  );

  return jsonb_build_object('ok', true, 'listing_id', p_listing_id, 'status', p_status);
end;
$$;

-- 6.5 Toggle the "verified landlord" badge (accommodation only).
-- `is_verified` is moderation-controlled, so it is deliberately NOT part of
-- admin_update_listing() - it gets its own narrow function.
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_listing_verified(
  p_listing_id uuid,
  p_verified   boolean,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
begin
  v_admin := public.admin_require_admin();

  if p_listing_id is null then
    raise exception 'A listing id is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.property_listings where id = p_listing_id) then
    raise exception 'That accommodation listing no longer exists' using errcode = 'P0002';
  end if;

  update public.property_listings
     set is_verified = coalesce(p_verified, false)
   where id = p_listing_id;

  perform public.admin_audit_write(
    case when p_verified then 'listing.verify' else 'listing.unverify' end,
    'property',
    p_listing_id::text,
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), ''))
  );

  return jsonb_build_object('ok', true, 'listing_id', p_listing_id, 'is_verified', coalesce(p_verified, false));
end;
$$;

-- 6.6 Admin edit of listing content.
--
-- Only content columns are writable here. Privileged columns (status,
-- is_verified, views_count, saves_count, boosted_until, user_id, created_at)
-- are deliberately excluded so this function cannot be used to sidestep the
-- dedicated moderation actions above - and so it stays a content edit, not a
-- privilege escalation.
-- ----------------------------------------------------------------------------
create or replace function public.admin_update_listing(
  p_kind       text,
  p_listing_id uuid,
  p_patch      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_keys  text[];
  v_ok    boolean;
begin
  v_admin := public.admin_require_admin();

  if p_kind not in ('marketplace', 'property') then
    raise exception 'Listing type must be marketplace or property' using errcode = '22023';
  end if;
  if p_listing_id is null then
    raise exception 'A listing id is required' using errcode = '22023';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Patch must be a JSON object' using errcode = '22023';
  end if;

  select array_agg(k) into v_keys
  from jsonb_object_keys(p_patch) as k;

  if v_keys is null or array_length(v_keys, 1) = 0 then
    raise exception 'Nothing to update' using errcode = '22023';
  end if;

  -- Array-valued columns need an explicit type check, and they must be read
  -- with a CASE on key presence: array(select jsonb_array_elements_text(...))
  -- yields '{}' rather than NULL when the key is absent, so COALESCE would
  -- silently blank out specs / images / amenities on a partial patch.
  if p_patch ? 'specs' and jsonb_typeof(p_patch->'specs') <> 'array' then
    raise exception 'specs must be an array of text' using errcode = '22023';
  end if;
  if p_patch ? 'images' and jsonb_typeof(p_patch->'images') <> 'array' then
    raise exception 'images must be an array of text' using errcode = '22023';
  end if;
  if p_patch ? 'amenities' and jsonb_typeof(p_patch->'amenities') <> 'array' then
    raise exception 'amenities must be an array of text' using errcode = '22023';
  end if;

  if p_kind = 'marketplace' then
    v_ok := v_keys <@ array['title', 'description', 'category', 'price', 'condition',
                            'location', 'pickup_spot', 'specs', 'images',
                            'contact_preference', 'phone_or_whatsapp']::text[];
    if not v_ok then
      raise exception 'One or more fields are not editable by an administrator' using errcode = '42501';
    end if;
    if not exists (select 1 from public.marketplace_listings where id = p_listing_id) then
      raise exception 'That listing no longer exists' using errcode = 'P0002';
    end if;

    update public.marketplace_listings
       set title              = coalesce(p_patch->>'title', title),
           description        = coalesce(p_patch->>'description', description),
           category           = coalesce((p_patch->>'category')::listing_category, category),
           price              = coalesce((p_patch->>'price')::numeric, price),
           condition          = coalesce((p_patch->>'condition')::item_condition, condition),
           location           = coalesce(p_patch->>'location', location),
           pickup_spot        = coalesce(p_patch->>'pickup_spot', pickup_spot),
           specs              = case when p_patch ? 'specs'
                                     then array(select jsonb_array_elements_text(p_patch->'specs'))
                                     else specs end,
           images             = case when p_patch ? 'images'
                                     then array(select jsonb_array_elements_text(p_patch->'images'))
                                     else images end,
           contact_preference = coalesce((p_patch->>'contact_preference')::contact_preference, contact_preference),
           phone_or_whatsapp  = coalesce(p_patch->>'phone_or_whatsapp', phone_or_whatsapp)
     where id = p_listing_id;
  else
    v_ok := v_keys <@ array['title', 'description', 'area', 'distance_to_campus', 'price_per_year',
                            'room_type', 'availability', 'water_source', 'power_setup', 'security',
                            'proximity_desc', 'amenities', 'images', 'contact_phone',
                            'contact_whatsapp', 'landlord_role']::text[];
    if not v_ok then
      raise exception 'One or more fields are not editable by an administrator' using errcode = '42501';
    end if;
    if not exists (select 1 from public.property_listings where id = p_listing_id) then
      raise exception 'That listing no longer exists' using errcode = 'P0002';
    end if;

    update public.property_listings
       set title              = coalesce(p_patch->>'title', title),
           description        = coalesce(p_patch->>'description', description),
           area               = coalesce(p_patch->>'area', area),
           distance_to_campus = coalesce(p_patch->>'distance_to_campus', distance_to_campus),
           price_per_year     = coalesce((p_patch->>'price_per_year')::numeric, price_per_year),
           room_type          = coalesce((p_patch->>'room_type')::property_room_type, room_type),
           availability       = coalesce((p_patch->>'availability')::property_availability, availability),
           water_source       = coalesce(p_patch->>'water_source', water_source),
           power_setup        = coalesce(p_patch->>'power_setup', power_setup),
           security           = coalesce(p_patch->>'security', security),
           proximity_desc     = coalesce(p_patch->>'proximity_desc', proximity_desc),
           amenities          = case when p_patch ? 'amenities'
                                     then array(select jsonb_array_elements_text(p_patch->'amenities'))
                                     else amenities end,
           images             = case when p_patch ? 'images'
                                     then array(select jsonb_array_elements_text(p_patch->'images'))
                                     else images end,
           contact_phone      = coalesce(p_patch->>'contact_phone', contact_phone),
           contact_whatsapp   = coalesce(p_patch->>'contact_whatsapp', contact_whatsapp),
           landlord_role      = coalesce((p_patch->>'landlord_role')::landlord_role, landlord_role)
     where id = p_listing_id;
  end if;

  perform public.admin_audit_write(
    'listing.edit', p_kind, p_listing_id::text,
    jsonb_build_object('fields', to_jsonb(v_keys))
  );

  return jsonb_build_object('ok', true, 'listing_id', p_listing_id, 'updated', to_jsonb(v_keys));
end;
$$;

-- 6.7 Permanently delete a listing. Irreversible - the console requires an
-- explicit typed confirmation before calling it.
-- ----------------------------------------------------------------------------
create or replace function public.admin_delete_listing(
  p_kind       text,
  p_listing_id uuid,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_title text;
begin
  v_admin := public.admin_require_admin();

  if p_kind not in ('marketplace', 'property') then
    raise exception 'Listing type must be marketplace or property' using errcode = '22023';
  end if;
  if p_listing_id is null then
    raise exception 'A listing id is required' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required to permanently delete a listing' using errcode = '22023';
  end if;

  if p_kind = 'marketplace' then
    select title into v_title from public.marketplace_listings where id = p_listing_id;
    if v_title is null then
      raise exception 'That listing no longer exists' using errcode = 'P0002';
    end if;
    delete from public.marketplace_listings where id = p_listing_id;
  else
    select title into v_title from public.property_listings where id = p_listing_id;
    if v_title is null then
      raise exception 'That listing no longer exists' using errcode = 'P0002';
    end if;
    delete from public.property_listings where id = p_listing_id;
  end if;

  perform public.admin_audit_write(
    'listing.delete', p_kind, p_listing_id::text,
    jsonb_build_object('title', v_title, 'reason', trim(p_reason))
  );

  return jsonb_build_object('ok', true, 'listing_id', p_listing_id, 'deleted', true);
end;
$$;

-- 6.8 Resolve a report.
--
-- p_report_table is whitelisted against pg_class and fully qualified, so it
-- cannot be used for SQL injection. Only the columns a moderator should be
-- able to set are touched.
-- ----------------------------------------------------------------------------
create or replace function public.admin_resolve_report(
  p_report_table text,
  p_report_id    uuid,
  p_status       text,
  p_note         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
begin
  v_admin := public.admin_require_admin();

  if p_report_table not in ('listing_reports', 'user_reports') then
    raise exception 'Unknown report type' using errcode = '22023';
  end if;
  if p_report_id is null then
    raise exception 'A report id is required' using errcode = '22023';
  end if;
  if p_status is null or p_status not in ('reviewing', 'resolved', 'dismissed', 'action_taken') then
    raise exception 'Invalid resolution status' using errcode = '22023';
  end if;

  -- `reviewing` is not terminal, so it must clear the resolution timestamp
  -- rather than stamp one (a report can go reviewing -> dismissed).
  execute format(
    'update public.%I set status = $1::report_status, resolved_by = $2, resolved_at = case when $1 = ''reviewing'' then null else now() end, resolution_note = $3 where id = $4',
    p_report_table
  )
  using p_status, v_admin, nullif(trim(coalesce(p_note, '')), ''), p_report_id;

  perform public.admin_audit_write(
    'report.' || p_status, 'report', p_report_id::text,
    jsonb_build_object('table', p_report_table, 'note', nullif(trim(coalesce(p_note, '')), ''))
  );

  return jsonb_build_object('ok', true, 'report_id', p_report_id, 'status', p_status);
end;
$$;

-- 6.9 Remove an inappropriate review.
-- ----------------------------------------------------------------------------
create or replace function public.admin_delete_review(
  p_review_id uuid,
  p_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin    uuid;
  v_vendor   uuid;
  v_reviewer uuid;
  v_rating   smallint;
begin
  v_admin := public.admin_require_admin();

  if p_review_id is null then
    raise exception 'A review id is required' using errcode = '22023';
  end if;

  select vendor_id, reviewer_id, rating
    into v_vendor, v_reviewer, v_rating
  from public.vendor_reviews
  where id = p_review_id;

  if v_vendor is null then
    raise exception 'That review no longer exists' using errcode = 'P0002';
  end if;

  delete from public.vendor_reviews where id = p_review_id;

  perform public.admin_audit_write(
    'review.delete', 'review', p_review_id::text,
    jsonb_build_object(
      'vendor_id', v_vendor, 'reviewer_id', v_reviewer, 'rating', v_rating,
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    )
  );

  return jsonb_build_object('ok', true, 'review_id', p_review_id, 'deleted', true);
end;
$$;

-- 6.10 Notify a user from the console (e.g. a listing was taken down).
-- ----------------------------------------------------------------------------
create or replace function public.admin_notify_user(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_type    text default 'system'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
begin
  v_admin := public.admin_require_admin();

  if p_user_id is null or nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'A recipient and title are required' using errcode = '22023';
  end if;

  if p_type not in ('message', 'boost', 'inquiry', 'system', 'report', 'review') then
    p_type := 'system';
  end if;

  insert into public.notifications (user_id, title, body, type)
  values (p_user_id, left(trim(p_title), 120), left(coalesce(p_body, ''), 400), p_type::notification_type);

  perform public.admin_audit_write(
    'user.notify', 'user', p_user_id::text, jsonb_build_object('title', trim(p_title))
  );

  return jsonb_build_object('ok', true);
end;
$$;


-- ============================================================================
-- 7. Tighten the existing suspension guard
--
-- schema.sql protected is_suspended but not the two moderation columns added
-- above. Without this, a user could PATCH their own suspension_reason.
-- ============================================================================
create or replace function public.protect_suspension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.is_suspended is distinct from old.is_suspended then
    raise exception 'Only administrators can change suspension status' using errcode = '42501';
  end if;

  if new.suspension_reason is distinct from old.suspension_reason
     or new.suspended_at is distinct from old.suspended_at then
    raise exception 'Only administrators can change moderation notes' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_suspension on public.profiles;
create trigger trg_protect_suspension
  before update on public.profiles
  for each row execute function public.protect_suspension();


-- ============================================================================
-- 8. Grants
--
-- Postgres grants EXECUTE on every function to PUBLIC by default, so the
-- default must be revoked before anything is granted back deliberately:
--   - anon                : nothing. Admin data is never publicly readable.
--   - authenticated      : the console functions only. admin_require_admin()
--                          and admin_audit_write() stay owner-only, so a client
--                          cannot forge an audit entry or probe the guard.
--
-- Every function below still calls admin_require_admin() first, so possession
-- of a valid session is not authorisation - the role check is the gate.
-- ============================================================================
do $$
declare
  r record;
begin
  for r in
    select p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin\_%'
  loop
    execute format('revoke all on function public.%I(%s) from public', r.proname, r.args);
    execute format('revoke all on function public.%I(%s) from anon', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to authenticated', r.proname, r.args);
  end loop;
end;
$$;

-- Internal plumbing: callable only by the functions above (which run as the
-- table owner), never directly by a client.
revoke all on function public.admin_require_admin() from public, anon, authenticated;
revoke all on function public.admin_audit_write(text, text, text, jsonb) from public, anon, authenticated;

-- Belt and braces: the audit log is readable by admins only, and is NOT
-- writable by a browser at all - not even by a valid admin session.
--
-- schema.sql created a `for all ... with check (is_admin(auth.uid()))` policy,
-- which combined with Supabase's default table grants let an authenticated admin
-- INSERT, UPDATE or DELETE rows directly and forge history. The only writer is
-- admin_audit_write(), which is SECURITY DEFINER (so it runs as the table
-- owner, bypassing both the grants and RLS) and stamps auth.uid() itself.
revoke all on table public.admin_audit_log from anon, authenticated;

drop policy if exists audit_admin_only on public.admin_audit_log;
drop policy if exists audit_admin_write on public.admin_audit_log;
drop policy if exists audit_admin_read on public.admin_audit_log;

create policy audit_admin_read on public.admin_audit_log
  for select using (public.is_admin(auth.uid()));


-- ============================================================================
-- 9. Verification
--
-- After running this file, the query below should list 25 rows, one per
-- function, with has_public_grant = false and can_authenticated_call = true.
-- If it returns fewer rows, or a row with can_authenticated_call = false for
-- anything other than admin_require_admin / admin_audit_write, the grants did
-- not apply as intended - do not run the admin panel until they do.
--
-- The second query must return zero rows: clients hold no privileges on
-- admin_audit_log, so audit rows can only be written by admin_audit_write().
-- ----------------------------------------------------------------------------
-- select p.proname,
--        has_function_privilege('anon', p.oid, 'execute')       as anon_can_call,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_call
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname like 'admin\_%'
-- order by p.proname;
--
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'admin_audit_log'
--   and grantee in ('anon', 'authenticated');
