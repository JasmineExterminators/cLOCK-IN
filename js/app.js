import { CARS, HOMES, CITIES, PAYDAY, rankFor, nextRank, LEGACY_HOME, LEGACY_CAR } from './data.js';
import { renderScene, renderCarSide, renderHomeTile } from './art.js';
import { Pix, hex } from './pixel.js';
import { dotText } from './glyphs.js';
import { crewApi, normCode, prettyCode } from './social.js';
import { cloudAvailable, currentUser, signIn, signUp, signOutLocal, cloudSave, getMeta, setMeta, mergeSaves, api } from './cloud.js';

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

const HOUR = 3600e3;
const DAY = 864e5;
const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const startOfWeek = (t = Date.now()) => { const d = new Date(startOfDay(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

function nextPayday(t) {
  const d = new Date(t);
  d.setHours(PAYDAY.hour, 0, 0, 0);
  d.setDate(d.getDate() + ((PAYDAY.day - d.getDay() + 7) % 7));
  if (d.getTime() <= t) d.setDate(d.getDate() + 7);
  return d.getTime();
}
function prevPayday(t) {
  const d = new Date(nextPayday(t));
  d.setDate(d.getDate() - 7);
  return d.getTime();
}

/* ------------------------------------------------------------------ */
/* State (saved in this browser's localStorage)                        */
/* ------------------------------------------------------------------ */

const KEY = 'clockin.v1';
const fresh = () => ({
  version: 2,
  name: '',
  clockedInAt: null,
  task: '',
  sessions: [], // { id, start, end, task, rate, earned, paid, checkNo }
  checks: [], // { no, payday, from, gross, ms, shifts: [ids], deposited }
  balance: 0,
  owned: { car: ['bike'], home: ['pgh-dorm'] },
  equipped: { car: 'bike', home: 'pgh-dorm' },
  lastPayday: prevPayday(Date.now()),
  crews: [], // codes of the crews I'm in, e.g. ['K7MPQ2']
  activeCrew: null, // the crew shown on the Friends page
  paydayEmails: true, // email me when my paycheck is ready
  owner: null, // account id this save belongs to (null = made before signing in)
});

function migrate(s) {
  if (!s.version) {
    // v1 paid every shift instantly, so everything already in the balance counts as paid.
    s.sessions = (s.sessions || []).map((x) => ({ ...x, paid: true }));
    s.checks = [];
    s.lastPayday = prevPayday(Date.now());
    s.version = 2;
  }
  const mapHome = (id) => LEGACY_HOME[id] || id;
  const mapCar = (id) => LEGACY_CAR[id] || id;
  s.owned.home = [...new Set(s.owned.home.map(mapHome))].filter((id) => HOMES.some((h) => h.id === id));
  s.owned.car = [...new Set(s.owned.car.map(mapCar))].filter((id) => CARS.some((c) => c.id === id));
  if (!s.owned.home.includes('pgh-dorm')) s.owned.home.unshift('pgh-dorm');
  if (!s.owned.car.includes('bike')) s.owned.car.unshift('bike');
  s.equipped.home = mapHome(s.equipped.home);
  s.equipped.car = mapCar(s.equipped.car);
  if (!s.owned.home.includes(s.equipped.home)) s.equipped.home = 'pgh-dorm';
  if (!s.owned.car.includes(s.equipped.car)) s.equipped.car = 'bike';
  delete s.player; // old friends id, replaced by accounts
  if (s.crew) { s.crews = [...new Set([...(s.crews || []), s.crew])]; s.activeCrew = s.activeCrew || s.crew; }
  delete s.crew; // one crew became a list of crews
  if (!Array.isArray(s.crews)) s.crews = [];
  return s;
}

let state = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const saved = JSON.parse(raw); return migrate({ ...fresh(), ...saved, version: saved.version || 0 }); }
  } catch {}
  return migrate(fresh());
}
function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}
function save() {
  saveLocal();
  publishMe();
  queueCloudSave();
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const round2 = (n) => Math.round(n * 100) / 100;
const usd = (n, cents = true) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
const dur = (ms) => {
  const m = Math.round(ms / 60000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const shortDate = (t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function until(t) {
  const ms = t - Date.now();
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.floor((ms % HOUR) / 60000);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${Math.max(1, m)}m`;
}
const paydayLabel = (short = false) => {
  const p = nextPayday(Date.now());
  const day = new Date(p).toLocaleDateString([], { weekday: short ? 'short' : 'long' });
  const at = new Date(p).toLocaleTimeString([], { hour: 'numeric', minute: new Date(p).getMinutes() ? '2-digit' : undefined });
  return short ? `Payday ${day} ${at}, ${until(p)}` : `Payday ${day} at ${at}, ${until(p)}`;
};

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function words(n) {
  if (n === 0) return 'zero';
  const under1000 = (x) => {
    let out = [];
    if (x >= 100) { out.push(`${ONES[Math.floor(x / 100)]} hundred`); x %= 100; }
    if (x >= 20) { out.push(TENS[Math.floor(x / 10)] + (x % 10 ? `-${ONES[x % 10]}` : '')); }
    else if (x > 0) out.push(ONES[x]);
    return out.join(' ');
  };
  const parts = [];
  if (n >= 1e6) { parts.push(`${under1000(Math.floor(n / 1e6))} million`); n %= 1e6; }
  if (n >= 1000) { parts.push(`${under1000(Math.floor(n / 1000))} thousand`); n %= 1000; }
  if (n > 0) parts.push(under1000(n));
  return parts.join(' ');
}
const checkWords = (amt) => {
  const d = Math.floor(amt), c = Math.round((amt - d) * 100);
  const w = words(d);
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} and ${String(c).padStart(2, '0')}/100 dollars`;
};

/* ------------------------------------------------------------------ */
/* Derived numbers                                                     */
/* ------------------------------------------------------------------ */

const sorted = () => [...state.sessions].sort((a, b) => a.start - b.start);
const totalHours = () => state.sessions.reduce((s, x) => s + (x.end - x.start), 0) / HOUR;
const liveMs = () => (state.clockedInAt ? Date.now() - state.clockedInAt : 0);
const currentRate = () => rankFor(totalHours()).rate;
const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];
const homeById = (id) => HOMES.find((h) => h.id === id) || HOMES[0];
const pendingPay = () => round2(state.sessions.filter((s) => !s.paid).reduce((a, s) => a + s.earned, 0));
const undeposited = () => state.checks.filter((c) => !c.deposited);

function msBetween(from, to) {
  let ms = 0;
  for (const s of state.sessions) ms += Math.max(0, Math.min(s.end, to) - Math.max(s.start, from));
  if (state.clockedInAt) ms += Math.max(0, Math.min(Date.now(), to) - Math.max(state.clockedInAt, from));
  return ms;
}
const completedWeekMs = () => {
  const w = startOfWeek();
  return state.sessions.reduce((a, s) => a + Math.max(0, s.end - Math.max(s.start, w)), 0);
};

/* ------------------------------------------------------------------ */
/* UI bits                                                             */
/* ------------------------------------------------------------------ */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// In-page confirm (browser confirm() is blocked in some embeds).
function ask(message, okLabel) {
  const d = $('#confirm');
  $('#confirm-msg').textContent = message;
  $('#confirm-ok').textContent = okLabel;
  d.returnValue = '';
  d.showModal();
  return new Promise((res) => d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true }));
}

let shownBalance = null;
function renderBalance(animate = false) {
  const target = state.balance;
  const els = $$('[data-bind="balance"]');
  if (!animate || shownBalance === null || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    shownBalance = target;
    els.forEach((el) => (el.textContent = usd(target)));
    return;
  }
  const from = shownBalance, t0 = performance.now(), D = 900;
  els.forEach((el) => el.classList.add('bump'));
  const step = (now) => {
    const k = Math.min(1, (now - t0) / D);
    const v = from + (target - from) * (1 - Math.pow(1 - k, 3));
    els.forEach((el) => (el.textContent = usd(v)));
    if (k < 1) requestAnimationFrame(step);
    else { shownBalance = target; els.forEach((el) => el.classList.remove('bump')); }
  };
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------------ */
/* Clock in / out                                                      */
/* ------------------------------------------------------------------ */

function clockIn() {
  if (state.clockedInAt) return;
  state.clockedInAt = Date.now();
  state.task = $('#task-input').value.trim();
  save();
  renderAll();
}

function clockOut() {
  if (!state.clockedInAt) return;
  const start = state.clockedInAt, end = Date.now();
  const before = rankFor(totalHours());
  const rate = before.rate;
  const earned = round2(((end - start) / HOUR) * rate);
  state.sessions.push({ id: `${start}`, start, end, task: state.task, rate, earned, paid: false });
  state.clockedInAt = null;
  const task = state.task;
  state.task = '';
  $('#task-input').value = '';
  save();
  const after = rankFor(totalHours());
  showReceipt({ start, end, task, rate, earned, promoted: after.name !== before.name ? after : null });
  renderAll();
}

const toggleClock = () => (state.clockedInAt ? clockOut() : clockIn());

function showReceipt({ start, end, task, rate, earned, promoted }) {
  $('#stub-date').textContent = `${shortDate(start)}, ${time(start)}–${time(end)}`;
  $('#stub-task').textContent = task || 'Untitled shift';
  $('#stub-hours').textContent = dur(end - start);
  $('#stub-rate').textContent = `${usd(rate, false)}/hr`;
  $('#stub-paid').textContent = usd(earned);
  $('#stub-week').textContent = usd(pendingPay());
  $('#stub-payday').textContent = `${paydayLabel()}.`;
  const promo = $('#stub-promo');
  promo.hidden = !promoted;
  if (promoted) promo.textContent = `Promoted to ${promoted.name}. Your rate is now ${usd(promoted.rate, false)}/hr.`;
  $('#stub').showModal();
}

/* ------------------------------------------------------------------ */
/* Payday                                                              */
/* ------------------------------------------------------------------ */

function issueCheck(list, payday, from) {
  const no = 1001 + state.checks.length;
  const gross = round2(list.reduce((a, s) => a + s.earned, 0));
  const ms = list.reduce((a, s) => a + s.end - s.start, 0);
  list.forEach((s) => { s.paid = true; s.checkNo = no; });
  state.checks.push({ no, payday, from, gross, ms, shifts: list.map((s) => s.id), deposited: false });
}

function processPaydays() {
  let p = nextPayday(state.lastPayday);
  let issued = false;
  while (p <= Date.now()) {
    const unpaid = state.sessions.filter((s) => !s.paid && s.end <= p);
    if (unpaid.length) { issueCheck(unpaid, p, state.lastPayday); issued = true; }
    state.lastPayday = p;
    p = nextPayday(p);
  }
  if (issued) save();
  return issued;
}

let checkOpenNo = null;
function openCheck(c) {
  if (!c) return;
  checkOpenNo = c.no;
  $('#check-no').textContent = c.no;
  $('#check-date').textContent = new Date(c.payday).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  $('#check-name').textContent = state.name || 'You';
  $('#check-amount').textContent = usd(c.gross);
  $('#check-words').textContent = checkWords(c.gross);
  const shifts = c.shifts.length;
  $('#check-memo').textContent = `${shortDate(c.from)}–${shortDate(c.payday)}, ${dur(c.ms)} over ${shifts} shift${shifts === 1 ? '' : 's'}`;
  $('#check').showModal();
}

function deposit(no) {
  const c = state.checks.find((x) => x.no === no);
  if (!c || c.deposited) return;
  c.deposited = true;
  state.balance = round2(state.balance + c.gross);
  save();
  renderBalance(true);
  toast(`Deposited ${usd(c.gross)}. Time to go shopping.`);
  renderAll();
}

$('#check').addEventListener('close', () => {
  if ($('#check').returnValue === 'deposit' && checkOpenNo != null) deposit(checkOpenNo);
  checkOpenNo = null;
});
$('#check-banner-open').addEventListener('click', () => openCheck(undeposited()[0]));
$('#bank-deposit').addEventListener('click', () => openCheck(undeposited()[0]));


/* ------------------------------------------------------------------ */
/* Rendering: clock screen                                             */
/* ------------------------------------------------------------------ */

let lastSceneKey = '';
function renderSceneIfChanged() {
  const key = `${state.equipped.home}|${state.equipped.car}|${!!state.clockedInAt}`;
  if (key === lastSceneKey) return;
  lastSceneKey = key;
  renderScene(homeById(state.equipped.home), carById(state.equipped.car), { working: !!state.clockedInAt }).draw($('#scene'));
  $('#place-home').textContent = homeById(state.equipped.home).name;
  $('#place-car').textContent = carById(state.equipped.car).name;
}

let lastTimer = '', lastOn = null;
function renderClock() {
  const on = !!state.clockedInAt;
  const ms = liveMs();
  const rate = currentRate();
  $('#clock-panel').classList.toggle('on', on);
  const t = clock(ms);
  $('#timer').textContent = t;
  if (t !== lastTimer || on !== lastOn) {
    lastTimer = t; lastOn = on;
    dotText($('#timer-canvas'), t, on
      ? { cell: 12, gap: 2, pad: 1, color: '#f2b54a', ghost: 'rgba(242,181,74,0.08)', glow: 12 }
      : { cell: 12, gap: 2, pad: 1, color: '#5b6069', ghost: 'rgba(255,255,255,0.04)' });
  }
  $('#shift-earned').textContent = usd((ms / HOUR) * rate);
  $('#shift-rate').textContent = `this shift at ${usd(rate, false)}/hr`;
  $('#clock-status-text').textContent = on ? `On the clock since ${time(state.clockedInAt)}` : 'Off the clock';
  $('#punch-label').textContent = on ? 'Clock out' : 'Clock in';
  const input = $('#task-input');
  input.disabled = on;
  if (on) input.value = state.task || '';
  document.title = on ? `${t} · cLOCK IN` : 'cLOCK IN';
  $('#stat-pending').textContent = usd(pendingPay() + (ms / HOUR) * rate);
}

function renderStats() {
  $('#stat-today').textContent = dur(msBetween(startOfDay(), Infinity));
  $('#stat-week').textContent = dur(msBetween(startOfWeek(), Infinity));
  $('#stat-payday').textContent = paydayLabel(true);
  const hrs = totalHours();
  const r = rankFor(hrs), n = nextRank(hrs);
  $('#stat-rank').textContent = r.name;
  if (n) {
    $('#rank-bar').style.width = `${Math.min(100, ((hrs - r.hours) / (n.hours - r.hours)) * 100)}%`;
    const left = n.hours - hrs;
    $('#rank-next').textContent = `${left < 1 ? `${Math.ceil(left * 60)}m` : `${left.toFixed(1)}h`} to ${n.name}`;
  } else {
    $('#rank-bar').style.width = '100%';
    $('#rank-next').textContent = 'Top of the ladder';
  }
  const waiting = undeposited();
  $('#check-banner').hidden = !waiting.length;
  if (waiting.length) {
    const sum = round2(waiting.reduce((a, c) => a + c.gross, 0));
    $('#check-banner-text').textContent = waiting.length === 1
      ? `It's payday. Your paycheck for ${usd(sum)} is ready to deposit.`
      : `You have ${waiting.length} paychecks waiting, ${usd(sum)} in total.`;
  }
}

function renderChart() {
  const days = [];
  const today = startOfDay();
  for (let i = 6; i >= 0; i--) {
    const from = today - i * DAY;
    days.push({ from, ms: msBetween(from, from + DAY) });
  }
  const max = Math.max(2 * HOUR, ...days.map((d) => d.ms));
  $('#week-total').textContent = `${dur(days.reduce((s, d) => s + d.ms, 0))} total`;
  $('#chart').innerHTML = days
    .map((d, i) => {
      const label = new Date(d.from).toLocaleDateString([], { weekday: 'short' });
      return `<div class="col${i === 6 ? ' today' : ''}" title="${label}: ${dur(d.ms)}">
        <span class="col-val">${d.ms ? (d.ms / HOUR).toFixed(1) : ''}</span>
        <div class="col-track"><i style="height:${(d.ms / max) * 100}%"></i></div>
        <span class="col-label">${i === 6 ? 'Today' : label}</span>
      </div>`;
    })
    .join('');
}

function shiftRow(s, removable = false) {
  return `<li class="shift">
    <div class="shift-main">
      <strong>${esc(s.task || 'Untitled shift')}</strong>
      <span class="muted">${time(s.start)}–${time(s.end)}${s.paid ? '' : ' <span class="tag">Pending</span>'}</span>
    </div>
    <span class="shift-dur">${dur(s.end - s.start)}</span>
    <span class="money-pos">+${usd(s.earned)}</span>
    ${removable ? `<button class="icon-btn" data-remove="${s.id}" aria-label="Remove shift">×</button>` : ''}
  </li>`;
}

function renderRecent() {
  const list = sorted().slice(-4).reverse();
  $('#recent').innerHTML = list.length
    ? list.map((s) => shiftRow(s)).join('')
    : `<li class="empty">Your shifts show up here. Clock in to start your first one.</li>`;
}

/* ------------------------------------------------------------------ */
/* Rendering: pay page                                                 */
/* ------------------------------------------------------------------ */

function renderPay() {
  const groups = new Map();
  for (const s of sorted().reverse()) {
    const k = dayKey(s.start);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  const lifetime = state.checks.reduce((a, c) => a + c.gross, 0);
  $('#bank-pending').textContent = usd(pendingPay());
  $('#bank-payday').textContent = paydayLabel(true).replace(/^Payday /, '');
  $('#bank-lifetime').textContent = usd(lifetime);
  const waiting = undeposited();
  $('#bank-waiting').hidden = !waiting.length;
  if (waiting.length) {
    const sum = round2(waiting.reduce((a, c) => a + c.gross, 0));
    $('#bank-waiting-text').textContent = waiting.length === 1
      ? `Paycheck for ${usd(sum)} waiting to be deposited.`
      : `${waiting.length} paychecks, ${usd(sum)} in total, waiting to be deposited.`;
  }
  $('#shifts-count').textContent = `${state.sessions.length} total, ${totalHours().toFixed(1)}h`;
  $('#shift-days').innerHTML = groups.size
    ? [...groups.values()]
        .map((list) => {
          const ms = list.reduce((a, s) => a + s.end - s.start, 0);
          const label = new Date(list[0].start).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
          return `<section class="day"><div class="day-head"><h3>${label}</h3><span class="muted">${dur(ms)}</span></div>
            <ul class="shift-list">${list.map((s) => shiftRow(s, true)).join('')}</ul></section>`;
        })
        .join('')
    : `<p class="empty">Clock in to start your first shift. Each one lands here, then on Friday's paycheck.</p>`;

  const checks = [...state.checks].reverse();
  $('#checks-sub').textContent = checks.length ? `${checks.length} so far` : '';
  $('#check-list').innerHTML = checks.length
    ? checks
        .map((c) => `<li class="check-row">
          <div class="shift-main">
            <strong>No. ${c.no}, ${shortDate(c.payday)}</strong>
            <span class="muted">${dur(c.ms)}, ${c.shifts.length} shift${c.shifts.length === 1 ? '' : 's'}</span>
          </div>
          <span class="money-pos">${usd(c.gross)}</span>
          ${c.deposited ? '<span class="muted small">Deposited</span>' : `<button class="tile-btn buy small" data-open-check="${c.no}">Deposit</button>`}
        </li>`)
        .join('')
    : `<li class="empty">Your first paycheck arrives on payday with everything you earned that week.</li>`;
}

/* ------------------------------------------------------------------ */
/* Rendering: shop                                                     */
/* ------------------------------------------------------------------ */

let shopTab = 'homes';
const tileCache = new Map();
function renderShop() {
  $$('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === shopTab)));
  const isCar = shopTab === 'cars';
  const items = isCar ? CARS : HOMES.filter((h) => h.city === 'pgh');
  const slot = isCar ? 'car' : 'home';
  const tiles = $('#tiles');
  tiles.className = `tiles ${shopTab}`;
  tiles.innerHTML = items
    .map((it) => {
      const owned = state.owned[slot].includes(it.id);
      const equipped = state.equipped[slot] === it.id;
      const afford = state.balance >= it.price;
      let btn;
      if (equipped) btn = `<button class="tile-btn" disabled>Equipped</button>`;
      else if (owned) btn = `<button class="tile-btn" data-equip="${it.id}">Equip</button>`;
      else
        btn = `<button class="tile-btn buy" data-buy="${it.id}" ${afford ? '' : 'disabled'}>${
          afford ? `Buy for ${usd(it.price, false)}` : `${usd(it.price - state.balance, false)} more`
        }</button>`;
      return `<article class="tile${equipped ? ' equipped' : ''}">
        <div class="tile-art" style="--tile:${it.tile}"><canvas data-art="${slot}:${it.id}"></canvas>${
          it.hood ? `<span class="tile-hood">${it.hood}</span>` : ''}</div>
        <div class="tile-body">
          <div class="tile-title"><h3>${it.name}</h3><span class="price">${it.price ? usd(it.price, false) : 'Starter'}</span></div>
          <p class="muted">${it.blurb}</p>
          ${btn}
        </div>
      </article>`;
    })
    .join('');
  $$('canvas[data-art]', tiles).forEach((cv) => {
    const [kind, id] = cv.dataset.art.split(':');
    const key = cv.dataset.art;
    if (!tileCache.has(key)) tileCache.set(key, kind === 'car' ? renderCarSide(carById(id)) : renderHomeTile(homeById(id)));
    tileCache.get(key).draw(cv);
  });
  $('#cities').innerHTML = isCar ? '' : `<h2>More cities</h2><div class="city-row">${CITIES.filter((c) => !c.open)
    .map((c) => `<div class="city"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>
      <div><strong>${c.name}</strong><span class="muted">${c.unlock}</span></div></div>`).join('')}</div>`;
}

/* ------------------------------------------------------------------ */
/* Friends (crews on the Vercel API, see js/social.js and api/crew.js)  */
/* ------------------------------------------------------------------ */

let crewInfo = new Map(); // code -> { name, size } for every crew I'm in
const crewData = new Map(); // code -> { name, members } for crews I've opened
let crewStatus = 'idle'; // idle | loading | on | error (for the crew on screen)
let crewError = '';
let pendingInvite = null; // crew code from an invite link
let addingCrew = false; // showing "start or join" while already in a crew
let busy = false;
const sceneCache = new Map();

const activeCrew = () => (state.crews.includes(state.activeCrew) ? state.activeCrew : state.crews[0] || null);
const crewLabel = (code) => crewInfo.get(code)?.name || crewData.get(code)?.name || `Crew ${prettyCode(code)}`;

function myCard() {
  return {
    name: state.name || '',
    home: state.equipped.home,
    car: state.equipped.car,
    title: rankFor(totalHours()).name,
    hours: round2(totalHours()),
    weekHours: round2(completedWeekMs() / HOUR),
    weekStart: startOfWeek(),
    clockedInAt: state.clockedInAt || null,
    task: state.clockedInAt ? state.task || '' : '',
  };
}

function gotCrew(code, crew) {
  const members = crew.members || [];
  crewData.set(code, { name: crew.name || '', members });
  crewInfo.set(code, { name: crew.name || '', size: members.length });
  crewStatus = 'on';
  crewError = '';
  if (currentUser() && !members.some((m) => m.id === currentUser().id)) lostCrew(code, `You’re no longer in ${crewLabel(code)}.`);
}

function lostCrew(code, message) {
  state.crews = state.crews.filter((c) => c !== code);
  if (state.activeCrew === code) state.activeCrew = state.crews[0] || null;
  crewData.delete(code);
  crewInfo.delete(code);
  crewStatus = 'idle';
  save();
  if (message) toast(message);
}

function handleCrewError(code, e) {
  if (e.status === 404 || e.status === 403) lostCrew(code, e.message);
  else { crewStatus = crewData.has(code) ? 'on' : 'error'; crewError = e.message; }
}

// The server knows which crews I'm in (another device may have joined or left one).
async function syncCrewList() {
  if (!currentUser()) return;
  try {
    const { crews } = await crewApi.mine();
    crewInfo = new Map(crews.map((c) => [c.code, { name: c.name, size: c.size }]));
    const codes = crews.map((c) => c.code);
    if (codes.join() !== state.crews.join()) {
      state.crews = codes;
      if (!codes.includes(state.activeCrew)) state.activeCrew = codes[0] || null;
      save();
    }
  } catch {}
}

async function refreshCrew() {
  const code = activeCrew();
  if (!code || !currentUser()) return;
  if (!crewData.has(code)) { crewStatus = 'loading'; if (view === 'friends') renderFriends(); }
  try { gotCrew(code, await crewApi.get(code)); }
  catch (e) { handleCrewError(code, e); }
  if (view === 'friends') renderFriends();
}

async function openFriends() {
  renderFriends();
  await syncCrewList();
  if (view === 'friends') renderFriends();
  refreshCrew();
}

// Publish my card to all my crews when it changes (debounced; skipped when nothing changed).
let lastPublished = '';
let publishTimer = null;
function publishMe() {
  if (!state.crews.length || !currentUser()) return;
  clearTimeout(publishTimer);
  publishTimer = setTimeout(async () => {
    const card = myCard();
    const json = JSON.stringify(card);
    if (json === lastPublished || !state.crews.length) return;
    lastPublished = json;
    try { await crewApi.updateAll(card); }
    catch { lastPublished = ''; }
  }, 800);
}

function needName() {
  const input = $('#crew-name');
  const name = input.value.trim().slice(0, 24);
  if (!name) { input.focus(); toast('Add your name first, so friends know it’s you.'); return null; }
  state.name = name;
  return name;
}

async function crewAction(fn, done) {
  if (busy) return;
  busy = true;
  $$('#crew-create, #crew-join').forEach((b) => (b.disabled = true));
  try {
    const crew = await fn();
    if (!state.crews.includes(crew.code)) state.crews.push(crew.code);
    state.activeCrew = crew.code;
    pendingInvite = null;
    addingCrew = false;
    gotCrew(crew.code, crew);
    save();
    lastPublished = JSON.stringify(myCard());
    $('#crew-new-name').value = '';
    $('#crew-code').value = '';
    toast(done(crew.code));
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
    $$('#crew-create, #crew-join').forEach((b) => (b.disabled = false));
    renderAll();
  }
}

$('#crew-create').addEventListener('click', () => {
  if (!needName()) return;
  const name = $('#crew-new-name').value;
  crewAction(() => crewApi.create(myCard(), name), (c) => `${crewLabel(c)} is ready. Copy the invite link and send it to a friend.`);
});

$('#crew-join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = normCode($('#crew-code').value);
  if (!code) { $('#crew-code').focus(); toast('Crew codes are 6 letters and numbers, like K7M-PQ2.'); return; }
  if (!needName()) return;
  crewAction(() => crewApi.join(code, myCard()), (c) => `You joined ${crewLabel(c)}.`);
});

$('#crew-cancel').addEventListener('click', () => {
  addingCrew = false;
  pendingInvite = null;
  renderFriends();
});

$('#crew-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-crew]');
  if (tab) {
    state.activeCrew = tab.dataset.crew;
    addingCrew = false;
    pendingInvite = null;
    saveLocal();
    renderFriends();
    refreshCrew();
  } else if (e.target.closest('[data-add-crew]')) {
    addingCrew = true;
    renderFriends();
    $('#crew-new-name').focus();
  }
});

$('#crew-copy').addEventListener('click', async () => {
  const link = `${location.origin}${location.pathname}#join-${activeCrew()}`;
  try {
    await navigator.clipboard.writeText(link);
    toast(`Invite link for ${crewLabel(activeCrew())} copied. Send it to a friend.`);
  } catch {
    toast(`Send this link to a friend: ${link}`);
  }
});

$('#crew-leave').addEventListener('click', async () => {
  const code = activeCrew();
  const label = crewLabel(code);
  if (!(await ask(`Leave ${label}? You can rejoin later with the code ${prettyCode(code)}.`, 'Leave crew'))) return;
  try { await crewApi.leave(code); } catch {}
  lostCrew(code);
  toast(`You left ${label}.`);
  renderAll();
});

$('#crew-title').addEventListener('change', async (e) => {
  const code = activeCrew();
  const name = e.target.value.trim();
  try {
    gotCrew(code, await crewApi.rename(code, name));
    toast(name ? `Crew renamed to ${name}.` : 'Crew name cleared.');
  } catch (err) {
    toast(err.message);
  }
  renderFriends();
});
$('#crew-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

$('#nickname').addEventListener('change', (e) => {
  state.name = e.target.value.trim().slice(0, 24);
  save();
  renderAll();
  toast(state.name ? `Friends will see you as ${state.name}.` : 'Name cleared.');
});

const liveWeekHours = (c) => {
  const wk = startOfWeek();
  let h = c.weekStart === wk ? Number(c.weekHours) || 0 : 0;
  if (c.clockedInAt) h += Math.max(0, Date.now() - Math.max(c.clockedInAt, wk)) / HOUR;
  return h;
};

function friendScene(c) {
  const key = `${c.home}|${c.car}|${!!c.clockedInAt}`;
  if (!sceneCache.has(key)) sceneCache.set(key, renderScene(homeById(c.home), carById(c.car), { working: !!c.clockedInAt }));
  return sceneCache.get(key);
}

function renderCrewTabs(code, adding) {
  $('#crew-tabs').innerHTML = state.crews
    .map((c) => {
      const size = crewInfo.get(c)?.size;
      return `<button type="button" class="crew-tab" data-crew="${c}" aria-pressed="${!adding && c === code}">
        <span>${esc(crewLabel(c))}</span>${size ? `<span class="crew-tab-n" aria-label="${size} people">${size}</span>` : ''}</button>`;
    })
    .join('') + `<button type="button" class="crew-tab add" data-add-crew aria-pressed="${adding}">+ New crew</button>`;
}

function renderFriends() {
  const box = $('#friends');
  const signedIn = !!currentUser();
  const code = activeCrew();
  const showStart = signedIn && (!code || addingCrew || !!pendingInvite);
  $('#crew-tabs').hidden = !signedIn || !state.crews.length;
  $('#crew-start').hidden = !showStart;
  $('#crew-bar').hidden = !signedIn || showStart || !code;

  if (!cloudAvailable()) {
    $('#friends-sub').textContent = 'See your crew’s places and who’s on the clock right now.';
    box.innerHTML = `<div class="panel empty-panel"><h2>Friends works on the live site</h2>
      <p class="muted">Open cLOCK IN from its Vercel address to start or join a crew.</p></div>`;
    return;
  }
  if (!signedIn) {
    $('#friends-sub').textContent = 'See your crew’s places and who’s on the clock right now.';
    box.innerHTML = `<div class="panel empty-panel"><h2>Sign in to use Friends</h2>
      <p class="muted">${pendingInvite ? `You've been invited to crew ${prettyCode(pendingInvite)}. ` : ''}Friends see each other through their accounts. Signing in also backs up your progress.</p>
      <button class="punch small" type="button" data-signin>Sign in or create an account</button></div>`;
    return;
  }

  if (state.crews.length) renderCrewTabs(code, showStart);

  if (showStart) {
    const name = $('#crew-name');
    if (document.activeElement !== name) name.value = state.name || '';
    const invite = $('#crew-invite');
    invite.hidden = !pendingInvite;
    if (pendingInvite) {
      invite.textContent = `You've been invited to crew ${prettyCode(pendingInvite)}. Add your name and press Join.`;
      if (!$('#crew-code').value) $('#crew-code').value = prettyCode(pendingInvite);
    }
    $('#crew-cancel').hidden = !state.crews.length;
    $('#friends-sub').textContent = state.crews.length
      ? 'Start another crew or join one. Each crew is its own group with its own invite link.'
      : 'Start a crew or join a friend’s. Then you’ll see each other’s places and who’s on the clock.';
    box.innerHTML = '';
    return;
  }

  $('#crew-code-label').textContent = prettyCode(code);
  const title = $('#crew-title');
  title.placeholder = `Crew ${prettyCode(code)}`;
  if (document.activeElement !== title) title.value = crewInfo.get(code)?.name || crewData.get(code)?.name || '';
  const nick = $('#nickname');
  if (document.activeElement !== nick) nick.value = state.name || '';

  const data = crewData.get(code);
  if (!data && crewStatus === 'error') {
    box.innerHTML = `<div class="panel empty-panel"><h2>Can’t load this crew</h2><p class="muted">${esc(crewError)}</p>
      <button class="ghost-btn" type="button" data-retry>Try again</button></div>`;
    return;
  }
  if (!data) {
    box.innerHTML = `<p class="empty">Loading ${esc(crewLabel(code))}…</p>`;
    return;
  }

  const me = currentUser().id;
  const byId = new Map(data.members.map((c) => [c.id, c]));
  byId.set(me, { id: me, ...myCard() });
  const cards = [...byId.values()].sort((a, b) => liveWeekHours(b) - liveWeekHours(a));
  $('#friends-sub').textContent = cards.length > 1
    ? `${cards.length} people in ${crewLabel(code)}, ranked by hours this week.`
    : 'Just you so far. Copy the invite link and send it to a friend.';
  box.innerHTML = cards
    .map((c, i) => {
      const isMe = c.id === me;
      const name = (isMe ? state.name : c.name) || (isMe ? 'You' : 'Someone');
      const home = homeById(c.home), car = carById(c.car);
      return `<article class="friend${c.clockedInAt ? ' on' : ''}${isMe ? ' me' : ''}">
        <div class="friend-art"><canvas data-scene="${esc(c.id)}"></canvas><span class="friend-rank">${i + 1}</span></div>
        <div class="friend-body">
          <div class="friend-name"><h3>${esc(name)}</h3>${isMe ? '<span class="tag">You</span>' : ''}</div>
          <p class="muted">${esc(c.title || 'Intern')}, ${esc(home.name)}</p>
          <p class="friend-status" data-status="${esc(c.id)}"></p>
          <dl class="friend-stats">
            <div><dt>This week</dt><dd data-week="${esc(c.id)}"></dd></div>
            <div><dt>All time</dt><dd>${(Number(c.hours) || 0).toFixed(1)}h</dd></div>
            <div><dt>Drives</dt><dd>${esc(car.name)}</dd></div>
          </dl>
        </div>
      </article>`;
    })
    .join('');
  for (const c of cards) {
    const cv = box.querySelector(`canvas[data-scene="${CSS.escape(c.id)}"]`);
    if (cv) friendScene(c).draw(cv);
  }
  friendsView = cards;
  tickFriends();
}

$('#friends').addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) refreshCrew();
  if (e.target.closest('[data-signin]')) openAccount();
});

