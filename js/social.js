// Friends client: talks to /api/crew on the Vercel deployment.
//
// You and your friends join the same "crew" with a 6-character code. Each person's
// browser keeps a random player id and secret token; the server only lets that
// token change that player's card. Cards are tiny: name, home, car, title, hours,
// and whether you're on the clock.

const API = '/api/crew';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newPlayer() {
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const id = [...rand(12)].map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  const token = [...rand(32)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { id, token };
}

export const normCode = (s) => {
  const c = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 6 && [...c].every((ch) => ALPHABET.includes(ch)) ? c : null;
};
export const prettyCode = (c) => `${c.slice(0, 3)}-${c.slice(3)}`;

// The API only exists on the deployed site (or `vercel dev`), not inside a claude.ai preview.
export const friendsAvailable = () =>
  location.protocol.startsWith('http') && !/claude\.ai|claudeusercontent|anthropic/.test(location.hostname);

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

async function call(method, { code, body } = {}) {
  let res;
  try {
    res = await fetch(method === 'GET' ? `${API}?code=${encodeURIComponent(code)}` : API, {
      method,
      headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'offline', 'Can’t reach the server. Check your connection.');
  }
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok || !json) throw new ApiError(res.status, json?.error || 'server_error', json?.message || 'Something went wrong. Try again.');
  return json;
}

export const crewApi = {
  get: (code) => call('GET', { code }),
  create: (player, card) => call('POST', { body: { action: 'create', ...player, card } }),
  join: (player, code, card) => call('POST', { body: { action: 'join', ...player, code, card } }),
  update: (player, code, card) => call('POST', { body: { action: 'update', ...player, code, card } }),
  leave: (player, code) => call('POST', { body: { action: 'leave', ...player, code } }),
};
