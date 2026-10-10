# JID — Supabase Backend Setup

This directory contains everything needed to stand up the **live** JID backend.
JID uses **Supabase** for auth + data and **Cloudinary** for image hosting.

> The app has **no demo/offline mode**. If the environment variables below are
> missing or invalid, the app shows a configuration screen instead of starting.
> This is intentional — production must run on the real backend.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> → **New project**.
2. Choose a name (e.g. `jid-prod`), a strong database password, and a region
   close to your users (e.g. `West EU (London)` or the nearest available to
   Nigeria).
3. Wait for the project to finish provisioning.

## 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor**.
2. Click **New query**, then paste the **entire contents** of
   [`schema.sql`](./schema.sql).
3. Click **Run**.

This creates every table, enum, index, function, trigger, view and Row Level
Security policy the app relies on, and registers the realtime tables. It is safe
to re-run if you change the file later.

> **Updating an existing project:** apply the files in
> [`migrations/`](./migrations) **in order**:
>
> | # | File | Adds |
> |---|------|------|
> | 002 | `002_admin_panel.sql` | Admin moderation tables, `user_roles`, audit log. |
> | 003 | `003_admin_email_lock.sql` | Locks admin email changes. |
> | 004 | `004_search_and_filters.sql` | Indexed full-text search + filter RPCs for the marketplace and accommodation explorers. |
> | 005 | `005_saved_searches_and_alerts.sql` | Saved searches, price-drop and new-match alerts. |
> | 006 | `006_messaging_upgrade.sql` | Presence, replies, image/voice, search, pin, archive, block, chat reports, Web Push. |
> | 007 | `007_messaging_mobile.sql` | Delivery receipts, mute, push tokens for the Expo app, and the `dispatch_message_push()` trigger. |
> | 008 | `008_message_attachments_empty_content.sql` | Allows empty `content` for image/voice rows. |
> | 009 | `009_messaging_parity.sql` | Unifies the web and mobile messaging schemas (see [Web + mobile](#web--mobile-one-database-two-clients)). |
>
> Every migration is additive and idempotent (`if not exists` / `drop … if
> exists`), so re-running one is safe.

## 3. Configure Authentication

In **Authentication → Providers → Email**:

- Enable **Email** sign-in.
- For fastest onboarding during setup you may turn **Confirm email** *off*
  (Authentication → Providers → Email → "Confirm email"). For production, leave
  it **on** so users verify their address. The app handles both cases.
- Any valid email is accepted (personal `@gmail.com` **or** `@oauife.edu.ng`).
  Do **not** add domain restrictions.

In **Authentication → URL Configuration**:

- Set **Site URL** to `https://jidapp.ng` (or your local URL during dev, e.g.
  `http://localhost:3000`).
- Add both to **Redirect URLs** so password-reset links work in every
  environment.

## 4. Get your API keys

In **Project Settings → API**, copy:

- **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
- **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

> **Never** put the `service_role` key in the client app. It bypasses RLS.

## 5. Configure Cloudinary (image uploads)

1. Create a free account at <https://cloudinary.com>.
2. Dashboard → copy your **Cloud name** → `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`.
3. **Settings → Upload → Upload presets → Add upload preset**:
   - **Signing mode:** `Unsigned` (required for direct browser uploads).
   - (Optional) set a folder like `jid`.
   - Save, then copy the **preset name** → `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.

> Only the **cloud name** and **unsigned upload preset** belong in the client.
> Never ship the Cloudinary **API secret**.

## 6. Add environment variables

Copy `.env.example` (in the project root) to `.env` and fill it in:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset
```

Then restart the dev server (`npm run dev`). The build tool also accepts the
`VITE_` prefix (e.g. `VITE_SUPABASE_URL`) as a fallback if you prefer it.

## 7. Create the first admin account (securely)

Admin rights are **never** granted from the client — they live in the
`user_roles` table and are enforced by RLS. To promote the first admin:

1. Sign up normally through the app with the email that should be the admin.
2. In Supabase → **SQL Editor**, find the user id:

   ```sql
   select id, email from auth.users where email = 'you@example.com';
   ```

3. Promote them:

   ```sql
   update public.user_roles set role = 'admin' where user_id = '<paste-uuid>';
   ```

That account can now sign in at `/admin` (the private admin area). Everyone
else — including anyone who types `/admin` manually — is rejected because the
role check runs against the database, not the browser.

## 8. (Optional) Auto-expire boosts on a schedule

Boosts already expire correctly on read (the app treats a past `boosted_until`
as not boosted), and `expire_boosts()` cleans the columns. To also run it
server-side, enable **pg_cron** (Database → Extensions) and schedule it:

```sql
select cron.schedule('expire-jid-boosts', '*/15 * * * *', $$ select public.expire_boosts(); $$);
```

## 9. Messaging — apply the migrations (required for the new chat)

The production chat — presence, replies, image/voice messages, search, pinning,
archiving, blocking, reports **and both push systems** — lands across migrations
`006` → `009`. Apply them in order. **The chat will not work until `009` has
run.**

1. SQL Editor → run
   [`migrations/006_messaging_upgrade.sql`](./migrations/006_messaging_upgrade.sql).
   It is additive and idempotent. Two things to know:

   - It **drops and recreates `get_my_conversations()`**. The function's return
     type is wider than the original, and Postgres refuses to change a return
     type in place. Nothing depends on it by name, so this is safe.
   - It **deletes existing `notifications` rows of type `message`** and stops
     `notify_new_message()` from creating new ones. Messages and the bell are
     now separate systems: a new message updates `conversations.last_message_at`
     and nothing else, and the bell shows only saved-search and moderation
     alerts. This is intended — leaving it out would double-notify every message.

2. Run [`migrations/007_messaging_mobile.sql`](./migrations/007_messaging_mobile.sql).
   Adds delivery receipts (`delivered_at`), reply previews, per-thread mute,
   the Expo push tables (`push_tokens` / `push_preferences` / `push_deliveries`)
   and the `dispatch_message_push()` trigger.

3. Run
   [`migrations/008_message_attachments_empty_content.sql`](./migrations/008_message_attachments_empty_content.sql).
   Lets an image/voice row carry an empty `content`.

4. Run [`migrations/009_messaging_parity.sql`](./migrations/009_messaging_parity.sql).
   This is the file that makes the website and the phone share **one** messaging
   schema. It:

   - adds the `media_url` / `duration_ms` / … columns the phone writes and keeps
     them bidirectionally in sync with the web's `metadata` (plus a backfill);
   - swaps the 007 *partial* idempotency index for a plain unique index
     PostgREST can infer from `onConflict: 'sender_id,client_id'`;
   - adds `message_reports` and `user_reports.conversation_id`;
   - adds the phone-only RPCs (`get_my_conversations_v2`,
     `get_conversation_participant`, `delete_message_for_me` /
     `delete_message_for_everyone`, `list_blocked_users`, `is_blocked_between`,
     `submit_message_report`, presence settings) implemented over the canonical
     `blocks` / `message_deletions` tables.

   > **`009` narrows nothing and removes nothing the website reads** — it is a
   > superset. The one function whose return shape changes is
   > `search_my_conversations`, which `009` drops and recreates wider; the
   > website never calls it.

   > **Do not apply the phone's own `mobile/supabase/migrations/2026*.sql`
   > drafts on top of `009`.** They predate the unification and conflict with
   > it. See [`mobile/supabase/README.md`](../mobile/supabase/README.md).

## 10. Web Push (website)

1. Add the push **public** key to the app's environment (see section 7 of the
   root README / `.env`):

   ```
   EXPO_PUBLIC_VAPID_PUBLIC_KEY=<your public key>
   ```

   Push is optional. Without it the app still runs; it just cannot deliver
   background notifications, and the "Enable notifications" prompt is hidden.

2. Deploy the push sender:

   ```bash
   supabase functions deploy notify-push --no-verify-jwt
   ```

3. Set the sender's secrets:

   ```bash
   npx web-push generate-vapid-keys   # run once, keep the private key safe
   supabase secrets set \
     VAPID_PUBLIC_KEY=<public key> \
     VAPID_PRIVATE_KEY=<private key> \
     VAPID_SUBJECT=mailto:you@yourdomain.com
   ```

4. Wire the sender to new messages. Dashboard → **Database → Webhooks → Add
   Webhook**:

   - Source: `messages`
   - Events: `Insert`
   - Type: `HTTP Request`
   - URL: `https://<project-ref>.supabase.co/functions/v1/notify-push`
   - Body:
     ```json
     { "record": {{ record }} }
     ```

   Without this webhook nothing calls the function and no push is ever sent.
   The webhook fires *after* the message commits, so a slow or failing push
   service can never delay or fail an actual send.

5. Allow audio recording in the Cloudinary upload preset used by the app
   (Settings → Upload → your preset → "Allowed formats" must include `webm`,
   `mp4`, `mp3` and `m4a`; audio/video resources are uploaded through the
   `video` resource type). Without this, voice notes fail at upload while image
   uploads still work.

6. (Optional) Schedule the housekeeping function so dead subscriptions and stale
   presence rows are pruned:

   ```sql
   select cron.schedule('prune-jid-push', '17 3 * * *', $$ select public.prune_push_subscriptions(); $$);
   ```

### What Web Push can and cannot do here

- **Chrome / Edge / Samsung Internet on Android** — works, including when the app
  is fully closed.
- **iOS Safari** — works only from an installed Home Screen web app (iOS 16.4+),
  and permission must be requested from a user gesture. There is no equivalent
  to an Expo push token in a browser.
- **Firefox desktop** — works.
- Notification permission is **never** requested on first launch. It is offered
  once the student opens a conversation, and declining is remembered for the
  session.

## 11. Expo Push (mobile app)

The phone registers an Expo push token through `register_push_token` (added in
`007`), and `007`'s `dispatch_message_push()` trigger calls the
`send-message-push` function over `pg_net` on every new message.

1. Deploy the sender:

   ```bash
   supabase functions deploy send-message-push --no-verify-jwt
   ```

2. (Optional) Set a shared secret so only the trigger can invoke it:

   ```bash
   supabase secrets set PUSH_WEBHOOK_SECRET=<random-string>
   ```

   `007` passes the same value in the `x-jid-webhook-secret` header. Leave it
   unset and the function accepts unauthenticated calls (fine for local work,
   not for production).

3. No VAPID keys are needed for Expo push — Expo brokers delivery to APNs/FCM.

### Web + mobile: one database, two clients

Both clients point at the **same** Supabase project and read the **same**
tables; only the delivery path differs.

| Concern | Website | Mobile app |
|---------|---------|------------|
| Media payload | `messages.metadata` (`{urls:[…]}` / `{url, durationMs, peaks}`) | `messages.media_url`, `duration_ms`, `media_width`, `media_height` |
| Blocks table | `blocks` | `blocks` (aligned in `009`) |
| Web / device push | `push_subscriptions` + `notify-push` (Web Push) | `push_tokens` + `send-message-push` (Expo) |
| Unread cursor | `conversation_participants.last_read_at` | `messages.read_at` |

`009` keeps the two media columns in sync in **both** directions, so a photo
sent from the phone shows up in the browser and vice-versa.

**Known divergences (accepted, not bugs):**

- The browser can attach **multiple** images to one message
  (`metadata.urls` is an array); the phone models a single `media_url`. A
  multi-image message sent from the web renders its **first** image on the
  phone. The full array is never lost.
- The two clients track "read" with different cursors (see the table above),
  so the badge count in the phone's tab bar and the web's unread style are
  computed independently. They agree on the messages themselves.

## 12. Verify

- Sign up → a row appears in `public.profiles` and `public.user_roles`.
- Create a listing with images → images resolve to `res.cloudinary.com` URLs
  and a row appears in `marketplace_listings` / `property_listings`.
- Open a second account, message the first → the message appears live (realtime).
  **No `notifications` row is created** — check that the bell count is unchanged.
- Send a photo and a voice note → both render in the other account.
- Close the browser, send from the second account → a system notification appears
  within a second or two, and tapping it opens that conversation.
- Block the second account, then try to send → the send fails and the thread
  disappears from the list. Unblock from Account Settings → it is reachable again.
- Type `/admin` as a normal user → access denied. As the promoted admin → the
  dashboard loads.

---

### Table overview

| Table | Purpose |
|-------|---------|
| `profiles` | Public-safe user info (name, username, dept, level, avatar, bio). No email/phone. |
| `user_roles` | `user` / `admin` authorization. Source of truth for admin access. |
| `marketplace_listings` | Products for sale. |
| `property_listings` | Accommodation listings. |
| `saved_listings` | Per-user private bookmarks. |
| `conversations` / `conversation_participants` / `messages` | In-app messaging. |
| `message_deletions` | Per-student "delete for me". One participant hiding a message. |
| `blocks` | Directional blocks. Blocks both messaging and new conversations. Read by the website and the phone. |
| `chat_reports` | Moderation queue for chat content, keyed to a conversation. |
| `message_reports` | Moderation queue for a single message (phone report flow), with `message_id` + `conversation_id`. |
| `push_subscriptions` | Web Push endpoints. Read by the `notify-push` Edge Function only. |
| `push_tokens` / `push_preferences` / `push_deliveries` | Expo device tokens, per-user push prefs and delivery-log/dedupe. Read by `send-message-push`. |
| `app_sessions` | "App is open" heartbeat, so push is skipped for students already looking. |
| `notifications` | Per-user notifications (created by triggers). **No longer carries messages.** |
| `vendor_reviews` | 1–5 star reviews, one per reviewer per vendor, gated on prior interaction. |
| `listing_reports` / `user_reports` | Moderation queue. `user_reports.conversation_id` links a report to a thread (`009`). |
| `listing_boosts` | Watch-2-ads → 24h visibility boost history. |
| `admin_audit_log` | Record of admin/moderation actions. |

Contact phone numbers are stored **per listing** (opt-in), never on the profile,
so a public storefront never leaks a user's personal number.
