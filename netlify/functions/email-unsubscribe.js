const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { esc } = require('./lib/email');

const MESSAGE_SCOPE = 'message';
const ONBOARDING_SCOPE = 'onboarding';

function page(title, message, form) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    esc(title) + '</title></head><body style="margin:0;background:#0a0a0a;color:#f0f0f0;font-family:Arial,sans-serif"><main style="max-width:520px;margin:10vh auto;padding:32px;background:#151515;border:1px solid #282828;border-radius:12px"><div style="color:#1db954;font-weight:700;letter-spacing:2px">INSURANCE MAVERICKS</div><h1>' +
    esc(title) + '</h1><p style="line-height:1.6;color:#ccc">' + esc(message) + '</p>' + (form || '') + '<div style="margin-top:32px;font-size:12px;line-height:1.6;color:#888">Spartan Business Warriors LLC · c/o Wyoming Registered Agent Services LLC<br>30 N Gould St Ste R, Sheridan, WY 82801</div></main></body></html>';
}

function html(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    },
    body
  };
}

function signaturePayload(uid, scope) {
  if (scope === MESSAGE_SCOPE) return uid;
  if (scope === ONBOARDING_SCOPE) return 'v1:onboarding:' + uid;
  return null;
}

function validSignedUser(uid, sig, secret, scope = MESSAGE_SCOPE) {
  if (typeof uid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid)) return false;
  if (typeof sig !== 'string' || !/^[0-9a-f]{64}$/.test(sig)) return false;
  if (!secret) return false;
  const payload = signaturePayload(uid, scope);
  if (!payload) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const left = Buffer.from(sig, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return html(405, page('Method not allowed', 'Use the unsubscribe link from your email.'));
  }

  const uid = event.queryStringParameters && event.queryStringParameters.uid || '';
  const sig = event.queryStringParameters && event.queryStringParameters.sig || '';
  const scope = event.queryStringParameters && event.queryStringParameters.scope || MESSAGE_SCOPE;
  const secret = process.env.UNSUBSCRIBE_HMAC_SECRET || '';
  if (!secret) {
    console.error('Unsubscribe endpoint is missing its HMAC secret.');
    return html(500, page('Temporarily unavailable', 'Please try again later.'));
  }
  if (!validSignedUser(uid, sig, secret, scope)) {
    return html(400, page('Invalid unsubscribe link', 'This link is invalid or has been changed.'));
  }

  const onboarding = scope === ONBOARDING_SCOPE;
  if (event.httpMethod === 'GET') {
    let action = '/.netlify/functions/email-unsubscribe?uid=' + encodeURIComponent(uid) +
      '&sig=' + encodeURIComponent(sig);
    if (onboarding) action += '&scope=' + encodeURIComponent(ONBOARDING_SCOPE);
    const button = onboarding ? 'Stop onboarding reminder emails' : 'Stop message notification emails';
    const title = onboarding ? 'Stop onboarding reminders?' : 'Stop message notifications?';
    const form = '<form method="post" action="' + esc(action) + '" style="margin-top:24px"><button type="submit" style="background:#1db954;color:#000;border:0;border-radius:6px;padding:12px 18px;font-weight:700;cursor:pointer">' + esc(button) + '</button></form>';
    return html(200, page(
      title,
      'Confirm below. Opening this page has not changed your preferences.',
      form
    ));
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Unsubscribe endpoint is missing Supabase configuration.');
    return html(500, page('Temporarily unavailable', 'Please try again later.'));
  }

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let data;
  let error;
  if (onboarding) {
    ({ data, error } = await service.from('onboarding_nudges')
      .upsert({
        user_id: uid,
        opted_out: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select('user_id,opted_out'));
  } else {
    ({ data, error } = await service.from('profiles')
      .update({ email_notifications: false })
      .eq('user_id', uid)
      .select('user_id,email_notifications'));
  }

  if (error) {
    console.error('Unsubscribe preference update failed:', error.message || 'unknown error');
    return html(500, page('Temporarily unavailable', 'Please try again later.'));
  }
  const landed = data && data.length === 1 && (
    onboarding ? data[0].opted_out === true : data[0].email_notifications === false
  );
  if (!landed) {
    console.error('Unsubscribe preference update did not match exactly one account.');
    return html(404, page('Account not found', 'No email preference was changed.'));
  }

  return html(200, page(
    'You are unsubscribed',
    onboarding
      ? 'Onboarding reminder emails are now off for this account.'
      : 'Message notification emails are now off. You can turn them back on from your profile.'
  ));
};

exports.__test = {
  MESSAGE_SCOPE,
  ONBOARDING_SCOPE,
  signaturePayload,
  validSignedUser,
  page,
  html
};
