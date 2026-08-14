const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { esc, getSiteUrl, sendEmail } = require('./lib/email');
const { listIncompleteUsers } = require('./lib/incomplete-users');

const FIRST_NUDGE_AGE_MS = 24 * 60 * 60 * 1000;
const SECOND_NUDGE_AGE_MS = 72 * 60 * 60 * 1000;
const SECOND_NUDGE_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_SENDS_PER_RUN = 5;
const STOP_STARTING_AFTER_MS = 18000;

function json(statusCode, value) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(value)
  };
}

function dueOrdinal(user, nowMs) {
  if (user.opted_out || user.nudge_count >= 2) return null;
  const createdAt = Date.parse(user.created_at || '');
  if (!Number.isFinite(createdAt)) return null;
  const age = nowMs - createdAt;
  if (user.nudge_count === 0) return age >= FIRST_NUDGE_AGE_MS ? 1 : null;
  if (user.nudge_count !== 1 || age < SECOND_NUDGE_AGE_MS) return null;
  const nudgedAt = Date.parse(user.nudged_at || '');
  if (!Number.isFinite(nudgedAt)) return null;
  return nowMs - nudgedAt >= SECOND_NUDGE_MIN_INTERVAL_MS ? 2 : null;
}

function onboardingUnsubscribeUrl(userId) {
  const secret = process.env.UNSUBSCRIBE_HMAC_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_HMAC_SECRET is not configured.');
  const payload = 'v1:onboarding:' + userId;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const url = new URL('/.netlify/functions/email-unsubscribe', getSiteUrl());
  url.searchParams.set('uid', userId);
  url.searchParams.set('scope', 'onboarding');
  url.searchParams.set('sig', signature);
  return url.toString();
}

