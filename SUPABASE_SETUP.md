# Supabase setup

The browser client is already configured for:

- Project URL: https://krdjdzikepmkcjjibvqt.supabase.co
- Public anon key: stored in public/supabase-client.js

The anon key is designed for browser use. The service-role key is not; keep it only in Netlify environment variables.

## Apply the schema

Run the migrations in order from the Supabase SQL Editor:

1. supabase/migrations/0001_init.sql
2. supabase/migrations/0002_tiers_and_messaging.sql
3. supabase/migrations/0003_harden_tiers_and_messaging.sql

Do not attempt to run migrations with the anon key. Migration 0003 revokes direct browser mutation of profiles, adds protected Stripe identifiers, replaces profile-returning RPCs with safe explicit shapes, and hardens messaging.

## Security model

- Signed-in members can read the safe directory columns.
- stripe_customer_id and stripe_subscription_id are never granted to anon or authenticated.
- Browser profile creates, edits, photo changes, tier resets, and deletion use SECURITY DEFINER RPCs.
- Direct INSERT, UPDATE, and DELETE on profiles are revoked from browser roles.
- Only set_my_tier('free') is allowed for self-service tier reset; paid tiers are written by the Stripe webhook with the service role.
- A new message thread requires a Pro recipient and a sender profile.
- Either participant may reply after a thread exists, regardless of current tier.
- Deleted profiles appear as Former member in existing thread lists.

## Authentication

Email/password authentication works through Supabase Auth. Configure the production Site URL and allowed redirect URLs under Authentication URL configuration.

Google is intentionally not configured, so its sign-in UI stays hidden. Follow DEPLOY.md when it is enabled later.

## Avatar storage

Migration 0001 creates the public avatars bucket. Authenticated members can write only within their own user-id folder. Deleting a profile does not automatically delete existing storage objects.

## Verification after 0003

Use a throwaway authenticated account and confirm:

1. upsert_my_profile creates only a Free profile.
2. Direct profile INSERT/UPDATE/DELETE is rejected.
3. Direct tier changes and Stripe identifier writes are rejected.
4. Stripe identifier columns cannot be selected through the browser role.
5. set_my_tier('free') succeeds.
6. send_message rejects a new non-Pro recipient.
7. send_message rejects a profile-less sender.
8. Existing-thread replies remain possible for both participants.

Delete the throwaway profile through delete_my_profile when finished. The Supabase Auth user and any uploaded avatar objects may remain and can be removed separately by an administrator.

See DEPLOY.md for the complete deployment and smoke-test checklist.