let friendsView = [];
function tickFriends() {
  for (const c of friendsView) {
    const st = document.querySelector(`[data-status="${CSS.escape(c.id)}"]`);
    const wk = document.querySelector(`[data-week="${CSS.escape(c.id)}"]`);
    const card = c.id === currentUser()?.id ? { ...c, ...myCard() } : c;
    if (st) {
      st.innerHTML = card.clockedInAt
        ? `<span class="pulse on" aria-hidden="true"></span> On the clock ${clock(Date.now() - card.clockedInAt)}${card.task ? `, on ${esc(card.task)}` : ''}`
        : '<span class="pulse" aria-hidden="true"></span> Off the clock';
    }
    if (wk) wk.textContent = dur(liveWeekHours(card) * HOUR);
  }
}

/* ------------------------------------------------------------------ */
/* Account and cloud saves (see js/cloud.js, api/auth.js, api/save.js)  */
/* ------------------------------------------------------------------ */

let syncStatus = 'idle'; // idle | saving | saved | offline | error
let dirty = false; // local changes not yet in the cloud
let syncTimer = null;
let syncing = null;

const hasProgress = (s) => (s.sessions || []).length > 0 || s.balance > 0 || (s.checks || []).length > 0;

function setSync(st) {
  syncStatus = st;
  renderAccount();
}

