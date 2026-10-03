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
> [`migrations/`](./migrations) in order (currently `002_admin_panel.sql`,
> `003_admin_email_lock.sql`, `004_search_and_filters.sql`, then
> `005_saved_searches_and_alerts.sql`). `004` adds the indexed full-text search
> and filter RPCs used by the marketplace and accommodation explorers. `005`
> adds saved searches, price-drop alerts and new-match alert generation.

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

## 9. Messaging upgrade (required for the new chat)

The production chat features — presence, replies, image/voice messages, search,
pinning, archiving, blocking, chat reports and Web Push — all land in one
migration. **The app's new UI will not work until it is applied.**

1. SQL Editor → paste the whole of
   [`migrations/006_messaging_upgrade.sql`](./migrations/006_messaging_upgrade.sql)
   → **Run**.

   It is additive and idempotent (`if not exists` / `drop ... if exists`
   throughout), so re-running it is safe. Two things to know about it:

   - It **drops and recreates `get_my_conversations()`**. The function's return
     type is wider than the original, and Postgres refuses to change a return
     type in place. Nothing depends on it by name, so this is safe.
   - It **deletes existing `notifications` rows of type `message`** and stops
     `notify_new_message()` from creating new ones. Messages and the bell are
     now separate systems: a new message updates `conversations.last_message_at`
     and nothing else, and the bell shows only saved-search and moderation
     alerts. This is intended — leaving it out would double-notify every message.

2. Add the push **public** key to the app's environment (see section 7 of the
   root README / `.env`):

   ```
   EXPO_PUBLIC_VAPID_PUBLIC_KEY=<your public key>
   ```

   Push is optional. Without it the app still runs; it just cannot deliver
   background notifications, and the "Enable notifications" prompt is hidden.

3. Deploy the push sender:

   ```bash
   supabase functions deploy notify-push --no-verify-jwt
   ```

4. Set the sender's secrets:

   ```bash
   npx web-push generate-vapid-keys   # run once, keep the private key safe
   supabase secrets set \
     VAPID_PUBLIC_KEY=<public key> \
     VAPID_PRIVATE_KEY=<private key> \
     VAPID_SUBJECT=mailto:you@yourdomain.com
   ```

5. Wire the sender to new messages. Dashboard → **Database → Webhooks → Add
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

6. Allow audio recording in the Cloudinary upload preset used by the app
   (Settings → Upload → your preset → "Allowed formats" must include `webm`,
   `mp4`, `mp3` and `m4a`; audio/video resources are uploaded through the
   `video` resource type). Without this, voice notes fail at upload while image
   uploads still work.

7. (Optional) Schedule the housekeeping function so dead subscriptions and stale
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

## 10. Verify

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
| `blocks` | Directional blocks. Blocks both messaging and new conversations. |
| `chat_reports` | Moderation queue for chat content, keyed to a conversation. |
| `push_subscriptions` | Web Push endpoints. Read by the `notify-push` Edge Function only. |
| `app_sessions` | "App is open" heartbeat, so push is skipped for students already looking. |
| `notifications` | Per-user notifications (created by triggers). **No longer carries messages.** |
| `vendor_reviews` | 1–5 star reviews, one per reviewer per vendor, gated on prior interaction. |
| `listing_reports` / `user_reports` | Moderation queue. |
| `listing_boosts` | Watch-2-ads → 24h visibility boost history. |
| `admin_audit_log` | Record of admin/moderation actions. |

Contact phone numbers are stored **per listing** (opt-in), never on the profile,
so a public storefront never leaks a user's personal number.
