const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const LIVE_STATUS_RANK = {
  active: 1,
  trialing: 1,
  past_due: 2,
  unpaid: 2,
  paused: 2,
  incomplete: 3
};

function json(statusCode, value) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}

function siteUrl(event) {
  return (process.env.URL || `https://${event.headers.host}`).replace(/\/$/, '');
}

async function listAllSubscriptions(stripe, customerId) {
  const subscriptions = [];
  let startingAfter;
  do {
    const page = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {})
    });
    subscriptions.push(...page.data);
    startingAfter = page.has_more ? page.data[page.data.length - 1].id : null;
  } while (startingAfter);
  return subscriptions;
}

function electCurrent(subscriptions) {
  return [...subscriptions].sort((a, b) => {
    const rankA = LIVE_STATUS_RANK[a.status] || 4;
    const rankB = LIVE_STATUS_RANK[b.status] || 4;
    return rankA - rankB || b.created - a.created || b.id.localeCompare(a.id);
  })[0] || null;
}

function tierForPriceId(priceIds, priceId) {
  const matches = [];
  if ([priceIds.STRIPE_PRICE_BASIC_MONTHLY, priceIds.STRIPE_PRICE_BASIC_ANNUAL].includes(priceId)) {
    matches.push('basic');
  }
  if ([priceIds.STRIPE_PRICE_PRO_MONTHLY, priceIds.STRIPE_PRICE_PRO_ANNUAL].includes(priceId)) {
    matches.push('pro');
  }
  return new Set(matches).size === 1 ? matches[0] : null;
}

async function updateOneProfile(supabase, userId, values) {
  const { data, error } = await supabase.from('profiles')
    .update(values)
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw error;
  if (!data || data.length !== 1) throw new Error('Profile update did not match exactly one row.');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error('Checkout is missing Stripe or Supabase environment variables.');
    return json(500, { error: 'Billing is not configured on the server.' });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { payload = {}; }
  const plan = payload.plan;
  const interval = payload.interval === 'year' ? 'year' : 'month';
  if (!['basic', 'pro'].includes(plan)) {
    return json(400, { error: 'Unknown plan. Expected "basic" or "pro".' });
  }

  const priceEnvName = `STRIPE_PRICE_${plan.toUpperCase()}_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`;
  const priceIds = {
    STRIPE_PRICE_BASIC_MONTHLY: process.env.STRIPE_PRICE_BASIC_MONTHLY,
    STRIPE_PRICE_BASIC_ANNUAL: process.env.STRIPE_PRICE_BASIC_ANNUAL,
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PRO_ANNUAL: process.env.STRIPE_PRICE_PRO_ANNUAL
  };
  const priceId = priceIds[priceEnvName];
  if (!priceId) {
    console.error(`Checkout is missing ${priceEnvName}.`);
    return json(500, { error: `Billing is missing the configured price for ${plan} ${interval}.` });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Not signed in.' });

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) return json(401, { error: 'Invalid or expired session.' });

  const userId = userData.user.id;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile, error: profileError } = await serviceClient.from('profiles')
    .select('user_id,tier,stripe_customer_id,stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) {
    console.error('Profile lookup failed:', profileError);
    return json(500, { error: 'Could not verify your member profile.' });
  }
  if (!profile) return json(400, { error: 'Create your member profile before upgrading.' });

  const stripe = Stripe(stripeSecretKey);
  const returnBase = siteUrl(event);

  try {
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.user.email || undefined,
        metadata: { supabase_user_id: userId }
      }, { idempotencyKey: `customer-${userId}` });
      customerId = customer.id;
      await updateOneProfile(serviceClient, userId, { stripe_customer_id: customerId });
    }

    const subscriptions = await listAllSubscriptions(stripe, customerId);
    const current = electCurrent(subscriptions);

    if (current && (current.status === 'active' || current.status === 'trialing')) {
      const currentPriceId = current.items.data[0]?.price?.id;
      if (currentPriceId === priceId) {
        const verifiedTier = tierForPriceId(priceIds, currentPriceId);
        if (!verifiedTier) {
          throw new Error('The active subscription price does not map to exactly one membership tier.');
        }

        const needsRepair = profile.tier !== verifiedTier
          || profile.stripe_customer_id !== customerId
          || profile.stripe_subscription_id !== current.id;
        if (needsRepair) {
          await updateOneProfile(serviceClient, userId, {
            tier: verifiedTier,
            stripe_customer_id: customerId,
            stripe_subscription_id: current.id
          });
          return json(200, { updated: true });
        }
        return json(409, { error: 'You are already subscribed to this membership price.' });
      }

      if (profile.stripe_subscription_id !== current.id) {
        await updateOneProfile(serviceClient, userId, { stripe_subscription_id: current.id });
      }

      const replacementItems = current.items.data.map((item, index) => (
        index === 0
          ? { id: item.id, price: priceId, quantity: 1 }
          : { id: item.id, deleted: true }
      ));
      await stripe.subscriptions.update(current.id, {
        items: replacementItems,
        proration_behavior: 'create_prorations',
        metadata: { ...current.metadata, supabase_user_id: userId, plan }
      });
      return json(200, { updated: true });
    }

    if (current && ['past_due', 'unpaid', 'paused'].includes(current.status)) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${returnBase}/?billing=return`
      });
      return json(200, { portalUrl: portal.url, billingIssue: true });
    }

    if (current?.status === 'incomplete') {
      await stripe.subscriptions.cancel(current.id);
      await updateOneProfile(serviceClient, userId, { stripe_subscription_id: null, tier: 'free' });
    } else if (!current || ['incomplete_expired', 'canceled'].includes(current.status)) {
      if (profile.stripe_subscription_id) {
        await updateOneProfile(serviceClient, userId, { stripe_subscription_id: null });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { supabase_user_id: userId, plan },
      subscription_data: { metadata: { supabase_user_id: userId, plan } },
      success_url: `${returnBase}/?checkout=success`,
      cancel_url: `${returnBase}/?checkout=cancelled`
    });

    return json(200, { url: session.url });
  } catch (error) {
    console.error('Stripe checkout request failed:', error);
    return json(500, { error: error.message || 'Could not start checkout.' });
  }
};
