/* ============================================================
   Insurance Mavericks — Create Stripe Checkout Session
   POST { plan: 'basic'|'pro', interval: 'month'|'year' }
   Header: Authorization: Bearer <supabase access token>

   Required environment variables (set in Netlify, never in git):
     STRIPE_SECRET_KEY        — sk_live_... / sk_test_...
     SUPABASE_URL             — same project URL as supabase-client.js
     SUPABASE_ANON_KEY        — same anon key as supabase-client.js
                                 (used only to verify the caller's JWT)
   See ../../STRIPE_SETUP.md for the full walkthrough.
   ============================================================ */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Real pricing (USD). Annual = one lump-sum charge per year, not 12x monthly.
const PLANS = {
  basic: { name: 'Insurance Mavericks — Basic Membership', monthlyCents: 1487, annualCents: 9784 },
  pro:   { name: 'Insurance Mavericks — Pro Membership',   monthlyCents: 2082, annualCents: 13698 }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey) {
    console.error('Missing STRIPE_SECRET_KEY / SUPABASE_URL / SUPABASE_ANON_KEY env vars');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server is not configured yet — see STRIPE_SETUP.md.' }) };
  }

  // Identify the caller from their Supabase access token — never trust a
  // client-supplied user id, or anyone could pay for themselves while
  // upgrading someone else's account.
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not signed in.' }) };
  }

  const supabaseForAuth = createClient(supabaseUrl, supabaseAnonKey);
  const { data: userData, error: userErr } = await supabaseForAuth.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired session.' }) };
  }
  const userId = userData.user.id;
  const email = userData.user.email;

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { payload = {}; }
  const plan = payload.plan;
  const interval = payload.interval === 'year' ? 'year' : 'month';

  const planDef = PLANS[plan];
  if (!planDef) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown plan. Expected "basic" or "pro".' }) };
  }
  const unitAmount = interval === 'year' ? planDef.annualCents : planDef.monthlyCents;

  const siteUrl = process.env.URL || `https://${event.headers.host}`;
  const stripe = Stripe(stripeSecretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email || undefined,
      client_reference_id: userId,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          recurring: { interval },
          product_data: { name: planDef.name }
        },
        quantity: 1
      }],
      metadata: { supabase_user_id: userId, plan },
      subscription_data: {
        metadata: { supabase_user_id: userId, plan }
      },
      success_url: `${siteUrl}/?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancelled`
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Stripe checkout session creation failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Could not start checkout.' }) };
  }
};
