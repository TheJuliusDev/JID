-- ============================================================================
-- 003 — Single-owner administrator lock + console integrity fixes
--
-- Run this AFTER schema.sql and 002_admin_panel.sql, in that order.
--
-- Goal: exactly one human account may hold the `admin` role, and that fact is
-- enforced by the DATABASE rather than by the browser, the UI, or a client
-- flag. `AdminGate` still re-verifies on every entry, but this file removes the
-- underlying ability to hand the role to anybody else.
--
-- What this closes:
--   1. `admin_set_user_role()` let ANY admin promote ANY user to admin. Once a
--      second admin existed, either could mint a third. Every grant of the
--      admin role now passes through a trigger that compares the target's
--      auth.users email against a single configured address.
--   2. `roles_admin_write` is a `for all` policy on user_roles, so an
--      authenticated admin could INSERT/UPDATE user_roles directly over
--      PostgREST — bypassing the RPC, its "you cannot change your own role" and
--      "this is the last administrator" guards, and its audit write. Table-level
--      INSERT/UPDATE/DELETE are now revoked from anon/authenticated, so the
--      audited RPC is the only writer.
--   3. Nothing prevented demoting the owner, which would permanently lock the
--      console with no in-app recovery path. The trigger now refuses that too.
--
-- Also fixed here:
--   - admin_get_user() now returns marketplace_count / property_count, which
--     the user drawer already rendered but the function never returned (it read
--     as a permanent 0 for every user).
--   - notification_type gains 'admin_message', which the Users console already
--     sends; without the enum value admin_notify_user silently downgraded every
--     operator message to 'system'.
--
-- NOTE: no password is stored in this file or anywhere in the repository.
-- `jid_bootstrap_admin_account()` takes the password as a runtime argument, so
-- it exists only in your SQL session. Do not commit it to the browser bundle.
--
-- Safe to re-run.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Configuration: which single account may hold the admin role
-- ----------------------------------------------------------------------------
create table if not exists public.admin_email_lock (
  id            boolean primary key default true,
  allowed_email text    not null,
  updated_at    timestamptz not null default now(),
  constraint admin_email_lock_singleton check (id),
  constraint admin_email_lock_has_at check (position('@' in allowed_email) > 1)
);

comment on table public.admin_email_lock is
  'Single row. The one account permitted to hold the admin role. Changing the administrator means updating allowed_email.';

-- Seed / re-point the lock. This is the ONLY place the owner address lives.
insert into public.admin_email_lock (id, allowed_email)
values (true, 'ayodejijulius27@gmail.com')
on conflict (id) do update
  set allowed_email = excluded.allowed_email,
      updated_at    = now();

-- ----------------------------------------------------------------------------
-- 2. Accessor: the allowed email, lower-cased and trimmed
--
-- SECURITY DEFINER so the enforcement trigger below can read the table without
-- inheriting the caller's grants. Execute is revoked from clients in section 7;
-- the trigger runs as the function owner and is unaffected.
--
-- Named `jid_*` on purpose: 002_admin_panel.sql's grant loop matches `admin\_%`,
-- so a `admin_*` name would be re-granted to `authenticated` if 002 were ever
-- re-applied after this file.
-- ----------------------------------------------------------------------------
create or replace function public.jid_admin_allowed_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(btrim(allowed_email)) from public.admin_email_lock where id;
$$;

-- ----------------------------------------------------------------------------
-- 3. The guard: only the configured account may hold `admin`
-- ----------------------------------------------------------------------------
create or replace function public.jid_enforce_admin_email_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed text;
  v_email   text;
begin
  v_allowed := public.jid_admin_allowed_email();

  -- Resolve the target account's login email. NULL for a phone-only/ OAuth
  -- account, which is treated as "not the owner" and therefore blocked below.
  select lower(btrim(au.email)) into v_email
  from auth.users au
  where au.id = new.user_id;

  -- ---- granting admin ----------------------------------------------------
  if new.role = 'admin'::app_role then
    -- Already admin and staying admin: a no-op, nothing to authorise.
    if tg_op = 'UPDATE' and old.role = 'admin'::app_role then
      return new;
    end if;

    if v_email is null or v_email is distinct from v_allowed then
      raise exception
        'Administrator access is restricted to a single owner account on this deployment. Only % may hold the admin role.',
        coalesce(v_allowed, '(not configured)')
        using errcode = '42501';
    end if;

    return new;
  end if;

  -- ---- demoting ----------------------------------------------------------
  -- Refuse to strip admin from the owner: it would lock every operator out of
  -- the console with no in-app recovery. Demoting any OTHER admin is fine, and
  -- so is demoting an ordinary user.
  if tg_op = 'UPDATE' and old.role = 'admin'::app_role and v_email = v_allowed then
    raise exception
      'The owner account cannot be demoted. Administrator access is locked to it.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_admin_email_lock on public.user_roles;
