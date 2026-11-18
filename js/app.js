import { CARS, HOMES, CITIES, PAYDAY, rankFor, nextRank, LEGACY_HOME, LEGACY_CAR } from './data.js';
import { renderScene, renderCarSide, renderHomeTile } from './art.js';
import { Pix, hex } from './pixel.js';
import { dotText } from './glyphs.js';
import { connect } from './social.js';

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
  return s;
}

let state = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const saved = JSON.parse(raw); return migrate({ ...fresh(), ...saved, version: saved.version || 0 }); }
  } catch {}
  return fresh();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  publishMe();
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
  $('#shifts-summary').textContent = `${usd(pendingPay())} pending for this week. ${paydayLabel()}. Lifetime pay ${usd(lifetime)}.`;
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
/* Friends                                                             */
/* ------------------------------------------------------------------ */

let social = null;
let socialState = 'connecting'; // connecting | on | off | error
let friendCards = [];
let profileNames = {};
const sceneCache = new Map();

function myCard() {
  return {
    v: 1,
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
function publishMe() {
  if (social && social.canWrite) social.publish(myCard());
}

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

function renderFriends() {
  $('#nickname').value = document.activeElement === $('#nickname') ? $('#nickname').value : state.name || '';
  const box = $('#friends');
  if (socialState !== 'on') {
    $('#friends-me').hidden = socialState === 'connecting';
    box.innerHTML = socialState === 'connecting'
      ? `<p class="empty">Looking for your friends…</p>`
      : `<div class="panel empty-panel">
          <h2>Friends need the shared page</h2>
          <p class="muted">Friends works on the cLOCK IN page on claude.ai. Share that page with a friend as an Editor. When they open it, their place shows up here, live.</p>
        </div>`;
    return;
  }
  $('#friends-me').hidden = false;
  const me = social.me;
  const byId = new Map(friendCards.map((c) => [c.id, c]));
  byId.set(me, { id: me, ...myCard() });
  const cards = [...byId.values()].sort((a, b) => liveWeekHours(b) - liveWeekHours(a));
  $('#friends-sub').textContent = cards.length > 1
    ? `${cards.length} people on this page, ranked by hours this week.`
    : 'Just you so far. Share this page with a friend as an Editor and their place shows up here.';
  box.innerHTML = cards
    .map((c, i) => {
      const isMe = c.id === me;
      const name = (isMe ? state.name : c.name) || profileNames[c.id] || (isMe ? 'You' : 'Someone');
      const home = homeById(c.home), car = carById(c.car);
      return `<article class="friend${c.clockedInAt ? ' on' : ''}${isMe ? ' me' : ''}" data-fid="${esc(c.id)}">
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

let friendsView = [];
function tickFriends() {
  for (const c of friendsView) {
    const st = document.querySelector(`[data-status="${CSS.escape(c.id)}"]`);
    const wk = document.querySelector(`[data-week="${CSS.escape(c.id)}"]`);
    const card = c.id === social?.me ? { ...c, ...myCard() } : c;
    if (st) {
      st.innerHTML = card.clockedInAt
        ? `<span class="pulse on" aria-hidden="true"></span> On the clock ${clock(Date.now() - card.clockedInAt)}${card.task ? `, on ${esc(card.task)}` : ''}`
        : '<span class="pulse" aria-hidden="true"></span> Off the clock';
    }
    if (wk) wk.textContent = dur(liveWeekHours(card) * HOUR);
  }
}

async function resolveNames() {
  if (!social) return;
  const ids = friendCards.map((c) => c.id).filter((id) => !(id in profileNames));
  if (!ids.length) return;
  const got = await social.names(ids);
  for (const id of ids) profileNames[id] = got[id] || '';
  if (view === 'friends') renderFriends();
}

async function startSocial() {
  social = await connect();
  if (!social) { socialState = 'off'; if (view === 'friends') renderFriends(); return; }
  socialState = 'on';
  if (!state.name) {
    const n = await social.myName();
    if (n && !state.name) { state.name = n.split(' ')[0]; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} renderGreeting(); if ($('#check').open) $('#check-name').textContent = state.name; }
  }
  social.subscribe(
    (cards) => { friendCards = cards; resolveNames(); if (view === 'friends') renderFriends(); },
    () => { socialState = 'error'; if (view === 'friends') renderFriends(); },
  );
  publishMe();
  if (view === 'friends') renderFriends();
}

$('#nickname').addEventListener('change', (e) => {
  state.name = e.target.value.trim().slice(0, 24);
  save();
  renderFriends();
  toast(state.name ? `Friends will see you as ${state.name}.` : 'Name cleared.');
});

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
  if (view === 'shop') renderShop();
  if (view === 'shifts') renderPay();
  if (view === 'friends') renderFriends();
}

let view = 'dashboard';
function route() {
  const v = (location.hash || '#dashboard').slice(1);
  view = ['dashboard', 'shop', 'shifts', 'friends'].includes(v) ? v : 'dashboard';
  $$('.view').forEach((el) => (el.hidden = el.id !== `view-${view}`));
  $$('.nav a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.view === view));
  if (view === 'shop') renderShop();
  if (view === 'shifts') renderPay();
  if (view === 'friends') renderFriends();
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
startSocial();
if (undeposited().length) openCheck(undeposited()[0]);

setInterval(() => {
  if (state.clockedInAt) renderClock();
  if (view === 'friends' && socialState === 'on') tickFriends();
}, 1000);
setInterval(() => {
  if (processPaydays()) { renderAll(); if (!$('#check').open) openCheck(undeposited()[0]); }
  renderStats();
  renderChart();
}, 30000);
