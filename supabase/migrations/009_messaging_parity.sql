-- ===========================================================================
-- 009 — Web + mobile messaging parity
--
-- Run AFTER 008_message_attachments_empty_content.sql.
--
-- WHY THIS FILE EXISTS
-- The website (`src/services/database.ts`) and the Expo app (`mobile/services`)
-- share one Supabase project. 006/007/008 built the *web* messaging schema;
-- the phone shipped a parallel set of drafts under
-- `mobile/supabase/migrations/2026*` that were never compatible with it:
--
--   * the phone stored image/voice payloads in dedicated `messages.media_url`
--     / `duration_ms` columns, the web stored them in `messages.metadata`;
--   * the phone used `user_blocks` / `message_reports`, the web used
--     `blocks` / `chat_reports`;
--   * several phone RPCs (`get_my_conversations_v2`, `get_conversation_participant`,
--     `delete_message_for_*`, ...) had no web counterpart at all;
--   * the phone called shared RPCs with different parameter names
--     (`p_conversation` vs `conv_id`, `p_user` vs `other_user`).
--
-- This migration makes the canonical schema (006+007+008) a *superset* of what
-- both apps need. It is purely additive/idempotent: no existing column, table,
-- function or policy that the website relies on is removed or given a new
-- meaning.
--
-- The phone's own `2026*` migrations are superseded by this file and are kept
-- only as history — do NOT apply them on top of 009 (see `mobile/supabase/README.md`).
--
-- WHAT THIS FILE DOES
--   1. `messages.media_url / media_width / media_height / duration_ms /
--      deleted_for_everyone_at`, and a BEFORE trigger that keeps those columns
--      in sync (both directions) with `messages.metadata`, plus a backfill.
--   2. Repairs the idempotent-send index so PostgREST can infer it: a plain
--      unique index on (sender_id, client_id) instead of the partial one in 007.
--   3. `user_reports.conversation_id` and the `message_reports` table.
--   4. The phone-only RPCs, implemented over the canonical `blocks` /
--      `message_deletions` / `message_reports` tables (NOT the dead
--      `user_blocks` draft).
--   5. Aligns `set_last_seen_visibility` with the web's `presence_visible`, so
--      hiding last-seen on the phone also hides it on the web.
--
-- Apply with: supabase db push
--   (or paste into the Supabase SQL editor and run once)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Message media columns
--
-- `metadata` remains the website's payload (image -> {urls:[...]},
-- voice -> {url, durationMs, peaks}); the dedicated columns are the phone's.
-- Both are kept and synchronised so each client keeps reading what it always
-- read while the other side can see the message.
-- ---------------------------------------------------------------------------
alter table public.messages add column if not exists media_url text;
alter table public.messages add column if not exists media_width integer;
alter table public.messages add column if not exists media_height integer;
alter table public.messages add column if not exists duration_ms integer;

-- Distinguishes "sender deleted for everyone" (existing `deleted_at`) from the
-- per-recipient hide recorded in `message_deletions`.
alter table public.messages add column if not exists deleted_for_everyone_at timestamptz;

-- ---------------------------------------------------------------------------
-- 1b. Bidirectional media sync
--
-- A BEFORE trigger is the only place that can rewrite NEW safely and
-- idempotently. Rules:
--   image -> metadata.urls[1]  <-> media_url
--   voice -> metadata.url      <-> media_url
--            metadata.durationMs <-> duration_ms
--
-- Existing non-empty arrays are never collapsed, so a multi-image web message
-- keeps all of its URLs when the phone later touches the row.
-- A tombstone (deleted_at / jid://deleted/) is left alone so a delete can never
-- be undone by the sync.
-- ---------------------------------------------------------------------------
create or replace function public.sync_message_media()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.metadata, '{}'::jsonb);
  urls jsonb := case when jsonb_typeof(meta -> 'urls') = 'array' then meta -> 'urls' else '[]'::jsonb end;
  voice_url text := coalesce(meta ->> 'url', '');
  voice_ms integer;
