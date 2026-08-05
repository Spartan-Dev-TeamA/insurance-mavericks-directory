const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { sendMembershipConfirmation } = require('./lib/email');

const STATUS_RANK = {
  active: 1, trialing: 1, past_due: 2, unpaid: 2, paused: 2,
  incomplete: 3, incomplete_expired: 4, canceled: 4
};
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete']);

function customerIdOf(value) {
  return typeof value === 'string' ? value : (value && value.id) || null;
}

async function listAllSubscriptions(stripe, customerId) {
  const all = [];
  let startingAfter;
  do {
    const page = await stripe.subscriptions.list({
      customer: customerId, status: 'all', limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {})
    });
    all.push(...page.data);
    startingAfter = page.has_more ? page.data[page.data.length - 1].id : null;
  } while (startingAfter);
  return all;
}

function electWinner(subscriptions) {
  return [...subscriptions].sort((a, b) =>
    (STATUS_RANK[a.status] || 4) - (STATUS_RANK[b.status] || 4)
    || b.created - a.created
    || b.id.localeCompare(a.id)
  )[0] || null;
}

function priceOf(subscription) {
  return subscription && subscription.items && subscription.items.data &&
    subscription.items.data[0] && subscription.items.data[0].price || null;
}

function priceIdOf(subscription) {
  const price = priceOf(subscription);
  return price && price.id || null;
}

function intervalOf(subscription) {
  const interval = priceOf(subscription) && priceOf(subscription).recurring &&
    priceOf(subscription).recurring.interval;
  return interval === 'year' ? 'year' : 'month';
}

function tierFor(subscription, priceToTier) {
  if (!subscription || !['active', 'trialing'].includes(subscription.status)) return 'free';
  return priceToTier.get(priceIdOf(subscription)) || 'free';
}

function transitionFor(priorTier, newTier) {
  if (priorTier === newTier) return null;
  if (priorTier === 'free' && newTier !== 'free') return 'activated';
  if (priorTier !== 'free' && newTier === 'free') return 'cancelled';
  if (priorTier !== 'free' && newTier !== 'free') return 'updated';
  return null;
}

async function profileBy(supabase, column, value) {
  if (!value) return null;
  const { data, error } = await supabase.from('profiles')
    .select('user_id,tier,stripe_customer_id,stripe_subscription_id')
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function claimTierTransition(supabase, profile, newTier, values) {
  const { data, error } = await supabase.from('profiles')
    .update({ ...values, tier: newTier })
    .eq('user_id', profile.user_id)
    .eq('tier', profile.tier)
    .select('user_id');
  if (error) throw error;
  if (data && data.length === 1) {
    return { owned: true, transition: transitionFor(profile.tier, newTier) };
  }
  if (data && data.length > 1) throw new Error('Tier CAS matched more than one profile.');

  const reread = await profileBy(supabase, 'user_id', profile.user_id);
  if (reread && reread.tier === newTier) {
    return { owned: false, transition: null };
  }
  throw new Error('Tier CAS lost without the requested tier being committed.');
}

function isStripeNotFound(error) {
  return error && (error.statusCode === 404 || error.code === 'resource_missing');
}

async function retrieveCurrentSubscription(stripe, subscriptionId) {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    if (isStripeNotFound(error)) return null;
    throw error;
  }
}

async function cancelDuplicate(stripe, subscription) {
  try {
    await stripe.subscriptions.cancel(subscription.id, { prorate: true, invoice_now: false });
  } catch (error) {
    if (isStripeNotFound(error)) return;
    const current = await retrieveCurrentSubscription(stripe, subscription.id);
    if (!current || !LIVE_STATUSES.has(current.status)) return;
    throw error;
  }
}

