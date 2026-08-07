# Insurance Mavericks deployment

This repository deploys as a static Netlify site from `public/` with serverless functions from `netlify/functions/`.

## 1. Supabase migrations

Run all seven SQL migrations in order in the Supabase SQL Editor or through the Supabase CLI:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_tiers_and_messaging.sql`
3. `supabase/migrations/0003_harden_tiers_and_messaging.sql`
4. `supabase/migrations/0004_email_notifications.sql`
5. `supabase/migrations/0005_state_coverage_stats.sql`
6. `supabase/migrations/0006_fix_upsert_my_profile_ambiguous_column.sql` — fixes a bug in 0003 that blocked every signup (`upsert_my_profile` failed with "column reference user_id is ambiguous"). Required even on a fresh project — this isn't optional cleanup.
7. `supabase/migrations/0007_message_notification_webhook_trigger.sql` — creates the message-notification Database Webhook trigger via `pg_net` directly. **Before running, replace `<MESSAGE_WEBHOOK_SECRET>` in the file with the actual value of the `MESSAGE_WEBHOOK_SECRET` Netlify environment variable.** This supersedes the manual "Database > Webhooks > Create a new hook" instructions in section 5 below — creating the trigger via SQL is equivalent and more reliable than the Dashboard wizard.

The browser anon key cannot apply schema changes. Never expose `SUPABASE_SERVICE_ROLE_KEY` in `public/` or any browser code.

After migration 0004, verify that authenticated callers can select only `id`, `user_low`, `user_high`, and `created_at` from `message_threads`; the notification claim columns must remain server-only. Also verify a participant can still read `messages` through RLS and a non-participant cannot.

Migration 0005 adds `get_state_coverage_counts()`, a public SECURITY DEFINER RPC (matching `get_directory_stats()`'s existing pattern) that powers the public Map tab's per-state licensed-coverage counts for logged-out visitors, without exposing individual profile rows to anon.

## 2. Stripe catalog

Create Basic and Pro recurring-subscription products in the same Stripe mode used by `STRIPE_SECRET_KEY`, with four prices:

| Product | Cadence | Displayed charge | Netlify variable |
| --- | --- | ---: | --- |
| Basic membership | Monthly | $14.87 USD | `STRIPE_PRICE_BASIC_MONTHLY` |
| Basic membership | Annual | $97.84 USD | `STRIPE_PRICE_BASIC_ANNUAL` |
| Pro membership | Monthly | $20.82 USD | `STRIPE_PRICE_PRO_MONTHLY` |
| Pro membership | Annual | $136.98 USD | `STRIPE_PRICE_PRO_ANNUAL` |

Checkout uses these existing price IDs and never creates products or prices.

## 3. Netlify environment variables

Set these for the production deploy context, then trigger a new deploy:

| Variable | Used by | Value |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Billing functions | Stripe secret key for the selected mode |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Stripe endpoint signing secret |
| `SUPABASE_URL` | Server functions | Supabase project URL |
| `SUPABASE_ANON_KEY` | Authenticated function token verification | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server functions | Supabase service-role key; server only |
| `STRIPE_PRICE_BASIC_MONTHLY` | Checkout/webhook | Basic monthly price ID |
| `STRIPE_PRICE_BASIC_ANNUAL` | Checkout/webhook | Basic annual price ID |
| `STRIPE_PRICE_PRO_MONTHLY` | Checkout/webhook | Pro monthly price ID |
| `STRIPE_PRICE_PRO_ANNUAL` | Checkout/webhook | Pro annual price ID |
| `RESEND_API_KEY` | Email sender | Production Resend sending-scoped API key, when available |
| `EMAIL_FROM` | Email sender | `notifications@insurance-mavericks.com` |
| `SITE_URL` | All email links | Fixed trusted production origin, for example `https://insurance-mavericks.com` |
| `MESSAGE_WEBHOOK_SECRET` | Message email webhook | A long random secret, distinct from every other secret |
| `UNSUBSCRIBE_HMAC_SECRET` | Signed unsubscribe links | A different long random secret, independently rotatable |
| `URL` | Checkout/portal return URLs | Netlify-provided production site URL; verify it |

Generate each webhook/HMAC secret with a cryptographically secure password generator. Do not put values in SQL, webhook payloads, client code, docs, or source control. The verified Resend domain is `insurance-mavericks.com` (hyphenated).

Use a sending-scoped Resend key for Netlify production if the dashboard offers that permission. The boss-held full-access key is used only when running the live verification script because polling `GET /emails/<id>` requires read access.

## 4. Stripe webhook and confirmation boundary

