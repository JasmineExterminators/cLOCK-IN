// Accounts and cloud saves, talking to our own /api routes (which use Supabase).
//
// The session (access + refresh token) lives in localStorage. Every request
// sends the access token; if it has expired we refresh once and retry.

const SESSION_KEY = 'clockin.session';
const META_KEY = 'clockin.cloud'; // { userId, email, version } for the save in this browser

// The API only exists on the deployed site (or `vercel dev`), not inside a claude.ai preview.
export const cloudAvailable = () =>
  location.protocol.startsWith('http') && !/claude\.ai|claudeusercontent|anthropic/.test(location.hostname);

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let session = read(SESSION_KEY); // { access_token, refresh_token, expires_at, user: { id, email } }
export const currentUser = () => (session ? session.user : null);
export const getMeta = () => read(META_KEY) || {};
export const setMeta = (m) => write(META_KEY, m);

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

async function raw(method, path, body, token) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'offline', 'Can’t reach the server. Check your connection.');
  }
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok || !json) throw new ApiError(res.status, json?.error || 'server_error', json?.message || 'Something went wrong. Try again.', json || {});
  return json;
}

function keep(res) {
  session = { ...res.session, user: res.user };
  write(SESSION_KEY, session);
  return session.user;
}

let refreshing = null;
async function refresh() {
  if (!session?.refresh_token) throw new ApiError(401, 'signed_out', 'Please sign in again.');
  refreshing = refreshing || raw('POST', '/api/auth', { action: 'refresh', refresh_token: session.refresh_token })
    .then(keep)
    .catch((e) => { if (e.status === 401) signOutLocal(); throw e; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

// Authenticated request with one automatic refresh.
export async function api(method, path, body) {
  if (!session) throw new ApiError(401, 'signed_out', 'Please sign in.');
  if (session.expires_at && session.expires_at * 1000 < Date.now() + 60e3) await refresh();
  try {
    return await raw(method, path, body, session.access_token);
  } catch (e) {
    if (e.status !== 401) throw e;
    await refresh();
    return raw(method, path, body, session.access_token);
  }
}

export async function signUp(email, password) {
  return keep(await raw('POST', '/api/auth', { action: 'signup', email, password }));
}
export async function signIn(email, password) {
  return keep(await raw('POST', '/api/auth', { action: 'login', email, password }));
}
export function signOutLocal() {
  session = null;
  write(SESSION_KEY, null);
  write(META_KEY, null);
}

export const cloudSave = {
  get: () => api('GET', '/api/save'),
  put: (data, baseVersion, force = false) => api('PUT', '/api/save', { data, baseVersion, force }),
};

/**
 * Merge two saves after a conflict. The other device's save wins, but no study
 * time is ever dropped: shifts that exist only here are added back.
 */
export function mergeSaves(remote, local) {
  const out = structuredClone(remote);
  const ids = new Set((out.sessions || []).map((s) => s.id));
  for (const s of local.sessions || []) if (!ids.has(s.id)) out.sessions.push({ ...s, paid: false, checkNo: undefined });
  if (!out.clockedInAt && local.clockedInAt) { out.clockedInAt = local.clockedInAt; out.task = local.task; }
  return out;
}
