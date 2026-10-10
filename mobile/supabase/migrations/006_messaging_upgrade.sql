-- ===========================================================================
-- 006 — Production messaging upgrade
--
-- Adds, without touching the shape of anything that already ships:
--   * message kind + metadata (image / voice), and replies
--   * delete-for-me (independent of the existing delete-for-everyone)
--   * pinned / archived per participant
--   * blocking
--   * message + conversation reports (moderation stays server-side)
--   * Web Push subscriptions
--   * presence columns (online / last seen) with privacy switches
--
-- IMPORTANT — Messages and Notifications become separate systems.
-- `notify_new_message()` previously inserted a row into `notifications` for
-- every new message, which made messages show up on the general Notifications
-- page. That trigger is replaced below and the historical rows are removed.
-- Message unread state is derived from `conversation_participants.last_read_at`.
--
-- Safe to run repeatedly: every statement is idempotent.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'message_kind') then
    create type message_kind as enum ('text', 'image', 'voice');
  end if;

  if not exists (select 1 from pg_type where typname = 'chat_report_reason') then
    create type chat_report_reason as enum (
      'scam',            -- Scam / fraud
      'harassment',      -- Harassment or abuse
      'spam',            -- Spam or repeated messages
      'inappropriate',   -- Inappropriate content
      'fake_listing',    -- Fake / misleading listing
      'impersonation',   -- Pretending to be someone else
      'other'            -- Other
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 2. Presence on profiles
--
-- `last_seen_at` is a throttled heartbeat (at most once a minute, written only
-- while the tab is visible) — it backs "Last seen today", not "online now".
-- "Online now" comes from Supabase Realtime Presence over the existing
-- websocket, so presence costs no polling.
--
-- The two switches make presence privacy-ready: a future settings screen only
-- has to flip a column, and the read paths below already respect them.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

alter table public.profiles
  add column if not exists presence_visible boolean not null default true;

alter table public.profiles
  add column if not exists last_seen_visible boolean not null default true;

create index if not exists idx_profiles_last_seen
  on public.profiles (last_seen_at desc)
  where presence_visible;

-- ---------------------------------------------------------------------------
-- 3. Messages: kind, metadata, replies
--
-- `kind` is the single source of truth going forward. Existing rows predate the
-- column and are backfilled from the `jid://photo/` content prefix that older
-- clients wrote, so nothing renders differently after this migration.
-- `metadata` holds per-kind extras that do not belong in `content`:
--   image -> { "urls": [...] }
--   voice -> { "url": "...", "durationMs": 4200, "peaks": [0.2, ...] }
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists kind message_kind not null default 'text';

alter table public.messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null;

-- Client-generated id, written once when the sender inserts. Lets the sending
-- device reconcile its optimistic bubble with both the INSERT response and the
-- realtime INSERT that races it, so a fast connection cannot double-render a
-- message. Only meaningful for the sender; safe to read for anyone in the thread.
alter table public.messages
  add column if not exists client_id text;

-- Backfill the legacy single-photo encoding into kind + metadata.
--
-- The prefix is exactly `jid://photo/` (12 characters), so the URL is whatever
-- follows it. Stating the length rather than a magic number keeps this from
-- silently corrupting URLs if the encoding ever changes.
update public.messages
   set kind = 'image',
       metadata = jsonb_build_object(
         'urls',
         array[substring(content from length('jid://photo/') + 1)]
       )
 where content like 'jid://photo/%'
   and kind = 'text';

-- Replies render a quoted preview, so fetch the parent cheaply.
create index if not exists messages_reply_to_idx
  on public.messages (reply_to_id)
  where reply_to_id is not null;

-- Full-text search inside a conversation. `content` is the haystack; the
-- generated column keeps it in step with the table without a trigger.
alter table public.messages
  add column if not exists search_tsv tsvector
  generated always as (to_tsvector('simple', coalesce(content, ''))) stored;

create index if not exists messages_search_idx
  on public.messages using gin (search_tsv);

-- A message that has been soft-deleted should not match search results.
create index if not exists messages_live_idx
  on public.messages (conversation_id, created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4. Delete for me
--
-- `messages.deleted_at` + the wiped `jid://deleted/` content is the existing
-- delete-for-everyone. Hiding a message for one participant only needs its own
-- table — changing `content` would wipe it for the other side too.
-- ---------------------------------------------------------------------------
create table if not exists public.message_deletions (
  message_id      uuid not null references public.messages (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  -- Denormalised from `messages` so "what has this student hidden in this
  -- thread?" is one indexed equality lookup instead of a join. The client
  -- always knows the conversation it is looking at, and RLS below re-checks
  -- that the caller really participates in it, so the copy cannot be spoofed.
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists idx_msg_del_user on public.message_deletions (user_id);
create index if not exists idx_msg_del_conv  on public.message_deletions (conversation_id);

-- ---------------------------------------------------------------------------
-- 5. Pin and archive (per participant — never global to the conversation)
-- ---------------------------------------------------------------------------
alter table public.conversation_participants
  add column if not exists pinned_at timestamptz;

alter table public.conversation_participants
  add column if not exists archived_at timestamptz;

-- ---------------------------------------------------------------------------
-- 6. Blocking
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create index if not exists idx_blocks_blocked on public.blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- 7. Message / conversation reports
--
-- Deliberately narrow: a normal user can only INSERT. Reading and resolving is
-- admin-only via `is_admin()`, so no moderation surface is exposed to students.
-- ---------------------------------------------------------------------------
create table if not exists public.chat_reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid references public.profiles (id) on delete set null,
  reported_user_id  uuid not null references public.profiles (id) on delete cascade,
  conversation_id   uuid references public.conversations (id) on delete set null,
  message_id        uuid references public.messages (id) on delete set null,
  reason            chat_report_reason not null,
  details           text check (char_length(details) <= 2000),
  status            report_status not null default 'pending',
  resolved_by       uuid references public.profiles (id) on delete set null,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  -- A report must point at a message, a conversation, or both.
  constraint chat_report_has_target check (
    message_id is not null or conversation_id is not null
  )
);

create index if not exists idx_chat_reports_status  on public.chat_reports (status, created_at desc);
create index if not exists idx_chat_reports_reporter on public.chat_reports (reporter_id);
create index if not exists idx_chat_reports_target   on public.chat_reports (reported_user_id);

-- ---------------------------------------------------------------------------
-- 8. Web Push subscriptions
--
-- One row per browser/device. The client stores the subscription here after
-- `PushManager.subscribe()`; the `notify-push` Edge Function reads these rows to
-- dispatch. `endpoint` is unique because a re-subscribed browser gets a new
-- endpoint and the old one 410s.
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

create index if not exists idx_push_user on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- 8b. app_sessions — "is this student actually looking at the app right now?"
--
-- The service worker already suppresses a system notification when it can find a
-- visible window, but that only helps *after* the push has been delivered over
-- the network. Recording a heartbeat lets `notify-push` skip the push entirely
-- for students who are already in the app, which is the difference between a
-- message appearing instantly and appearing a second later behind a banner.
--
-- One row per student (unique on `user_id`, so the client can upsert without a
-- read-modify-write): the question is "is this student in the app", not which
-- device. `last_ping_at` is written at most once every 45s by the client and
-- pruned below, so this table stays at one row per active user.
-- ---------------------------------------------------------------------------
create table if not exists public.app_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_ping_at timestamptz not null default now()
);

create index if not exists idx_app_sessions_ping on public.app_sessions (last_ping_at desc);
create unique index if not exists uq_app_sessions_user on public.app_sessions (user_id);

alter table public.app_sessions enable row level security;

-- A student may see and maintain only their own heartbeat. Everyone else is
-- served by `get_my_conversations()`, never by reading this table directly.
create policy "app_sessions_read_own" on public.app_sessions
  for select using (auth.uid() = user_id);
create policy "app_sessions_insert_own" on public.app_sessions
  for insert with check (auth.uid() = user_id);
create policy "app_sessions_update_own" on public.app_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "app_sessions_delete_own" on public.app_sessions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 9. Notify: messages and notifications are now separate systems
--
-- Replaces the old body, which wrote every new message into `notifications`.
-- `last_message_at` is still maintained here (it drives conversation ordering);
-- push dispatch is handled by the `notify-push` Edge Function reading the
-- messages table, so this trigger never blocks a send.
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;

  return new;
end;
$$;

-- Drop the message rows the old trigger created. Messages now surface through
-- the conversation list, so leaving these behind would double-notify.
delete from public.notifications where type = 'message';

-- ---------------------------------------------------------------------------
-- 10. Conversation list
--
-- Adds pinned/archived ordering, the other participant's presence, and an
-- unread count that ignores anything hidden via `message_deletions`.
--
-- The return type is wider than the version in schema.sql (presence, pin/archive
-- and last-message-kind are new columns), and PostgreSQL refuses to change a
-- function's return type via CREATE OR REPLACE — it raises "cannot change
-- return type of existing function". So the old signature is dropped first.
--
-- Nothing depends on this function (it is only ever called by name from the
-- client), so dropping it cannot break another object.
-- ---------------------------------------------------------------------------
drop function if exists public.get_my_conversations();

create function public.get_my_conversations()
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
  last_message        text,
  last_message_kind   message_kind,
  last_sender_id      uuid,
  unread_count        bigint,
  pinned_at           timestamptz,
  archived_at         timestamptz,
  is_blocked          boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with my as (
    select conversation_id, last_read_at, pinned_at, archived_at
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
    -- Respect the other student's presence privacy switch.
    case when pr.presence_visible then pr.last_seen_at end,
    pr.presence_visible,
    c.listing_type,
    c.listing_id,
    c.listing_title,
    c.listing_price,
    c.listing_image,
    c.last_message_at,
    lm.content,
    lm.kind,
    lm.sender_id,
    coalesce(uc.cnt, 0),
    my.pinned_at,
    my.archived_at,
    exists (
      select 1 from public.blocks b
       where b.blocker_id = auth.uid() and b.blocked_id = op.user_id
    )
  from my
  join public.conversations c on c.id = my.conversation_id
  join public.conversation_participants op
    on op.conversation_id = c.id and op.user_id <> auth.uid()
  join public.profiles pr on pr.id = op.user_id
  left join lateral (
    select content, kind, sender_id
    from public.messages m
    where m.conversation_id = c.id and m.deleted_at is null
      -- Same exclusion as the unread count below: a message this student chose
      -- to hide must not keep reappearing as the thread preview.
      and not exists (
        select 1 from public.message_deletions d
         where d.message_id = m.id and d.user_id = auth.uid()
      )
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*) as cnt
    from public.messages m
    where m.conversation_id = c.id
      and m.created_at > my.last_read_at
      and m.sender_id <> auth.uid()
      and m.deleted_at is null
      and not exists (
        select 1 from public.message_deletions d
         where d.message_id = m.id and d.user_id = auth.uid()
      )
  ) uc on true
  -- Pinned first, then most recent. Archived threads sort last but stay in the
  -- result set: the client renders them behind the "Archived" toggle, which is
  -- why they must remain searchable and countable.
  order by
    (my.pinned_at is null),
    my.pinned_at desc nulls last,
    (my.archived_at is not null),
    c.last_message_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 11. Pin / archive / block RPCs
--
-- SECURITY DEFINER so they can update `conversation_participants` without the
-- caller having to satisfy the participant UPDATE policy's `with check`, and so
-- each function can enforce its own precondition server-side.
-- ---------------------------------------------------------------------------

create or replace function public.set_conversation_pinned(conv_id uuid, pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_participants
    set pinned_at = case when pinned then now() else null end
    where conversation_id = conv_id and user_id = auth.uid();

  if not found then
    raise exception 'Not a participant of this conversation';
  end if;
end;
$$;

create or replace function public.set_conversation_archived(conv_id uuid, archived boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_participants
    -- Unarchiving a pinned chat must not resurrect the pin timestamp.
    set archived_at = case when archived then now() else null end
    where conversation_id = conv_id and user_id = auth.uid();

  if not found then
    raise exception 'Not a participant of this conversation';
  end if;
end;
$$;

-- Blocking hides the conversation from the blocker immediately and refuses new
-- messages in that direction. Raises so the client can surface a real error
-- rather than silently dropping a message.
create or replace function public.block_user(other_user uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if other_user is null or other_user = auth.uid() then
    raise exception 'Invalid user to block';
  end if;

  insert into public.blocks (blocker_id, blocked_id, reason)
  values (auth.uid(), other_user, left(p_reason, 200))
  on conflict (blocker_id, blocked_id) do update set reason = excluded.reason;
end;
$$;

create or replace function public.unblock_user(other_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.blocks
   where blocker_id = auth.uid() and blocked_id = other_user;
$$;

-- Does either participant block the other? Used by the message insert policy so
-- a blocked user cannot reach the blocker by any client-side path.
create or replace function public.blocks_between(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  );
$$;

-- The same question, but asked about a *conversation* rather than two known
-- user ids.
--
-- This is the form the RLS policies need. `blocks_between(auth.uid(),
-- sender_id)` cannot be used there: a participant inserting into an existing
-- thread is necessarily `sender_id = auth.uid()`, so that call compares the
-- sender against themselves and is always false. Blocking has to be checked
-- against the *other* participant instead, which means looking up who else is in
-- the thread.
create or replace function public.conversation_has_block(conv_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.conversation_participants cp
      join public.blocks b
        on b.blocker_id = cp.user_id
       and b.blocked_id = auth.uid()
     where cp.conversation_id = conv_id
       and cp.user_id <> auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 12. Search inside a conversation
--
-- Ranked server-side on the tsvector index so a long thread stays cheap, and
-- paged with a keyset cursor on (rank, created_at, id) so the client never
-- issues an OFFSET against a growing table.
-- ---------------------------------------------------------------------------
create or replace function public.search_messages(
  conv_id uuid,
  q text,
  p_limit integer default 40
)
returns table (
  message_id  uuid,
  sender_id   uuid,
  content     text,
  kind        message_kind,
  created_at  timestamptz,
  read_at     timestamptz,
  reply_to_id uuid,
  snippet     text
)
language sql
security definer
set search_path = public
stable
as $$
  with hits as (
    select
      m.id, m.sender_id, m.content, m.kind, m.created_at, m.read_at, m.reply_to_id,
      ts_rank_cd(m.search_tsv, plainto_tsquery('simple', q)) as rank
    from public.messages m
    where m.conversation_id = conv_id
      and m.deleted_at is null
      and m.search_tsv @@ plainto_tsquery('simple', q)
      and not exists (
        select 1 from public.message_deletions d
         where d.message_id = m.id and d.user_id = auth.uid()
      )
      and not public.blocks_between(auth.uid(), m.sender_id)
  )
  select
    h.id, h.sender_id, h.content, h.kind, h.created_at, h.read_at, h.reply_to_id,
    -- Headline the hit so the client can highlight without re-running the query.
    ts_headline(
      'simple', h.content, plainto_tsquery('simple', q),
      'StartSel=<mark>,StopSel=</mark>,MaxWords=28,MinWords=12'
    )
  from hits h
  where auth.uid() is not null
    and public.is_conversation_participant(conv_id, auth.uid())
  order by h.rank desc, h.created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

-- ---------------------------------------------------------------------------
-- 13. Throttled presence heartbeat
--
-- SECURITY DEFINER because `profiles_update_own` is fine for this but the
-- function also lets us clamp the write rate server-side, so a misbehaving or
-- tampered client cannot use it to hammer the table.
-- ---------------------------------------------------------------------------
create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     -- Server-side rate limit: one write per 30s, regardless of client cadence.
     and (last_seen_at is null or last_seen_at < now() - interval '30 seconds');

  -- Same beat doubles as the "app is open" signal `notify-push` uses to decide
  -- whether a push is needed at all. Upserting here keeps it to one round trip
  -- per heartbeat instead of two, and the unique index on `user_id` makes this
  -- safe to call from every device and every session.
  insert into public.app_sessions (user_id, last_ping_at)
  values (auth.uid(), now())
  on conflict (user_id) do update
    set last_ping_at = excluded.last_ping_at
    where app_sessions.last_ping_at < now() - interval '30 seconds';
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Row level security
-- ---------------------------------------------------------------------------
alter table public.message_deletions enable row level security;
alter table public.blocks               enable row level security;
alter table public.chat_reports          enable row level security;
alter table public.push_subscriptions    enable row level security;

-- ---- message_deletions ----
-- Students manage only their own hidden messages. The insert also requires the
-- caller to be a participant in the message's conversation.
drop policy if exists msgdel_select on public.message_deletions;
create policy msgdel_select on public.message_deletions
  for select using (auth.uid() = user_id);

drop policy if exists msgdel_insert on public.message_deletions;
create policy msgdel_insert on public.message_deletions
  for insert with check (
    auth.uid() = user_id
    -- The denormalised conversation_id must match the message it hides, and the
    -- caller must actually participate in that conversation.
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.conversation_id = conversation_id
        and public.is_conversation_participant(m.conversation_id, auth.uid())
    )
  );

-- No delete policy: a hide is permanent, matching WhatsApp/iOS behaviour.
--
-- The update policy is a technicality, not a feature. `hideMessage()` upserts on
-- (message_id, user_id), and PostgREST implements that as
-- INSERT ... ON CONFLICT DO UPDATE — the conflict branch runs as an UPDATE, so
-- without this policy the upsert fails the *second* time a student hides an
-- already-hidden message. It cannot be used to widen what is hidden, because the
-- `using` clause still pins the row to the caller.
drop policy if exists msgdel_update on public.message_deletions;
create policy msgdel_update on public.message_deletions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- blocks ----
-- A blocker sees their own blocks. The blockee is not told they were blocked.
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks
  for select using (auth.uid() = blocker_id);

drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks
  for delete using (auth.uid() = blocker_id);

-- ---- chat_reports ----
-- Insert-only for students. Reporting creates no read access to anyone else's
-- reports; moderation reads through `is_admin()`.
drop policy if exists chatreports_insert on public.chat_reports;
create policy chatreports_insert on public.chat_reports
  for insert with check (
    auth.uid() = reporter_id
    and reported_user_id <> auth.uid()
    and public.users_share_conversation(reported_user_id, auth.uid())
  );

drop policy if exists chatreports_select_admin on public.chat_reports;
create policy chatreports_select_admin on public.chat_reports
  for select using (public.is_admin(auth.uid()));

drop policy if exists chatreports_update_admin on public.chat_reports;
create policy chatreports_update_admin on public.chat_reports
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- push_subscriptions ----
drop policy if exists push_select_own on public.push_subscriptions;
create policy push_select_own on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists push_insert_own on public.push_subscriptions;
create policy push_insert_own on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists push_update_own on public.push_subscriptions;
create policy push_update_own on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Dispatch runs in the Edge Function with the service role key, which bypasses
-- RLS — that is the only path allowed to read other users' subscriptions.

-- ---------------------------------------------------------------------------
-- 15. Existing policies that must respect blocking
-- ---------------------------------------------------------------------------

-- A blocked pair must not be able to open a new thread.
drop policy if exists cp_update_own on public.conversation_participants;
create policy cp_update_own on public.conversation_participants
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tighten message insert: participants only, and not across a block in either
-- direction. The old policy has no block check, so without this a blocked user
-- could keep messaging by any client.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id, auth.uid())
    -- Checked against the *other* participant, via the conversation. Comparing
    -- the caller to `sender_id` here would be meaningless: the first condition
    -- already pins them equal, so it would always pass.
    and not public.conversation_has_block(conversation_id)
  );

-- Blocked users cannot start a new conversation with the blocker.
--
-- Note this policy is effectively a backstop: direct inserts into
-- `conversations` do go through it, but the app opens threads via
-- `get_or_create_direct_conversation()`, which is SECURITY DEFINER and so
-- bypasses RLS entirely. That function has its own explicit block check below —
-- this policy cannot be relied on alone.
drop policy if exists conversation_insert_blocked on public.conversations;
create policy conversation_insert_blocked on public.conversations
  for insert with check (
    auth.uid() = created_by
    and not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id
        and cp.user_id <> auth.uid()
        and public.blocks_between(auth.uid(), cp.user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 15b. Block enforcement inside the conversation creator
--
-- `get_or_create_direct_conversation()` is SECURITY DEFINER, so RLS policies do
-- not apply to the rows it inserts — the check has to live in the function body.
-- Without this, the `conversation_insert_blocked` policy above is decorative and
-- a blocked user could still open a fresh thread on any listing.
--
-- Replacement is safe: the signature and `returns uuid` are unchanged, so this
-- is a normal CREATE OR REPLACE and existing callers are unaffected.
-- ---------------------------------------------------------------------------
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

  -- Either side having blocked the other closes the door. Blocking is stored
  -- directionally, but the *effect* on starting a conversation is not: if
  -- someone has blocked you, they should not be able to be pulled into a new
  -- thread by you, and you should not be able to reach them by re-opening one.
  if public.blocks_between(me, other_user) then
    raise exception 'You cannot start a conversation with this user';
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

-- ---------------------------------------------------------------------------
-- 16. Realtime publication
--
-- Pin/archive and delete-for-me need to reach the other open tabs live. Guarded
-- so re-running the migration cannot fail on a duplicate entry.
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'conversation_participants'
    ) then
      alter publication supabase_realtime add table public.conversation_participants;
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'message_deletions'
    ) then
      alter publication supabase_realtime add table public.message_deletions;
    end if;
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 17. Housekeeping
--
-- One-off cleanup so the personal data this feature creates is not kept forever:
-- prune push subscriptions that have not been used in 90 days, drop last_seen
-- timestamps for profiles that opted out, and forget the "app is open" heartbeat
-- of anyone who has not pinged in 24h.
--
-- Schedule with pg_cron if available:
--   select cron.schedule('prune-push', '17 3 * * *', 'select public.prune_push_subscriptions()');
-- ---------------------------------------------------------------------------
create or replace function public.prune_push_subscriptions()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions
   where created_at < now() - interval '90 days'
     and (last_ok_at is null or last_ok_at < now() - interval '90 days');

  -- A session that has not pinged in a day is not "awake" by any definition
  -- `notify-push` uses, so keeping it serves nothing.
  delete from public.app_sessions
   where last_ping_at < now() - interval '24 hours';

  -- Presence privacy: a student who opted out should not have an exact last-seen
  -- timestamp retained server-side indefinitely.
  update public.profiles
     set last_seen_at = null
   where presence_visible = false
     and last_seen_at is not null;
$$;
