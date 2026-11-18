// GET  /api/crew?code=K7MPQ2       -> { code, members: [...] }   (members only)
// POST /api/crew { action, code?, card? }   action: create | join | update | leave
// Requires "Authorization: Bearer <access token>".
import { handleCrew } from './_lib/crew.js';
import { crewStore } from './_lib/db.js';
import { userFrom } from './_lib/auth.js';
import { body, run } from './_lib/http.js';

export default async function handler(req, res) {
  await run(res, async () => handleCrew(crewStore, await userFrom(req), req.method, req.query || {}, body(req)));
}
