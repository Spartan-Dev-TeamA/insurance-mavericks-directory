#!/usr/bin/env node
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  sendMembershipConfirmation,
  sendWelcome,
  sendMessageNotification
} = require('../netlify/functions/lib/email');

const required = ['RESEND_API_KEY', 'EMAIL_FROM', 'TEST_EMAIL_TO'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error('Missing required environment variables: ' + missing.join(', '));
  process.exit(1);
}

process.env.SITE_URL = process.env.SITE_URL || 'https://insurance-mavericks.com';
process.env.UNSUBSCRIBE_HMAC_SECRET =
  process.env.UNSUBSCRIBE_HMAC_SECRET || crypto.randomBytes(32).toString('hex');

const runId = Date.now().toString(36);
const to = process.env.TEST_EMAIL_TO;
const variants = [
  ['activated', () => sendMembershipConfirmation({
    to, transition: 'activated', tier: 'basic', interval: 'month',
    idempotencyKey: 'live-test-activated-' + runId
  })],
  ['updated', () => sendMembershipConfirmation({
    to, transition: 'updated', tier: 'pro', interval: 'year',
    idempotencyKey: 'live-test-updated-' + runId
  })],
  ['cancelled', () => sendMembershipConfirmation({
    to, transition: 'cancelled', tier: 'free', interval: 'month',
    idempotencyKey: 'live-test-cancelled-' + runId
  })],
  ['welcome', () => sendWelcome({
    to, userId: '00000000-0000-4000-8000-000000000001', firstName: 'Maverick',
    idempotencyKey: 'live-test-welcome-' + runId
  })],
  ['message-notification', () => sendMessageNotification({
    to, recipientId: '00000000-0000-4000-8000-000000000001',
    senderName: 'Test Member',
    idempotencyKey: 'live-test-message-' + runId
  })]
];

const sent = [];
for (const [name, send] of variants) {
  try {
    const result = await send();
    sent.push([name, result.id]);
    console.log('SENT ' + name + ': ' + result.id);
  } catch (error) {
    console.error('FAIL ' + name + ': ' + (error && error.message || error));
    process.exitCode = 1;
  }
}

const terminal = new Set(['delivered', 'bounced', 'complained', 'failed', 'canceled']);
async function retrieve(id) {
  const response = await fetch('https://api.resend.com/emails/' + encodeURIComponent(id), {
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'User-Agent': 'Insurance-Mavericks-Email-Test/1.0'
    }
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}

await Promise.all(sent.map(async ([name, id]) => {
  let observed = 'unknown';
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const email = await retrieve(id);
      observed = email.status || email.last_event || 'unknown';
      console.log('STATUS ' + name + ' [' + id + ']: ' + observed);
      if (terminal.has(observed)) break;
    } catch (error) {
      console.error('POLL ' + name + ' [' + id + ']: ' + error.message);
    }
    if (attempt < 12) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}));
