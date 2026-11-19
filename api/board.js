// GET  /api/board?crew=CODE                      -> { milestones, reports } for a crew you're in
// POST /api/board { crew, action, ... }          -> milestone | suggest | complete | remove | congrats
//                                                   report | vote | accept
import { handleBoard } from './_lib/board.js';
import { boardStore } from './_lib/db.js';
import { userFrom } from './_lib/auth.js';
import { body, run } from './_lib/http.js';

export default async function handler(req, res) {
  await run(res, async () => handleBoard(boardStore, await userFrom(req), req.method, req.query || {}, body(req)));
}
