const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { sendMessageNotification } = require('./lib/email');

function json(statusCode, value) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}

function headerValue(headers, name) {
  const target = name.toLowerCase();
  const key = Object.keys(headers || {}).find((candidate) => candidate.toLowerCase() === target);
  return key ? String(headers[key]) : '';
}

function secretMatches(provided, expected) {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const expectedSecret = process.env.MESSAGE_WEBHOOK_SECRET || '';
  const providedSecret = headerValue(event.headers, 'x-message-webhook-secret');
  if (!secretMatches(providedSecret, expectedSecret)) {
    return json(401, { error: 'Unauthorized.' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Message email hook is missing Supabase configuration.');
    return json(500, { error: 'Server not configured.' });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON.' }); }
  if (payload.type !== 'INSERT' || payload.schema !== 'public' || payload.table !== 'messages'
      || !payload.record || !isUuid(payload.record.id)) {
    return json(400, { error: 'Invalid webhook envelope.' });
  }

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: message, error: messageError } = await service.from('messages')
    .select('id,thread_id,sender_id,read')
    .eq('id', payload.record.id)
    .maybeSingle();
  if (messageError) {
    console.error('Message webhook reload failed:', messageError.message || 'unknown error');
    return json(500, { error: 'Could not reload message.' });
  }
  if (!message) return json(200, { sent: false, missing: true });

  const { data: thread, error: threadError } = await service.from('message_threads')
    .select('id,user_low,user_high')
    .eq('id', message.thread_id)
    .maybeSingle();
  if (threadError) {
    console.error('Message thread lookup failed:', threadError.message || 'unknown error');
    return json(500, { error: 'Could not load thread.' });
  }
  if (!thread) return json(200, { sent: false, missingThread: true });

  const senderIsLow = message.sender_id === thread.user_low;
  const senderIsHigh = message.sender_id === thread.user_high;
  if (senderIsLow === senderIsHigh) {
    console.warn('Message notification ignored because sender is not exactly one thread participant.');
    return json(200, { sent: false, invalidSender: true });
  }
  const recipientId = senderIsLow ? thread.user_high : thread.user_low;
  const recipientSide = recipientId === thread.user_low ? 'low' : 'high';

  const { data: won, error: claimError } = await service.rpc('claim_message_notification', {
    p_message_id: message.id,
    p_thread_id: thread.id,
    p_recipient_id: recipientId
  });
  if (claimError) {
    console.error('Message notification claim failed:', claimError.message || 'unknown error');
    return json(500, { error: 'Could not claim notification.' });
  }
  if (won !== true) return json(200, { sent: false, claimed: false });

  const { data: readCheck, error: readError } = await service.from('messages')
    .select('read').eq('id', message.id).maybeSingle();
  if (readError) {
    console.error('Post-claim read check failed:', readError.message || 'unknown error');
    return json(200, { sent: false });
  }
  if (!readCheck || readCheck.read) {
    const release = recipientSide === 'low'
      ? { notify_claimed_low: false }
      : { notify_claimed_high: false };
    const { error: releaseError } = await service.from('message_threads')
      .update(release).eq('id', thread.id);
    if (releaseError) console.error('Message notification claim release failed.');
    return json(200, { sent: false, becameRead: true });
  }

  const { data: recipientProfile, error: prefsError } = await service.from('profiles')
    .select('email_notifications').eq('user_id', recipientId).maybeSingle();
  if (prefsError) {
    console.error('Message notification preference lookup failed.');
    return json(200, { sent: false });
  }
  if (!recipientProfile || recipientProfile.email_notifications === false) {
    return json(200, { sent: false, disabled: true });
  }

  const [{ data: senderProfile, error: senderError }, authResult] = await Promise.all([
    service.from('profiles').select('first_name,last_name').eq('user_id', message.sender_id).maybeSingle(),
    service.auth.admin.getUserById(recipientId)
  ]);
  if (senderError) console.warn('Message sender profile lookup failed; using a generic sender label.');
  if (authResult.error || !authResult.data || !authResult.data.user || !authResult.data.user.email) {
    console.warn('Message notification skipped because recipient auth email is unavailable.');
    return json(200, { sent: false, noEmail: true });
  }

  const senderName = senderProfile
    ? [senderProfile.first_name, senderProfile.last_name].filter(Boolean).join(' ')
    : 'A member';
  try {
    const result = await sendMessageNotification({
      to: authResult.data.user.email,
      recipientId,
      senderName,
      idempotencyKey: 'msgnotify-' + thread.id + '-' + recipientId + '-' + message.id
    });
    return json(200, { sent: true, id: result.id });
  } catch (emailError) {
    console.error('Message notification send failed:', emailError && emailError.message || 'unknown error');
    return json(200, { sent: false });
  }
};

exports.__test = { headerValue, secretMatches, isUuid, json };