begin
  -- Never resurrect media on a deleted message.
  if new.deleted_at is not null or new.content = 'jid://deleted/' then
    return new;
  end if;

  if new.kind = 'image' then
    if jsonb_array_length(urls) = 0 then
      -- Web -> dedicated column (or the phone writing an image).
      if new.media_url is not null then
        meta := jsonb_set(meta, '{urls}', jsonb_build_array(new.media_url), true);
      end if;
    elsif new.media_url is null then
      -- Dedicated column -> web.
      new.media_url := urls ->> 0;
    end if;

  elsif new.kind = 'voice' then
    if voice_url = '' then
      if new.media_url is not null then
        meta := jsonb_set(meta, '{url}', to_jsonb(new.media_url), true);
        meta := jsonb_set(meta, '{durationMs}', to_jsonb(coalesce(new.duration_ms, 0)), true);
      end if;
    else
      if new.media_url is null then
        new.media_url := voice_url;
      end if;

      -- Tolerate a malformed duration rather than abort the write.
      if (meta ->> 'durationMs') ~ '^[0-9]+$' then
        voice_ms := (meta ->> 'durationMs')::integer;
      end if;
      new.duration_ms := coalesce(new.duration_ms, nullif(voice_ms, 0));

      -- Keep metadata.durationMs in step with the column when the column wins.
      if new.duration_ms is not null
         and coalesce((meta ->> 'durationMs'), '') <> new.duration_ms::text then
        meta := jsonb_set(meta, '{durationMs}', to_jsonb(new.duration_ms), true);
      end if;
    end if;
  end if;

  new.metadata := meta;
  return new;
end;
$$;

drop trigger if exists messages_media_sync on public.messages;
create trigger messages_media_sync
  before insert or update on public.messages
  for each row execute function public.sync_message_media();

-- Backfill existing rows. Touching each row fires the BEFORE trigger above,
-- which does the actual two-way fill. Deleted rows are skipped on purpose.
update public.messages m
   set media_url = m.media_url
 where m.deleted_at is null
   and m.kind in ('image', 'voice')
   and (
     (m.media_url is null and (
        (m.kind = 'image' and jsonb_array_length(
            case when jsonb_typeof(m.metadata -> 'urls') = 'array' then m.metadata -> 'urls' else '[]'::jsonb end
          ) > 0)
        or (m.kind = 'voice' and coalesce(m.metadata ->> 'url', '') <> '')
     ))
     or
     (coalesce(m.media_url, '') <> '' and (
        (m.kind = 'image' and jsonb_array_length(
            case when jsonb_typeof(m.metadata -> 'urls') = 'array' then m.metadata -> 'urls' else '[]'::jsonb end
          ) = 0)
        or (m.kind = 'voice' and coalesce(m.metadata ->> 'url', '') = '')
     ))
   );

-- ---------------------------------------------------------------------------
-- 2. Idempotent send
--
-- 007 created a *partial* unique index (`where client_id is not null`). PostgREST
-- implements the phone's `upsert(..., { onConflict: 'sender_id,client_id' })` as
-- `INSERT ... ON CONFLICT (sender_id, client_id)`, and that inference cannot use
-- a partial index (no matching WHERE clause is emitted). Replace it with a plain
-- unique index. Postgres treats NULLs as distinct in a unique index, so the many
-- pre-006 rows with no `client_id` remain valid.
-- ---------------------------------------------------------------------------
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

drop index if exists public.messages_sender_client_id_key;

create unique index if not exists messages_sender_client_id_key
  on public.messages (sender_id, client_id);

-- ---------------------------------------------------------------------------
-- 3. Reports
-- ---------------------------------------------------------------------------

-- A conversation-level report has to name the conversation it came from. Null
-- for profile-level reports (and for rows written before this column existed).
alter table public.user_reports
  add column if not exists conversation_id uuid
    references public.conversations (id) on delete set null;

create index if not exists user_reports_conversation_id_idx
  on public.user_reports (conversation_id)
  where conversation_id is not null;