create trigger trg_admin_email_lock
  before insert or update on public.user_roles
  for each row execute function public.jid_enforce_admin_email_lock();

-- ----------------------------------------------------------------------------
-- 4. Force every role write through the audited RPC
--
-- 002 deliberately routes role changes through admin_set_user_role() so the
-- change lands in admin_audit_log. These table grants let an admin skip that by
-- writing the row directly, which is why the `roles_admin_write` policy needs to
-- be paired with a revoke — a policy without a grant does nothing on its own.
--
-- SELECT stays: admins must still be able to read roles.
-- handle_new_user() and admin_set_user_role() are SECURITY DEFINER and run as
-- the table owner, so neither is affected by this revoke.
-- ----------------------------------------------------------------------------
revoke insert, update, delete on public.user_roles from anon, authenticated;

-- The policy becomes unreachable for writes; drop it so the table has exactly
-- one obvious write path and no misleading second one to reason about later.
drop policy if exists roles_admin_write on public.user_roles;

-- ----------------------------------------------------------------------------
-- 5. Demote any admin that is not the configured owner
--
-- Must run with the trigger in place so it cannot be used to bootstrap a new
-- admin by accident. A no-op on a database that never had another admin.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select ur.user_id, coalesce(au.email, '(no email)') as email
    from public.user_roles ur
    left join auth.users au on au.id = ur.user_id
    where ur.role = 'admin'
      and lower(btrim(coalesce(au.email, ''))) is distinct from public.jid_admin_allowed_email()
  loop
    update public.user_roles set role = 'user' where user_id = r.user_id;
    raise notice 'JID: demoted non-owner admin % (%)', r.user_id, r.email;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Owner-only bootstrap: create (or repair) the admin account
--
-- Callable ONLY from the Supabase SQL Editor, because execute is revoked from
-- anon/authenticated in section 7 — a browser session cannot reach it.
--
-- The password is a parameter, never a literal in this file. Running it leaves
-- no credential in the repository, in git history, or in the client bundle.
--
--   select public.jid_bootstrap_admin_account(
--     'ayodejijulius27@gmail.com',
--     '<your password>'
--   );
--
-- Idempotent: creates the account if missing, otherwise resets the password,
-- confirms the email, and (re)grants the admin role.
-- ----------------------------------------------------------------------------
create or replace function public.jid_bootstrap_admin_account(
  p_email    text,
  p_password text
)
returns jsonb
language plpgsql
security definer
-- `extensions` is where Supabase installs pgcrypto; crypt()/gen_salt() are
-- needed for the password-reset path below. A schema that does not exist is
-- simply ignored by search_path, so this is safe on any deployment.
set search_path = public, extensions
as $$
declare
  v_allowed text;
  v_email   text;
  v_user_id uuid;
begin
  v_email   := lower(btrim(p_email));
  v_allowed := public.jid_admin_allowed_email();

  if v_email is distinct from v_allowed then
    raise exception
      'Refusing to bootstrap %: the administrator email lock is set to %.',
      coalesce(v_email, '(empty)'), coalesce(v_allowed, '(not configured)')
      using errcode = '42501';
  end if;

  if p_password is null or char_length(p_password) < 8 then
    raise exception 'A password of at least 8 characters is required'
      using errcode = '22023';
  end if;

  select id into v_user_id from auth.users where lower(email) = v_email;

  if v_user_id is null then
    v_user_id := (
      auth.admin.create_user(
        jsonb_build_object(
          'email', v_email,
          'password', p_password,
          'email_confirm', true
        )
      )
    )::uuid;
  else
    -- Repair path: make sure the account can actually sign in.
    update auth.users
       set password        = crypt(p_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now())
     where id = v_user_id;
  end if;

  -- handle_new_user() may not have fired (account predates the trigger, or was
  -- inserted directly), so make sure the profile and role rows exist.
  insert into public.profiles (id, username, full_name)
  values (
    v_user_id,
    'jidadmin',
    'JID Administrator'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'admin')
  on conflict (user_id) do update set role = 'admin';

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'email', v_email,
    'role', 'admin'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Grants
--
-- Postgres grants EXECUTE to PUBLIC by default, so every function above must be
-- revoked explicitly. The config table and its contents are owner-only too: a
-- client that could read allowed_email could at least confirm the target, and
-- nothing gains from that.
-- ----------------------------------------------------------------------------
revoke all on function public.jid_admin_allowed_email() from public, anon, authenticated;
revoke all on function public.jid_enforce_admin_email_lock() from public, anon, authenticated;
revoke all on function public.jid_bootstrap_admin_account(text, text) from public, anon, authenticated;

revoke all on table public.admin_email_lock from anon, authenticated;
alter table public.admin_email_lock enable row level security;
-- No policies on purpose: RLS with zero policies denies every client, which is
-- the intent. The owner role bypasses RLS, so SQL Editor access still works.

