-- ---------------------------------------------------------------------------
-- 004 · messaging_search_snippet
--
-- Adds the matched message's text to `search_my_conversations`.
--
-- Why
--
-- The function already found the matching message and returned its id and kind,
-- but not its content — so a hit could only ever be rendered as "a text message
-- matched here". Opening five results to find the one line that actually matched
-- is not search, it is guessing. Returning the snippet is what lets the inbox show
-- the matching sentence with the term highlighted.
--
-- Only the newest match per conversation is returned, matching the existing
-- behaviour of `last_message`: one row per conversation, ordered by the newest
-- matching message. Returning every match would change the row shape the client
-- already paginates and would let one busy conversation crowd out others.
--
-- Additive and backward compatible: the new column is appended to the RETURNS
-- TABLE, so every existing caller that names columns positionally or ignores the
-- extra one keeps working. The website does not call this function at all — it is
-- mobile-only — but the replacement is written to behave identically otherwise.
-- ---------------------------------------------------------------------------

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
  matched_sender_id uuid,
  -- Appended, not inserted: see the note above on positional compatibility.
  matched_message_content text
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
    hit.sender_id,
    hit.content
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
    SELECT msg.id, msg.kind, msg.sender_id, msg.content
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

GRANT EXECUTE ON FUNCTION public.search_my_conversations(text, integer) TO authenticated;

COMMENT ON FUNCTION public.search_my_conversations(text, integer) IS
  'Searches the signed-in user''s conversations by participant name, username, or message text. '
  'Returns one row per conversation including the newest matching message''s content so the '
  'client can show and highlight what matched. Archived conversations are included.';