-- "This specific message is a scam" is a different queue from "this person is a
-- scammer", so it gets its own table (matching the phone's report flow).
create table if not exists public.message_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  message_id       uuid references public.messages (id) on delete set null,
  conversation_id  uuid references public.conversations (id) on delete set null,
  reason           text not null,
  details          text check (char_length(details) <= 2000),
  status           text not null default 'pending'
                     check (status in ('pending', 'reviewing', 'resolved', 'dismissed', 'action_taken')),
  created_at       timestamptz not null default now()
);

create index if not exists message_reports_reporter_idx
  on public.message_reports (reporter_id, created_at desc);

create index if not exists message_reports_queue_idx
  on public.message_reports (status, created_at desc);

alter table public.message_reports enable row level security;

-- Insert-only for the reporter. The queue has no client read path at all;
-- moderation reads it with the service role.
drop policy if exists message_reports_insert_own on public.message_reports;
create policy message_reports_insert_own on public.message_reports
  for insert with check (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- 4. Phone-only RPCs
--
-- Every function is SECURITY DEFINER with an explicit search_path, matching the
-- rest of the schema: `conversation_participants` and `blocks` are only readable
-- by their owner under RLS, so a SECURITY INVOKER caller could not join them.
-- ---------------------------------------------------------------------------

-- 4.1 One conversation, for a cold start from a push notification.
create or replace function public.get_conversation_participant(p_conversation uuid)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  department text,
  level text,
  hall_or_area text,
  last_seen_at timestamptz,
  last_seen_visible boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.department,
    p.level,
    p.hall_or_area,
    -- Suppressed at read time, so flipping the switch is immediately respected.
    case when p.last_seen_visible then p.last_seen_at else null end,
    p.last_seen_visible
  from public.conversation_participants cp
  join public.profiles p on p.id = cp.user_id
  where cp.conversation_id = p_conversation
    and cp.user_id <> auth.uid()
  limit 1;
$$;

-- 4.2 The upgraded inbox. `get_my_conversations()` (006) is left untouched for
-- the website; this is the phone's shape, with muted_at and last-message kind.
create or replace function public.get_my_conversations_v2(p_archived boolean default null)
returns table (
  conversation_id uuid,
  other_id uuid,
  other_username text,
  other_full_name text,
  other_avatar_url text,
  other_department text,
  other_level text,
  other_hall_or_area text,
  other_last_seen_at timestamptz,
  other_last_seen_visible boolean,
  last_message text,
  last_message_kind text,
  last_message_duration_ms integer,
  last_sender_id uuid,
  last_message_at timestamptz,
  unread_count bigint,
  listing_id uuid,
  listing_title text,
  listing_price numeric,
  listing_image text,
  listing_type text,
  pinned_at timestamptz,
  archived_at timestamptz,
  muted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  with mine as (
    select
      cp.conversation_id,
      cp.pinned_at,
      cp.archived_at,
      cp.muted_at,
      other.id as other_id,
      other.username as other_username,
      other.full_name as other_full_name,
      other.avatar_url as other_avatar_url,
      other.department as other_department,
      other.level as other_level,
      other.hall_or_area as other_hall_or_area,
      case when other.last_seen_visible then other.last_seen_at else null end as other_last_seen_at,
      other.last_seen_visible as other_last_seen_visible
    from public.conversation_participants cp
    join public.conversation_participants other_cp
      on other_cp.conversation_id = cp.conversation_id
     and other_cp.user_id <> cp.user_id
    join public.profiles other on other.id = other_cp.user_id
    where cp.user_id = auth.uid()
      -- A block hides the thread from the inbox entirely.
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = other.id)
           or (b.blocker_id = other.id and b.blocked_id = auth.uid())
      )
      -- p_archived = true -> archived, false -> inbox, null -> both.
      and (
        p_archived is null
        or (p_archived and cp.archived_at is not null)
        or (not p_archived and cp.archived_at is null)
      )
  )
  select
    m.conversation_id,
    m.other_id,
    m.other_username,
    m.other_full_name,
    m.other_avatar_url,
    m.other_department,
    m.other_level,
    m.other_hall_or_area,
    m.other_last_seen_at,
    m.other_last_seen_visible,
    lm.content,
    lm.kind::text,
    lm.duration_ms,
    lm.sender_id,
    lm.created_at,
    coalesce(uc.cnt, 0),
    c.listing_id,
    coalesce(mp.title, pp.title),
    coalesce(mp.price, pp.price_per_year),
    coalesce(
      case when array_length(mp.images, 1) > 0 then mp.images[1] end,
      case when array_length(pp.images, 1) > 0 then pp.images[1] end
    ),
    c.listing_type::text,
    m.pinned_at,
    m.archived_at,
    m.muted_at
  from mine m
  join public.conversations c on c.id = m.conversation_id
  left join public.marketplace_listings mp
    on c.listing_type = 'marketplace' and mp.id = c.listing_id
  left join public.property_listings pp
    on c.listing_type = 'property' and pp.id = c.listing_id
  left join lateral (
    select msg.content, msg.kind, msg.duration_ms, msg.sender_id, msg.created_at
    from public.messages msg
    where msg.conversation_id = m.conversation_id
      and not exists (
        select 1 from public.message_deletions d
        where d.message_id = msg.id and d.user_id = auth.uid()
      )
    order by msg.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*) as cnt
    from public.messages msg
    where msg.conversation_id = m.conversation_id
      and msg.sender_id <> auth.uid()
      and msg.read_at is null
      and not exists (
        select 1 from public.message_deletions d
        where d.message_id = msg.id and d.user_id = auth.uid()
      )
  ) uc on true
  order by m.pinned_at desc nulls last, coalesce(lm.created_at, 'epoch'::timestamptz) desc;
