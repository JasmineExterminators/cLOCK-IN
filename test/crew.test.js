// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, Conflict, normCode } from '../api/_lib/crew.js';

// In-memory store with real ETag semantics.
function memoryStore() {
  const docs = new Map();
  let n = 0;
  return {
    docs,
    async read(code) {
      const d = docs.get(code);
      return d ? { doc: JSON.parse(d.json), etag: d.etag } : null;
    },
    async create(code, doc) {
      if (docs.has(code)) throw new Conflict('exists');
      docs.set(code, { json: JSON.stringify(doc), etag: `e${++n}` });
    },
    async replace(code, doc, etag) {
      const d = docs.get(code);
      if (!d || d.etag !== etag) throw new Conflict('stale');
      docs.set(code, { json: JSON.stringify(doc), etag: `e${++n}` });
    },
  };
}

const A = { id: 'playeraaaa01', token: 'a'.repeat(64) };
const B = { id: 'playerbbbb02', token: 'b'.repeat(64) };
const card = (name, extra = {}) => ({ name, home: 'pgh-dorm', car: 'bike', title: 'Intern', hours: 1, weekHours: 1, weekStart: Date.now(), clockedInAt: null, task: '', ...extra });

test('create, join, read, update, leave', async () => {
  const s = memoryStore();
  const created = await handle(s, 'POST', {}, { action: 'create', ...A, card: card('Jasmine') });
  assert.equal(created.status, 200);
  const code = created.json.code;
  assert.ok(normCode(code));

  const joined = await handle(s, 'POST', {}, { action: 'join', code, ...B, card: card('Ari') });
  assert.equal(joined.status, 200);
  assert.equal(joined.json.members.length, 2);

  const now = Date.now();
  const upd = await handle(s, 'POST', {}, { action: 'update', code, ...A, card: card('Jasmine', { clockedInAt: now, task: 'malloc' }) });
  assert.equal(upd.status, 200);

  const got = await handle(s, 'GET', { code: code.toLowerCase().replace(/(...)/, '$1-') });
  assert.equal(got.status, 200);
  const me = got.json.members.find((m) => m.id === A.id);
  assert.equal(me.clockedInAt, now);
  assert.equal(me.task, 'malloc');
  assert.ok(!('tokenHash' in me), 'token hash never leaves the server');

  const left = await handle(s, 'POST', {}, { action: 'leave', code, ...B });
  assert.equal(left.json.members.length, 1);
});

test('someone else cannot overwrite your card', async () => {
  const s = memoryStore();
  const { json } = await handle(s, 'POST', {}, { action: 'create', ...A, card: card('Jasmine') });
  const evil = await handle(s, 'POST', {}, { action: 'update', code: json.code, id: A.id, token: 'c'.repeat(64), card: card('Hacked') });
  assert.equal(evil.status, 403);
  const evilJoin = await handle(s, 'POST', {}, { action: 'join', code: json.code, id: A.id, token: 'c'.repeat(64), card: card('Hacked') });
  assert.equal(evilJoin.status, 403);
});

test('cards are cleaned and bounded', async () => {
  const s = memoryStore();
  const { json } = await handle(s, 'POST', {}, {
    action: 'create', ...A,
    card: { name: 'x'.repeat(100), home: '<script>', hours: -5, weekHours: 9999, clockedInAt: 'soon', extra: 'nope' },
  });
  const m = json.members[0];
  assert.equal(m.name.length, 24);
  assert.equal(m.hours, 0);
  assert.equal(m.weekHours, 168);
  assert.equal(m.clockedInAt, null);
  assert.ok(!('extra' in m));
});

test('concurrent updates from two friends both land', async () => {
  const s = memoryStore();
  const { json } = await handle(s, 'POST', {}, { action: 'create', ...A, card: card('Jasmine') });
  await handle(s, 'POST', {}, { action: 'join', code: json.code, ...B, card: card('Ari') });
  // Interleave: wrap read so both writers read the same etag first.
  const realRead = s.read.bind(s);
  let gate = 0;
  s.read = async (code) => { const r = await realRead(code); if (gate++ < 2) await new Promise((x) => setTimeout(x, 20)); return r; };
  await Promise.all([
    handle(s, 'POST', {}, { action: 'update', code: json.code, ...A, card: card('Jasmine', { task: 'A' }) }),
    handle(s, 'POST', {}, { action: 'update', code: json.code, ...B, card: card('Ari', { task: 'B' }) }),
  ]);
  s.read = realRead;
  const got = await handle(s, 'GET', { code: json.code });
  const tasks = Object.fromEntries(got.json.members.map((m) => [m.name, m.task]));
  assert.deepEqual(tasks, { Jasmine: 'A', Ari: 'B' });
});

test('bad input is rejected', async () => {
  const s = memoryStore();
  assert.equal((await handle(s, 'GET', { code: 'nope' })).status, 400);
  assert.equal((await handle(s, 'GET', { code: 'ABCDEF' })).status, 404);
  assert.equal((await handle(s, 'POST', {}, { action: 'create', id: 'x', token: 'y' })).status, 400);
  assert.equal((await handle(s, 'POST', {}, { action: 'join', code: 'ABCDEF', ...A })).status, 404);
  assert.equal((await handle(s, 'DELETE')).status, 405);
});
