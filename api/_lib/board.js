// The crew board: milestones (crew-priced bonuses for big assignments) and report tickets
// (the crew votes on shifts that look wrong). Storage-free so it can be tested without a database.
import crypto from 'node:crypto';

export const MILESTONE_MAX = 1000; // largest bonus anyone can suggest
export const OPEN_MILESTONES = 10; // per person per crew
const round2 = (n) => Math.round(n * 100) / 100;
const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const ok = (json) => ({ status: 200, json });
const fail = (status, error, message) => ({ status, json: { error, message } });

/** A milestone's bonus: the average of suggestions, once at least two people (not only the owner) have suggested. */
export function milestoneBonus(m) {
  const votes = m.votes || [];
  if (votes.length < 2 || !votes.some((v) => v.userId !== m.userId)) return null;
  return round2(votes.reduce((a, v) => a + Number(v.amount), 0) / votes.length);
}

/**
 * Report outcome. Everyone in the crew except the reported person can vote; the reporter counts as agreeing.
 * Upheld when a majority of them agree and at least two people agree, or when the reported person accepts.
 * Dismissed when a majority disagree.
 */
export function reportStatus(report, memberCount) {
  if (report.status !== 'open') return report.status;
  const voters = Math.max(1, memberCount - 1);
  const agree = report.votes.filter((v) => v.agree).length;
  const disagree = report.votes.length - agree;
  if (agree >= 2 && agree > voters / 2) return 'upheld';
  if (disagree > voters / 2) return 'dismissed';
  return 'open';
}

const publicMilestone = (m) => ({
  id: m.id, userId: m.userId, title: m.title, createdAt: m.createdAt, doneAt: m.doneAt || null,
  bonus: m.doneAt ? m.bonus : milestoneBonus(m),
  votes: m.votes.map((v) => ({ userId: v.userId, amount: Number(v.amount) })),
  congrats: m.congrats,
});
const publicReport = (r) => ({
  id: r.id, reporter: r.reporter, target: r.target, shift: r.shift, reason: r.reason, capHours: r.capHours,
  status: r.status, createdAt: r.createdAt, votes: r.votes,
});

function cleanShift(s = {}) {
  const start = Number(s.start), end = s.end == null ? null : Number(s.end);
  if (!Number.isFinite(start) || start < 1.5e12) return null;
  if (end != null && (!Number.isFinite(end) || end <= start)) return null;
  return { id: text(String(s.id ?? start), 40), start, end, task: text(s.task, 60) };
}

/**
 * store: { members(code) -> [userId] | null,
 *   listMilestones(code), getMilestone(id), createMilestone(m), voteMilestone(id, userId, amount),
 *   completeMilestone(id, bonus), deleteMilestone(id), setCongrats(id, userId, on),
 *   listReports(code), getReport(id), findOpenReport(code, target, shiftId), createReport(r),
 *   voteReport(id, userId, agree), setReportStatus(id, status) }
 */
