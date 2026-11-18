// GET /api/save                        -> { data, version, updatedAt }
// PUT /api/save { data, baseVersion }  -> { version, updatedAt } or 409 { current }
// Requires "Authorization: Bearer <access token>".
import { handleSave } from './_lib/save.js';
import { saveStore } from './_lib/db.js';
import { userFrom } from './_lib/auth.js';
import { body, run } from './_lib/http.js';

export default async function handler(req, res) {
  await run(res, async () => handleSave(saveStore, await userFrom(req), req.method, body(req)));
}