// Replace the local save (from the cloud or a merge) without triggering another upload.
function applyState(next) {
  const uid = currentUser()?.id || null;
  state = migrate({ ...fresh(), ...next, version: next.version || 0 });
  state.owner = uid;
  saveLocal();
  lastSceneKey = '';
  crewData.clear();
  lastPublished = '';
  processPaydays();
  renderAll();
}

function queueCloudSave() {
  if (!currentUser() || !cloudAvailable()) return;
  dirty = true;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushSave, 1500);
  if (syncStatus !== 'saving') setSync('saving');
}

async function pushSave() {
  if (!currentUser()) return;
  if (syncing) { await syncing; if (dirty) return pushSave(); return; }
  syncing = (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const meta = getMeta();
      try {
        state.owner = currentUser().id;
        const res = await cloudSave.put(state, meta.userId === currentUser().id ? meta.version || 0 : 0);
        setMeta({ userId: currentUser().id, version: res.version });
        dirty = false;
        setSync('saved');
        return;
      } catch (e) {
        if (e.status === 409 && e.current?.data) {
          // Another device saved first: keep its save, add back any shifts only this device has.
          applyState(mergeSaves(e.current.data, state));
          setMeta({ userId: currentUser().id, version: e.current.version });
          continue;
        }
        setSync(e.status === 0 ? 'offline' : 'error');
        return;
      }
    }
  })();
  try { await syncing; } finally { syncing = null; }
}

