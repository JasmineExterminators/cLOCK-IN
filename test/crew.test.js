// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCrew, normCode, MAX_CREWS } from '../api/_lib/crew.js';
import { memoryCrews } from './memory-stores.js';

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

test('crew: one person in several named crews', async () => {
  const s = memoryCrews();
  const a = (await handleCrew(s, A, 'POST', {}, { action: 'create', name: '  Racing   team ', card: card('Jasmine') })).json;
  const b = (await handleCrew(s, B, 'POST', {}, { action: 'create', name: 'Roommates', card: card('Ari') })).json;
  assert.equal(a.name, 'Racing team');
  await handleCrew(s, A, 'POST', {}, { action: 'join', code: b.code, card: card('Jasmine') });

  const mine = (await handleCrew(s, A, 'GET', {})).json.crews;
  assert.deepEqual(mine.map((c) => c.name), ['Racing team', 'Roommates']);
  assert.equal(mine[1].size, 2);

  // One update reaches every crew.
  const now = Date.now();
  const up = await handleCrew(s, A, 'POST', {}, { action: 'update_all', card: card('Jasmine', { clockedInAt: now }) });
  assert.equal(up.json.updated, 2);
  const seen = (await handleCrew(s, B, 'GET', { code: b.code })).json.members.find((m) => m.id === A.id);
  assert.equal(seen.clockedInAt, now);

  const renamed = await handleCrew(s, B, 'POST', {}, { action: 'rename', code: b.code, name: 'Forbes Ave' });
  assert.equal(renamed.json.name, 'Forbes Ave');
  assert.equal((await handleCrew(s, B, 'POST', {}, { action: 'rename', code: a.code, name: 'x' })).status, 404, 'only members rename');
});

test('crew: limit on how many crews one person joins', async () => {
  const s = memoryCrews();
  for (let i = 0; i < MAX_CREWS; i++) await handleCrew(s, A, 'POST', {}, { action: 'create', card: card('J') });
  assert.equal((await handleCrew(s, A, 'POST', {}, { action: 'create', card: card('J') })).status, 409);
  const other = (await handleCrew(s, B, 'POST', {}, { action: 'create', card: card('B') })).json.code;
  assert.equal((await handleCrew(s, A, 'POST', {}, { action: 'join', code: other, card: card('J') })).status, 409);
});
