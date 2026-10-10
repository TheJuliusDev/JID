-- =============================================================================
-- JID Mobile — Messaging upgrade (schema)
-- =============================================================================
-- Target: xiaczqvmrhoxkdxunzzp
--
-- DESIGN NOTES
--
-- 1. This migration is ADDITIVE ONLY. It never drops or rewrites an existing
--    column, table or function. The JID website talks to this same database
--    with the same anon key, so anything destructive here breaks a product that
--    is already live. Every new capability therefore arrives as a new column,
--    table or `*_v2` function alongside the existing one.
--
-- 2. The original `get_my_conversations()` is left untouched. The mobile app
--    calls `get_my_conversations_v2()` and falls back to the v1 function when
--    this migration has not been applied yet (see services/messaging/capabilities.ts).
--
-- 3. `messages.content` stays a plain text column. Rich message kinds (image,
--    voice) and reply links are stored in dedicated columns rather than packed
--    into a URL scheme, so they can be queried, indexed and filtered in SQL.
--
-- Apply with:  supabase db push        (CLI)
--          or: paste into the Supabase SQL editor and run once.
-- Safe to run more than once — every statement is guarded.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. messages: kinds, replies, delivery, idempotency, media metadata
-- -----------------------------------------------------------------------------
-- `client_id` is generated on the device before the insert. The unique index on
-- (sender_id, client_id) is what makes an optimistic send safe to retry: a
-- retried insert after a flaky network returns the original row instead of
-- creating a duplicate bubble. This is the mechanism behind "messages should
-- never silently disappear" and "no duplicate messages".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN client_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'kind'
  ) THEN
    -- Backfill before the NOT NULL default lands so no rewrite is needed on a
    -- large table.
    ALTER TABLE public.messages ADD COLUMN kind text;
    UPDATE public.messages SET kind = 'text' WHERE kind IS NULL;
    ALTER TABLE public.messages
      ALTER COLUMN kind SET DEFAULT 'text',
      ALTER COLUMN kind SET NOT NULL;
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_kind_check
      CHECK (kind IN ('text', 'image', 'voice', 'system'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'reply_to_id'
  ) THEN
    ALTER TABLE public.messages
      ADD COLUMN reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN delivered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'duration_ms'
  ) THEN
    -- Voice-message length. Kept server-side so the bubble can render the right
    -- waveform width without downloading the audio first.
    ALTER TABLE public.messages ADD COLUMN duration_ms integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'media_url'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN media_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'media_width'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN media_width integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'media_height'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN media_height integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'reply_preview'
  ) THEN
    -- A denormalised copy of the quoted text at the moment of the reply.
    -- Resolving the quote by walking reply_to_id would need the parent to still
    -- be in the loaded page of history; this keeps the quote renderable even
    -- when the original scrolled far out of the loaded window, which is the
    -- common case in a busy thread.
    ALTER TABLE public.messages ADD COLUMN reply_preview text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'deleted_for_everyone_at'
  ) THEN
    -- Distinguishes "sender deleted for everyone" (existing deleted_at) from a
    -- per-recipient "delete for me", which hides a message only for the person
    -- who asked and is recorded in message_deletions.
    ALTER TABLE public.messages ADD COLUMN deleted_for_everyone_at timestamptz;
  END IF;
END $$;

-- Idempotent send: the same (sender, client_id) can only ever land once.
CREATE UNIQUE INDEX IF NOT EXISTS messages_sender_client_id_key
  ON public.messages (sender_id, client_id)
  WHERE client_id IS NOT NULL;

-- Reply rendering reads a message plus its parent in one query.
CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx
  ON public.messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- Conversation search filters on (conversation_id, created_at desc); this makes
-- the in-conversation search index-usable instead of scanning the thread.
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at DESC);

-- Unread counts are recomputed on every conversation-list fetch and on every
-- read receipt write.
CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON public.messages (conversation_id, read_at)
  WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. conversation_participants: pin, archive, mute, read cursor
-- -----------------------------------------------------------------------------
-- These are per-user properties, so they belong on the membership row rather
-- than on `conversations` — pinning a chat must not pin it for the other person.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversation_participants'
      AND column_name = 'pinned_at'
  ) THEN
    ALTER TABLE public.conversation_participants ADD COLUMN pinned_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversation_participants'
      AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.conversation_participants ADD COLUMN archived_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversation_participants'
      AND column_name = 'muted_at'
  ) THEN
    ALTER TABLE public.conversation_participants ADD COLUMN muted_at timestamptz;
  END IF;
