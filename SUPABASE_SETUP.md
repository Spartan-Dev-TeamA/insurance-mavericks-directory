# Supabase Setup — Insurance Mavericks Member Directory

The site's member database, auth, and photo storage all run on
[Supabase](https://supabase.com) (hosted Postgres + Auth + Storage). This
doc walks through standing up a project from scratch.

## 1. Create the project

1. Go to https://supabase.com/dashboard and create a new project.
2. Wait for provisioning to finish (a couple of minutes).

## 2. Run the schema migration

1. Open **SQL Editor** in the dashboard.
2. Paste the contents of `supabase/migrations/0001_init.sql` and run it.
   This creates:
   - `profiles` — one row per member (name, agency, home state, licensed
     states/lines of business/specializations, bio, photo, Facebook link).
   - `states`, `lines_of_business`, `specializations` — reference tables
     mirroring the taxonomy used by the onboarding form.
   - Row Level Security policies so the directory is members-only (any
     signed-in user can read it; only the owner can edit/delete their own
     row).
   - Database functions (RPC): `get_directory_stats`, `search_directory`,
     `upsert_my_profile`, `set_my_photo`, `delete_my_profile`.
   - An `avatars` Storage bucket (public read, owner-only write) for
     profile photos.
3. Paste the contents of `supabase/migrations/0002_tiers_and_messaging.sql`
   and run it. This adds:
   - A `tier` column on `profiles` (`'free'` or `'pro'`) and a
     `set_my_tier` RPC — a **self-service stub, not real billing**. Wire a
     Stripe webhook (`checkout.session.completed` → `update profiles set
     tier = 'pro' where user_id = ...`) before charging real money.
   - `message_threads` / `messages` tables for direct messaging, with RLS
     that only lets a thread's two participants read it, and no direct
     write access — all writes go through `send_message()`, which
     enforces **"only Pro members are messageable"** server-side (not
     just in the UI).
   - RPCs: `send_message`, `list_my_threads`, `mark_thread_read`.

If you'd rather use the CLI: `supabase link` then
`supabase db push` from the project root (applies both migrations in
order).

## 3. Get your API keys

1. **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `supabase-client.js` in this repo and set:

   ```js
   const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```

   Until both are set (they default to the placeholder strings), the site
   runs with an empty directory and auth buttons show a
   "Backend not configured" toast instead of erroring.

## 4. (Optional) Enable Google Sign-In

The page already has a Google Identity Services button wired up
(`GOOGLE_CLIENT_ID` near the top of `index.html`'s script). To make it
actually sign people into Supabase:

1. Follow the existing comment in `index.html` to create a Google OAuth
   Client ID and set `GOOGLE_CLIENT_ID`.
2. In Supabase: **Authentication → Providers → Google** → enable it, and
   paste the **same Client ID** into the "Authorized Client IDs" field
   (this project uses Supabase's `signInWithIdToken` flow, so Supabase
   needs to recognize tokens minted for that client).
3. No separate OAuth secret/redirect setup is needed for this flow — the
   Google button hands its ID token straight to
   `supabase.auth.signInWithIdToken`.

Email/password sign-up works out of the box with no extra configuration
(Supabase's built-in email auth). If you want to skip email confirmation
during testing, turn it off under **Authentication → Providers → Email →
Confirm email**.

## 5. Deploy

This is a static site (see `netlify.toml`) — the Supabase URL/anon key are
public, client-safe values (RLS is what actually protects the data), so
they can be committed and shipped as-is. No environment variables or
build step are required.

## What's where

| File | Purpose |
|---|---|
| `supabase/migrations/0001_init.sql` | Core schema: `profiles`, taxonomy tables, RLS, storage bucket. Re-runnable (`create ... if not exists` / `on conflict do nothing` throughout). |
| `supabase/migrations/0002_tiers_and_messaging.sql` | Membership `tier` column + Pro-only messaging (`message_threads`, `messages`, RLS, RPCs). Re-runnable. |
| `supabase-client.js` | Thin data-access layer (`window.db`) wrapping Supabase auth, profile CRUD, photo upload, directory stats, and messaging. `index.html` calls into this instead of talking to `supabase-js` directly. |
| `index.html` | UI + wiring. Auth (email/password + Google), onboarding form, profile editing, the directory grid, membership upgrade, and the Messages tab all go through `window.db`. |

## Feature audit — signup → profile → directory → messaging

- **Sign up**: email/password (`doSignup`) or Google (`handleGoogleSignIn`)
  create a real Supabase Auth user. Email sign-up respects whatever
  email-confirmation setting you have in Authentication → Providers.
- **Build a profile**: the "Join / Onboard" tab calls `upsert_my_profile`.
  Required fields (name, a valid home state, at least one licensed state
  and line of business) are validated client-side against `STATES` before
  the call, and enforced again by table constraints server-side.
- **See other members**: the directory grid reads `profiles` through RLS
  that requires the caller to be `authenticated` — any signed-in member,
  regardless of tier, can browse the full directory.
- **Pro messaging**: the Messages tab (`renderMessagesTab` /
  `openThread` / `sendThreadMessage` in `index.html`) lists threads via
  `list_my_threads` and sends via `send_message`. A member card only
  shows a **MESSAGE** button when that member's `tier = 'pro'`; the same
  rule is enforced again inside `send_message()` itself, so it can't be
  bypassed by calling the API directly.
- **Membership upgrades** (Basic/Pro) go through real Stripe Checkout,
  not a self-service toggle — see **STRIPE_SETUP.md** for that whole
  flow. `set_my_tier()` in the database only allows self-downgrading to
  `'free'`; paid tiers are granted exclusively by the Stripe webhook.

## Extending the schema

Add new capabilities (referral tracking, real billing, etc.) as
additional tables + RPC functions in a new `supabase/migrations/000N_*.sql`
file, and extend `supabase-client.js` with matching wrapper methods —
keep `index.html` talking to `window.db` only, never to `supabase-js`
directly, so the data layer stays swappable.

## Full account deletion

`delete_my_profile()` removes a member's directory listing but not their
Supabase Auth account (deleting `auth.users` requires the service-role
key, which must never ship to the browser). To offer full account
deletion, add a Supabase Edge Function that uses
`supabase.auth.admin.deleteUser()` with the service role key kept
server-side, and call it from the client instead of/after
`delete_my_profile()`.
