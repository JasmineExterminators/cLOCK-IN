// GET  /api/crew?code=K7MPQ2            -> { code, members: [...] }
// POST /api/crew { action, id, token, code?, card? }
//      action: create | join | update | leave
import { handle } from './_lib/crew.js';
import { blobStore } from './_lib/blob-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  try {
    const { status, json } = await handle(blobStore, req.method, req.query || {}, body || {});
    res.status(status).json(json);
  } catch (e) {
    console.error('crew api error', e);
    res.status(500).json({ error: 'server_error', message: 'Something went wrong on our side. Try again.' });
  }
}
