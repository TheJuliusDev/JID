# JID — Supabase backend (moved)

**The backend has one source of truth, and it is not this folder.**

The website and the mobile app run against the **same** Supabase project. The
canonical schema, migrations and Edge Functions now live at the repository root:

- [`../../supabase/schema.sql`](../../supabase/schema.sql) — the full schema
  (run this first on a brand-new project).
- [`../../supabase/migrations/`](../../supabase/migrations) — `002` → `009`,
  applied in order on an existing project. **`009_messaging_parity.sql` is what
  makes the phone and the website share one messaging schema — it is required.**
- [`../../supabase/functions/`](../../supabase/functions) — `notify-push` (Web
  Push, website) and `send-message-push` (Expo push, mobile app).
- [`../../supabase/README.md`](../../supabase/README.md) — the full setup guide,
  including the Web + mobile table of differences.

## What is in this folder now

- `schema.sql` — a frozen copy of the original baseline. Kept only as history;
  **do not run it.**
- `migrations/` — the phone's original `2026*` drafts (messaging upgrade,
  privacy, search, reports, push). They were written before the web and mobile
  schemas were unified and **conflict with the canonical `006`–`009`**. Do not
  apply them to a project that has `006`–`009`.
- `functions/send-message-push/` — **moved to
  [`../../supabase/functions/send-message-push/`](../../supabase/functions/send-message-push).**
  The copy still here read the retired `user_blocks` table and must not be
  deployed.

## Setting up the backend

Follow the root guide: [`../../supabase/README.md`](../../supabase/README.md).

The only mobile-specific environment variable is the Supabase/Cloudinary set
(`EXPO_PUBLIC_*`) already documented there. Nothing in this folder needs to be
applied for the app to work — the root `002`–`009` cover its entire API surface.
