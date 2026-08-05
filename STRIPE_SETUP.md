# Stripe setup

Insurance Mavericks uses Stripe Checkout for subscription purchases, a Billing Portal session for customer-managed cancellation, and a signed webhook as the source of membership entitlement.

## Products and prices

Create two products and four recurring prices:

| Product | Monthly | Annual |
| --- | ---: | ---: |
| Basic membership | $14.87 | $97.84 |
| Pro membership | $20.82 | $136.98 |

Set the four resulting price IDs in STRIPE_PRICE_BASIC_MONTHLY, STRIPE_PRICE_BASIC_ANNUAL, STRIPE_PRICE_PRO_MONTHLY, and STRIPE_PRICE_PRO_ANNUAL. The functions do not use ad-hoc price_data.

## Required Netlify configuration

Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, all four STRIPE_PRICE variables, and the Netlify-provided URL value. See DEPLOY.md for the authoritative table.

## Checkout behavior

create-checkout-session:

- Verifies the Supabase access token.
- Requires an existing member profile.
- Creates or reuses one Stripe customer per auth user and stores it before returning a Checkout URL.
- Lists the customer's real Stripe subscriptions rather than trusting the stored subscription ID.
- Rejects the same active price.
- Updates a different active price in place with Stripe proration.
- Sends recoverable billing states to the Billing Portal.
- Cancels an incomplete subscription before opening fresh Checkout.
- Reuses the customer and clears only stale subscription IDs for terminal states.

## Webhook behavior

Create https://YOUR-SITE/.netlify/functions/stripe-webhook and subscribe it to:

- checkout.session.completed
- customer.subscription.updated
- customer.subscription.deleted

On Checkout completion, the webhook lists every customer subscription, deterministically elects the strongest current subscription, cancels non-winning live duplicates with proration enabled, and persists only the winner. Subscription update/delete handlers retrieve current Stripe state instead of trusting an event snapshot. Paid entitlement is granted only for active or trialing subscriptions whose current price maps to Basic or Pro.

Database update errors and zero-row matches return a server error so Stripe retries. Events for a known discarded duplicate return success without changing the elected membership.

## Billing Portal

Activate the Stripe Billing Portal, enable cancellation, disable plan switching, and set the return destination to https://YOUR-SITE/?billing=return. Paid-tier UI uses Manage billing; there is no database-only cancellation button.

Keep test-mode and live-mode keys, price IDs, and webhook signing secrets separated. Complete the post-deploy tests in DEPLOY.md before taking live payments.