// Bring this browser up to date with the account's save.
async function pullSave() {
  const user = currentUser();
  if (!user || !cloudAvailable()) return;
  if (dirty) return pushSave();
  try {
    const remote = await cloudSave.get();
    const meta = getMeta();
    if (!remote.data) {
      // Nothing in the cloud yet: this browser's progress becomes the account's first save.
      if (state.owner && state.owner !== user.id) applyState(fresh());
      setMeta({ userId: user.id, version: 0 });
      dirty = true;
      return pushSave();
    }
    if (meta.userId === user.id && meta.version === remote.version && state.owner === user.id) { setSync('saved'); return; }
    const firstTimeHere = state.owner !== user.id;
    const keepLocal = firstTimeHere && !state.owner && hasProgress(state); // progress made before signing in
    applyState(keepLocal ? mergeSaves(remote.data, state) : remote.data);
    setMeta({ userId: user.id, version: remote.version });
    if (keepLocal) { dirty = true; await pushSave(); } else setSync('saved');
    if (firstTimeHere) toast(keepLocal ? 'Signed in. Your saved progress is loaded, plus shifts from this browser.' : 'Signed in. Your saved progress is loaded.');
  } catch (e) {
    setSync(e.status === 0 ? 'offline' : 'error');
  }
}

/* ---------- account dialog ---------- */

