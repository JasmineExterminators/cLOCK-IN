import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleBoard, milestoneBonus, reportStatus } from '../api/_lib/board.js';
import { memoryBoard } from './memory-stores.js';

const [A, B, C, D] = ['a', 'b', 'c', 'd'].map((id) => ({ id, email: `${id}@x.com` }));
const H = 3600e3;
const NOW = Date.UTC(2026, 10, 18, 15);
const post = (s, u, body) => handleBoard(s, u, 'POST', {}, { crew: 'CREW01', ...body }, NOW);

test('board: members only', async () => {
  const s = memoryBoard({ CREW01: ['a', 'b'] });
  assert.equal((await handleBoard(s, null, 'GET', { crew: 'CREW01' })).status, 401);
  assert.equal((await handleBoard(s, C, 'GET', { crew: 'CREW01' })).status, 403);
  assert.equal((await handleBoard(s, A, 'GET', { crew: 'NOPE00' })).status, 404);
  assert.deepEqual((await handleBoard(s, A, 'GET', { crew: 'CREW01' })).json, { milestones: [], reports: [] });
});

test('milestones: bonus is the average of at least two suggestions, then done, then congrats', async () => {
  const s = memoryBoard({ CREW01: ['a', 'b', 'c'] });
  const m = (await post(s, A, { action: 'milestone', title: '  Malloc   lab ' })).json;
  assert.equal(m.title, 'Malloc lab');
  assert.equal(m.bonus, null);
  assert.equal((await post(s, A, { action: 'complete', id: m.id })).status, 409, 'needs two suggestions first');
  await post(s, B, { action: 'suggest', id: m.id, amount: 50 });
  assert.equal((await post(s, A, { action: 'complete', id: m.id })).status, 409, 'one suggestion is not enough');
  const priced = (await post(s, C, { action: 'suggest', id: m.id, amount: 81 })).json;
  assert.equal(priced.bonus, 65.5);
  assert.equal((await post(s, B, { action: 'complete', id: m.id })).status, 403, 'only the owner marks it done');
  const done = (await post(s, A, { action: 'complete', id: m.id })).json;
  assert.ok(done.doneAt);
  assert.equal(done.bonus, 65.5);
  assert.equal((await post(s, B, { action: 'suggest', id: m.id, amount: 1000 })).status, 409, 'bonus is locked once done');
  assert.equal((await post(s, A, { action: 'congrats', id: m.id })).status, 409, 'no self-congrats');
  assert.deepEqual((await post(s, B, { action: 'congrats', id: m.id })).json.congrats, ['b']);
  assert.deepEqual((await post(s, B, { action: 'congrats', id: m.id, on: false })).json.congrats, []);
});

test('milestones: two suggestions must not both be the owner, amounts are bounded', () => {
  assert.equal(milestoneBonus({ userId: 'a', votes: [{ userId: 'a', amount: 10 }] }), null);
  assert.equal(milestoneBonus({ userId: 'a', votes: [{ userId: 'a', amount: 10 }, { userId: 'b', amount: 30 }] }), 20);
});

test('milestones: in a crew of two, owner plus friend can price it', async () => {
  const s = memoryBoard({ CREW01: ['a', 'b'] });
  const m = (await post(s, A, { action: 'milestone', title: 'Signals HW 9' })).json;
  assert.equal((await post(s, A, { action: 'suggest', id: m.id, amount: 0 })).status, 400);
  await post(s, A, { action: 'suggest', id: m.id, amount: 20 });
  assert.equal((await post(s, B, { action: 'suggest', id: m.id, amount: 30 })).json.bonus, 25);
});

