const crypto = require('crypto');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'notifications@insurance-mavericks.com';
const USER_AGENT = 'Insurance-Mavericks-Email/1.0';
const SEND_TIMEOUT_MS = 10000;

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function getSiteUrl() {
  const raw = String(process.env.SITE_URL || '').trim().replace(/\/$/, '');
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('SITE_URL must be a valid absolute URL.'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('SITE_URL must use http or https.');
  return parsed.origin + parsed.pathname.replace(/\/$/, '');
}

function unsubscribeUrl(userId) {
  const secret = process.env.UNSUBSCRIBE_HMAC_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_HMAC_SECRET is not configured.');
  const sig = crypto.createHmac('sha256', secret).update(String(userId)).digest('hex');
  const url = new URL('/.netlify/functions/email-unsubscribe', getSiteUrl());
  url.searchParams.set('uid', String(userId));
  url.searchParams.set('sig', sig);
  return url.toString();
}

async function safeProviderError(response) {
  const fallback = 'Resend request failed with HTTP ' + response.status + '.';
  let body;
  try { body = await response.text(); } catch { return fallback; }
  if (!body) return fallback;
  try {
    const parsed = JSON.parse(body);
    const message = parsed && (parsed.message || (parsed.error && parsed.error.message) || parsed.name);
    return message ? fallback + ' ' + String(message).slice(0, 300) : fallback;
  } catch {
    return fallback;
  }
}

async function sendEmail({ to, subject, html, text, idempotencyKey, headers }, options = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');
  if (!to || !subject || !html || !text || !idempotencyKey) {
    throw new Error('Email requires to, subject, html, text, and idempotencyKey.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl || fetch;
  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [to],
        subject,
        html,
        text,
        ...(headers && Object.keys(headers).length ? { headers } : {})
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(await safeProviderError(response));
    const result = await response.json();
    if (!result || !result.id) throw new Error('Resend response did not include an email id.');
    return result;
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('Resend request timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function frame(title, content, footer) {
  return '<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#f0f0f0;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:36px 24px"><div style="color:#1db954;font-weight:700;letter-spacing:2px">INSURANCE MAVERICKS</div><h1 style="font-size:28px;margin:24px 0 16px">' + title + '</h1><div style="font-size:16px;line-height:1.6;color:#d7d7d7">' + content + '</div><div style="margin-top:32px;font-size:12px;line-height:1.6;color:#888">' + footer + '</div></div></body></html>';
}

function cta(label, href) {
  return '<p style="margin:28px 0"><a href="' + esc(href) + '" style="display:inline-block;background:#1db954;color:#000;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:6px">' + esc(label) + '</a></p>';
}

function membershipEmail({ transition, tier, interval }) {
  const site = getSiteUrl();
  const tierLabel = tier === 'pro' ? 'Pro' : tier === 'basic' ? 'Basic' : 'Free';
  const intervalLabel = interval === 'year' || interval === 'annual' ? 'annual' : 'monthly';
  let subject;
  let heading;
  let copy;
  if (transition === 'activated') {
    subject = 'Membership activated — ' + tierLabel + ' (' + intervalLabel + ')';
    heading = 'Your membership is active';
    copy = 'Your Insurance Mavericks ' + tierLabel + ' membership is now active on the ' + intervalLabel + ' billing interval.';
  } else if (transition === 'updated') {
    subject = 'Membership updated — now ' + tierLabel;
    heading = 'Your membership was updated';
    copy = 'Your Insurance Mavericks membership is now ' + tierLabel + ' on the ' + intervalLabel + ' billing interval.';
  } else if (transition === 'cancelled') {
    subject = 'Membership cancelled';
    heading = 'Your membership was cancelled';
    copy = 'Your paid Insurance Mavericks membership has ended and your account is now on the Free plan.';
  } else {
    throw new Error('Unknown membership transition.');
  }
  const footer = 'This is a transactional membership confirmation. <a href="' + esc(site) + '" style="color:#1db954">Manage your account</a>.';
  return {
    subject,
    html: frame(esc(heading), '<p>' + esc(copy) + '</p>' + cta('Manage your account', site), footer),
    text: 'Insurance Mavericks\n\n' + heading + '\n\n' + copy + '\n\nManage your account: ' + site
  };
}

function welcomeEmail({ userId, firstName }) {
  const site = getSiteUrl();
  const unsubscribe = unsubscribeUrl(userId);
  const name = firstName ? ' ' + firstName : '';
  const copy = 'Welcome' + name + '! Your member profile is ready. Explore the directory and connect with fellow Insurance Mavericks.';
  const footer = 'Manage email preferences from your profile, or <a href="' + esc(unsubscribe) + '" style="color:#1db954">stop message notification emails</a>.';
  return {
    subject: 'Welcome to Insurance Mavericks',
    html: frame('Welcome to Insurance Mavericks', '<p>' + esc(copy) + '</p>' + cta('Explore the member directory', site), footer),
    text: 'Insurance Mavericks\n\n' + copy + '\n\nExplore the member directory: ' + site + '\n\nManage email preferences from your profile. Stop message notification emails: ' + unsubscribe
  };
}

function messageNotificationEmail({ recipientId, senderName }) {
  const site = getSiteUrl();
  const messagesUrl = new URL(site);
  messagesUrl.searchParams.set('tab', 'messages');
  const unsubscribe = unsubscribeUrl(recipientId);
  const listHeaders = {
    'List-Unsubscribe': '<' + unsubscribe + '>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  };
  const copy = (senderName || 'A member') + ' sent you a message.';
  return {
    subject: 'You have a new message',
    html: frame('New message', '<p>' + esc(copy) + '</p>' + cta('View your messages', messagesUrl.toString()), '<a href="' + esc(unsubscribe) + '" style="color:#1db954">Unsubscribe from message notification emails</a>.'),
    text: 'Insurance Mavericks\n\n' + copy + '\n\nView your messages: ' + messagesUrl + '\n\nUnsubscribe from message notification emails: ' + unsubscribe,
    headers: listHeaders
  };
}

async function sendMembershipConfirmation(args, options) {
  return sendEmail({ ...membershipEmail(args), to: args.to, idempotencyKey: args.idempotencyKey }, options);
}
async function sendWelcome(args, options) {
  return sendEmail({ ...welcomeEmail(args), to: args.to, idempotencyKey: args.idempotencyKey }, options);
}
async function sendMessageNotification(args, options) {
  return sendEmail({ ...messageNotificationEmail(args), to: args.to, idempotencyKey: args.idempotencyKey }, options);
}

module.exports = {
  DEFAULT_FROM, SEND_TIMEOUT_MS, USER_AGENT, esc, getSiteUrl, unsubscribeUrl,
  membershipEmail, welcomeEmail, messageNotificationEmail, sendEmail,
  sendMembershipConfirmation, sendWelcome, sendMessageNotification
};