let accountMode = 'signin'; // signin | signup
function openAccount(mode = 'signin') {
  if (!cloudAvailable()) { toast('Accounts work on the live site. Open cLOCK IN from its Vercel address.'); return; }
  accountMode = mode;
  renderAccountDialog();
  $('#account-error').hidden = true;
  $('#account').showModal();
  $('#account-email').focus();
}

function renderAccountDialog() {
  const up = accountMode === 'signup';
  $('#account-title').textContent = up ? 'Create your account' : 'Sign in';
  $('#account-lede').textContent = up
    ? 'Your progress in this browser comes with you. After this, it’s saved to your account automatically.'
    : 'Pick up where you left off, on any device.';
  $('#account-submit').textContent = up ? 'Create account' : 'Sign in';
  $('#account-password').autocomplete = up ? 'new-password' : 'current-password';
  $('#account-password').placeholder = up ? 'At least 8 characters' : '';
  $('#account-switch').textContent = up ? 'Already have an account? Sign in' : 'New here? Create an account';
}

$('#account-switch').addEventListener('click', () => {
  accountMode = accountMode === 'signup' ? 'signin' : 'signup';
  $('#account-error').hidden = true;
  renderAccountDialog();
});
$('#account-cancel').addEventListener('click', () => $('#account').close());

