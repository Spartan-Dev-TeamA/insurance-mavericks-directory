const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const json = (statusCode, value) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(value)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const { STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Billing is not configured on the server.' });
  }

  const token = (event.headers.authorization || event.headers.Authorization || '')
    .replace(/^Bearer\s+/i, '').trim();
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) return json(401, { error: 'Invalid or expired session.' });

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile, error: profileError } = await serviceClient.from('profiles')
    .select('stripe_customer_id').eq('user_id', userData.user.id).maybeSingle();
  if (profileError) return json(500, { error: 'Could not load billing details.' });
  if (!profile?.stripe_customer_id) return json(400, { error: 'No Stripe customer is linked to this profile.' });

  try {
    const returnBase = (process.env.URL || `https://${event.headers.host}`).replace(/\/$/, '');
    const session = await Stripe(STRIPE_SECRET_KEY).billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${returnBase}/?billing=return`
    });
    return json(200, { url: session.url });
  } catch (error) {
    console.error('Billing Portal session creation failed:', error);
    return json(500, { error: error.message || 'Could not open Billing Portal.' });
  }
};
