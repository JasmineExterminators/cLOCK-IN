// Crew rules, independent of storage so they can be tested without a database.
// A crew is a code plus its members; each member is a signed-in user with a small public card.

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

export const publicCrew = (crew) => ({
  code: crew.code,
  members: crew.members.map((m) => ({ id: m.userId, ...m.card, updatedAt: m.updatedAt })),
});

const ok = (json) => ({ status: 200, json });
const fail = (status, error, message) => ({ status, json: { error, message } });

/**
 * store: { getCrew(code), createCrew(code, userId, card) (throws Conflict), addMember(code, userId, card, max) -> 'ok'|'full'|'no_crew',
 *          updateMember(code, userId, card) -> bool, removeMember(code, userId) }
 */
export async function handleCrew(store, user, method, query = {}, body = {}) {
  if (!user) return fail(401, 'signed_out', 'Sign in to use Friends.');

  if (method === 'GET') {
    const code = normCode(query.code);
    if (!code) return fail(400, 'bad_code', 'That crew code doesn’t look right.');
    const crew = await store.getCrew(code);
    if (!crew) return fail(404, 'no_crew', 'No crew with that code.');
    if (!crew.members.some((m) => m.userId === user.id)) return fail(403, 'not_member', 'You’re not in this crew.');
    return ok(publicCrew(crew));
  }

  if (method !== 'POST') return fail(405, 'method', 'Use GET or POST.');
  const action = body?.action;
  const card = cleanCard(body?.card);

  if (action === 'create') {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      try {
        await store.createCrew(code, user.id, card);
        return ok(publicCrew(await store.getCrew(code)));
      } catch (e) {
        if (!(e instanceof Conflict)) throw e;
      }
    }
    return fail(500, 'no_code', 'Couldn’t make a crew code. Try again.');
  }

  const code = normCode(body?.code);
  if (!code) return fail(400, 'bad_code', 'That crew code doesn’t look right.');

  if (action === 'join') {
    const r = await store.addMember(code, user.id, card, MAX_MEMBERS);
    if (r === 'no_crew') return fail(404, 'no_crew', 'No crew with that code.');
    if (r === 'full') return fail(409, 'full', 'That crew is full.');
    return ok(publicCrew(await store.getCrew(code)));
  }
  if (action === 'update') {
    if (!(await store.updateMember(code, user.id, card))) return fail(404, 'not_member', 'You’re not in this crew.');
    return ok(publicCrew(await store.getCrew(code)));
  }
  if (action === 'leave') {
    await store.removeMember(code, user.id);
    return ok({ code, members: [] });
  }
  return fail(400, 'bad_action', 'Unknown action.');
}