$('#account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#account-email').value.trim();
  const password = $('#account-password').value;
  const btn = $('#account-submit');
  btn.disabled = true;
  $('#account-error').hidden = true;
  try {
    const user = accountMode === 'signup' ? await signUp(email, password) : await signIn(email, password);
    $('#account').close();
    $('#account-password').value = '';
    if (state.owner && state.owner !== user.id) setMeta({});
    await pullSave();
    if (accountMode === 'signup') toast(`Account created. Your progress is backed up to ${user.email}.`);
    renderAll();
    if (view === 'friends') openFriends();
  } catch (err) {
    $('#account-error').textContent = err.message;
    $('#account-error').hidden = false;
  } finally {
    btn.disabled = false;
  }
});

async function signOut() {
  const ok = await ask('Sign out? Your progress stays saved in your account. This browser starts fresh until you sign in again.', 'Sign out');
  if (!ok) return;
  if (dirty) await pushSave();
  signOutLocal();
  state = fresh();
  saveLocal();
  crewData.clear();
  crewInfo.clear();
  lastSceneKey = '';
  dirty = false;
  setSync('idle');
  renderAll();
  toast('Signed out.');
}

/* ---------- account UI ---------- */

function syncLabel() {
  return { saving: 'Saving…', saved: 'Backed up', offline: 'Offline. Will retry.', error: 'Couldn’t back up. Will retry.', idle: '' }[syncStatus];
}

