// Friends client: crews on /api/crew. Requires being signed in (see cloud.js).
import { api } from './cloud.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const normCode = (s) => {
  const c = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 6 && [...c].every((ch) => ALPHABET.includes(ch)) ? c : null;
};
export const prettyCode = (c) => `${c.slice(0, 3)}-${c.slice(3)}`;

export const crewApi = {
  mine: () => api('GET', '/api/crew'),
  get: (code) => api('GET', `/api/crew?code=${encodeURIComponent(code)}`),
  create: (card, name) => api('POST', '/api/crew', { action: 'create', card, name }),
  updateAll: (card) => api('POST', '/api/crew', { action: 'update_all', card }),
  rename: (code, name) => api('POST', '/api/crew', { action: 'rename', code, name }),
  join: (code, card) => api('POST', '/api/crew', { action: 'join', code, card }),
  update: (code, card) => api('POST', '/api/crew', { action: 'update', code, card }),
  leave: (code) => api('POST', '/api/crew', { action: 'leave', code }),
};
