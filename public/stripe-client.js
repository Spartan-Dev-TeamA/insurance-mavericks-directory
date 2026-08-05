/* Insurance Mavericks — Stripe checkout and Billing Portal client. */
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51Mz3JiGjglZumtKvcyXdvGJwNlSOlo6cT0UDiGqt3hmM3Y8CCf04JbZ5NtSvrR6vKa70AtuJGMtr5y96prPMFXcK00EXIJlUZu';
const EXPECTED_PLAN_KEY = 'insurance_mavericks_expected_plan';

window.stripeCheckout = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  expectedPlanKey: EXPECTED_PLAN_KEY,

  async startCheckout(plan, interval, accessToken) {
    const data = await window.authedFunctionRequest('create-checkout-session', { plan, interval });

    if (data.portalUrl) {
      window.location.href = data.portalUrl;
      return { redirectedToPortal: true };
    }

    if (data.updated) {
      sessionStorage.setItem(EXPECTED_PLAN_KEY, plan);
      return { updated: true };
    }

    if (!data.url) throw new Error('Checkout did not return a redirect URL.');
    sessionStorage.setItem(EXPECTED_PLAN_KEY, plan);
    window.location.href = data.url;
    return { redirectedToCheckout: true };
  },

  async openBillingPortal(accessToken) {
    const data = await window.authedFunctionRequest('create-portal-session', {});
    if (!data.url) throw new Error('Billing Portal did not return a redirect URL.');
    window.location.href = data.url;
  },

  getExpectedPlan() {
    return sessionStorage.getItem(EXPECTED_PLAN_KEY);
  },

  clearExpectedPlan() {
    sessionStorage.removeItem(EXPECTED_PLAN_KEY);
  }
};