function renderAccount() {
  const user = currentUser();
  const live = cloudAvailable();
  // rail
  const rail = $('#rail-account');
  rail.hidden = !live;
  if (live) {
    rail.innerHTML = user
      ? `<span class="acct-email" title="${esc(user.email)}">${esc(user.email)}</span>
         <span class="acct-sync ${syncStatus}"><i aria-hidden="true"></i>${syncLabel()}</span>
         <button class="text-btn" type="button" data-signout>Sign out</button>`
      : `<span class="muted">Progress only lives in this browser.</span>
         <button class="ghost-btn" type="button" data-signin>Sign in to back up</button>`;
  }
  // dashboard banner (signed out)
  $('#backup-banner').hidden = !live || !!user;
  // pay page panel
  const pay = $('#account-panel');
  pay.hidden = !live;
  if (live) {
    pay.innerHTML = user
      ? `<div><h2>Account</h2><p class="muted">Signed in as ${esc(user.email)}. <span class="acct-sync ${syncStatus}"><i aria-hidden="true"></i>${syncLabel()}</span></p>
           <div class="email-row">
             <label class="toggle"><input type="checkbox" id="payday-emails" ${state.paydayEmails !== false ? 'checked' : ''} /><span>Email me on payday</span></label>
             <button class="text-btn" type="button" data-test-email>Send me a test email</button>
           </div></div>
         <button class="ghost-btn" type="button" data-signout>Sign out</button>`
      : `<div><h2>Account</h2><p class="muted">Your progress only lives in this browser. Create an account to back it up and use it on other devices.</p></div>
         <button class="punch small" type="button" data-signin>Back up my progress</button>`;
  }
}

document.addEventListener('click', (e) => {
  const signin = e.target.closest('[data-signin], [data-signup]');
  if (signin) { openAccount(signin.hasAttribute('data-signup') || hasProgress(state) ? 'signup' : 'signin'); return; }
  if (e.target.closest('[data-signout]')) signOut();
});

document.addEventListener('change', (e) => {
  if (e.target.id !== 'payday-emails') return;
  state.paydayEmails = e.target.checked;
  save();
  toast(state.paydayEmails ? `You’ll get an email at ${currentUser()?.email} every payday.` : 'Payday emails are off.');
});
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-test-email]');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  try {
    const r = await api('POST', '/api/payday', { action: 'test' });
    toast(`Test email sent to ${r.to}. It can take a minute to arrive.`);
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
  }
});

