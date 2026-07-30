# Stripe Setup — Insurance Mavericks Subscriptions

Real subscription billing for Basic ($14.87/mo or $97.84/yr) and Pro
($20.82/mo or $136.98/yr) membership, via Stripe Checkout (Stripe's own
hosted payment page — this site never touches card details).

⚠️ **The publishable key already in `stripe-client.js` is a `pk_live_...`
key — production, not test mode.** Anything you deploy with the secret
key filled in will charge real cards. Test with a `sk_test_...` secret
key first if you want to verify the flow before going live (Stripe lets
you use a live publishable key with a test secret key isn't allowed —
use matching test-mode keys for a dry run instead, then swap both to
live for launch).

## How it works

1. A signed-in member clicks **Upgrade to Basic/Pro** in My Profile.
2. The browser calls `netlify/functions/create-checkout-session.js` with
   their Supabase access token (not a client-supplied user id — the
   function independently verifies the token with Supabase so nobody
   can pay for themselves while upgrading a different account).
3. That function creates a Stripe Checkout Session (subscription mode,
   the real price baked in server-side) and returns its URL. The browser
   redirects there — the member enters their card on Stripe's page.
4. On success, Stripe calls `netlify/functions/stripe-webhook.js`
   (`checkout.session.completed`), which uses the Supabase **service
   role** key to set `profiles.tier` to `'basic'` or `'pro'`.
5. The browser is redirected back to `/?checkout=success`, which shows a
   toast and refreshes the member's profile a few seconds later (giving
   the webhook time to land).
6. If the subscription is later cancelled in Stripe
   (`customer.subscription.deleted`), the webhook sets `tier` back to
   `'free'`.

The database itself refuses to let anyone grant themselves a paid tier
directly — `set_my_tier()` only allows setting `'free'`. Only the
webhook (running with the service role, which bypasses that rule) can
grant `'basic'`/`'pro'`. See the comment on `set_my_tier` in
`supabase/migrations/0002_tiers_and_messaging.sql`.

## 1. Netlify environment variables

Set these in **Site settings → Environment variables** (never commit
them — they're secrets):

| Variable | Where to find it |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Created in step 2 below |
| `SUPABASE_URL` | Supabase Project Settings → API → Project URL (same value as `SUPABASE_URL` in `supabase-client.js`) |
| `SUPABASE_ANON_KEY` | Supabase Project Settings → API → anon public key (same value as in `supabase-client.js`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings → API → **service_role** key — bypasses RLS, server-side only |

## 2. Create the webhook endpoint in Stripe

1. Deploy the site first (so you have a real URL) — Netlify builds the
   two functions automatically from `netlify/functions/` using the
   dependencies in `package.json`.
2. Stripe Dashboard → Developers → Webhooks → **Add endpoint**.
3. Endpoint URL: `https://<your-site>.netlify.app/.netlify/functions/stripe-webhook`
4. Events to send: `checkout.session.completed`, `customer.subscription.deleted`.
5. Copy the **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
6. Redeploy (or trigger a new deploy) so the function picks up the new
   env vars.

## 3. The publishable key

`stripe-client.js` already has the live publishable key
(`pk_live_51Mz3Ji...`) hard-coded — that's expected and safe, publishable
keys are meant to be public, same as the Supabase anon key. It isn't
actually used by the current redirect-to-Checkout flow (Checkout Session
URLs work without loading Stripe.js), but it's kept there for future use
if this page ever adds Stripe Elements/Payment Element in-page.

## 4. Pricing

Prices are defined server-side in
`netlify/functions/create-checkout-session.js` (`PLANS` constant) so
they can't be tampered with from the browser:

| Plan | Monthly | Annual (billed once/year) |
|---|---|---|
| Basic | $14.87 | $97.84 |
| Pro | $20.82 | $136.98 |

To change pricing, edit `PLANS` in that file and redeploy — no Stripe
dashboard Product/Price setup is required (Checkout Sessions are created
with inline `price_data` each time).

## What's not built yet

- **Plan changes / upgrades between paid tiers** (e.g. Basic → Pro)
  currently just start a brand-new subscription rather than prorating
  the existing one. A member on Basic who upgrades to Pro will end up
  with two Stripe subscriptions unless you cancel the old one — add a
  `customer.subscription.updated`-aware flow (using Stripe's
  [subscription update API](https://stripe.com/docs/billing/subscriptions/upgrade-downgrade))
  before this matters in practice.
- **Self-service cancellation UI.** The webhook already handles
  `customer.subscription.deleted` (downgrades to free), but there's no
  "Cancel my subscription" button in the app yet — for now, cancellation
  happens via the Stripe customer portal or dashboard.
- **Failed payments / dunning** (`invoice.payment_failed`) aren't
  handled — a card that fails on renewal won't currently downgrade the
  member automatically.
