-- ===========================================================================
-- 008 — Let attachment messages carry empty content
--
-- `messages.content` was created with an inline check
-- `char_length(content) between 1 and 4000`. When image/voice messages were
-- introduced in 006 their payload moved into `messages.metadata`, which leaves
-- `content` empty for an attachment (`src/components/messages/MessagingView.tsx`
-- sends `content: ''` plus `kind` and `metadata`). The old lower bound rejects
-- that row with SQLSTATE 23514, which PostgREST surfaces as HTTP 400 — so every
-- photo and voice note failed to send with "[messages] send failed" even though
-- the columns already existed.
--
-- Replace the flat lower bound with a kind-aware one: a text message still needs
-- at least one character, while image/voice rows may be empty because their body
-- lives in `metadata`. The 4000 upper bound is unchanged.
--
-- Idempotent: safe to run more than once.
-- Apply with: supabase db push
-- ===========================================================================

alter table public.messages
  drop constraint if exists messages_content_check;

alter table public.messages
  add constraint messages_content_check
  check (
    (kind = 'text' and char_length(content) between 1 and 4000)
    or (kind <> 'text' and char_length(content) <= 4000)
  );