end;
$$;

-- 4.3 The phone's tab-bar badge, computed on the same `read_at` cursor the
-- phone's inbox uses, so the two numbers agree.
create or replace function public.get_unread_message_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.messages msg
  join public.conversation_participants cp
    on cp.conversation_id = msg.conversation_id and cp.user_id = auth.uid()
  where msg.sender_id <> auth.uid()
    and msg.read_at is null
    and msg.deleted_at is null
    and cp.archived_at is null
    and not exists (
      select 1 from public.message_deletions d
      where d.message_id = msg.id and d.user_id = auth.uid()
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = msg.sender_id)
         or (b.blocker_id = msg.sender_id and b.blocked_id = auth.uid())
    );
$$;

-- 4.4 Server-side search within one thread.
create or replace function public.search_conversation_messages(
  p_conversation uuid,
  p_query text,
  p_limit integer default 50
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  content text,
  kind text,
  created_at timestamptz,
  read_at timestamptz,
  deleted_at timestamptz,
  reply_to_id uuid,
  reply_preview text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  needle text := btrim(p_query);
begin
  if needle is null or length(needle) < 2 then
    return;
  end if;

  return query
  select
    m.id, m.conversation_id, m.sender_id, m.content, m.kind::text,
    m.created_at, m.read_at, m.deleted_at, m.reply_to_id, m.reply_preview
  from public.messages m
  where m.conversation_id = p_conversation
    and m.deleted_at is null
    and not exists (
      select 1 from public.message_deletions d
      where d.message_id = m.id and d.user_id = auth.uid()
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = m.sender_id)
         or (b.blocker_id = m.sender_id and b.blocked_id = auth.uid())
    )
    and m.content ilike '%' || replace(replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_'), ' ', '%') || '%'
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- 4.5 Delete for me / delete for everyone.
--
-- `message_deletions` in 006 has a NOT NULL `conversation_id`; the phone's RPC
-- must derive it from the message instead of inserting only (message_id, user_id).
create or replace function public.delete_message_for_me(p_message uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  conv uuid;
begin
  select m.conversation_id into conv
  from public.messages m
  where m.id = p_message
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = m.conversation_id and cp.user_id = auth.uid()
    );

  if conv is null then
    return false;
  end if;

  insert into public.message_deletions (message_id, user_id, conversation_id)
  values (p_message, auth.uid(), conv)
  on conflict (message_id, user_id) do nothing;

  return true;
end;
$$;

create or replace function public.delete_message_for_everyone(p_message uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  is_sender boolean;
  age_minutes numeric;
begin
  select (m.sender_id = auth.uid()),
         extract(epoch from (now() - m.created_at)) / 60
    into is_sender, age_minutes
  from public.messages m
  where m.id = p_message;

  -- Only the sender, and only within an hour.
  if not is_sender or age_minutes > 60 then
    return false;
  end if;

  update public.messages
     set content = 'jid://deleted/',
         deleted_at = now(),
         deleted_for_everyone_at = now(),
         media_url = null,
         reply_preview = null
   where id = p_message;

  return true;
end;
$$;

-- 4.6 Blocking. The canonical table is `blocks` (006), not the phone draft's
-- `user_blocks`. `block_user` / `unblock_user` already exist in 006 with
-- `(other_user, p_reason)` / `(other_user)`; the phone code is aligned to those.
create or replace function public.list_blocked_users()
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.full_name, p.avatar_url, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

create or replace function public.is_blocked_between(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = p_other)
       or (blocker_id = p_other and blocked_id = auth.uid())
  );
$$;

-- 4.7 The phone's only entry point into message moderation. Non-default
-- parameters come first; PostgREST resolves the call by name.
create or replace function public.submit_message_report(
  p_reported_user uuid,
  p_reason text,
  p_message uuid default null,
  p_conversation uuid default null,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.message_reports (
    reporter_id, reported_user_id, message_id, conversation_id, reason, details
  )
  values (auth.uid(), p_reported_user, p_message, p_conversation, p_reason, p_details)
  returning id into new_id;

  return new_id;
end;
$$;

-- 4.8 Presence privacy. The web keeps `presence_visible` and
-- `last_seen_visible` in step (see `setPresenceVisible` in the web data layer),
-- so toggling last-seen from the phone must do the same — otherwise the web's
-- `get_my_conversations()` would still expose the timestamp.
create or replace function public.set_last_seen_visibility(p_visible boolean)
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
     set last_seen_visible = coalesce(p_visible, true),
         presence_visible   = coalesce(p_visible, true),
         -- Opting out should not leave an exact timestamp behind.
         last_seen_at       = case when coalesce(p_visible, true) then last_seen_at else null end
   where id = auth.uid();
end;
$$;

create or replace function public.get_my_presence_settings()
returns table (last_seen_visible boolean)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.last_seen_visible from public.profiles p where p.id = auth.uid()),
    true
  );
