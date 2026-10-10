-- =============================================================================
-- 202602020003 — messaging privacy controls
-- =============================================================================
--
-- Adds the one write path the mobile privacy screen needs. Everything else in
-- `202602020001_messaging_upgrade.sql` already created the `last_seen_visible`
-- column and the RLS-aware read function; this migration only closes the loop by
-- giving the owner a way to change their own value.
--
-- Why a function rather than a direct UPDATE:
-- `profiles` is editable by its owner for a long list of profile columns. A
-- dedicated function means the mobile client holds exactly one statement that can
-- write this column and none that can write anything else near it, so the privacy
-- switch cannot be reached by an unrelated, less-carefully-audited code path.
--
-- Effect of switching off, already enforced upstream:
--   * `get_conversation_participant` returns NULL for `last_seen_at` when
--     `last_seen_visible` is false, so the value never crosses the wire.
--   * Realtime presence still works. Being online in an open thread is something
--     the person is demonstrably doing, so it is not treated as private.

-- -----------------------------------------------------------------------------
-- The toggle
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_last_seen_visibility(p_visible boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- A signed-out caller has no row to update. Returning quietly rather than
  -- raising means the client can call this from a sign-out teardown path without
  -- special-casing an error it cannot act on.
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
     SET last_seen_visible = COALESCE(p_visible, true)
   WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_last_seen_visibility(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_last_seen_visibility(boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- Own-setting read, shaped like the other messaging RPCs
-- -----------------------------------------------------------------------------
-- Returns a row even when the profile has never recorded a last-seen value, so
-- the settings screen always has something to render rather than an empty result
-- it has to guess about.
CREATE OR REPLACE FUNCTION public.get_my_presence_settings()
RETURNS TABLE (last_seen_visible boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT p.last_seen_visible FROM public.profiles p WHERE p.id = auth.uid()),
    true
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_presence_settings() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_presence_settings() TO authenticated;

-- -----------------------------------------------------------------------------
-- Delivery receipts need an index
-- -----------------------------------------------------------------------------
-- `mark_messages_delivered` updates every unread outbound row in a conversation
-- on each thread open. Without this index that is a sequential scan of `messages`
-- for a write that happens every time somebody opens a chat.
CREATE INDEX IF NOT EXISTS messages_conversation_delivery_idx
  ON public.messages (conversation_id)
  WHERE delivered_at IS NULL;

-- Read receipts are written the same way, for the same reason.
CREATE INDEX IF NOT EXISTS messages_conversation_unread_idx
  ON public.messages (conversation_id)
  WHERE read_at IS NULL;