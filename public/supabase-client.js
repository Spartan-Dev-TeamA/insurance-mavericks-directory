/* Insurance Mavericks — Supabase client and data-access layer. */
const SUPABASE_URL = 'https://krdjdzikepmkcjjibvqt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyZGpkemlrZXBta2NqamlidnF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MjI1OTgsImV4cCI6MjEwMTQ5ODU5OH0.k_NOjlg_RKhGorj56gjJ0tc9R4azfbbvynPJh65hcUU';
const DB_READY = true;
const PROFILE_COLUMNS = [
  'id', 'user_id', 'first_name', 'last_name', 'agency', 'home_state',
  'states', 'lobs', 'specs', 'bio', 'facebook_url', 'photo_url',
  'joined_at', 'updated_at', 'tier'
].join(',');
const MESSAGE_COLUMNS = 'id,thread_id,sender_id,body,read,created_at';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


async function authedFunctionRequest(name, body) {
  const { data, error: sessionError } = await sb.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = data && data.session && data.session.access_token;
  if (!accessToken) throw new Error('You need to be signed in.');

  const response = await fetch('/.netlify/functions/' + name, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken
    },
    body: JSON.stringify(body || {})
  });
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}
window.authedFunctionRequest = authedFunctionRequest;

function mapProfileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    first: row.first_name,
    last: row.last_name,
    agency: row.agency || '',
    home: row.home_state,
    states: row.states || [],
    lobs: row.lobs || [],
    specs: row.specs || [],
    bio: row.bio || '',
    fb: row.facebook_url || '',
    photo: row.photo_url || null,
    tier: row.tier || 'free',
    joined: new Date(row.joined_at).toLocaleString('default', { month: 'short', year: 'numeric' })
  };
}

function mapThreadRow(row) {
  return {
    threadId: row.thread_id,
    otherUserId: row.other_user_id,
    otherFirst: row.other_first || 'Former',
    otherLast: row.other_last || 'member',
    otherPhoto: row.other_photo || null,
    lastBody: row.last_body || '',
    lastAt: row.last_at,
    unread: Number(row.unread_count) || 0
  };
}

window.db = {
  ready: DB_READY,

  auth: {
    async getSession() {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    onAuthStateChange(callback) {
      return sb.auth.onAuthStateChange((_event, session) => callback(session));
    },

    async signUpWithPassword(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      return data.session;
    },

    async signInWithPassword(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.session;
    },

    async signInWithGoogleIdToken(idToken) {
      const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (error) throw error;
      return data.session;
    },

    async signOut() {
      const { error } = await sb.auth.signOut();
      if (error) throw error;
    }
  },

  profiles: {
    async list() {
      const { data, error } = await sb.from('profiles')
        .select(PROFILE_COLUMNS)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      return data.map(mapProfileRow);
    },

    async search(q, stateFilter, lobFilter) {
      const { data, error } = await sb.rpc('search_directory', {
        q: q || '',
        state_filter: stateFilter || '',
        lob_filter: lobFilter || ''
      });
      if (error) throw error;
      return data.map(mapProfileRow);
    },

    async mine() {
      const { data: userData, error: userError } = await sb.auth.getUser();
      if (userError) throw userError;
      if (!userData?.user) return null;
      const { data, error } = await sb.from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (error) throw error;
      return mapProfileRow(data);
    },

    async upsertMine(profile) {
      const { data, error } = await sb.rpc('upsert_my_profile', {
        p_first_name: profile.first,
        p_last_name: profile.last,
        p_agency: profile.agency || '',
        p_home_state: profile.home,
        p_states: profile.states,
        p_lobs: profile.lobs,
        p_specs: profile.specs || [],
        p_bio: profile.bio || '',
        p_facebook_url: profile.fb || ''
      });
      if (error) throw error;
      return mapProfileRow(Array.isArray(data) ? data[0] : data);
    },

    async deleteMine() {
      const { error } = await sb.rpc('delete_my_profile');
      if (error) throw error;
    },

    async uploadPhoto(file) {
      const { data: userData, error: userError } = await sb.auth.getUser();
      if (userError) throw userError;
      if (!userData?.user) throw new Error('NOT_SIGNED_IN');
      const storagePath = `${userData.user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await sb.storage.from('avatars')
        .upload(storagePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicData } = sb.storage.from('avatars').getPublicUrl(storagePath);
      const { data, error } = await sb.rpc('set_my_photo', { p_photo_url: publicData.publicUrl });
      if (error) throw error;
      return mapProfileRow(Array.isArray(data) ? data[0] : data);
    },

    async setTier(tier) {
      const { data, error } = await sb.rpc('set_my_tier', { p_tier: tier });
      if (error) throw error;
      return mapProfileRow(Array.isArray(data) ? data[0] : data);
    }
  },


  prefs: {
    async get() {
      const { data, error } = await sb.rpc('get_my_email_prefs');
      if (error) throw error;
      return data === true;
    },

    async set(enabled) {
      const { data, error } = await sb.rpc('set_my_email_prefs', { p_enabled: !!enabled });
      if (error) throw error;
      return data === true;
    }
  },

  welcome: {
    async send() {
      return authedFunctionRequest('send-welcome-email', {});
    }
  },

  stats: {
    async get() {
      const { data, error } = await sb.rpc('get_directory_stats');
      if (error) throw error;
      return data[0];
    },

    async getStateCoverage() {
      const { data, error } = await sb.rpc('get_state_coverage_counts');
      if (error) throw error;
      return data || [];
    }
  },

  messaging: {
    async listThreads() {
      const { data, error } = await sb.rpc('list_my_threads');
      if (error) throw error;
      return data.map(mapThreadRow);
    },

    async listMessages(threadId) {
      const { data, error } = await sb.from('messages')
        .select(MESSAGE_COLUMNS)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },

    async send(toUserId, body) {
      const { data, error } = await sb.rpc('send_message', {
        p_to_user: toUserId,
        p_body: body
      });
      if (error) throw error;
      return data;
    },

    async markRead(threadId) {
      const { error } = await sb.rpc('mark_thread_read', { p_thread_id: threadId });
      if (error) throw error;
    }
  }
};
