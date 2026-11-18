// Crew logic, independent of storage so it can be tested without Vercel.
//
// A crew is one JSON document: { v, code, createdAt, members: { [playerId]: { tokenHash, card, joinedAt, updatedAt } } }.
// Players prove who they are with a random token kept in their browser; only its SHA-256 is stored.
// Writes are read-modify-write with an ETag check, retried on conflict, so two friends
// updating at the same moment don't overwrite each other.

import crypto from 'node:crypto';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
export const MAX_MEMBERS = 24;

export class Conflict extends Error {}

export const newCode = () => {
  const bytes = crypto.randomBytes(6);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
};

export const normCode = (s) => {
  const c = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 6 && [...c].every((ch) => CODE_ALPHABET.includes(ch)) ? c : null;
};

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const validId = (id) => typeof id === 'string' && /^[a-z0-9]{8,32}$/i.test(id);
const validToken = (t) => typeof t === 'string' && /^[a-f0-9]{32,128}$/.test(t);

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v, max = 1e7) => (Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0);
const time = (v) => (Number.isFinite(v) && v > 1.5e12 && v < 4e12 ? v : null);

// Only these fields, trimmed and bounded, ever get stored.
export function cleanCard(c = {}) {
  return {
    name: str(c.name, 24).trim(),
    home: str(c.home, 32),
    car: str(c.car, 32),
    title: str(c.title, 40),
    hours: num(c.hours),
    weekHours: num(c.weekHours, 168),
    weekStart: time(c.weekStart),
    clockedInAt: time(c.clockedInAt),
    task: str(c.task, 60),
  };
}

export function publicCrew(doc) {
  return {
    code: doc.code,
    members: Object.entries(doc.members || {}).map(([id, m]) => ({ id, ...m.card, updatedAt: m.updatedAt })),
  };
}

const ok = (json) => ({ status: 200, json });
const fail = (status, error, message) => ({ status, json: { error, message } });

/**
 * store: { read(code) -> {doc, etag} | null, create(code, doc) (throws Conflict if exists),
 *          replace(code, doc, etag) (throws Conflict if etag is stale) }
 */
export async function handle(store, method, query = {}, body = {}) {
  if (method === 'GET') {
    const code = normCode(query.code);
    if (!code) return fail(400, 'bad_code', 'That crew code doesn’t look right.');
    const found = await store.read(code);
    if (!found) return fail(404, 'no_crew', 'No crew with that code.');
    return ok(publicCrew(found.doc));
  }

  if (method !== 'POST') return fail(405, 'method', 'Use GET or POST.');
  const { action, id, token } = body || {};
  if (!validId(id) || !validToken(token)) return fail(400, 'bad_player', 'Missing or invalid player id.');
  const tokenHash = hashToken(token);
  const now = Date.now();

  if (action === 'create') {
    const card = cleanCard(body.card);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      const doc = { v: 1, code, createdAt: now, members: { [id]: { tokenHash, card, joinedAt: now, updatedAt: now } } };
      try {
        await store.create(code, doc);
        return ok(publicCrew(doc));
      } catch (e) {
        if (!(e instanceof Conflict)) throw e;
      }
    }
    return fail(500, 'no_code', 'Couldn’t make a crew code. Try again.');
  }

  const code = normCode(body.code);
  if (!code) return fail(400, 'bad_code', 'That crew code doesn’t look right.');
  if (!['join', 'update', 'leave'].includes(action)) return fail(400, 'bad_action', 'Unknown action.');

  // Read-modify-write with optimistic concurrency.
  for (let attempt = 0; attempt < 6; attempt++) {
    const found = await store.read(code);
    if (!found) return fail(404, 'no_crew', 'No crew with that code.');
    const doc = found.doc;
    doc.members = doc.members || {};
    const existing = doc.members[id];
    if (existing && !sameHash(existing.tokenHash, tokenHash)) return fail(403, 'not_you', 'That spot in the crew belongs to someone else.');

    if (action === 'join') {
      if (!existing && Object.keys(doc.members).length >= MAX_MEMBERS) return fail(409, 'full', 'That crew is full.');
      doc.members[id] = { tokenHash, card: cleanCard(body.card), joinedAt: existing?.joinedAt || now, updatedAt: now };
    } else if (action === 'update') {
      if (!existing) return fail(404, 'not_member', 'You’re not in this crew.');
      doc.members[id] = { ...existing, card: cleanCard(body.card), updatedAt: now };
    } else if (action === 'leave') {
      if (!existing) return ok(publicCrew(doc));
      delete doc.members[id];
    }

    try {
      await store.replace(code, doc, found.etag);
      return ok(publicCrew(doc));
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
    }
  }
  return fail(503, 'busy', 'The crew is busy. Try again in a moment.');
}