test('reports: crew majority (at least two) upholds; the reported person can accept', async () => {
  const s = memoryBoard({ CREW01: ['a', 'b', 'c', 'd'] });
  const shift = { id: 's1', start: NOW - 12 * H, end: NOW - H, task: 'reading' };
  assert.equal((await post(s, A, { action: 'report', target: 'a', shift, capHours: 2 })).status, 400, 'not yourself');
  assert.equal((await post(s, A, { action: 'report', target: 'b', shift, capHours: 20 })).status, 400);
  assert.equal((await post(s, A, { action: 'report', target: 'b', shift, capHours: 11 })).status, 400, 'must be shorter');
  const r = (await post(s, A, { action: 'report', target: 'b', shift, capHours: 2, reason: 'Fell asleep on the clock' })).json;
  assert.equal(r.status, 'open');
  assert.equal((await post(s, C, { action: 'report', target: 'b', shift, capHours: 3 })).status, 409, 'one open report per shift');
  assert.equal((await post(s, B, { action: 'vote', id: r.id, agree: false })).status, 403, 'the reported person cannot vote');
  assert.equal((await post(s, C, { action: 'vote', id: r.id, agree: true })).json.status, 'upheld', '2 of 3 voters agree');
  assert.equal((await post(s, D, { action: 'vote', id: r.id })).status, 409, 'decided reports are closed');

  const r2 = (await post(s, A, { action: 'report', target: 'c', shift: { ...shift, id: 's2' }, capHours: 1 })).json;
  await post(s, B, { action: 'vote', id: r2.id, agree: false });
  assert.equal((await post(s, D, { action: 'vote', id: r2.id, agree: false })).json.status, 'dismissed');

  const r3 = (await post(s, A, { action: 'report', target: 'd', shift: { id: 'open', start: NOW - 9 * H, end: null }, capHours: 3 })).json;
  assert.equal((await post(s, A, { action: 'accept', id: r3.id })).status, 403);
  assert.equal((await post(s, D, { action: 'accept', id: r3.id })).json.status, 'upheld');
});

test('reports: the reporter can retract an open report, nobody else can', async () => {
  const s = memoryBoard({ CREW01: ['a', 'b', 'c'] });
  const shift = { id: 's1', start: NOW - 12 * H, end: NOW - H, task: 'reading' };
  const r = (await post(s, A, { action: 'report', target: 'b', shift, capHours: 2 })).json;
  assert.equal((await post(s, B, { action: 'retract', id: r.id })).status, 403, 'not the reported person');
  assert.equal((await post(s, C, { action: 'retract', id: r.id })).status, 403, 'not another crewmate');
  assert.deepEqual((await post(s, A, { action: 'retract', id: r.id })).json, { removed: r.id });
  assert.deepEqual((await handleBoard(s, A, 'GET', { crew: 'CREW01' })).json.reports, []);
  assert.equal((await post(s, A, { action: 'report', target: 'b', shift, capHours: 2 })).status, 200, 'the shift can be reported again');

  const r2 = (await post(s, A, { action: 'report', target: 'c', shift: { ...shift, id: 's2' }, capHours: 2 })).json;
  await post(s, C, { action: 'accept', id: r2.id });
  assert.equal((await post(s, A, { action: 'retract', id: r2.id })).status, 409, 'decided reports stay');
});

test('reports: the reported person can respond, and update the response, while it is open', async () => {
  const s = memoryBoard({ CREW01: ['a', 'b', 'c'] });
  const shift = { id: 's1', start: NOW - 12 * H, end: NOW - H, task: 'reading' };
  const r = (await post(s, A, { action: 'report', target: 'b', shift, capHours: 2 })).json;
  assert.equal(r.response, '');
  assert.equal((await post(s, A, { action: 'respond', id: r.id, text: 'hi' })).status, 403, 'not the reporter');
  assert.equal((await post(s, C, { action: 'respond', id: r.id, text: 'hi' })).status, 403, 'not a crewmate');
  assert.equal((await post(s, B, { action: 'respond', id: r.id, text: '   ' })).status, 400, 'needs text');
  const first = (await post(s, B, { action: 'respond', id: r.id, text: '  I was  reading the whole time ' })).json;
  assert.equal(first.response, 'I was reading the whole time');
  assert.equal(first.respondedAt, NOW);
  assert.equal((await post(s, B, { action: 'respond', id: r.id, text: 'x'.repeat(400) })).json.response.length, 280);
  await post(s, C, { action: 'vote', id: r.id, agree: true });
  assert.equal((await post(s, B, { action: 'respond', id: r.id, text: 'late' })).status, 409, 'decided reports are closed');
});

test('reports: in a crew of two, only accepting decides it', () => {
  assert.equal(reportStatus({ status: 'open', votes: [{ userId: 'a', agree: true }] }, 2), 'open');
  assert.equal(reportStatus({ status: 'open', votes: [{ userId: 'a', agree: true }, { userId: 'c', agree: true }] }, 3), 'upheld');
});