Create `https://YOUR-SITE/.netlify/functions/stripe-webhook` and subscribe it to:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the signing secret to `STRIPE_WEBHOOK_SECRET`. Keep test-mode keys, prices, and secrets together, and live-mode values together.

Membership confirmation emails are transition-driven and contain no amounts. They are sent only when webhook reconciliation owns a tier change by CAS. These tier writes intentionally do not send confirmations:

- Checkout’s stale-tier repair path, because the member was already entitled.
- Cancellation of an incomplete subscription, because that tier was never entitled.
- `set_my_tier('free')`, which has no billing UI path. Billing Portal cancellation does produce a webhook and therefore does send a cancellation confirmation.

Email failures never alter Stripe webhook status codes or trigger a Stripe retry. Without an outbox, a transient Resend failure permanently loses that email.

## 5. Supabase message Database Webhook

**Already handled by migration `0007_message_notification_webhook_trigger.sql`
in section 1 above** — run that migration (with the real
`MESSAGE_WEBHOOK_SECRET` substituted in) instead of using the Dashboard
wizard described below. The Dashboard's "Database > Webhooks" UI generates
the exact same underlying `pg_net`-based trigger; creating it via SQL was
confirmed more reliable in practice (2026-08-07) and lets the whole schema
live in version control instead of undocumented Dashboard state. Skip the
rest of this section if you've run migration 0007.

<details>
<summary>Dashboard wizard steps (not needed if you ran migration 0007)</summary>

In Supabase Dashboard, create a Database Webhook with:

- Table: `public.messages`
- Event: `INSERT` only
- Method: `POST`
- URL: `https://YOUR-SITE/.netlify/functions/message-email-hook`
- Header name: `x-message-webhook-secret`
- Header value: exactly the Netlify `MESSAGE_WEBHOOK_SECRET`
- Content type: JSON
- Timeout: allow at least 10 seconds; the downstream Resend request itself times out at about 10 seconds

</details>

Supabase Database Webhooks are asynchronous `pg_net` calls and do not provide guaranteed retries. View delivery attempts and response details in the webhook’s Supabase Dashboard logs; also review Netlify function logs. A lost webhook or transient Resend outage can permanently lose a notification.

The latch guarantees at most one send attempt per unread cycle. It does not guarantee at most one delivered email while a cycle is active because a prior-cycle send may still be in flight after a read re-arms the latch. Avoiding mail for a message that has just become read is best-effort because the external send and database transaction cannot be atomic.

## 6. Resend and Supabase Auth SMTP

The sending domain `insurance-mavericks.com` must remain verified in Resend. In Supabase Dashboard, open Authentication email/SMTP settings and configure custom SMTP:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: the Resend API key
- Sender email: `notifications@insurance-mavericks.com`
- Sender name: `Insurance Mavericks`

Send an Auth test email and complete a signup/password-recovery smoke test. This is a dashboard-only configuration; no SMTP credential belongs in the repository.

## 7. Stripe Billing Portal

Activate the portal, enable subscription cancellation, disable customer plan switching, and set the return URL to `https://YOUR-SITE/?billing=return`. Plan changes remain app-managed. Portal cancellation must produce the subscription webhook that returns the member to Free.

## 8. Netlify settings

`netlify.toml` publishes `public/` and loads functions from `netlify/functions/`. Keep repository docs, SQL, scripts, `package.json`, and `PLAN.md` outside the published directory.

## 9. Verification commands and smoke tests

Before deployment:

1. Run `node scripts/db-integration-test.mjs` with Docker running. All migration and concurrency checks must print PASS.
2. With the boss-held full-access Resend key, set `RESEND_API_KEY`, `EMAIL_FROM`, and `TEST_EMAIL_TO`, then run `node scripts/send-test-emails.mjs`. Confirm five IDs and delivered statuses.
3. Scan for secret material, including the actual boss-held values and common secret prefixes.
4. Run syntax checks on every changed JavaScript/MJS file.

After deployment:

1. Create and edit a profile; both saves must remain successful even if email sending is unavailable.
2. Confirm the welcome claim sends at most once, including after a fresh signed-in session.
3. Toggle Email notifications off/on and reload the profile panel to confirm persistence.
4. Send two unread messages in one thread and confirm only the first wins the notification cycle; read the thread, then confirm a later message can notify.
5. Confirm message emails have a working confirmation-form unsubscribe link and inbox one-click headers; GET alone must not change the preference.
6. Confirm membership activated, updated, and cancelled transitions send the correct template and no monetary amount.
7. Exercise all Stripe prices, in-place plan changes, recoverable billing redirects, portal cancellation, duplicate reconciliation, and database-failure retries.
8. Confirm direct browser writes to tier, Stripe identifiers, `welcomed_at`, and notification latch columns remain rejected.
