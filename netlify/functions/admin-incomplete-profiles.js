const { createClient } = require('@supabase/supabase-js');
const { listIncompleteUsers } = require('./lib/incomplete-users');

const REPORT_LIMIT = 500;

function json(statusCode, value) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(value)
  };
}

function adminUserIds(raw) {
  return new Set(String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean));
}

function bearerToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USER_IDS } = process.env;
  const allowed = adminUserIds(ADMIN_USER_IDS);
  if (allowed.size === 0) return json(403, { error: 'Forbidden.' });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Admin incomplete-profile handler is missing Supabase configuration.');
    return json(500, { error: 'Server not configured.' });
  }

  const token = bearerToken(event);
  if (!token) return json(401, { error: 'Not signed in.' });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData || !userData.user) {
    return json(401, { error: 'Invalid or expired session.' });
  }
  if (!allowed.has(userData.user.id)) return json(403, { error: 'Forbidden.' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { payload = {}; }
  if (payload.mode === 'probe') return json(200, { authorized: true });

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    const incomplete = await listIncompleteUsers(service);
    const users = incomplete.slice(0, REPORT_LIMIT).map((user) => ({
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed_at: user.email_confirmed_at,
      nudge_count: user.nudge_count,
      nudged_at: user.nudged_at,
      opted_out: user.opted_out
    }));
    return json(200, {
      users,
      total: incomplete.length,
      truncated: incomplete.length > users.length
    });
  } catch (error) {
    console.error('Could not build incomplete-profile report:', error && error.message || 'unknown error');
    return json(500, { error: 'Could not build incomplete-profile report.' });
  }
};

exports.__test = { REPORT_LIMIT, adminUserIds, bearerToken, json };
