/* ============================================================
   Insurance Mavericks — Stripe Webhook
   Upgrades/downgrades a member's profile tier when Stripe confirms a
   subscription actually got paid for (or cancelled). This is the one
   place tier changes to 'basic'/'pro' are allowed to happen — the
   database's set_my_tier() RPC only permits self-downgrading to 'free'.

   Configure in the Stripe dashboard: Developers -> Webhooks -> Add
   endpoint -> https://<your-site>/.netlify/functions/stripe-webhook
   Events to send: checkout.session.completed, customer.subscription.deleted

   Required environment variables (set in Netlify, never in git):
     STRIPE_SECRET_KEY          — sk_live_... / sk_test_...
     STRIPE_WEBHOOK_SECRET      — whsec_... (from the endpoint you create above)
     SUPABASE_URL               — same project URL as supabase-client.js
     SUPABASE_SERVICE_ROLE_KEY  — Project Settings -> API -> service_role
                                   (bypasses RLS — server-side only, NEVER
                                   ship this to the browser)
   See ../../STRIPE_SETUP.md for the full walkthrough.
   ============================================================ */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('Stripe webhook missing required env vars (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    return { statusCode: 500, body: 'Server not configured' };
  }

  const stripe = Stripe(stripeSecretKey);
  const sig = event.headers['stripe-signature'];
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const userId = session.metadata?.supabase_user_id || session.client_reference_id;
        const plan = session.metadata?.plan;
        if (userId && (plan === 'basic' || plan === 'pro')) {
          const { error } = await supabase.from('profiles').update({ tier: plan }).eq('user_id', userId);
          if (error) console.error('Failed to upgrade profile tier:', error);
        } else {
          console.error('checkout.session.completed missing supabase_user_id/plan metadata', session.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const userId = subscription.metadata?.supabase_user_id;
        if (userId) {
          const { error } = await supabase.from('profiles').update({ tier: 'free' }).eq('user_id', userId);
          if (error) console.error('Failed to downgrade profile tier:', error);
        }
        break;
      }

      default:
        // Other events (invoice.paid, subscription.updated, etc.) aren't
        // handled yet — add cases here as the billing flow grows.
        break;
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return { statusCode: 500, body: 'Webhook handler error' };
  }
};
