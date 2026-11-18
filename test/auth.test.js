import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleAuth, userFrom } from '../api/_lib/auth.js';

function fakeAuth() {
  const users = new Map();
  const session = (email) => ({ session: { access_token: `tok:${email}`, refresh_token: `ref:${email}`, expires_at: 9e9 }, user: { id: `id:${email}`, email } });
  return {
    async createUser(email, pw) { if (users.has(email)) return { error: 'taken' }; users.set(email, pw); return {}; },
    async signIn(email, pw) { return users.get(email) === pw ? session(email) : { error: 'bad_login' }; },
    async refresh(rt) { return rt.startsWith('ref:') ? session(rt.slice(4)) : { error: 'expired' }; },
    async getUser(tok) { return tok.startsWith('tok:') ? { id: `id:${tok.slice(4)}`, email: tok.slice(4) } : null; },
  };
}

test('auth: sign up, sign in, refresh, read user', async () => {
  const a = fakeAuth();
  const up = await handleAuth(a, { action: 'signup', email: ' Jas@Example.com ', password: 'longenough' });
  assert.equal(up.status, 200);
  assert.equal(up.json.user.email, 'jas@example.com');
  assert.equal((await handleAuth(a, { action: 'signup', email: 'jas@example.com', password: 'longenough' })).status, 409);
  assert.equal((await handleAuth(a, { action: 'login', email: 'jas@example.com', password: 'wrong' })).status, 401);
  assert.equal((await handleAuth(a, { action: 'login', email: 'jas@example.com', password: 'longenough' })).status, 200);
  assert.equal((await handleAuth(a, { action: 'refresh', refresh_token: up.json.session.refresh_token })).status, 200);
  const user = await userFrom({ headers: { authorization: `Bearer ${up.json.session.access_token}` } }, a);
  assert.equal(user.email, 'jas@example.com');
  assert.equal(await userFrom({ headers: {} }, a), null);
});

test('auth: validation', async () => {
  const a = fakeAuth();
  assert.equal((await handleAuth(a, { action: 'signup', email: 'nope', password: 'longenough' })).status, 400);
  assert.equal((await handleAuth(a, { action: 'signup', email: 'a@b.co', password: 'short' })).status, 400);
  assert.equal((await handleAuth(a, { action: 'refresh', refresh_token: 'x' })).status, 401);
  assert.equal((await handleAuth(a, { action: 'dance' })).status, 400);
});
