import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paycheckFor, paydayEmail, runPayday, handlePaydayRequest } from '../api/_lib/payday.js';
import { memoryPayday, memorySaves } from './memory-stores.js';

const H = 3600e3;
const NOW = Date.UTC(2026, 10, 20, 22, 5); // a Friday, 5:05 PM Eastern
const shift = (hoursAgo, len, earned, extra = {}) => ({ id: `${hoursAgo}`, start: NOW - hoursAgo * H, end: NOW - hoursAgo * H + len * H, earned, paid: false, ...extra });

test('payday: pending shifts plus a just-issued check, ignoring old or deposited ones', () => {
  const save = {
    sessions: [shift(30, 2, 30), shift(5, 1, 15), shift(100, 1, 15, { paid: true })],
    checks: [
      { payday: NOW - H, gross: 45, ms: 3 * H, shifts: ['a', 'b'], deposited: false },
      { payday: NOW - 8 * 24 * H, gross: 99, ms: H, shifts: ['c'], deposited: false },
      { payday: NOW - 2 * H, gross: 50, ms: H, shifts: ['d'], deposited: true },
    ],
  };
  assert.deepEqual(paycheckFor(save, NOW), { amount: 90, hours: 6, shifts: 4 });
  assert.equal(paycheckFor({ sessions: [], checks: [] }, NOW), null);
});

test('payday: email text', () => {
  const e = paydayEmail({ name: 'Jasmine', amount: 90, hours: 6, shifts: 4, balance: 100 });
  assert.equal(e.subject, 'Payday: your $90.00 paycheck is ready');
  assert.match(e.text, /6h 00m over 4 shifts/);
  assert.match(e.text, /from \$100\.00 to \$190\.00/);
  assert.match(e.html, /Jasmine/);
  assert.ok(!paydayEmail({ name: '<b>x</b>', amount: 1, hours: 1, shifts: 1 }).html.includes('<b>x</b>'), 'names are escaped');
});

test('payday: emails each person once, skips opt-outs and people with no pay', async () => {
  const people = [
    { userId: 'a', email: 'a@x.com', data: { name: 'A', sessions: [shift(3, 1, 15)] } },
    { userId: 'b', email: 'b@x.com', data: { name: 'B', sessions: [shift(3, 1, 15)], paydayEmails: false } },
    { userId: 'c', email: 'c@x.com', data: { name: 'C', sessions: [] } },
  ];
  const store = memoryPayday(people);
  const sent = [];
  const send = async (m) => { sent.push(m.to); };
  assert.deepEqual(await runPayday({ store, send, now: NOW }), { sent: 1, skipped: 2, failed: 0 });
  assert.deepEqual(await runPayday({ store, send, now: NOW + 60e3 }), { sent: 0, skipped: 3, failed: 0 }, 'a retry the same day sends nothing');
  assert.deepEqual(sent, ['a@x.com']);
});

test('payday: a failed send can be retried', async () => {
  const store = memoryPayday([{ userId: 'a', email: 'a@x.com', data: { sessions: [shift(3, 1, 15)] } }]);
  let fail = true;
  const send = async () => { if (fail) throw new Error('smtp down'); };
  assert.equal((await runPayday({ store, send, now: NOW })).failed, 1);
  fail = false;
  assert.equal((await runPayday({ store, send, now: NOW })).sent, 1);
});

test('payday: request handling', async () => {
  const deps = { store: memoryPayday([]), saves: memorySaves(), send: async () => {}, ready: true, now: NOW };
  assert.equal((await handlePaydayRequest(deps, { method: 'GET', cronOk: false })).status, 401, 'cron needs the secret');
  assert.equal((await handlePaydayRequest(deps, { method: 'GET', cronOk: true })).status, 200);
  assert.equal((await handlePaydayRequest({ ...deps, ready: false }, { method: 'GET', cronOk: true })).status, 503);
  const user = { id: 'u', email: 'u@x.com' };
  assert.equal((await handlePaydayRequest(deps, { method: 'POST', user: null, body: { action: 'test' } })).status, 401);
  assert.deepEqual((await handlePaydayRequest(deps, { method: 'POST', user, body: { action: 'test' } })).json, { sent: true, to: 'u@x.com' });
  assert.equal((await handlePaydayRequest(deps, { method: 'POST', user, body: { action: 'test' } })).status, 429, 'one test a minute');
});
