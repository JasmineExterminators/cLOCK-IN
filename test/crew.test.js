// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCrew, Conflict, normCode } from '../api/_lib/crew.js';

function memoryCrews() {
  const crews = new Map(); // code -> Map(userId -> {card, updatedAt})
  return {
    async getCrew(code) {
      const m = crews.get(code);
      return m ? { code, members: [...m].map(([userId, v]) => ({ userId, ...v })) } : null;
    },
    async createCrew(code, userId, card) {
      if (crews.has(code)) throw new Conflict();
      crews.set(code, new Map([[userId, { card, updatedAt: Date.now() }]]));
    },
    async addMember(code, userId, card, max) {
      const m = crews.get(code);
      if (!m) return 'no_crew';
      if (!m.has(userId) && m.size >= max) return 'full';
      m.set(userId, { card, updatedAt: Date.now() });
      return 'ok';
    },
    async updateMember(code, userId, card) {
      const m = crews.get(code);
      if (!m || !m.has(userId)) return false;
      m.set(userId, { card, updatedAt: Date.now() });
      return true;
    },
    async removeMember(code, userId) { crews.get(code)?.delete(userId); },
  };
}

const A = { id: 'user-a', email: 'a@x.com' };
const B = { id: 'user-b', email: 'b@x.com' };
const card = (name, extra = {}) => ({ name, home: 'pgh-dorm', car: 'bike', title: 'Intern', hours: 1, weekHours: 1, weekStart: Date.now(), clockedInAt: null, task: '', ...extra });

test('crew: create, join, update, read, leave', async () => {
  const s = memoryCrews();
  const made = await handleCrew(s, A, 'POST', {}, { action: 'create', card: card('Jasmine') });
  assert.equal(made.status, 200);
  const code = made.json.code;
  assert.ok(normCode(code));

  assert.equal((await handleCrew(s, B, 'POST', {}, { action: 'join', code, card: card('Ari') })).json.members.length, 2);
  const now = Date.now();
  await handleCrew(s, A, 'POST', {}, { action: 'update', code, card: card('Jasmine', { clockedInAt: now, task: 'malloc' }) });

  const got = await handleCrew(s, B, 'GET', { code: code.toLowerCase().replace(/(...)/, '$1-') });
  assert.equal(got.status, 200);
  const me = got.json.members.find((m) => m.id === A.id);
  assert.equal(me.clockedInAt, now);
  assert.equal(me.task, 'malloc');

  await handleCrew(s, B, 'POST', {}, { action: 'leave', code });
  assert.equal((await handleCrew(s, B, 'GET', { code })).status, 403, 'non-members cannot read a crew');
});

test('crew: signed out is rejected', async () => {
  assert.equal((await handleCrew(memoryCrews(), null, 'GET', { code: 'ABCDEF' })).status, 401);
});

test('crew: cards are cleaned and bounded', async () => {
  const s = memoryCrews();
  const { json } = await handleCrew(s, A, 'POST', {}, {
    action: 'create', card: { name: 'x'.repeat(100), home: '<script>', hours: -5, weekHours: 9999, clockedInAt: 'soon', extra: 'nope' },
  });
  const m = json.members[0];
  assert.equal(m.name.length, 24);
  assert.equal(m.hours, 0);
  assert.equal(m.weekHours, 168);
  assert.equal(m.clockedInAt, null);
  assert.ok(!('extra' in m));
});

test('crew: bad input', async () => {
  const s = memoryCrews();
  assert.equal((await handleCrew(s, A, 'GET', { code: 'nope' })).status, 400);
  assert.equal((await handleCrew(s, A, 'GET', { code: 'ABCDEF' })).status, 404);
  assert.equal((await handleCrew(s, A, 'POST', {}, { action: 'join', code: 'ABCDEF' })).status, 404);
  assert.equal((await handleCrew(s, A, 'POST', {}, { action: 'update', code: 'ABCDEF' })).status, 404);
  assert.equal((await handleCrew(s, A, 'DELETE')).status, 405);
});
