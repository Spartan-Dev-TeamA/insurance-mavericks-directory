const { createClient } = require('@supabase/supabase-js');
const { sendWelcome } = require('./lib/email');

function json(statusCode, value) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Welcome email handler is missing Supabase configuration.');
    return json(500, { error: 'Server not configured.' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Not signed in.' });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData || !userData.user) return json(401, { error: 'Invalid or expired session.' });

  const user = userData.user;
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await service.from('profiles')
    .update({ welcomed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('welcomed_at', null)
    .select('first_name');

  if (error) {
    console.error('Welcome email claim failed:', error.message || 'unknown error');
    return json(500, { error: 'Could not claim welcome email.' });
  }
  if (!data || data.length === 0) return json(200, { sent: false, alreadyClaimed: true });
  if (data.length !== 1) {
    console.error('Welcome email claim matched an unexpected number of profiles.');
    return json(500, { error: 'Could not claim welcome email.' });
  }

  if (!user.email) {
    console.warn('Welcome email skipped because the authenticated user has no email.');
    return json(200, { sent: false, noEmail: true });
  }

  try {
    const result = await sendWelcome({
      to: user.email,
      userId: user.id,
      firstName: data[0].first_name,
      idempotencyKey: 'welcome-' + user.id
    });
    return json(200, { sent: true, id: result.id });
  } catch (emailError) {
    console.error('Welcome email send failed:', emailError && emailError.message || 'unknown error');
    return json(200, { sent: false });
  }
};

exports.__test = { json };
