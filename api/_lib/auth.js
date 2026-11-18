// Accounts through Supabase Auth (email + password).
//
// Sign-up goes through the admin API with the email pre-confirmed, so no
// confirmation email (and no email service) is needed. Everything else uses
// the normal password sign-in and refresh-token flow.
import { createClient } from '@supabase/supabase-js';

const env = (...names) => names.map((n) => process.env[n]).find(Boolean);

let admin = null;
let anon = null;
function clients() {
  const url = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('Supabase keys are missing. Connect the Supabase database to this Vercel project.');
  const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  if (!admin) admin = createClient(url, serviceKey, opts);
  if (!anon) anon = createClient(url, anonKey, opts);
  return { admin, anon };
}

const shapeSession = (session, user) => ({
  session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at },
  user: { id: user.id, email: user.email },
});

export const supabaseAuth = {
  async createUser(email, password) {
    const { error } = await clients().admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (!error) return {};
    const taken = /already|registered|exists/i.test(error.message || '') || error.status === 422;
    return { error: taken ? 'taken' : 'failed', message: error.message };
  },
  async signIn(email, password) {
    const { data, error } = await clients().anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) return { error: 'bad_login' };
    return shapeSession(data.session, data.user);
  },
  async refresh(refreshToken) {
    const { data, error } = await clients().anon.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return { error: 'expired' };
    return shapeSession(data.session, data.user);
  },
  async getUser(accessToken) {
    const { data, error } = await clients().admin.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email };
  },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleAuth(auth, body = {}) {
  const action = body.action;
  if (action === 'signup' || action === 'login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!EMAIL.test(email)) return { status: 400, json: { error: 'bad_email', message: 'That email doesn’t look right.' } };
    if (action === 'signup') {
      if (password.length < 8) return { status: 400, json: { error: 'weak_password', message: 'Use at least 8 characters for your password.' } };
      const made = await auth.createUser(email, password);
      if (made.error === 'taken') return { status: 409, json: { error: 'taken', message: 'There’s already an account with that email. Sign in instead.' } };
      if (made.error) return { status: 400, json: { error: 'signup_failed', message: made.message || 'Couldn’t create the account. Try again.' } };
    }
    const res = await auth.signIn(email, password);
    if (res.error) return { status: 401, json: { error: 'bad_login', message: 'Wrong email or password.' } };
    return { status: 200, json: res };
  }
  if (action === 'refresh') {
    const res = await auth.refresh(String(body.refresh_token || ''));
    if (res.error) return { status: 401, json: { error: 'expired', message: 'Please sign in again.' } };
    return { status: 200, json: res };
  }
  return { status: 400, json: { error: 'bad_action', message: 'Unknown action.' } };
}

// Reads "Authorization: Bearer <token>" and returns the user, or null.
export async function userFrom(req, auth = supabaseAuth) {
  const h = req.headers?.authorization || req.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  return auth.getUser(m[1]);
}
