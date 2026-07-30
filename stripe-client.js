/* ============================================================
   Insurance Mavericks — Stripe Checkout (client side)
   Talks to netlify/functions/create-checkout-session.js, which
   verifies the caller's Supabase session and creates a real Stripe
   Checkout Session. The actual charge happens on Stripe's own hosted
   page — this site never sees or handles card details.
   See STRIPE_SETUP.md for the full setup walkthrough.
   ============================================================ */

// Publishable key — safe to expose client-side (Stripe designs it that
// way, same as the Supabase anon key). Not currently required by the
// redirect-to-session-url flow below, but kept here for future use if
// this page ever embeds Stripe Elements/Payment Element directly.
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51Mz3JiGjglZumtKvcyXdvGJwNlSOlo6cT0UDiGqt3hmM3Y8CCf04JbZ5NtSvrR6vKa70AtuJGMtr5y96prPMFXcK00EXIJlUZu';

window.stripeCheckout = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,

  // plan: 'basic' | 'pro'   interval: 'month' | 'year'
  async startCheckout(plan, interval, accessToken, email) {
    if (!accessToken) throw new Error('You need to be signed in to upgrade.');

    const res = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ plan, interval, email })
    });

    let data;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Could not start checkout.');
    }

    window.location.href = data.url;
  }
};