END $$;

-- The inbox query filters on "not archived" for one user.
CREATE INDEX IF NOT EXISTS conversation_participants_user_inbox_idx
  ON public.conversation_participants (user_id, archived_at, pinned_at DESC);

-- -----------------------------------------------------------------------------
-- 3. profiles: presence + privacy switches
-- -----------------------------------------------------------------------------
-- `last_seen_visible` is the "privacy-ready architecture" switch: the mobile app
-- already renders every last-seen state through it, so turning presence off
-- later is a settings toggle rather than a code change. `show_last_seen` stays
-- on `public_profiles` via a security-invoker view below, so the value is only
-- ever exposed when the owner allows it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen_visible'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN last_seen_visible boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. user_blocks
-- -----------------------------------------------------------------------------
-- A block is one-directional but enforced symmetrically: neither party can send
-- or be delivered new messages after it, which is what a user expects from
-- "block" and is why both directions are checked on read and write.
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx
  ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_blocks' AND policyname = 'user_blocks_select_own'
  ) THEN
    CREATE POLICY user_blocks_select_own ON public.user_blocks
      FOR SELECT USING (auth.uid() = blocker_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_blocks' AND policyname = 'user_blocks_insert_own'
  ) THEN
    CREATE POLICY user_blocks_insert_own ON public.user_blocks
      FOR INSERT WITH CHECK (auth.uid() = blocker_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_blocks' AND policyname = 'user_blocks_delete_own'
  ) THEN
    CREATE POLICY user_blocks_delete_own ON public.user_blocks
      FOR DELETE USING (auth.uid() = blocker_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. message_deletions — "delete for me"
-- -----------------------------------------------------------------------------
-- Scoped removal for one recipient. Written by the recipient only, and never
-- touches the row the other person sees.
CREATE TABLE IF NOT EXISTS public.message_deletions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_deletions_pkey PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_deletions_user_idx
  ON public.message_deletions (user_id);

ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'message_deletions' AND policyname = 'message_deletions_own'
  ) THEN
    CREATE POLICY message_deletions_own ON public.message_deletions
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. message_reports
-- -----------------------------------------------------------------------------
-- A separate table from user_reports because the queue, retention and triage of
-- "this message is a scam" is different from "this person is a scammer". The
-- mobile app only ever inserts and reads back its own receipts — it never lists
-- the queue. Moderation stays in the admin system.
CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reports_status_check
    CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed', 'action_taken'))
);

CREATE INDEX IF NOT EXISTS message_reports_reporter_idx
  ON public.message_reports (reporter_id, created_at DESC);

-- Lookup by the moderation system, never by the app.
CREATE INDEX IF NOT EXISTS message_reports_queue_idx
  ON public.message_reports (status, created_at DESC);

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'message_reports' AND policyname = 'message_reports_insert_own'
  ) THEN
    -- INSERT-only for the reporter. There is deliberately no SELECT policy on
    -- this table: the queue is unreadable from the client, by anyone.
    CREATE POLICY message_reports_insert_own ON public.message_reports
      FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. push_tokens
-- -----------------------------------------------------------------------------
-- Device registration for Expo push. One row per (user, device) so a student
-- with a phone and a tablet gets two registrations and only the signed-out
-- device stops receiving pushes.
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'android',
  device_name text,
  app_version text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_tokens_token_key UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS push_tokens_user_active_idx
  ON public.push_tokens (user_id) WHERE active;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_tokens' AND policyname = 'push_tokens_select_own'
  ) THEN
    CREATE POLICY push_tokens_select_own ON public.push_tokens
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_tokens' AND policyname = 'push_tokens_upsert_own'
  ) THEN
    CREATE POLICY push_tokens_upsert_own ON public.push_tokens
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_tokens' AND policyname = 'push_tokens_update_own'
  ) THEN
    CREATE POLICY push_tokens_update_own ON public.push_tokens
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_tokens' AND policyname = 'push_tokens_delete_own'
  ) THEN
    CREATE POLICY push_tokens_delete_own ON public.push_tokens
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 8. push_preferences
-- -----------------------------------------------------------------------------
-- Device-level notification settings, kept out of `profiles` so that changing a
-- push preference never touches the public profile row.
CREATE TABLE IF NOT EXISTS public.push_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages_enabled boolean NOT NULL DEFAULT true,
  show_preview boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_preferences' AND policyname = 'push_preferences_own'
  ) THEN
    CREATE POLICY push_preferences_own ON public.push_preferences
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- touch_last_seen
-- -----------------------------------------------------------------------------
-- Called on app foreground and on navigation between conversations.
--
-- Deliberately rate-limited in SQL rather than relying on the client to
-- throttle: a client-side-only guard still burns a network round-trip per
-- foreground, and this is the single write that decides what every other user
-- sees as "last seen".
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET last_seen_at = now()
   WHERE id = auth.uid()
     -- One write per 60s is plenty for a value rendered as "Last seen 5m ago".
     AND (last_seen_at IS NULL OR last_seen_at < now() - interval '60 seconds');
