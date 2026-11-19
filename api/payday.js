// GET  /api/payday                  -> the Friday cron job: emails everyone with pay waiting
//                                      (Vercel sends "Authorization: Bearer $CRON_SECRET")
// POST /api/payday { action: 'test' } -> sends a test payday email to the signed-in user
import { handlePaydayRequest } from './_lib/payday.js';
import { paydayStore, saveStore } from './_lib/db.js';
import { userFrom } from './_lib/auth.js';
import { sendMail, mailerReady } from './_lib/mailer.js';
import { body, run } from './_lib/http.js';

export default async function handler(req, res) {
  await run(res, async () => {
    const secret = process.env.CRON_SECRET;
    const cronOk = !!secret && req.headers.authorization === `Bearer ${secret}`;
    const user = req.method === 'POST' ? await userFrom(req) : null;
    return handlePaydayRequest(
      { store: paydayStore, saves: saveStore, send: sendMail, ready: mailerReady(), now: Date.now() },
      { method: req.method, cronOk, user, body: body(req) },
    );
  });
}