export async function handleBoard(store, user, method, query = {}, body = {}, now = Date.now()) {
  if (!user) return fail(401, 'signed_out', 'Sign in to use the crew board.');
  const code = String((method === 'GET' ? query.crew : body.crew) || '').toUpperCase();
  const members = code ? await store.members(code) : null;
  if (!members) return fail(404, 'no_crew', 'No crew with that code.');
  if (!members.includes(user.id)) return fail(403, 'not_member', 'You’re not in this crew.');

  if (method === 'GET') {
    const [milestones, reports] = await Promise.all([store.listMilestones(code), store.listReports(code)]);
    return ok({ milestones: milestones.map(publicMilestone), reports: reports.map(publicReport) });
  }
  if (method !== 'POST') return fail(405, 'method', 'Use GET or POST.');

  const a = body.action;

  // ---- milestones ----
  if (a === 'milestone') {
    const title = text(body.title, 80);
    if (!title) return fail(400, 'bad_title', 'Name the milestone, like “Malloc lab”.');
    const mine = (await store.listMilestones(code)).filter((m) => m.userId === user.id && !m.doneAt);
    if (mine.length >= OPEN_MILESTONES) return fail(409, 'too_many', `You can have ${OPEN_MILESTONES} open milestones in a crew.`);
    const m = { id: crypto.randomUUID(), crewCode: code, userId: user.id, title, createdAt: now };
    await store.createMilestone(m);
    return ok(publicMilestone({ ...m, votes: [], congrats: [] }));
  }
  if (['suggest', 'complete', 'remove', 'congrats'].includes(a)) {
    const m = await store.getMilestone(String(body.id || ''));
    if (!m || m.crewCode !== code) return fail(404, 'no_milestone', 'That milestone is gone.');
    if (a === 'suggest') {
      const amount = Math.round(Number(body.amount) * 100) / 100;
      if (m.doneAt) return fail(409, 'done', 'That milestone is already done.');
      if (!(amount >= 1 && amount <= MILESTONE_MAX)) return fail(400, 'bad_amount', `Suggest between $1 and $${MILESTONE_MAX}.`);
      await store.voteMilestone(m.id, user.id, amount);
    } else if (a === 'complete') {
      if (m.userId !== user.id) return fail(403, 'not_yours', 'Only the person who set it can mark it done.');
      if (m.doneAt) return fail(409, 'done', 'Already done.');
      const bonus = milestoneBonus(m);
      if (bonus == null) return fail(409, 'no_bonus', 'Wait until at least two people suggest a bonus.');
      await store.completeMilestone(m.id, bonus, now);
    } else if (a === 'remove') {
      if (m.userId !== user.id) return fail(403, 'not_yours', 'Only the person who set it can remove it.');
      if (m.doneAt) return fail(409, 'done', 'Finished milestones stay on the board.');
      await store.deleteMilestone(m.id);
      return ok({ removed: m.id });
    } else {
      if (!m.doneAt) return fail(409, 'not_done', 'Congratulate them once it’s done.');
      if (m.userId === user.id) return fail(409, 'own', 'You can’t congratulate yourself. Well earned, though.');
      await store.setCongrats(m.id, user.id, body.on !== false);
    }
    const fresh = await store.getMilestone(m.id);
    return ok(publicMilestone(fresh));
  }

  // ---- reports ----
  if (a === 'report') {
    const target = String(body.target || '');
    if (!members.includes(target)) return fail(404, 'no_member', 'That person isn’t in this crew.');
    if (target === user.id) return fail(400, 'self', 'You can fix your own shifts on the Pay page.');
    const shift = cleanShift(body.shift);
    if (!shift) return fail(400, 'bad_shift', 'Pick the shift that looks wrong.');
    const capHours = Math.round(Number(body.capHours) * 4) / 4;
    if (!(capHours >= 0 && capHours <= 12)) return fail(400, 'bad_cap', 'Say how long the shift should have been, up to 12 hours.');
    const lengthH = ((shift.end ?? now) - shift.start) / 3600e3;
    if (capHours >= lengthH) return fail(400, 'not_shorter', 'The fair length has to be shorter than the shift.');
    if (await store.findOpenReport(code, target, shift.id)) return fail(409, 'exists', 'Someone already reported that shift. Vote on it below.');
    const r = { id: crypto.randomUUID(), crewCode: code, reporter: user.id, target, shift, reason: text(body.reason, 140), capHours, status: 'open', createdAt: now };
    await store.createReport(r);
    await store.voteReport(r.id, user.id, true);
    const fresh = await store.getReport(r.id);
    const status = reportStatus(fresh, members.length);
    if (status !== 'open') await store.setReportStatus(r.id, status);
    return ok(publicReport({ ...fresh, status }));
  }
  if (a === 'vote' || a === 'accept') {
    const r = await store.getReport(String(body.id || ''));
    if (!r || r.crewCode !== code) return fail(404, 'no_report', 'That report is gone.');
    if (r.status !== 'open') return fail(409, 'closed', 'That report is already decided.');
    if (a === 'accept') {
      if (r.target !== user.id) return fail(403, 'not_yours', 'Only the reported person can accept a report.');
      await store.setReportStatus(r.id, 'upheld');
    } else {
      if (r.target === user.id) return fail(403, 'own', 'You can accept the report, but you can’t vote on it.');
      await store.voteReport(r.id, user.id, body.agree !== false);
      const status = reportStatus(await store.getReport(r.id), members.length);
      if (status !== 'open') await store.setReportStatus(r.id, status);
    }
    return ok(publicReport(await store.getReport(r.id)));
  }
  return fail(400, 'bad_action', 'Unknown action.');
}