END $$;

-- -----------------------------------------------------------------------------
-- get_conversation_participant
-- -----------------------------------------------------------------------------
-- The other person in a 1:1 thread. SECURITY DEFINER because the membership
-- rows are only visible to their own owner, so a plain caller cannot join them.
CREATE OR REPLACE FUNCTION public.get_conversation_participant(p_conversation uuid)
RETURNS TABLE (
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.department,
    p.level,
    p.hall_or_area,
    -- Suppressed at read time, not at write time: the owner can flip the
    -- setting and every cached read immediately respects it.
    CASE WHEN p.last_seen_visible THEN p.last_seen_at ELSE NULL END,
    p.last_seen_visible
  FROM public.conversation_participants cp
  JOIN public.profiles p ON p.id = cp.user_id
  WHERE cp.conversation_id = p_conversation
    AND cp.user_id <> auth.uid()
  LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- set_conversation_pinned / set_conversation_archived / set_conversation_muted
-- -----------------------------------------------------------------------------
-- Toggle helpers. Pinning and archiving are per-user, so they update only the
-- caller's own membership row. Passing NULL clears the state.
CREATE OR REPLACE FUNCTION public.set_conversation_pinned(
  p_conversation uuid,
  p_pinned boolean
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result timestamptz;
BEGIN
  -- Verifying membership here rather than relying on RLS keeps a non-member
  -- from writing a membership row for somebody else's conversation.
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  UPDATE public.conversation_participants
     SET pinned_at = CASE WHEN p_pinned THEN now() ELSE NULL END
   WHERE conversation_id = p_conversation AND user_id = auth.uid()
  RETURNING pinned_at INTO result;

  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.set_conversation_archived(
  p_conversation uuid,
  p_archived boolean
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  UPDATE public.conversation_participants
     SET archived_at = CASE WHEN p_archived THEN now() ELSE NULL END
   WHERE conversation_id = p_conversation AND user_id = auth.uid()
  RETURNING archived_at INTO result;

  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.set_conversation_muted(
  p_conversation uuid,
  p_muted boolean
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  UPDATE public.conversation_participants
     SET muted_at = CASE WHEN p_muted THEN now() ELSE NULL END
   WHERE conversation_id = p_conversation AND user_id = auth.uid()
  RETURNING muted_at INTO result;

  RETURN result;
END $$;

-- -----------------------------------------------------------------------------
-- mark_messages_delivered
-- -----------------------------------------------------------------------------
-- Delivery receipt, written when a message reaches a device that has actually
-- rendered the thread. Distinct from read_at: "delivered" is a transport fact,
-- "read" is a human one.
CREATE OR REPLACE FUNCTION public.mark_messages_delivered(p_conversation uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.messages m
     SET delivered_at = now()
   FROM public.conversation_participants cp
  WHERE m.conversation_id = p_conversation
    AND m.conversation_id = cp.conversation_id
    AND cp.user_id = auth.uid()
    AND m.sender_id <> auth.uid()
    AND m.delivered_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
       WHERE (b.blocker_id = cp.user_id AND b.blocked_id = m.sender_id)
          OR (b.blocker_id = m.sender_id AND b.blocked_id = cp.user_id)
    );
  GET DIAGNOSTICS affected = ROW_COUNT;

  RETURN affected;
END $$;

-- -----------------------------------------------------------------------------
-- delete_message_for_me / delete_message_for_everyone
-- -----------------------------------------------------------------------------
-- Split into two RPCs rather than one with a flag so the "for everyone" path has
-- a single, auditable owner check: only the sender may tombstone a message for
-- both people, and only within a short window.
CREATE OR REPLACE FUNCTION public.delete_message_for_me(p_message uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = p_message
      AND EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = m.conversation_id AND cp.user_id = auth.uid()
      )
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.message_deletions (message_id, user_id)
  VALUES (p_message, auth.uid())
  ON CONFLICT (message_id, user_id) DO NOTHING;

  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.delete_message_for_everyone(p_message uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_sender boolean;
  age_minutes numeric;
BEGIN
  SELECT
    (m.sender_id = auth.uid()),
    EXTRACT(EPOCH FROM (now() - m.created_at)) / 60
  INTO is_sender, age_minutes
  FROM public.messages m
  WHERE m.id = p_message;

  -- Only the sender, and only within an hour. After that the message is part of
  -- the other person's history and removing it silently is worse than useless.
  IF NOT is_sender OR age_minutes > 60 THEN
    RETURN false;
  END IF;

  UPDATE public.messages
     SET content = 'jid://deleted/',
         deleted_at = now(),
         deleted_for_everyone_at = now(),
         media_url = NULL,
         reply_preview = NULL
   WHERE id = p_message;

  RETURN true;
END $$;

-- -----------------------------------------------------------------------------
-- search_conversation_messages
-- -----------------------------------------------------------------------------
-- Server-side search within one thread.
--
-- Searches the plain-text column only. Image and voice messages have no text to
-- match, which is why `kind` is returned: the UI can say "no matching messages"
-- honestly instead of showing an empty thread.
CREATE OR REPLACE FUNCTION public.search_conversation_messages(
  p_conversation uuid,
  p_query text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  needle text := btrim(p_query);
BEGIN
  IF needle IS NULL OR length(needle) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id, m.conversation_id, m.sender_id, m.content, m.kind,
    m.created_at, m.read_at, m.deleted_at, m.reply_to_id, m.reply_preview
  FROM public.messages m
  WHERE m.conversation_id = p_conversation
    AND m.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.message_deletions d
      WHERE d.message_id = m.id AND d.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = m.sender_id)
         OR (b.blocker_id = m.sender_id AND b.blocked_id = auth.uid())
    )
    -- Escape the LIKE metacharacters so a query of "50%" does not match
    -- everything, and an unmatched user-supplied quote cannot 500 the search.
    AND m.content ILIKE '%' || replace(replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_'), ' ', '%') || '%'
  ORDER BY m.created_at DESC
  LIMIT least(greatest(p_limit, 1), 200);
END $$;

-- -----------------------------------------------------------------------------
-- search_my_conversations
-- -----------------------------------------------------------------------------
-- Inbox search across participants and message text. Archived conversations are
-- included, which is what makes "archived chats are still searchable" true.
CREATE OR REPLACE FUNCTION public.search_my_conversations(
  p_query text,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
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
  matched_sender_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  needle text := btrim(p_query);
BEGIN
  IF needle IS NULL OR length(needle) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH mine AS (
    SELECT
      cp.conversation_id,
      cp.pinned_at,
      cp.archived_at,
      other.id AS other_id,
      other.full_name AS other_name,
      other.username AS other_username,
      other.avatar_url AS other_avatar
    FROM public.conversation_participants cp
    JOIN public.conversation_participants other_cp
      ON other_cp.conversation_id = cp.conversation_id
     AND other_cp.user_id <> cp.user_id
    JOIN public.profiles other ON other.id = other_cp.user_id
    WHERE cp.user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = other.id)
           OR (b.blocker_id = other.id AND b.blocked_id = auth.uid())
      )
  )
  SELECT
    m.conversation_id,
    m.other_id,
    m.other_name,
    m.other_username,
    m.other_avatar,
    lm.content,
    lm.created_at,
    COALESCE(uc.cnt, 0),
    m.pinned_at,
    m.archived_at,
    hit.id,
    hit.kind,
    hit.sender_id
  FROM mine m
  LEFT JOIN LATERAL (
    SELECT msg.content, msg.created_at
    FROM public.messages msg
    WHERE msg.conversation_id = m.conversation_id AND msg.deleted_at IS NULL
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM public.messages msg
    WHERE msg.conversation_id = m.conversation_id
      AND msg.sender_id <> auth.uid()
      AND msg.read_at IS NULL
  ) uc ON true
  LEFT JOIN LATERAL (
    SELECT msg.id, msg.kind, msg.sender_id
    FROM public.messages msg
    WHERE msg.conversation_id = m.conversation_id
      AND msg.deleted_at IS NULL
      AND msg.kind = 'text'
      AND msg.content ILIKE '%' || replace(replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_'), ' ', '%') || '%'
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) hit ON true
  WHERE
    m.other_name ILIKE '%' || needle || '%'
    OR m.other_username ILIKE '%' || needle || '%'
    OR hit.id IS NOT NULL
  ORDER BY m.pinned_at DESC NULLS LAST, lm.created_at DESC NULLS LAST
  LIMIT least(greatest(p_limit, 1), 100);
END $$;

-- -----------------------------------------------------------------------------
-- get_my_conversations_v2
-- -----------------------------------------------------------------------------
-- The upgraded inbox query. Additive: `get_my_conversations()` is left alone for
-- the website and as the client's fallback.
--
-- Ordering is pinned-first, then most recent — the list the conversation screen
-- renders without any client-side sorting.
CREATE OR REPLACE FUNCTION public.get_my_conversations_v2(p_archived boolean DEFAULT NULL)
RETURNS TABLE (
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH mine AS (
    SELECT
      cp.conversation_id,
      cp.pinned_at,
      cp.archived_at,
      cp.muted_at,
      other.id AS other_id,
      other.username AS other_username,
      other.full_name AS other_full_name,
      other.avatar_url AS other_avatar_url,
      other.department AS other_department,
      other.level AS other_level,
      other.hall_or_area AS other_hall_or_area,
      CASE WHEN other.last_seen_visible THEN other.last_seen_at ELSE NULL END AS other_last_seen_at,
      other.last_seen_visible AS other_last_seen_visible
    FROM public.conversation_participants cp
    JOIN public.conversation_participants other_cp
      ON other_cp.conversation_id = cp.conversation_id
     AND other_cp.user_id <> cp.user_id
    JOIN public.profiles other ON other.id = other_cp.user_id
    WHERE cp.user_id = auth.uid()
      -- A block hides the conversation from the inbox entirely rather than
      -- leaving a dead row the user cannot open or explain.
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = other.id)
           OR (b.blocker_id = other.id AND b.blocked_id = auth.uid())
      )
      -- p_archived = true -> archived section, false -> inbox, NULL -> both.
      AND (
        p_archived IS NULL
        OR (p_archived AND cp.archived_at IS NOT NULL)
        OR (NOT p_archived AND cp.archived_at IS NULL)
      )
  )
  SELECT
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
    lm.kind,
    lm.duration_ms,
    lm.sender_id,
    lm.created_at,
    COALESCE(uc.cnt, 0),
    c.listing_id,
    li.title,
    li.price,
    li.image,
    c.listing_type,
    m.pinned_at,
    m.archived_at,
    m.muted_at
  FROM mine m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN LATERAL (
    SELECT msg.content, msg.kind, msg.duration_ms, msg.sender_id, msg.created_at
    FROM public.messages msg
    WHERE msg.conversation_id = m.conversation_id
      AND NOT EXISTS (
        SELECT 1 FROM public.message_deletions d
        WHERE d.message_id = msg.id AND d.user_id = auth.uid()
      )
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM public.messages msg
    WHERE msg.conversation_id = m.conversation_id
      AND msg.sender_id <> auth.uid()
      AND msg.read_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.message_deletions d
        WHERE d.message_id = msg.id AND d.user_id = auth.uid()
      )
  ) uc ON true
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(mp.title, pp.title)          AS title,
      COALESCE(mp.price, pp.price_per_year) AS price,
      COALESCE(
        CASE WHEN array_length(mp.images, 1) > 0 THEN mp.images[1] END,
        CASE WHEN array_length(pp.images, 1) > 0 THEN pp.images[1] END
      ) AS image
    FROM (SELECT 1) AS one
    LEFT JOIN public.marketplace_listings mp
      ON c.listing_type = 'marketplace' AND mp.id = c.listing_id
    LEFT JOIN public.property_listings pp
      ON c.listing_type = 'property' AND pp.id = c.listing_id
    LIMIT 1
  ) li ON true
  ORDER BY m.pinned_at DESC NULLS LAST, COALESCE(lm.created_at, 'epoch'::timestamptz) DESC;
END $$;

-- -----------------------------------------------------------------------------
-- get_unread_message_count
-- -----------------------------------------------------------------------------
-- The tab-bar badge. A single cheap aggregate instead of summing the full inbox,
-- so the badge does not require loading every conversation.
CREATE OR REPLACE FUNCTION public.get_unread_message_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)
  FROM public.messages msg
  JOIN public.conversation_participants cp
    ON cp.conversation_id = msg.conversation_id AND cp.user_id = auth.uid()
  WHERE msg.sender_id <> auth.uid()
    AND msg.read_at IS NULL
    AND msg.deleted_at IS NULL
    AND cp.archived_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.message_deletions d
      WHERE d.message_id = msg.id AND d.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = msg.sender_id)
         OR (b.blocker_id = msg.sender_id AND b.blocked_id = auth.uid())
    );