-- ----------------------------------------------------------------------------
-- 8. Fix: admin_get_user must return the counts the user drawer renders
--
-- The drawer shows marketplace_count / property_count, but this function built
-- the profile object without them while its TypeScript type claimed AdminUserRow
-- (which declares them), so formatNumber(undefined) rendered a permanent 0.
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
        'last_sign_in_at', (select au.last_sign_in_at from auth.users au where au.id = p.id),
        -- Added: the drawer has always rendered these two tiles.
        'marketplace_count', (select count(*) from public.marketplace_listings m where m.user_id = p.id),
        'property_count', (select count(*) from public.property_listings pl where pl.user_id = p.id)
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
    ), '[]'::jsonb),
    'reviews_given', (select count(*) from public.vendor_reviews v where v.reviewer_id = p_user_id),
    'avg_rating', coalesce((select round(avg(v.rating)::numeric, 2) from public.vendor_reviews v where v.vendor_id = p_user_id), 0),
    'reports_against', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', lr.id, 'reason', lr.reason, 'details', lr.details,
               'status', lr.status::text, 'created_at', lr.created_at,
               'reporter', (select p4.full_name from public.profiles p4 where p4.id = lr.reporter_id)
             ) order by lr.created_at desc)
      from public.listing_reports lr
      where lr.listing_id in (
        select m.id from public.marketplace_listings m where m.user_id = p_user_id
        union all
        select pl.id from public.property_listings pl where pl.user_id = p_user_id
      )
    ), '[]'::jsonb),
    'reports_filed', (
      select count(*) from public.listing_reports lr where lr.reporter_id = p_user_id
    ) + (
      select count(*) from public.user_reports ur where ur.reporter_id = p_user_id
    ),
    'messages_sent', (select count(*) from public.messages m where m.sender_id = p_user_id)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Fix: let admin_notify_user actually carry 'admin_message'
--
-- The Users console sends that type. It was not in the enum, and
-- admin_notify_user() rewrites anything outside its allow-list to 'system', so
-- every operator message was stored as 'system' while the UI reported success.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum
    join pg_type t on t.oid = enumtypid
    where t.typname = 'notification_type' and enumlabel = 'admin_message'
  ) then
    alter type public.notification_type add value 'admin_message';
  end if;
end;
$$;

-- On PostgreSQL 12+ (Supabase runs 15/16/17) ALTER TYPE ... ADD VALUE is legal
-- inside a transaction block, provided the new label is not consumed in the
-- same transaction. It is not: the replacement function below only stores the
-- label inside a quoted body, which is never parsed here. So one transaction
-- covers the whole file.
begin;

create or replace function public.admin_notify_user(
  p_user_id uuid,
  p_title    text,
  p_body     text,
  p_type     text default 'system'
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

  -- 'admin_message' added: the Users console composes operator messages.
  if p_type not in ('message', 'boost', 'inquiry', 'system', 'report', 'review', 'admin_message') then
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

-- admin_get_user and admin_notify_user are `admin\_%` functions. 002 granted
-- EXECUTE to authenticated and revoked it from anon/public; re-assert that here
-- so the replacements cannot silently widen access if this file is applied alone.
revoke all on function public.admin_get_user(uuid) from public, anon;
revoke all on function public.admin_notify_user(uuid, text, text, text) from public, anon;
grant execute on function public.admin_get_user(uuid) to authenticated;
grant execute on function public.admin_notify_user(uuid, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 10. Verification
--
-- 1) The lock. Must return exactly one row, your address:
--      select allowed_email from public.admin_email_lock;
--
-- 2) The admin roster. Must list ONLY the owner:
--      select ur.role, au.email
--      from public.user_roles ur join auth.users au on au.id = ur.user_id
--      where ur.role = 'admin';
--
-- 3) Clients hold no write privileges on user_roles. Must return zero rows:
--      select table_name, grantee, privilege_type
--      from information_schema.role_table_grants
--      where table_schema = 'public' and table_name = 'user_roles'
--        and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
--
-- 4) The guard actually blocks a promotion. Must raise 42501:
--      select public.admin_set_user_role(<some-non-owner-uuid>, 'admin');
--
-- 5) Clients cannot reach the bootstrap helper. Must raise
--    "permission denied for function":
--      -- from a client, e.g. the browser console:
--      -- (await supabase.rpc('jid_bootstrap_admin_account', {p_email:'x', p_password:'y'}))
--
-- 6) Privileged plumbing stayed owner-only (002's own check, should still list
--    admin_require_admin / admin_audit_write as not callable by authenticated):
--      select p.proname,
--             has_function_privilege('anon', p.oid, 'execute')        as anon_can_call,
--             has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_call
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname like 'admin\_%'
--      order by p.proname;
-- ----------------------------------------------------------------------------

commit;
