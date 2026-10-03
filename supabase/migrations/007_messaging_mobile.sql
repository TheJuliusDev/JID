-- ===========================================================================
-- 007 — Mobile messaging: what the phone needs on top of 006
--
-- Run AFTER 006_messaging_upgrade.sql. Nothing here re-declares an object that
-- 006 already owns (see the list at the bottom) — this file only adds the
-- handful of columns, RPCs and tables the mobile app needs and the website
-- never had a reason to build.
--
-- WHAT 006 ALREADY OWNS, AND WHY IT IS NOT REPEATED HERE
--   messages.kind / metadata / client_id / reply_to_id / search_tsv
--   message_deletions (with a NOT NULL conversation_id), blocks, chat_reports,
--   push_subscriptions (Web Push), app_sessions
--   get_my_conversations(), search_messages(), set_conversation_pinned(),
--   set_conversation_archived(), block_user(), unblock_user(), touch_last_seen()
--
-- Those functions have fixed signatures. Re-declaring one with different
-- parameter names is the same function to PostgreSQL, so `CREATE OR REPLACE`
-- with a different return type fails outright, and renaming a parameter breaks
-- the website's PostgREST calls (src/services/database.ts passes `conv_id`,
-- `pinned`, `other_user` by name). The phone calls the same RPCs the site does.
--
-- WHAT THIS FILE ADDS
--   * messages.delivered_at + messages.reply_preview
--   * conversation_participants.muted_at, with an RPC to toggle it
--   * a unique (sender_id, client_id) index, so a retried offline send can never
--     create a second bubble
--   * get_conversation_detail(), get_unread_message_count(),
--     search_my_conversations(), mark_messages_delivered()
--   * Expo push: push_tokens, push_preferences, push_deliveries
--   * dispatch_message_push(): an asynchronous pg_net POST to the
--     `send-message-push` Edge Function, so a message insert never waits on a
--     push gateway
--
-- Idempotent: safe to run more than once.
-- Apply with: supabase db push
-- ===========================================================================