function onboardingNudgeEmail(userId, ordinal) {
  const site = getSiteUrl();
  const unsubscribe = onboardingUnsubscribeUrl(userId);
  const heading = ordinal === 1 ? 'Complete your member profile' : 'Your directory profile is still waiting';
  const copy = ordinal === 1
    ? 'Finish setting up your Insurance Mavericks profile so fellow members can find you in the directory.'
    : 'Add your profile to the Insurance Mavericks directory to make your licenses and expertise visible to fellow members.';
  const html = '<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#f0f0f0;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:36px 24px"><div style="color:#1db954;font-weight:700;letter-spacing:2px">INSURANCE MAVERICKS</div><h1 style="font-size:28px;margin:24px 0 16px">' +
    esc(heading) + '</h1><p style="font-size:16px;line-height:1.6;color:#d7d7d7">' + esc(copy) +
    '</p><p style="margin:28px 0"><a href="' + esc(site) + '" style="display:inline-block;background:#1db954;color:#000;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:6px">Complete your profile</a></p><div style="margin-top:32px;font-size:12px;line-height:1.6;color:#888"><a href="' +
    esc(unsubscribe) + '" style="color:#1db954">Stop onboarding reminder emails</a>.<div style="margin-top:12px">Spartan Business Warriors LLC · c/o Wyoming Registered Agent Services LLC<br>30 N Gould St Ste R, Sheridan, WY 82801</div></div></div></body></html>';
  const text = 'Insurance Mavericks\n\n' + heading + '\n\n' + copy +
    '\n\nComplete your profile: ' + site +
    '\n\nStop onboarding reminder emails: ' + unsubscribe +
    '\n\nSpartan Business Warriors LLC · c/o Wyoming Registered Agent Services LLC\n30 N Gould St Ste R, Sheridan, WY 82801';
  return {
    subject: heading,
    html,
    text,
    headers: {
      'List-Unsubscribe': '<' + unsubscribe + '>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
}

async function processCandidate(service, candidate, nowMs) {
  const { error: ensureError } = await service.from('onboarding_nudges')
    .upsert({ user_id: candidate.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (ensureError) throw ensureError;

  const [profileResult, nudgeResult] = await Promise.all([
    service.from('profiles').select('user_id').eq('user_id', candidate.id).maybeSingle(),
    service.from('onboarding_nudges')
      .select('user_id,nudge_count,nudged_at,opted_out')
      .eq('user_id', candidate.id)
      .single()
  ]);
  if (profileResult.error) throw profileResult.error;
  if (nudgeResult.error) throw nudgeResult.error;
  if (profileResult.data) return { skipped: 'profile-complete' };

  const fresh = {
    ...candidate,
    nudge_count: Number(nudgeResult.data.nudge_count) || 0,
    nudged_at: nudgeResult.data.nudged_at,
    opted_out: nudgeResult.data.opted_out === true
  };
  const ordinal = dueOrdinal(fresh, nowMs);
  if (!ordinal) return { skipped: fresh.opted_out ? 'opted-out' : 'not-due' };

  const email = onboardingNudgeEmail(candidate.id, ordinal);
  const result = await sendEmail({
    ...email,
    to: candidate.email,
    idempotencyKey: 'onboarding-nudge/' + candidate.id + '/' + ordinal
  });

  const timestamp = new Date().toISOString();
  const { data: updated, error: updateError } = await service.from('onboarding_nudges')
    .update({ nudge_count: ordinal, nudged_at: timestamp, updated_at: timestamp })
    .eq('user_id', candidate.id)
    .eq('nudge_count', ordinal - 1)
    .eq('opted_out', false)
    .select('user_id');
  if (updateError) throw updateError;
  if (!updated || updated.length !== 1) {
    console.warn('Onboarding nudge sent but CAS did not win for user:', candidate.id);
    return { sent: true, casWon: false, ordinal, id: result.id };
  }
  return { sent: true, casWon: true, ordinal, id: result.id };
}

exports.handler = async () => {
  const startedAt = Date.now();
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, SITE_URL, UNSUBSCRIBE_HMAC_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !SITE_URL || !UNSUBSCRIBE_HMAC_SECRET) {
    console.error('Incomplete-profile nudge is missing required configuration.');
    return json(500, { error: 'Server not configured.' });
  }

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let incomplete;
  try {
    incomplete = await listIncompleteUsers(service);
  } catch (error) {
    console.error('Could not list incomplete users:', error && error.message || 'unknown error');
    return json(500, { error: 'Could not list incomplete users.' });
  }

  const nowMs = Date.now();
  const candidates = incomplete.filter((user) =>
    user.email && user.email_confirmed_at && dueOrdinal(user, nowMs)
  );

  let sent = 0;
  let failed = 0;
  let examined = 0;
  let sendAttempts = 0;
  for (const candidate of candidates) {
    if (sendAttempts >= MAX_SENDS_PER_RUN || Date.now() - startedAt >= STOP_STARTING_AFTER_MS) break;
    examined += 1;
    sendAttempts += 1;
    try {
      const outcome = await processCandidate(service, candidate, Date.now());
      if (outcome.sent) sent += 1;
    } catch (error) {
      failed += 1;
      console.error('Onboarding nudge failed for user ' + candidate.id + ':', error && error.message || 'unknown error');
    }
  }

  const deferred = Math.max(0, candidates.length - examined);
  if (deferred > 0) console.log('Onboarding nudge deferred eligible users:', deferred);
  console.log('Onboarding nudge run complete:', { eligible: candidates.length, sent, failed, deferred });
  return json(200, { eligible: candidates.length, sent, failed, deferred });
};

exports.__test = {
  FIRST_NUDGE_AGE_MS,
  SECOND_NUDGE_AGE_MS,
  SECOND_NUDGE_MIN_INTERVAL_MS,
  MAX_SENDS_PER_RUN,
  STOP_STARTING_AFTER_MS,
  dueOrdinal,
  onboardingNudgeEmail,
  onboardingUnsubscribeUrl,
  processCandidate
};