window.addEventListener('online', () => { if (dirty) pushSave(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pullSave(); });

/* ------------------------------------------------------------------ */
/* Greeting, brand, routing                                            */
/* ------------------------------------------------------------------ */

function renderGreeting() {
  const h = new Date().getHours();
  const hi = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#greeting').textContent = state.name ? `${hi}, ${state.name}` : hi;
  $('#today-date').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function drawBrandMark() {
  const P = new Pix(12, 12);
  const ring = hex('#f2b54a'), hand = hex('#ecebe6');
  P.disc(6, 6, 5, (x, y) => (x * x + y * y >= 16 ? ring : null));
  P.line(6, 6, 6, 3, hand);
  P.line(6, 6, 8, 7, hand);
  P.draw($('#brand-mark'));
  dotText($('#brand-word'), 'cLOCK IN', { cell: 3, gap: 0, color: '#ecebe6' });
}

function renderAll() {
  renderClock();
  renderSceneIfChanged();
  renderStats();
  renderChart();
  renderRecent();
  renderBalance();
  renderGreeting();
  renderAccount();
  if (view === 'shop') renderShop();
  if (view === 'shifts') renderPay();
  if (view === 'friends') renderFriends();
}

let view = 'dashboard';
function route() {
  const invite = /^#join-([A-Za-z0-9-]{6,7})$/.exec(location.hash);
  if (invite) {
    const code = normCode(invite[1]);
    if (code && state.crews.includes(code)) state.activeCrew = code;
    else if (code) pendingInvite = code;
    history.replaceState(null, '', '#friends');
  }
  const v = (location.hash || '#dashboard').slice(1);
  view = ['dashboard', 'shop', 'shifts', 'friends'].includes(v) ? v : 'dashboard';
  $$('.view').forEach((el) => (el.hidden = el.id !== `view-${view}`));
  $$('.nav a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.view === view));
  if (view === 'shop') renderShop();
  if (view === 'shifts') renderPay();
  if (view === 'friends') openFriends();
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

$('#punch').addEventListener('click', toggleClock);
$('#task-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); clockIn(); }
});
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return;
  if (e.target.closest('input, textarea, button, a, select, summary, dialog')) return;
  if (view !== 'dashboard') return;
  e.preventDefault();
  toggleClock();
});

$$('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => { shopTab = b.dataset.tab; renderShop(); }));

$('#tiles').addEventListener('click', (e) => {
  const slot = shopTab === 'cars' ? 'car' : 'home';
  const items = slot === 'car' ? CARS : HOMES;
  const buy = e.target.closest('[data-buy]');
  const equip = e.target.closest('[data-equip]');
  if (buy) {
    const it = items.find((x) => x.id === buy.dataset.buy);
    if (state.balance < it.price) return;
    state.balance = round2(state.balance - it.price);
    state.owned[slot].push(it.id);
    state.equipped[slot] = it.id;
    save();
    toast(`You bought the ${it.name} for ${usd(it.price, false)}. It's at your place now.`);
    renderAll();
  } else if (equip) {
    const it = items.find((x) => x.id === equip.dataset.equip);
    state.equipped[slot] = it.id;
    save();
    toast(`Equipped the ${it.name}.`);
    renderAll();
  }
});

$('#shift-days').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-remove]');
  if (!b) return;
  const s = state.sessions.find((x) => x.id === b.dataset.remove);
  if (!s) return;
  const c = s.paid ? state.checks.find((x) => x.no === s.checkNo) : null;
  const msg = !s.paid
    ? `Remove this shift? ${usd(s.earned)} comes off this week's pay.`
    : c && !c.deposited
      ? `Remove this shift? ${usd(s.earned)} comes off check No. ${c.no}.`
      : `Remove this shift? It was already paid, so ${usd(s.earned)} comes out of your balance.`;
  if (!(await ask(msg, 'Remove shift'))) return;
  state.sessions = state.sessions.filter((x) => x !== s);
  if (c) {
    c.shifts = c.shifts.filter((id) => id !== s.id);
    c.ms -= s.end - s.start;
    if (c.deposited) state.balance = round2(state.balance - s.earned);
    else c.gross = round2(c.gross - s.earned);
  }
  save();
  renderAll();
  toast('Shift removed.');
});

$('#check-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-open-check]');
  if (b) openCheck(state.checks.find((c) => c.no === Number(b.dataset.openCheck)));
});

$('#dev-add').addEventListener('click', () => {
  const end = state.clockedInAt ? state.clockedInAt - 1000 : Date.now();
  const start = end - HOUR;
  const rate = currentRate();
  state.sessions.push({ id: `${start}`, start, end, task: 'Test shift', rate, earned: rate, paid: false });
  save();
  renderAll();
  toast(`Added a 1-hour test shift. ${usd(rate)} goes on this week's pay.`);
});
$('#dev-payday').addEventListener('click', () => {
  const unpaid = state.sessions.filter((s) => !s.paid);
  if (!unpaid.length) { toast('Nothing pending to pay out. Add a shift first.'); return; }
  issueCheck(unpaid, Date.now(), state.lastPayday);
  save();
  renderAll();
  openCheck(state.checks[state.checks.length - 1]);
});
$('#dev-cash').addEventListener('click', () => {
  state.balance += 1000;
  save();
  renderAll();
  toast('Added $1,000 for testing.');
});
$('#dev-reset').addEventListener('click', async () => {
  if (!(await ask('Reset all shifts, pay, and purchases in this browser?', 'Reset everything'))) return;
  const name = state.name;
  state = fresh();
  state.name = name;
  save();
  lastSceneKey = '';
  renderAll();
  toast('Everything is reset.');
});

window.addEventListener('hashchange', route);
window.addEventListener('storage', (e) => {
  if (e.key === KEY) { state = load(); lastSceneKey = ''; renderAll(); }
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

drawBrandMark();
processPaydays();
save(); // persist any migration
route();
renderAll();
pullSave().then(publishMe);
if (undeposited().length) openCheck(undeposited()[0]);

setInterval(() => {
  if (state.clockedInAt) renderClock();
  if (view === 'friends' && state.crews.length) tickFriends();
}, 1000);
// Check on the crew every 15 seconds while the Friends page is open.
setInterval(() => {
  if (view === 'friends' && state.crews.length && document.visibilityState === 'visible') refreshCrew();
}, 15000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && view === 'friends') openFriends();
});
setInterval(() => {
  if (processPaydays()) { renderAll(); if (!$('#check').open) openCheck(undeposited()[0]); }
  renderStats();
  renderChart();
}, 30000);
