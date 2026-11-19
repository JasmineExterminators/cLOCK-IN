import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleSave } from '../api/_lib/save.js';
import { memorySaves } from './memory-stores.js';

const U = { id: 'u1' };

test('save: first save, then versioned updates', async () => {
  const s = memorySaves();
  assert.deepEqual((await handleSave(s, U, 'GET')).json.version, 0);
  const a = await handleSave(s, U, 'PUT', { data: { balance: 1 }, baseVersion: 0 });
  assert.equal(a.status, 200);
  assert.equal(a.json.version, 1);
  const b = await handleSave(s, U, 'PUT', { data: { balance: 2 }, baseVersion: 1 });
  assert.equal(b.json.version, 2);
  assert.equal((await handleSave(s, U, 'GET')).json.data.balance, 2);
});

test('save: a stale device gets a conflict with the current save', async () => {
  const s = memorySaves();
  await handleSave(s, U, 'PUT', { data: { balance: 1 }, baseVersion: 0 });
  await handleSave(s, U, 'PUT', { data: { balance: 5 }, baseVersion: 1 }); // laptop
  const phone = await handleSave(s, U, 'PUT', { data: { balance: 3 }, baseVersion: 1 }); // phone, stale
  assert.equal(phone.status, 409);
  assert.equal(phone.json.current.data.balance, 5);
  const forced = await handleSave(s, U, 'PUT', { data: { balance: 6 }, baseVersion: 1, force: true });
  assert.equal(forced.status, 200);
});

test('save: signed out and bad bodies', async () => {
  const s = memorySaves();
  assert.equal((await handleSave(s, null, 'GET')).status, 401);
  assert.equal((await handleSave(s, U, 'PUT', {})).status, 400);
  assert.equal((await handleSave(s, U, 'PUT', { data: [1, 2] })).status, 400);
  assert.equal((await handleSave(s, U, 'PUT', { data: { x: 'y'.repeat(300000) } })).status, 413);
});
