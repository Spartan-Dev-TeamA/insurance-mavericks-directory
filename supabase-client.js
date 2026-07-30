/* ============================================================
   Insurance Mavericks — Supabase Client & Data Access Layer
   Talks to the schema in supabase/migrations/0001_init.sql and
   0002_tiers_and_messaging.sql.
   See SUPABASE_SETUP.md for how to create the project and wire
   these values up.
   ============================================================ */

// ─────────────────────────────────────────────
//  SUPABASE SETUP
//  1. Create a project at https://supabase.com
//  2. Run supabase/migrations/0001_init.sql (SQL Editor or `supabase db push`)
//  3. Project Settings → API → copy the Project URL and anon public key below
//  4. Enable the Google provider under Authentication → Providers if you
//     want Google Sign-In to work (see SUPABASE_SETUP.md for exact steps)
// ─────────────────────────────────────────────
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const DB_READY = SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

const sb = DB_READY ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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
    otherFirst: row.other_first,
    otherLast: row.other_last,
    otherPhoto: row.other_photo,
    lastBody: row.last_body,
    lastAt: row.last_at,
    unread: row.unread_count || 0
  };
}

function requireConfigured() {
  if (!DB_READY) throw new Error('NOT_CONFIGURED');
}

window.db = {
  ready: DB_READY,

  auth: {
    async getSession() {
      if (!DB_READY) return null;
      const { data } = await sb.auth.getSession();
      return data.session;
    },

    onAuthStateChange(callback) {
      if (!DB_READY) return;
      sb.auth.onAuthStateChange((_event, session) => callback(session));
    },

    async signUpWithPassword(email, password) {
      requireConfigured();
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      return data.session;
    },

    async signInWithPassword(email, password) {
      requireConfigured();
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.session;
    },

    async signInWithGoogleIdToken(idToken) {
      requireConfigured();
      const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (error) throw error;
      return data.session;
    },

    async signOut() {
      if (!DB_READY) return;
      await sb.auth.signOut();
    }
  },

  profiles: {
    // Full directory listing (RLS restricts this to signed-in members).
    async list() {
      if (!DB_READY) return [];
      const { data, error } = await sb.from('profiles').select('*').order('joined_at', { ascending: false });
      if (error) throw error;
      return data.map(mapProfileRow);
    },

    // Server-side search/filter — mirrors list() shape, narrower result set.
    async search(q, stateFilter, lobFilter) {
      if (!DB_READY) return [];
      const { data, error } = await sb.rpc('search_directory', {
        q: q || '', state_filter: stateFilter || '', lob_filter: lobFilter || ''
      });
      if (error) throw error;
      return data.map(mapProfileRow);
    },

    // The signed-in user's own profile, or null if they haven't joined yet.
    async mine() {
      if (!DB_READY) return null;
      const { data: userData } = await sb.auth.getUser();
      if (!userData?.user) return null;
      const { data, error } = await sb.from('profiles').select('*').eq('user_id', userData.user.id).maybeSingle();
      if (error) throw error;
      return mapProfileRow(data);
    },

    async upsertMine(p) {
      requireConfigured();
      const { data, error } = await sb.rpc('upsert_my_profile', {
        p_first_name: p.first,
        p_last_name: p.last,
        p_agency: p.agency || '',
        p_home_state: p.home,
        p_states: p.states,
        p_lobs: p.lobs,
        p_specs: p.specs || [],
        p_bio: p.bio || '',
        p_facebook_url: p.fb || ''
      });
      if (error) throw error;
      return mapProfileRow(data);
    },

    async deleteMine() {
      requireConfigured();
      const { error } = await sb.rpc('delete_my_profile');
      if (error) throw error;
    },

    // Uploads to the `avatars` Storage bucket under the user's own folder,
    // then points the profile row's photo_url at the public URL.
    async uploadPhoto(file) {
      requireConfigured();
      const { data: userData } = await sb.auth.getUser();
      if (!userData?.user) throw new Error('NOT_SIGNED_IN');
      const path = `${userData.user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await sb.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: pub } = sb.storage.from('avatars').getPublicUrl(path);
      const { data, error } = await sb.rpc('set_my_photo', { p_photo_url: pub.publicUrl });
      if (error) throw error;
      return mapProfileRow(data);
    },

    // Self-service downgrade only ('free') — the database RPC rejects
    // any other value. Paid tiers ('basic'/'pro') are granted by the
    // Stripe webhook after a real checkout; see STRIPE_SETUP.md.
    async setTier(tier) {
      requireConfigured();
      const { data, error } = await sb.rpc('set_my_tier', { p_tier: tier });
      if (error) throw error;
      return mapProfileRow(data);
    }
  },

  stats: {
    // Public teaser numbers — works for signed-out visitors too.
    async get() {
      if (!DB_READY) return { members_count: 0, states_count: 0, lobs_count: 0, specs_count: 0 };
      const { data, error } = await sb.rpc('get_directory_stats');
      if (error) throw error;
      return data[0];
    }
  },

  messaging: {
    // Pro-only messaging. The Pro-tier requirement is enforced server-side
    // in send_message() — this is UX, not the security boundary.
    async listThreads() {
      if (!DB_READY) return [];
      const { data, error } = await sb.rpc('list_my_threads');
      if (error) throw error;
      return data.map(mapThreadRow);
    },

    async listMessages(threadId) {
      if (!DB_READY) return [];
      const { data, error } = await sb.from('messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },

    async send(toUserId, body) {
      requireConfigured();
      const { data, error } = await sb.rpc('send_message', { p_to_user: toUserId, p_body: body });
      if (error) throw error;
      return data;
    },

    async markRead(threadId) {
      if (!DB_READY) return;
      const { error } = await sb.rpc('mark_thread_read', { p_thread_id: threadId });
      if (error) throw error;
    }
  }
};
