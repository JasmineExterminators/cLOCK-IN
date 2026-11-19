// The crew board on the Friends page: milestones (crew-priced bonuses for big assignments,
// with congratulations) and report tickets for shifts that look wrong. Talks to /api/board.
import { api, currentUser } from './cloud.js';

const HOUR = 3600e3;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const usd = (n) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const dur = (ms) => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
const when = (t) => new Date(t).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}
const list = (names) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/**
 * opts: { toast, nameOf(userId), cardOf(userId), activeCrew(), onData(code, data) }
 * onData lets the app pay out finished milestone bonuses and apply upheld reports.
 */
export function initBoard(opts) {
  const boards = new Map(); // code -> { milestones, reports }
  let busy = false;
  let reportTarget = null;
  const me = () => currentUser()?.id;
  const name = (id) => (id === me() ? 'You' : opts.nameOf(id) || 'Someone');
  const possessive = (id) => (id === me() ? 'your' : `${name(id)}’s`);

  async function call(body) {
    const code = opts.activeCrew();
    if (!code || busy) return null;
    busy = true;
    try {
      await api('POST', '/api/board', { crew: code, ...body });
      await refresh(code);
      return true;
    } catch (e) {
      opts.toast(e.message);
      return null;
    } finally {
      busy = false;
    }
  }

  async function refresh(code) {
    if (!code || !currentUser()) return;
    try {
      const data = await api('GET', `/api/board?crew=${encodeURIComponent(code)}`);
      boards.set(code, data);
      opts.onData(code, data);
    } catch {}
    if (code === opts.activeCrew()) render(code);
  }

  function milestoneRow(m) {
    const mine = m.userId === me();
    const myVote = m.votes.find((v) => v.userId === me());
    const n = m.votes.length;
    let body = '';
    if (m.doneAt) {
      const cheered = m.congrats.includes(me());
      const names = m.congrats.map(name);
      body = `<p class="ms-status done"><span class="badge ok">Done</span> ${mine ? 'You earned' : `${esc(name(m.userId))} earned`} a ${usd(m.bonus)} bonus, ${ago(m.doneAt)}.</p>
        <div class="ms-actions">
          ${mine ? '' : `<button class="congrats${cheered ? ' on' : ''}" type="button" data-congrats="${m.id}" aria-pressed="${cheered}">${cheered ? 'Congratulated' : 'Congratulate'}</button>`}
          ${names.length ? `<span class="muted small">${esc(list(names))} congratulated ${mine ? 'you' : esc(name(m.userId))}.</span>` : ''}
        </div>`;
    } else {
      const status = m.bonus != null
        ? `Bonus ${usd(m.bonus)}, the average of ${n} suggestions.`
        : `${n} of 2 suggestions so far. The bonus is the average once two people weigh in.`;
      body = `<p class="ms-status">${status}</p>
        <form class="ms-suggest" data-suggest="${m.id}">
          <label><span class="sr-only">Suggested bonus in dollars</span><span class="dollar">$</span>
            <input type="number" min="1" max="1000" step="1" inputmode="numeric" value="${myVote ? myVote.amount : ''}" placeholder="${mine ? 'Your guess' : 'Suggest'}" /></label>
          <button class="ghost-btn" type="submit">${myVote ? 'Update' : 'Suggest'}</button>
          ${myVote ? `<span class="muted small">You suggested ${usd(myVote.amount)}.</span>` : ''}
        </form>
        ${mine ? `<div class="ms-actions">
          <button class="punch small" type="button" data-complete="${m.id}" ${m.bonus == null ? 'disabled' : ''}>Mark done</button>
          <button class="text-btn" type="button" data-remove-ms="${m.id}">Remove</button></div>` : ''}`;
    }
    return `<li class="ms${m.doneAt ? ' is-done' : ''}">
      <div class="ms-head"><strong>${esc(m.title)}</strong><span class="muted small">${mine ? 'Your milestone' : esc(name(m.userId))}, ${ago(m.createdAt)}</span></div>
      ${body}</li>`;
  }

  function reportRow(r) {
    const s = r.shift;
    const end = s.end ?? null;
    const span = end ? `${when(s.start)}–${time(end)} (${dur(end - s.start)})` : `since ${when(s.start)}, still on the clock`;
    const agree = r.votes.filter((v) => v.agree).length;
    const disagree = r.votes.length - agree;
    const myVote = r.votes.find((v) => v.userId === me());
    const isTarget = r.target === me();
    let actions = '';
    if (r.status === 'open') {
      if (isTarget) actions = `<button class="ghost-btn" type="button" data-accept="${r.id}">Accept, cut it to ${r.capHours}h</button>`;
      else actions = `<button class="ghost-btn${myVote?.agree === true ? ' chosen' : ''}" type="button" data-vote="${r.id}" data-agree="1">Agree</button>
        <button class="ghost-btn${myVote?.agree === false ? ' chosen' : ''}" type="button" data-vote="${r.id}" data-agree="0">Disagree</button>`;
    }
    const badge = r.status === 'upheld' ? `<span class="badge warn">Upheld, cut to ${r.capHours}h</span>`
      : r.status === 'dismissed' ? '<span class="badge">Dismissed</span>' : '<span class="badge open">Open</span>';
    return `<li class="report">
      <div class="ms-head">${badge}<span class="muted small">${ago(r.createdAt)}</span></div>
      <p>${esc(name(r.reporter))} reported ${esc(possessive(r.target))} shift ${esc(span)}${s.task ? `, “${esc(s.task)}”` : ''}. Fair length: ${r.capHours}h.</p>
      ${r.reason ? `<p class="report-reason">${esc(r.reason)}</p>` : ''}
      ${r.status === 'open' ? `<p class="muted small">${agree} agree, ${disagree} disagree. Decided by a majority of the crew (at least 2 people), or if ${isTarget ? 'you accept' : `${esc(name(r.target))} accepts`}.</p>` : ''}
      ${actions ? `<div class="ms-actions">${actions}</div>` : ''}
    </li>`;
  }

  function render(code) {
    const root = $('#board');
    if (!root) return;
    const data = boards.get(code);
    root.hidden = !code;
    if (!data) { $('#ms-list').innerHTML = '<li class="empty">Loading…</li>'; $('#report-list').innerHTML = ''; return; }
    const open = data.milestones.filter((m) => !m.doneAt);
    const done = data.milestones.filter((m) => m.doneAt);
    $('#ms-list').innerHTML = data.milestones.length
      ? [...open, ...done].map(milestoneRow).join('')
      : '<li class="empty">No milestones yet. Add a big assignment, and your crew decides what finishing it is worth.</li>';
    $('#report-list').innerHTML = data.reports.length
      ? data.reports.map(reportRow).join('')
      : '<li class="empty">No reports. If a friend’s shift looks wrong, like they never clocked out, use “Report hours” on their card.</li>';
  }

  // ---- events ----
  $('#ms-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#ms-title');
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    if (await call({ action: 'milestone', title })) { input.value = ''; opts.toast('Milestone added. Ask your crew to suggest a bonus.'); }
  });
  $('#board').addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-suggest]');
    if (!f) return;
    e.preventDefault();
    const amount = Number(f.querySelector('input').value);
    if (await call({ action: 'suggest', id: f.dataset.suggest, amount })) opts.toast(`You suggested ${usd(amount)}.`);
  });
  $('#board').addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    if (t.dataset.complete) { if (await call({ action: 'complete', id: t.dataset.complete })) opts.toast('Done. The bonus goes on Friday’s paycheck.'); }
    else if (t.dataset.removeMs) await call({ action: 'remove', id: t.dataset.removeMs });
    else if (t.dataset.congrats) await call({ action: 'congrats', id: t.dataset.congrats, on: t.getAttribute('aria-pressed') !== 'true' });
    else if (t.dataset.vote) await call({ action: 'vote', id: t.dataset.vote, agree: t.dataset.agree === '1' });
    else if (t.dataset.accept) { if (await call({ action: 'accept', id: t.dataset.accept })) opts.toast('Report accepted. Your shift is shortened.'); }
  });

  // ---- report dialog ----
  function openReport(userId) {
    const card = opts.cardOf(userId);
    if (!card) return;
    reportTarget = userId;
    const shifts = [...(card.shifts || [])];
    if (card.clockedInAt) shifts.unshift({ id: 'open', start: card.clockedInAt, end: null, task: card.task || '' });
    $('#report-title').textContent = `Report ${name(userId)}’s hours`;
    $('#report-shifts').innerHTML = shifts.length
      ? shifts.map((s, i) => `<label class="report-shift"><input type="radio" name="report-shift" value="${i}" ${i === 0 ? 'checked' : ''} />
          <span><strong>${s.end ? `${when(s.start)}–${time(s.end)}` : `On the clock since ${when(s.start)}`}</strong>
          <span class="muted small">${dur((s.end ?? Date.now()) - s.start)}${s.task ? `, ${esc(s.task)}` : ''}</span></span></label>`).join('')
      : '<p class="muted">No shifts this week to report.</p>';
    $('#report-shifts').dataset.shifts = JSON.stringify(shifts);
    $('#report-cap').value = 2;
    $('#report-reason').value = '';
    $('#report-submit').disabled = !shifts.length;
    $('#report').showModal();
  }
  $('#report-cancel').addEventListener('click', () => $('#report').close());
  $('#report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const shifts = JSON.parse($('#report-shifts').dataset.shifts || '[]');
    const pick = document.querySelector('input[name="report-shift"]:checked');
    if (!pick) return;
    const ok = await call({
      action: 'report', target: reportTarget, shift: shifts[Number(pick.value)],
      capHours: Number($('#report-cap').value), reason: $('#report-reason').value,
    });
    if (ok) { $('#report').close(); opts.toast('Report sent. Your crew can vote on it below.'); }
  });

  return { refresh, render, openReport, data: (code) => boards.get(code) };
}
