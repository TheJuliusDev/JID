-- ---------------------------------------------------------------------------
-- 005 · user_report_conversation_context
--
-- Lets a conversation-level report say which conversation it came from.
--
-- Why
--
-- The messaging UI offers two report targets: a single message, and the whole
-- conversation. Messages already had somewhere to go — `submit_message_report`
-- writes `message_reports`, which carries both `message_id` and
-- `conversation_id`. A conversation report had nowhere: it fell back to
-- `user_reports`, which records only *who* was reported. So "this whole
-- conversation is a scam" reached the moderation queue stripped of the one piece
-- of context that makes it actionable — a moderator saw a user report and no
-- thread to read.
--
-- Additive and backward compatible: a nullable column with no default. Every
-- existing row, and every insert from the website and from `DataProvider` on the
-- profile screen, keeps working unchanged. Those callers simply omit the column
-- and get `null`, which is the correct value for a report that is not about a
-- conversation.
--
-- `on delete set null` rather than `cascade`: a report must survive the
-- conversation it was raised against. If someone deletes the thread, the fact
-- that it was reported is exactly the thing worth keeping.
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_reports
  ADD COLUMN IF NOT EXISTS conversation_id uuid
    REFERENCES public.conversations(id) ON DELETE SET NULL;

-- Moderation triage reads reports newest-first and filters by status, and will
-- filter by conversation when following one up. Indexed for the follow-up.
CREATE INDEX IF NOT EXISTS user_reports_conversation_id_idx
  ON public.user_reports (conversation_id)
  WHERE conversation_id IS NOT NULL;

COMMENT ON COLUMN public.user_reports.conversation_id IS
  'The conversation a conversation-level report was raised from. Null for '
  'profile-level reports, and for reports raised before this column existed.';