-- -----------------------------------------------------------------------------
-- 1. pg_net
-- -----------------------------------------------------------------------------
-- Used only to fire the push dispatch. Web Push (006 + notify-push) is
-- unchanged; this is the second transport, for the phone.
create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- 2. Columns
-- -----------------------------------------------------------------------------
-- `delivered_at` is a transport fact ("this reached a device that had the thread
-- open"), deliberately separate from `read_at`, which is a human one. The site
-- stamps `read_at` per bubble (src/services/database.ts); the phone has a
-- foreground moment where a message is genuinely on screen and unread.
alter table public.messages
  add column if not exists delivered_at timestamptz;

-- A denormalised copy of the quoted text, taken when the reply was sent.
-- The site resolves a quote by joining the parent row
-- (`messages!messages_reply_to_fkey`), which only works while the parent is in
-- the loaded page of history. In a busy thread it usually is not, and the quote
-- renders empty. Copying the text makes the preview independent of paging.
alter table public.messages
  add column if not exists reply_preview text;

-- `muted_at` is per participant: muting a chat must not mute it for the other
-- person, which is why this belongs on the membership row and not on
-- `conversations`.
alter table public.conversation_participants
  add column if not exists muted_at timestamptz;

-- -----------------------------------------------------------------------------
-- 3. Idempotent send
-- -----------------------------------------------------------------------------
-- `client_id` is generated on the device before the insert. The unique index is
-- what makes an optimistic send safe to retry: a resend after a dropped
-- connection returns the original row instead of a duplicate bubble.
--
-- The site has been writing `client_id` since 006 without this constraint, so
-- clear any historical duplicate (keeping the earliest row, which is the one the
-- sender already reconciled) before the index is built — otherwise the CREATE
-- below fails on a table that is otherwise fine.
update public.messages m
   set client_id = null
  where m.client_id is not null
    and exists (
      select 1
        from public.messages older
       where older.sender_id = m.sender_id
         and older.client_id = m.client_id
         and (older.created_at, older.id) < (m.created_at, m.id)
    );

create unique index if not exists messages_sender_client_id_key
  on public.messages (sender_id, client_id)
  where client_id is not null;

-- -----------------------------------------------------------------------------
-- 4. Indexes
-- -----------------------------------------------------------------------------
-- The phone pages a thread newest-first on every open.
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

-- Delivered receipts are written per thread on foreground, filtered on
-- "not yet delivered".
create index if not exists messages_undelivered_idx
  on public.messages (conversation_id)
  where delivered_at is null;

-- The inbox query filters "not archived" for one user.
create index if not exists conversation_participants_user_inbox_idx
  on public.conversation_participants (user_id, archived_at, pinned_at desc);

-- -----------------------------------------------------------------------------
-- 5. Expo push
-- -----------------------------------------------------------------------------
-- The phone registers its Expo token here. `endpoint`-style uniqueness does not
-- apply the way it does for browsers: a re-install reuses the same token, so
-- uniqueness is on the token itself and re-registering updates the row in place
-- instead of accumulating dead devices.
create table if not exists public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  token        text not null unique,
  platform     text not null default 'android',
  device_name  text,
  app_version  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_user
  on public.push_tokens (user_id) where active;

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own on public.push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists push_tokens_update_own on public.push_tokens;
create policy push_tokens_update_own on public.push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens
  for delete using (auth.uid() = user_id);

-- Notification settings live outside `profiles` so that changing a preference
-- never touches the public profile row.
create table if not exists public.push_preferences (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  messages_enabled  boolean not null default true,
  show_preview      boolean not null default true,
  sound_enabled     boolean not null default true,
  updated_at        timestamptz not null default now()
);

alter table public.push_preferences enable row level security;

drop policy if exists push_preferences_own on public.push_preferences;
create policy push_preferences_own on public.push_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A ledger of dispatches the phone has already been handed, keyed by
-- message + device token.
--
-- The trigger below is at-least-once: if the transaction commits and the pg_net
-- queue is retried, the same message reaches the Edge Function twice, which would
-- notify twice. This table lets the function recognise its own prior work. Only
-- the function writes it, with the service role key, which is why it gets RLS
-- enabled and no policies at all.
create table if not exists public.push_deliveries (
  dedupe_key text primary key,
  expo_id    text,
  status     text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_deliveries_created
  on public.push_deliveries (created_at desc);

alter table public.push_deliveries enable row level security;

-- -----------------------------------------------------------------------------
-- 6. RPCs
-- -----------------------------------------------------------------------------
-- Every function below is SECURITY DEFINER with an explicit `set search_path`,
-- matching the rest of the schema: `conversation_participants` and `blocks` are
-- only readable by their owner under RLS, so a SECURITY INVOKER caller could
-- not join them.

-- 6.1 Mute a conversation. Void + raise, exactly like set_conversation_pinned()
-- in 006, so the phone treats a refusal as an error and can surface it.
create or replace function public.set_conversation_muted(conv_id uuid, muted boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_participants
     set muted_at = case when muted then now() else null end
   where conversation_id = conv_id and user_id = auth.uid();

  if not found then
    raise exception 'Not a participant of this conversation';
  end if;
end;
$$;

-- 6.2 Delivery receipt. Written when the thread is actually rendered, which is
-- a stronger claim than "the row exists".
create or replace function public.mark_messages_delivered(conv_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.is_conversation_participant(conv_id) then
    raise exception 'Not a participant of this conversation';
  end if;

  update public.messages m
     set delivered_at = now()
   where m.conversation_id = conv_id
     and m.sender_id <> auth.uid()
     and m.delivered_at is null
     -- A block is symmetric, so neither side's messages count as delivered.
     and not public.blocks_between(auth.uid(), m.sender_id);

  get diagnostics affected = row_count;

  return affected;
end;
$$;

-- 6.3 The tab-bar badge.
--
-- Deliberately built on the same `last_read_at` cursor as
-- get_my_conversations() in 006, not on `messages.read_at`. Two different
-- definitions of "unread" would show a badge that disagrees with the number
-- printed next to the conversation, and that is the kind of bug nobody reports.
create or replace function public.get_unread_message_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  with my as (
    select conversation_id, last_read_at
    from public.conversation_participants
    where user_id = auth.uid()
      and archived_at is null
  )
  select count(*)
  from my
  join public.messages m on m.conversation_id = my.conversation_id
  where m.created_at > my.last_read_at
    and m.sender_id <> auth.uid()
    and m.deleted_at is null
    and not public.blocks_between(auth.uid(), m.sender_id)
    and not exists (
      select 1 from public.message_deletions d
      where d.message_id = m.id and d.user_id = auth.uid()
    );
$$;

-- 6.4 One conversation, for a cold start from a push notification.
--
-- The inbox is not enough: an archived thread is absent from it by design, and
-- that is exactly the thread a tapped notification points at. Membership is
-- checked up front — without it this is a way to read anyone's messages by
-- guessing a UUID.
--
-- Column names mirror get_my_conversations() so the phone can share one mapper.
create or replace function public.get_conversation_detail(p_conv_id uuid)
returns table (
  conversation_id     uuid,
  other_id            uuid,
  other_username      text,
  other_full_name     text,
  other_avatar_url    text,
  other_department    text,
  other_level         text,
  other_hall_or_area  text,
  other_last_seen_at  timestamptz,
  other_presence_visible boolean,
  listing_type        listing_kind,
  listing_id          uuid,
  listing_title       text,
  listing_price       numeric,
  listing_image       text,
  last_message_at     timestamptz,
  unread_count        bigint,
  pinned_at           timestamptz,
  archived_at         timestamptz,
  muted_at            timestamptz,
  is_blocked          boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_conversation_participant(p_conv_id) then
    raise exception 'Not a participant of this conversation';
  end if;

  return query
  with my as (
    select cp.conversation_id, cp.last_read_at, cp.pinned_at, cp.archived_at, cp.muted_at
    from public.conversation_participants cp
    where cp.conversation_id = p_conv_id and cp.user_id = auth.uid()
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
    -- Respected server-side, so a client cannot ask for a hidden timestamp by
    -- reading `profiles` through another path.
    case when pr.presence_visible then pr.last_seen_at end,
    pr.presence_visible,
    c.listing_type,
    c.listing_id,
    c.listing_title,
    c.listing_price,
    c.listing_image,
    c.last_message_at,
    (
      select count(*)
      from public.messages m
      where m.conversation_id = c.id
        and m.created_at > my.last_read_at
        and m.sender_id <> auth.uid()
        and m.deleted_at is null
        and not public.blocks_between(auth.uid(), m.sender_id)
        and not exists (
          select 1 from public.message_deletions d
          where d.message_id = m.id and d.user_id = auth.uid()
        )
    ),
    my.pinned_at,
    my.archived_at,
    my.muted_at,
    exists (
      select 1 from public.blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = op.user_id
    )
  from my
  join public.conversations c on c.id = my.conversation_id
  join public.conversation_participants op
    on op.conversation_id = c.id and op.user_id <> auth.uid()
  join public.profiles pr on pr.id = op.user_id;
end;
$$;

-- 6.5 Inbox search across participants and message text.
--
-- Archived threads are included on purpose — that is what makes "archived chats
-- are still searchable" true — so the phone filters them out client-side, the
-- same way it renders them behind the Archived toggle.
--
-- Matching runs on the `search_tsv` GIN index that 006 built. An `ILIKE '%…%'`
-- would be simpler and would also scan the whole table on every keystroke.
create or replace function public.search_my_conversations(
  q text,
  p_limit integer default 25
)
returns table (
  conversation_id        uuid,
  other_id               uuid,
  other_full_name        text,
  other_username         text,
  other_avatar_url       text,
  listing_title          text,
  last_message_at        timestamptz,
  unread_count           bigint,
  pinned_at              timestamptz,
  archived_at            timestamptz,
  matched_message_id     uuid,
  matched_message_kind   message_kind,
  matched_sender_id      uuid
)
language sql
security definer
set search_path = public
stable
as $$
  with hits as (
    select
      m.conversation_id,
      m.id,
      m.kind,
      m.sender_id,
      m.created_at,
      ts_rank_cd(m.search_tsv, plainto_tsquery('simple', q)) as rank
    from public.messages m
    where m.deleted_at is null
      -- A one-character query matches most of a table and tells the user
      -- nothing. The site applies the same floor in search_messages().
      and length(btrim(q)) >= 2
      and m.search_tsv @@ plainto_tsquery('simple', q)
      and not exists (
        select 1 from public.message_deletions d
        where d.message_id = m.id and d.user_id = auth.uid()
      )
      and not public.blocks_between(auth.uid(), m.sender_id)
  ),
  mine as (
    select
      cp.conversation_id,
      cp.last_read_at,
      cp.pinned_at,
      cp.archived_at,
      op.user_id as other_id
    from public.conversation_participants cp
    join public.conversation_participants op
      on op.conversation_id = cp.conversation_id and op.user_id <> cp.user_id
    join public.profiles other on other.id = op.user_id
    where cp.user_id = auth.uid()
      and not public.blocks_between(auth.uid(), other.id)
      -- A name match counts even when the thread holds no matching text, so a
      -- search for someone you have never written to still finds the person.
      and (
        other.full_name ilike '%' || q || '%'
        or other.username ilike '%' || q || '%'
        or exists (select 1 from hits h where h.conversation_id = cp.conversation_id)
      )
  ),
  -- One match per thread, the best-ranked one. `rank` is selected but not
  -- returned: `distinct on` requires every ORDER BY expression in the select
  -- list, and the phone wants the winning message id, not its score.
  best as (
    select distinct on (conversation_id)
      conversation_id, id, kind, sender_id, rank
    from hits
    order by conversation_id, rank desc, created_at desc
  )
  select
    c.id,
    m.other_id,
    other.full_name,
    other.username,
    other.avatar_url,
    c.listing_title,
    c.last_message_at,
    (
      select count(*)
      from public.messages msg
      where msg.conversation_id = c.id
        and msg.created_at > m.last_read_at
        and msg.sender_id <> auth.uid()
        and msg.deleted_at is null
        and not public.blocks_between(auth.uid(), msg.sender_id)
        and not exists (
          select 1 from public.message_deletions d
          where d.message_id = msg.id and d.user_id = auth.uid()
        )
    ),
    m.pinned_at,
    m.archived_at,
    b.id,
    b.kind,
    b.sender_id
  from mine m
  join public.conversations c on c.id = m.conversation_id
  join public.profiles other on other.id = m.other_id
  left join best b on b.conversation_id = m.conversation_id
  order by m.pinned_at desc nulls last, c.last_message_at desc
  limit greatest(1, least(p_limit, 100));
$$;

-- 6.6 Device registration. Upsert on the token so re-registering on every launch
-- refreshes the existing row rather than filling the table with devices the
-- student no longer owns.
create or replace function public.register_push_token(
  p_token text,
  p_platform text default 'android',
  p_device_name text default null,
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
begin
  insert into public.push_tokens (user_id, token, platform, device_name, app_version, last_seen_at)
  values (auth.uid(), p_token, p_platform, p_device_name, p_app_version, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        device_name = excluded.device_name,
        app_version = excluded.app_version,
        active = true,
        last_seen_at = now()
  returning id into row_id;

  -- Seed the preference row so the Edge Function never has to handle a NULL and
  -- the phone's settings screen always has something to render.
  insert into public.push_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  return row_id;
end;
$$;

-- `found` rather than a `returning` clause: a SQL function whose last statement
-- is DELETE...RETURNING returns NULL, not false, when nothing was deleted, and
-- "no such token" should not be reported as "unknown".
create or replace function public.unregister_push_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_tokens
   where user_id = auth.uid() and token = p_token;

  return found;
end;
$$;

create or replace function public.get_push_preferences()
returns table (
  messages_enabled boolean,
  show_preview boolean,
  sound_enabled boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select messages_enabled, show_preview, sound_enabled
  from public.push_preferences
  where user_id = auth.uid();
$$;

-- NULL means "leave this one alone", so the settings screen can PATCH a single
-- switch without reading the row first.
create or replace function public.set_push_preferences(
  p_messages_enabled boolean default null,
  p_show_preview boolean default null,
  p_sound_enabled boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.push_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.push_preferences
     set messages_enabled = coalesce(p_messages_enabled, messages_enabled),
         show_preview = coalesce(p_show_preview, show_preview),
         sound_enabled = coalesce(p_sound_enabled, sound_enabled),
         updated_at = now()
   where user_id = auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Push dispatch
-- -----------------------------------------------------------------------------
-- What pg_net does: queue an HTTP request and return immediately, so a slow or
-- dead push gateway can never delay or fail the insert that saved the message.
-- The student still sees it in the inbox on next open.
--
-- SECURITY DEFINER because it reads the service-role key from `vault`, which the
-- anon and authenticated roles cannot do.
--
-- PREREQUISITES (Supabase SQL editor, run once):
--   alter database postgres set app.settings.supabase_url =
--     'https://xiaczqvmrhoxkdxunzzp.supabase.co';
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'jid_push_service_key');
--   select vault.create_secret('<RANDOM_STRING>', 'jid_push_webhook_secret');
--
-- Both are optional in the sense that the trigger no-ops without them: send a
-- message, see no push, and read the NOTICE explaining which one is missing.
--
-- If you would rather not enable pg_net, set
--   alter database postgres set app.settings.push_dispatch_enabled = 'off';
-- drop the trigger at the end of this file, and configure the same function
-- under Database -> Webhooks, exactly as notify-push already is: INSERT on
-- public.messages, POST /functions/v1/send-message-push, body
-- {"type":"INSERT","table":"messages","record":<record>}. The function reads
-- `body.record` either way.
--
-- Leave the trigger in place only if `send-message-push` is actually deployed.
-- With both the trigger and a Database Webhook configured, every message is
-- dispatched twice.
create or replace function public.dispatch_message_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_url text;
  service_key text;
  webhook_secret text;
  request_id bigint;
begin
  edge_url := current_setting('app.settings.supabase_url', true);

  -- Every prerequisite missing is a NOTICE, not an error. A misconfigured push
  -- must never surface as a failed message send.
  if edge_url is null or edge_url = '' then
    raise notice 'dispatch_message_push: app.settings.supabase_url not set; skipping push';
    return new;
  end if;

  -- Escape hatch for anyone who would rather use a Database Webhook instead:
  --   alter database postgres set app.settings.push_dispatch_enabled = 'off';
  -- Off unless explicitly disabled, so forgetting this line cannot silently stop
  -- every push on the project.
  if current_setting('app.settings.push_dispatch_enabled', true) = 'off' then
    raise notice 'dispatch_message_push: disabled by app.settings.push_dispatch_enabled';
    return new;
  end if;

  select decrypted_secret into service_key
    from vault.decrypted_secrets
   where name = 'jid_push_service_key';

  if service_key is null then
    raise notice 'dispatch_message_push: vault secret jid_push_service_key missing; skipping push';
    return new;
  end if;

  select decrypted_secret into webhook_secret
    from vault.decrypted_secrets
   where name = 'jid_push_webhook_secret';

  select net.http_post(
    url     := edge_url || '/functions/v1/send-message-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key,
      'x-jid-webhook-secret', coalesce(webhook_secret, '')
    ),
    body    := jsonb_build_object(
      'type', 'INSERT',
      'table', 'messages',
      'schema', 'public',
      'record', to_jsonb(new)
    )
  ) into request_id;

  raise notice 'dispatch_message_push: queued net request %', request_id;

  return new;

-- The reason this handler exists at all. This is an AFTER trigger, so anything
-- raised here propagates out of the message INSERT and rolls it back — the one
-- failure mode the whole asynchronous design is meant to rule out. A push that
-- cannot be queued costs a student a notification; a push that aborts the insert
-- costs them their message. Catch everything.
exception when others then
  raise notice 'dispatch_message_push: % %', sqlstate, sqlerrm;
  return new;
end;
$$;

-- AFTER INSERT only. Read receipts, delivery stamps and deletes are UPDATEs on
-- the same table and must never produce a notification.
drop trigger if exists messages_push_dispatch on public.messages;

create trigger messages_push_dispatch
  after insert on public.messages
  for each row
  execute function public.dispatch_message_push();

-- -----------------------------------------------------------------------------
-- 8. Grants
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER + PUBLIC execute is how PostgREST would otherwise let anon
-- call these. Only the signed-in user may, and only as themselves: every body
-- derives its target from auth.uid().
revoke all on function public.set_conversation_muted(uuid, boolean) from public, anon;
grant execute on function public.set_conversation_muted(uuid, boolean) to authenticated;

revoke all on function public.mark_messages_delivered(uuid) from public, anon;
grant execute on function public.mark_messages_delivered(uuid) to authenticated;

revoke all on function public.get_unread_message_count() from public, anon;
grant execute on function public.get_unread_message_count() to authenticated;

revoke all on function public.get_conversation_detail(uuid) from public, anon;
grant execute on function public.get_conversation_detail(uuid) to authenticated;

revoke all on function public.search_my_conversations(text, integer) from public, anon;
grant execute on function public.search_my_conversations(text, integer) to authenticated;

revoke all on function public.register_push_token(text, text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;

revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

revoke all on function public.get_push_preferences() from public, anon;
grant execute on function public.get_push_preferences() to authenticated;

revoke all on function public.set_push_preferences(boolean, boolean, boolean) from public, anon;
grant execute on function public.set_push_preferences(boolean, boolean, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Realtime
-- -----------------------------------------------------------------------------
-- 006 already added conversation_participants and message_deletions. `messages`
-- is guarded because the phone relies on DELETE arriving live to drop a bubble
-- that disappears, and `blocks` so a block on one device takes effect on the
-- other without a refresh.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'blocks'
    ) then
      alter publication supabase_realtime add table public.blocks;
    end if;
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- 10. Housekeeping
-- -----------------------------------------------------------------------------
-- The dispatch ledger is only ever read as "have I sent this recently", so a
-- couple of days is plenty. Scheduled rather than pg_cron, which is not
-- guaranteed to be enabled on every project:
--   delete from public.push_deliveries
--    where created_at < now() - interval '2 days';
--
-- Tokens that Expo rejects (DeviceNotRegistered) are deleted by the Edge
-- Function, so this table stays at one row per device the student actually owns.

-- ===========================================================================
-- VERIFY
--   select public.get_unread_message_count();
--   select * from public.get_conversation_detail('<uuid>');
--   select * from public.search_my_conversations('ada', 10);
-- ===========================================================================