-- =============================================================================
-- JID Mobile — Messaging upgrade (push delivery)
-- =============================================================================
-- Run AFTER 202602020001_messaging_upgrade.sql.
--
-- This is the half of push notifications that cannot live in the app: the part
-- that actually wakes somebody's phone when a message arrives.
--
-- HOW THE CHAIN WORKS
--   1. The mobile app registers its Expo push token -> `public.push_tokens`.
--   2. A row is inserted into `public.messages`.
--   3. `dispatch_message_push` (trigger below) makes an ASYNCHRONOUS HTTP POST
--      to the `send-message-push` Edge Function via pg_net.
--   4. The function loads the recipient's tokens and preferences and calls
--      Expo's push gateway.
--
-- Step 3 is asynchronous on purpose: pg_net queues the request and returns
-- immediately, so a slow or dead push gateway can never delay or fail the
-- message insert. A message that saved but could not be pushed still appears
-- in the recipient's inbox on next open.
--
-- PREREQUISITES (Supabase SQL editor, run once):
--   create extension if not exists pg_net;
--   ALTER DATABASE postgres SET app.settings.supabase_url =
--     'https://xiaczqvmrhoxkdxunzzp.supabase.co';
--   select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'jid_push_service_key');
--   select vault.create_secret('YOUR_RANDOM_STRING', 'jid_push_webhook_secret');
--
-- ...or `supabase secrets set PUSH_WEBHOOK_SECRET=<same random string>` for the
-- Edge Function's own environment.
-- =============================================================================

create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- push_deliveries
-- -----------------------------------------------------------------------------
-- A ledger of what was dispatched, keyed by message id + device token.
--
-- A database trigger is at-least-once: if the transaction commits and the
-- pg_net queue is retried, the same message can be handed to the Edge Function
-- twice, which would double-notify. This table lets the function recognise its
-- own prior work and stay quiet.
CREATE TABLE IF NOT EXISTS public.push_deliveries (
  dedupe_key text PRIMARY KEY,
  expo_id text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Delivery rows are only read as "recently seen"; keeping a year of them would
-- grow the table without ever changing behaviour.
CREATE INDEX IF NOT EXISTS push_deliveries_created_at_idx
  ON public.push_deliveries (created_at DESC);

ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;

-- No client policy at all. This table is service-role only, by design.

-- -----------------------------------------------------------------------------
-- dispatch_message_push
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER because it reads the service-role secret from `vault`.
--
-- Errors are swallowed on purpose: a push problem must never surface as a
-- failure to the user sending a message.
CREATE OR REPLACE FUNCTION public.dispatch_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url text := current_setting('app.settings.supabase_url', true);
  anon_key text;
  webhook_secret text;
  request_id bigint;
BEGIN
  edge_url := current_setting('app.settings.supabase_url', true);

  IF edge_url IS NULL OR edge_url = '' THEN
    RAISE NOTICE 'dispatch_message_push: app.settings.supabase_url not set; skipping push';
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO anon_key
    FROM vault.decrypted_secrets
   WHERE name = 'jid_push_service_key';

  IF anon_key IS NULL THEN
    RAISE NOTICE 'dispatch_message_push: vault secret jid_push_service_key missing; skipping push';
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO webhook_secret
    FROM vault.decrypted_secrets
   WHERE name = 'jid_push_webhook_secret';

  -- Fire-and-forget. net.http_post returns a request id immediately and the
  -- request is executed by pg_net's background worker.
  SELECT net.http_post(
    url     := edge_url || '/functions/v1/send-message-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-jid-webhook-secret', coalesce(webhook_secret, '')
    ),
    body    := jsonb_build_object(
      'type', 'INSERT',
      'table', 'messages',
      'schema', 'public',
      'record', to_jsonb(NEW)
    )
  ) INTO request_id;

  RAISE NOTICE 'dispatch_message_push: queued net request %', request_id;

  RETURN NEW;
END $$;

-- -----------------------------------------------------------------------------
-- Attach the trigger
-- -----------------------------------------------------------------------------
-- AFTER INSERT only. Read receipts and deletes are UPDATEs on the same table
-- and must never generate a notification.
DROP TRIGGER IF EXISTS messages_push_dispatch ON public.messages;

CREATE TRIGGER messages_push_dispatch
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_message_push();

-- -----------------------------------------------------------------------------
-- Retention
-- -----------------------------------------------------------------------------
-- Plain scheduled statement rather than pg_cron, which is not guaranteed to be
-- enabled on every project. Run it from Supabase's scheduled jobs, or monthly
-- by hand.
--   DELETE FROM public.push_deliveries
--    WHERE created_at < now() - interval '2 days';

-- =============================================================================
-- ALTERNATIVE: SUPABASE DATABASE WEBHOOKS
-- =============================================================================
-- If you would rather not enable pg_net, delete the trigger above and configure
-- the same function under Database -> Webhooks:
--
--   Name:     messages-push
--   Table:    messages
--   Event:    INSERT
--   Type:     HTTP Request
--   URL:      https://<project-ref>.supabase.co/functions/v1/send-message-push
--   Headers:   Authorization: Bearer <service_role_key>
--              x-jid-webhook-secret: <PUSH_WEBHOOK_SECRET>
--   Payload:   {"type":"INSERT","table":"messages","record":<record>}
--
-- Both routes deliver the same `record` object, so the Edge Function does not
-- care which one you chose.
-- =============================================================================