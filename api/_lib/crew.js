// Crew rules, independent of storage so they can be tested without a database.
// A crew is a code, a name and its members; each member is a signed-in user with a small public card.
// One person can be in several crews (up to MAX_CREWS), with the same card in each.

import crypto from 'node:crypto';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
export const MAX_MEMBERS = 24;
export const MAX_CREWS = 10;

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

export const cleanCrewName = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 32) : '');

export const publicCrew = (crew) => ({
  code: crew.code,
  name: crew.name || '',
  members: crew.members.map((m) => ({ id: m.userId, ...m.card, updatedAt: m.updatedAt })),
});

const ok = (json) => ({ status: 200, json });
const fail = (status, error, message) => ({ status, json: { error, message } });

/**
 * store: { getCrew(code) -> {code, name, members}, listMine(userId) -> [{code, name, size}],
 *          createCrew(code, userId, card, name) (throws Conflict), addMember(code, userId, card, max) -> 'ok'|'full'|'no_crew',
 *          updateMember(code, userId, card) -> bool, updateAll(userId, card) -> count, renameCrew(code, name),
 *          removeMember(code, userId) }
 */
export async function handleCrew(store, user, method, query = {}, body = {}) {
  if (!user) return fail(401, 'signed_out', 'Sign in to use Friends.');

  if (method === 'GET') {
    if (!query.code) return ok({ crews: await store.listMine(user.id) });
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

  if (action === 'update_all') {
    return ok({ updated: await store.updateAll(user.id, card) });
  }

  const tooMany = async () => (await store.listMine(user.id)).length >= MAX_CREWS;

  if (action === 'create') {
    if (await tooMany()) return fail(409, 'too_many', `You can be in up to ${MAX_CREWS} crews. Leave one to start another.`);
    const name = cleanCrewName(body?.name);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      try {
        await store.createCrew(code, user.id, card, name);
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
    const mine = await store.listMine(user.id);
    if (!mine.some((c) => c.code === code) && mine.length >= MAX_CREWS) {
      return fail(409, 'too_many', `You can be in up to ${MAX_CREWS} crews. Leave one to join another.`);
    }
    const r = await store.addMember(code, user.id, card, MAX_MEMBERS);
    if (r === 'no_crew') return fail(404, 'no_crew', 'No crew with that code.');
    if (r === 'full') return fail(409, 'full', 'That crew is full.');
    return ok(publicCrew(await store.getCrew(code)));
  }
  if (action === 'update') {
    if (!(await store.updateMember(code, user.id, card))) return fail(404, 'not_member', 'You’re not in this crew.');
    return ok(publicCrew(await store.getCrew(code)));
  }
  if (action === 'rename') {
    const crew = await store.getCrew(code);
    if (!crew || !crew.members.some((m) => m.userId === user.id)) return fail(404, 'not_member', 'You’re not in this crew.');
    await store.renameCrew(code, cleanCrewName(body?.name));
    return ok(publicCrew(await store.getCrew(code)));
  }
  if (action === 'leave') {
    await store.removeMember(code, user.id);
    return ok({ code, members: [] });
  }
  return fail(400, 'bad_action', 'Unknown action.');
}