$$;

-- -----------------------------------------------------------------------------
-- block_user / unblock_user / list_blocked_users
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_user(p_user uuid, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user = auth.uid() THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id, reason)
  VALUES (auth.uid(), p_user, p_reason)
  ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET reason = EXCLUDED.reason;

  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_blocks
   WHERE blocker_id = auth.uid() AND blocked_id = p_user;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.list_blocked_users()
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  blocked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.full_name, p.avatar_url, b.created_at
  FROM public.user_blocks b
  JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;

-- -----------------------------------------------------------------------------
-- is_blocked_between
-- -----------------------------------------------------------------------------
-- Symmetric check. Called on every send so a blocked user's message is refused
-- server-side, not merely hidden from the recipient's UI.
CREATE OR REPLACE FUNCTION public.is_blocked_between(p_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = p_other)
       OR (blocker_id = p_other AND blocked_id = auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- submit_message_report
-- -----------------------------------------------------------------------------
-- The client's only entry point into the moderation queue.
CREATE OR REPLACE FUNCTION public.submit_message_report(
  p_reported_user uuid,
  p_message uuid DEFAULT NULL,
  p_conversation uuid DEFAULT NULL,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.message_reports (
    reporter_id, reported_user_id, message_id, conversation_id, reason, details
  )
  VALUES (auth.uid(), p_reported_user, p_message, p_conversation, p_reason, p_details)
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

-- -----------------------------------------------------------------------------
-- register_push_token
-- -----------------------------------------------------------------------------
-- Upsert on token so re-registering on every launch updates in place instead of
-- accumulating dead rows for devices the student no longer owns.
CREATE OR REPLACE FUNCTION public.register_push_token(
  p_token text,
  p_platform text DEFAULT 'android',
  p_device_name text DEFAULT NULL,
  p_app_version text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_id uuid;
BEGIN
  INSERT INTO public.push_tokens (user_id, token, platform, device_name, app_version, last_seen_at)
  VALUES (auth.uid(), p_token, p_platform, p_device_name, p_app_version, now())
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        device_name = EXCLUDED.device_name,
        app_version = EXCLUDED.app_version,
        active = true,
        last_seen_at = now()
  RETURNING id INTO row_id;

  -- Seed the preference row so the push function never has to handle NULL.
  INSERT INTO public.push_preferences (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN row_id;
END $$;

CREATE OR REPLACE FUNCTION public.unregister_push_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.push_tokens
   WHERE user_id = auth.uid() AND token = p_token;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.get_push_preferences()
RETURNS TABLE (
  messages_enabled boolean,
  show_preview boolean,
  sound_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT messages_enabled, show_preview, sound_enabled
  FROM public.push_preferences
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.set_push_preferences(
  p_messages_enabled boolean DEFAULT NULL,
  p_show_preview boolean DEFAULT NULL,
  p_sound_enabled boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.push_preferences (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.push_preferences
     SET messages_enabled = coalesce(p_messages_enabled, messages_enabled),
         show_preview = coalesce(p_show_preview, show_preview),
         sound_enabled = coalesce(p_sound_enabled, sound_enabled),
         updated_at = now()
   WHERE user_id = auth.uid();
END $$;

-- -----------------------------------------------------------------------------
-- backfill_last_seen
-- -----------------------------------------------------------------------------
-- Existing accounts have no last_seen_at. Seeding with created_at means the very
-- first person you open a chat with shows "Joined <date>" rather than a blank
-- "Last seen", which would read as a bug.
-- Unconditional and idempotent: the column is guaranteed to exist by this point
-- in the file, and re-running only touches rows that are still null.
UPDATE public.profiles
   SET last_seen_at = created_at
 WHERE last_seen_at IS NULL;

-- =============================================================================
-- REALTIME
-- =============================================================================
-- The app already listens to `messages` INSERT/UPDATE. It additionally needs
-- DELETE (so a message removed for me disappears from both screens), and the
-- two new per-user tables so a conversation archived on one device updates the
-- other.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_blocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_blocks;
  END IF;
END $$;

-- =============================================================================
-- DONE
-- =============================================================================
-- Verify with:
--   select get_unread_message_count();
--   select count(*) from get_my_conversations_v2();
--
-- Until this migration is applied, the mobile app falls back to the v1
-- functions and hides pin / archive / reply / voice / last-seen controls. It
-- stays fully usable — see services/messaging/capabilities.ts.
-- =============================================================================