$$;

-- 4.9 Inbox search. This replaces the narrower 007 definition (same argument
-- types, so it is dropped first) with the phone's return shape, including the
-- matched message text for highlighting.
drop function if exists public.search_my_conversations(text, integer);

create or replace function public.search_my_conversations(
  p_query text,
  p_limit integer default 25
)
returns table (
  conversation_id uuid,
  participant_id uuid,
  participant_name text,
  participant_username text,
  participant_avatar_url text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint,
  pinned_at timestamptz,
  archived_at timestamptz,
  matched_message_id uuid,
  matched_message_kind text,
  matched_sender_id uuid,
  matched_message_content text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  needle text := btrim(p_query);
begin
  if needle is null or length(needle) < 2 then
    return;
  end if;

  return query
  with mine as (
    select
      cp.conversation_id,
      cp.pinned_at,
      cp.archived_at,
      other.id as other_id,
      other.full_name as other_name,
      other.username as other_username,
      other.avatar_url as other_avatar
    from public.conversation_participants cp
    join public.conversation_participants other_cp
      on other_cp.conversation_id = cp.conversation_id
     and other_cp.user_id <> cp.user_id
    join public.profiles other on other.id = other_cp.user_id
    where cp.user_id = auth.uid()
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = other.id)
           or (b.blocker_id = other.id and b.blocked_id = auth.uid())
      )
  )
  select
    m.conversation_id,
    m.other_id,
    m.other_name,
    m.other_username,
    m.other_avatar,
    lm.content,
    lm.created_at,
    coalesce(uc.cnt, 0),
    m.pinned_at,
    m.archived_at,
    hit.id,
    hit.kind::text,
    hit.sender_id,
    hit.content
  from mine m
  left join lateral (
    select msg.content, msg.created_at
    from public.messages msg
    where msg.conversation_id = m.conversation_id and msg.deleted_at is null
    order by msg.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*) as cnt
    from public.messages msg
    where msg.conversation_id = m.conversation_id
      and msg.sender_id <> auth.uid()
      and msg.read_at is null
  ) uc on true
  left join lateral (
    select msg.id, msg.kind, msg.sender_id, msg.content
    from public.messages msg
    where msg.conversation_id = m.conversation_id
      and msg.deleted_at is null
      and msg.kind = 'text'
      and msg.content ilike '%' || replace(replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_'), ' ', '%') || '%'
    order by msg.created_at desc
    limit 1
  ) hit on true
  where
    m.other_name ilike '%' || needle || '%'
    or m.other_username ilike '%' || needle || '%'
    or hit.id is not null
  order by m.pinned_at desc nulls last, lm.created_at desc nulls last
  limit least(greatest(p_limit, 1), 100);
end;
$$;

comment on function public.search_my_conversations(text, integer) is
  'Searches the signed-in user''s conversations by participant name, username or message text, '
  'returning one row per conversation with the newest matching message''s content. Archived threads included.';

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.get_conversation_participant(uuid) from public, anon;
grant execute on function public.get_conversation_participant(uuid) to authenticated;

revoke all on function public.get_my_conversations_v2(boolean) from public, anon;
grant execute on function public.get_my_conversations_v2(boolean) to authenticated;

revoke all on function public.search_conversation_messages(uuid, text, integer) from public, anon;
grant execute on function public.search_conversation_messages(uuid, text, integer) to authenticated;

revoke all on function public.delete_message_for_me(uuid) from public, anon;
grant execute on function public.delete_message_for_me(uuid) to authenticated;

revoke all on function public.delete_message_for_everyone(uuid) from public, anon;
grant execute on function public.delete_message_for_everyone(uuid) to authenticated;

revoke all on function public.list_blocked_users() from public, anon;
grant execute on function public.list_blocked_users() to authenticated;

revoke all on function public.is_blocked_between(uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid) to authenticated;

revoke all on function public.submit_message_report(uuid, text, uuid, uuid, text) from public, anon;
grant execute on function public.submit_message_report(uuid, text, uuid, uuid, text) to authenticated;

revoke all on function public.set_last_seen_visibility(boolean) from public, anon;
grant execute on function public.set_last_seen_visibility(boolean) to authenticated;

revoke all on function public.get_my_presence_settings() from public, anon;
grant execute on function public.get_my_presence_settings() to authenticated;

revoke all on function public.search_my_conversations(text, integer) from public, anon;
grant execute on function public.search_my_conversations(text, integer) to authenticated;

revoke all on function public.get_unread_message_count() from public, anon;
grant execute on function public.get_unread_message_count() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Realtime
--
-- 006/007 already published `messages`, `conversation_participants` and
-- `blocks`. Re-asserted here so this migration is self-sufficient on a database
-- where the phone's reads depend on DELETE events.
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_participants'
    ) then
      alter publication supabase_realtime add table public.conversation_participants;
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'blocks'
    ) then
      alter publication supabase_realtime add table public.blocks;
    end if;
  end if;
end$$;

-- ===========================================================================
-- VERIFY
--   select public.get_unread_message_count();
--   select * from public.get_my_conversations_v2(null) limit 5;
--   select * from public.list_blocked_users();
--   -- round-trip a media row written by the web (metadata) and by the phone
--   -- (media_url): both columns should be populated.
--   select id, kind, media_url, duration_ms, metadata
--     from public.messages
--    where kind in ('image', 'voice')
--    order by created_at desc limit 5;
-- ===========================================================================
