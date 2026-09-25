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

## 9. Verify

- Sign up → a row appears in `public.profiles` and `public.user_roles`.
- Create a listing with images → images resolve to `res.cloudinary.com` URLs
  and a row appears in `marketplace_listings` / `property_listings`.
- Open a second account, message the first → the message appears live (realtime)
  and a notification row is created.
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
| `notifications` | Per-user notifications (created by triggers). |
| `vendor_reviews` | 1–5 star reviews, one per reviewer per vendor, gated on prior interaction. |
| `listing_reports` / `user_reports` | Moderation queue. |
| `listing_boosts` | Watch-2-ads → 24h visibility boost history. |
| `admin_audit_log` | Record of admin/moderation actions. |

Contact phone numbers are stored **per listing** (opt-in), never on the profile,
so a public storefront never leaks a user's personal number.
