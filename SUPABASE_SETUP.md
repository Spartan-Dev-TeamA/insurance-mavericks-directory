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

If you'd rather use the CLI: `supabase link` then
`supabase db push` from the project root.

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
| `supabase/migrations/0001_init.sql` | Full schema: tables, RLS policies, RPC functions, storage bucket. Re-runnable (`create ... if not exists` / `on conflict do nothing` throughout). |
| `supabase-client.js` | Thin data-access layer (`window.db`) wrapping Supabase auth, profile CRUD, photo upload, and directory stats. `index.html` calls into this instead of talking to `supabase-js` directly. |
| `index.html` | UI + wiring. Auth (email/password + Google), onboarding form, profile editing, and the directory grid all go through `window.db`. |

## Extending the schema

`get_directory_stats`, `search_directory`, `upsert_my_profile`,
`set_my_photo`, and `delete_my_profile` are the current RPC surface. Add
new capabilities (e.g. messaging between members, referral tracking,
paid tiers) as additional tables + RPC functions in a new
`supabase/migrations/000N_*.sql` file, and extend `supabase-client.js`
with matching wrapper methods — keep `index.html` talking to `window.db`
only, never to `supabase-js` directly, so the data layer stays swappable.

## Full account deletion

`delete_my_profile()` removes a member's directory listing but not their
Supabase Auth account (deleting `auth.users` requires the service-role
key, which must never ship to the browser). To offer full account
deletion, add a Supabase Edge Function that uses
`supabase.auth.admin.deleteUser()` with the service role key kept
server-side, and call it from the client instead of/after
`delete_my_profile()`.
