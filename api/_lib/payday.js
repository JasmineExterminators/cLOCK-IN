// Payday emails: work out what someone is owed this payday from their save, and write the email.
// Runs every Friday from a Vercel cron job (see vercel.json), and on demand as a test email.

import { costPerDay } from '../../js/data.js';

export const SITE_URL = process.env.SITE_URL || 'https://clockin-gray.vercel.app';
const HOUR = 3600e3;
const round2 = (n) => Math.round(n * 100) / 100;
const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const dur = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const wantsEmails = (save) => !!save && save.paydayEmails !== false;

/**
 * Pay waiting for this payday. If the app already issued this week's paycheck (in the last day and a half),
 * that check's take-home is what's waiting. Otherwise it's the week's shifts and milestone bonuses not yet on
 * a paycheck, minus a week of living costs (utilities for the home, care for pets).
 */
export function paycheckFor(save, now = Date.now()) {
  if (!save) return null;
  const sessions = (save.sessions || []).filter((s) => !s.paid && Number.isFinite(s.end) && s.end <= now);
  const bonuses = (save.bonuses || []).filter((b) => !b.paid);
  const recent = (save.checks || []).filter((c) => Number.isFinite(c.payday) && c.payday <= now && now - c.payday < 36 * HOUR);
  const waiting = recent.filter((c) => !c.deposited);
  const shiftPay = sessions.reduce((a, s) => a + (Number(s.earned) || 0), 0);
  const bonusPay = bonuses.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const issuedGross = waiting.reduce((a, c) => a + (Number(c.gross) || 0), 0);
  const issuedNet = waiting.reduce((a, c) => a + (Number(c.net ?? c.gross) || 0), 0);
  const weekCosts = recent.length ? 0 : costPerDay(save.equipped?.home, save.pets) * 7;
  const earned = round2(shiftPay + bonusPay + issuedGross);
  const costs = round2(weekCosts + (issuedGross - issuedNet));
  const ms = sessions.reduce((a, s) => a + (s.end - s.start), 0) + waiting.reduce((a, c) => a + (Number(c.ms) || 0), 0);
  const shifts = sessions.length + waiting.reduce((a, c) => a + (c.shifts?.length || 0), 0);
  if (earned <= 0) return null;
  return { amount: round2(earned - costs), earned, costs, bonus: round2(bonusPay), hours: ms / HOUR, shifts };
}