async function sendOwnedConfirmation(supabase, stripeEvent, profile, claim, newTier, subscription) {
  if (!claim.owned || !claim.transition) return;
  try {
    const { data, error } = await supabase.auth.admin.getUserById(profile.user_id);
    if (error) throw error;
    const email = data && data.user && data.user.email;
    if (!email) {
      console.warn('Membership confirmation skipped because the member has no deliverable auth email.');
      return;
    }
    await sendMembershipConfirmation({
      to: email,
      transition: claim.transition,
      tier: newTier,
      interval: intervalOf(subscription),
      idempotencyKey: 'stripe-' + stripeEvent.id
    });
  } catch (error) {
    console.error('Membership confirmation email failed:', error && error.message || 'unknown error');
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const required = [
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_PRICE_BASIC_MONTHLY',
    'STRIPE_PRICE_BASIC_ANNUAL', 'STRIPE_PRICE_PRO_MONTHLY',
    'STRIPE_PRICE_PRO_ANNUAL'
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error('Stripe webhook missing environment variables:', missing.join(', '));
    return { statusCode: 500, body: 'Server not configured' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = event.headers['stripe-signature'];
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return { statusCode: 400, body: 'Webhook Error: ' + error.message };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const priceToTier = new Map([
    [process.env.STRIPE_PRICE_BASIC_MONTHLY, 'basic'],
    [process.env.STRIPE_PRICE_BASIC_ANNUAL, 'basic'],
    [process.env.STRIPE_PRICE_PRO_MONTHLY, 'pro'],
    [process.env.STRIPE_PRICE_PRO_ANNUAL, 'pro']
  ]);

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const customerId = customerIdOf(session.customer);
      if (!customerId) throw new Error('Completed Checkout Session has no Stripe customer.');

      const subscriptions = await listAllSubscriptions(stripe, customerId);
      const winner = electWinner(subscriptions);
      for (const subscription of subscriptions) {
        if (winner && subscription.id !== winner.id && LIVE_STATUSES.has(subscription.status)) {
          await cancelDuplicate(stripe, subscription);
        }
      }

      let profile = await profileBy(supabase, 'stripe_customer_id', customerId);
      if (!profile) {
        const metadataUserId = session.metadata && session.metadata.supabase_user_id ||
          session.client_reference_id;
        profile = await profileBy(supabase, 'user_id', metadataUserId);
      }
      if (!profile) throw new Error('Checkout reconciliation could not resolve exactly one member profile.');

      const newTier = tierFor(winner, priceToTier);
      const claim = await claimTierTransition(supabase, profile, newTier, {
        stripe_customer_id: customerId,
        stripe_subscription_id: winner && winner.id || null
      });
      await sendOwnedConfirmation(supabase, stripeEvent, profile, claim, newTier, winner);

      return { statusCode: 200, body: JSON.stringify({ received: true, reconciled: true }) };
    }

    if (stripeEvent.type === 'customer.subscription.updated'
        || stripeEvent.type === 'customer.subscription.deleted') {
      const eventSubscription = stripeEvent.data.object;
      const subscriptionId = eventSubscription.id;

      let profile = await profileBy(supabase, 'stripe_subscription_id', subscriptionId);
      if (!profile) {
        const metadataUserId = eventSubscription.metadata && eventSubscription.metadata.supabase_user_id;
        if (!metadataUserId) {
          throw new Error('Subscription event has no existing association or metadata user id.');
        }
        profile = await profileBy(supabase, 'user_id', metadataUserId);
        if (!profile) throw new Error('Subscription event did not resolve a member profile.');
        if (profile.stripe_subscription_id && profile.stripe_subscription_id !== subscriptionId) {
          return { statusCode: 200, body: JSON.stringify({ received: true, discardedDuplicate: true }) };
        }
      }

      const current = await retrieveCurrentSubscription(stripe, subscriptionId);
      const currentCustomerId = customerIdOf(current && current.customer)
        || customerIdOf(eventSubscription.customer)
        || profile.stripe_customer_id;
      const newTier = tierFor(current, priceToTier);
      const claim = await claimTierTransition(supabase, profile, newTier, {
        stripe_customer_id: currentCustomerId,
        stripe_subscription_id: subscriptionId
      });
      await sendOwnedConfirmation(
        supabase, stripeEvent, profile, claim, newTier, current || eventSubscription
      );

      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }

    return { statusCode: 200, body: JSON.stringify({ received: true, ignored: true }) };
  } catch (error) {
    console.error('Stripe webhook handler failed:', error);
    return { statusCode: 500, body: 'Webhook handler error' };
  }
};

exports.__test = {
  electWinner, tierFor, transitionFor, intervalOf, claimTierTransition
};
