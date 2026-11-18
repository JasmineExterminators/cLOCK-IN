// POST /api/auth { action: 'signup' | 'login', email, password } -> { session, user }
// POST /api/auth { action: 'refresh', refresh_token }            -> { session, user }
import { handleAuth, supabaseAuth } from './_lib/auth.js';
import { body, run } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return run(res, async () => ({ status: 405, json: { error: 'method', message: 'Use POST.' } }));
  await run(res, () => handleAuth(supabaseAuth, body(req)));
}