export function paydayEmail({ name, amount, earned = amount, costs = 0, bonus = 0, hours, shifts, balance = 0, test = false }) {
  const who = name ? `, ${name}` : '';
  const paid = earned > 0;
  const subject = test
    ? 'Test: your cLOCK IN payday emails are on'
    : `Payday: your ${usd(amount)} paycheck is ready`;
  const worked = `You worked ${dur(hours)} over ${shifts} shift${shifts === 1 ? '' : 's'} this week`;
  const lead = paid
    ? `It's payday${who}. ${worked}${bonus ? ` and earned a ${usd(bonus)} milestone bonus` : ''}, for ${usd(earned)}.${costs ? ` After ${usd(costs)} in living costs, your paycheck is ${usd(amount)}.` : ` Your paycheck is ${usd(amount)}.`}`
    : `Hi${who}. This is a test. On payday, this email tells you what you earned that week. Right now you have no pay waiting.`;
  const after = paid ? `Deposit it and your balance goes from ${usd(balance)} to ${usd(round2(balance + amount))}.` : 'Clock in to start earning.';
  const button = paid ? 'Open cLOCK IN and deposit' : 'Open cLOCK IN';
  const text = `${lead}\n\n${after}\n\n${button}: ${SITE_URL}/#shifts\n\nYou can turn payday emails off on the Pay page.\n`;
  const line = (label, value, strong) => `<tr><td style="padding:3px 0;font-size:13px;color:#5a6b61">${esc(label)}</td><td align="right" style="padding:3px 0;font-size:13px;${strong ? 'font-weight:700;color:#23302a' : 'color:#23302a'}">${value}</td></tr>`;
  const lines = paid
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:1px dashed #8fa596;padding-top:8px">
        ${line(`Shifts, ${dur(hours)}`, usd(round2(earned - bonus)))}${bonus ? line('Milestone bonus', usd(bonus)) : ''}${costs ? line('Living costs', `&minus;${usd(costs)}`) : ''}${line('Take-home', usd(amount), true)}
      </table>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#16181d;padding:28px 12px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#ecebe6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="font-weight:600;font-size:15px;letter-spacing:.04em;padding:0 4px 14px;color:#f2b54a">cLOCK IN</td></tr>
<tr><td style="background:#e9f0e4;border-radius:8px;padding:22px 24px;color:#23302a;border:1px solid #c9d8c2">
  <div style="font-size:12px;color:#5a6b61">cLOCK IN Payroll &middot; Pittsburgh, PA</div>
  <div style="font-size:13px;color:#5a6b61;margin-top:18px">Pay to the order of</div>
  <div style="font-size:20px;font-weight:600;border-bottom:1px solid #8fa596;padding-bottom:4px">${esc(name || 'You')}</div>
  <div style="font-size:34px;font-weight:700;margin-top:14px">${usd(amount)}</div>
  ${lines}
</td></tr>
<tr><td style="padding:20px 4px 0;font-size:15px;line-height:1.55;color:#ecebe6">${esc(lead)}<br><br>${esc(after)}</td></tr>
<tr><td style="padding:20px 4px"><a href="${SITE_URL}/#shifts" style="display:inline-block;background:#9cbf72;color:#172010;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:10px">${button}</a></td></tr>
<tr><td style="padding:8px 4px 0;font-size:12px;color:#8b9099">You can turn payday emails off on the Pay page.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Send this payday's emails. store: { recipients() -> [{userId, email, data}], claim(userId, key) -> bool, unclaim(userId, key) } */
export async function runPayday({ store, send, now = Date.now() }) {
  const key = new Date(now).toISOString().slice(0, 10);
  const out = { sent: 0, skipped: 0, failed: 0 };
  for (const r of await store.recipients()) {
    const pay = wantsEmails(r.data) ? paycheckFor(r.data, now) : null;
    if (!pay || !r.email || !(await store.claim(r.userId, key))) { out.skipped++; continue; }
    try {
      await send({ to: r.email, ...paydayEmail({ name: r.data.name, balance: Number(r.data.balance) || 0, ...pay }) });
      out.sent++;
    } catch (e) {
      console.error('payday email failed', r.userId, e.message);
      await store.unclaim(r.userId, key);
      out.failed++;
    }
  }
  return out;
}

const NOT_SET_UP = { status: 503, json: { error: 'not_set_up', message: 'Payday emails aren’t set up yet. The app needs its Gmail address and app password in Vercel.' } };

export async function handlePaydayRequest({ store, saves, send, ready, now = Date.now() }, { method, cronOk, user, body = {} }) {
  if (method === 'GET') {
    if (!cronOk) return { status: 401, json: { error: 'unauthorized', message: 'Only the payday job can run this.' } };
    if (!ready) return NOT_SET_UP;
    return { status: 200, json: await runPayday({ store, send, now }) };
  }
  if (method === 'POST' && body.action === 'test') {
    if (!user) return { status: 401, json: { error: 'signed_out', message: 'Sign in to get payday emails.' } };
    if (!ready) return NOT_SET_UP;
    const minute = `test:${new Date(now).toISOString().slice(0, 16)}`;
    if (!(await store.claim(user.id, minute))) return { status: 429, json: { error: 'slow_down', message: 'One test email a minute. Check your inbox.' } };
    const save = (await saves.get(user.id))?.data || {};
    const pay = paycheckFor(save, now) || { amount: 0, earned: 0, hours: 0, shifts: 0 };
    await send({ to: user.email, ...paydayEmail({ name: save.name, balance: Number(save.balance) || 0, ...pay, test: true }) });
    return { status: 200, json: { sent: true, to: user.email } };
  }
  return { status: 405, json: { error: 'method', message: 'Use GET (cron) or POST { action: "test" }.' } };
}
