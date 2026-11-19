// Procedural pixel art for cars, homes, and the "your place" scene.
import { Pix, Iso, hex, shade, mix, hash } from './pixel.js';

const C = {
  tire: hex('#1d1e21'),
  rim: hex('#8d939b'),
  hub: hex('#4a4e55'),
  glass: hex('#6f8597'),
  glassHi: hex('#a9bccb'),
  glassDark: hex('#2b3441'),
  lamp: hex('#f7e3a1'),
  tail: hex('#c8463c'),
  rust: [hex('#7a4a2f'), hex('#9b5a35'), hex('#6a3f29')],
  moss: [hex('#55703c'), hex('#6d8b48'), hex('#86a557'), hex('#46602f')],
  lit: hex('#f2b54a'),
  litHi: hex('#ffd68a'),
  litDim: hex('#c98a2e'),
  shadow: hex('#000000'),
  concrete: hex('#8a8c8b'),
  concreteHi: hex('#a4a59f'),
  asphalt: hex('#4b4e54'),
  grass: hex('#5f7d45'),
  dirt: hex('#5b4535'),
  water: hex('#5fa3b5'),
  trunk: hex('#5a4030'),
};

const moss = (n) => C.moss[Math.floor(n * C.moss.length) % C.moss.length];

/* ------------------------------------------------------------------ */
/* Side-view cars (shop tiles)                                         */
/* ------------------------------------------------------------------ */

export function renderCarSide(car, scale = 1) {
  const P = new Pix(56, 28);
  const gy = 22;
  if (car.kind === 'bike') return drawBikeSide(P, car, gy);

  const body = hex(car.color);
  const len = car.len;
  const x0 = Math.floor((P.w - len) / 2);
  const x1 = x0 + len - 1;
  const wr = car.wheelR || 3;
  const bodyTop = gy - wr - car.bodyH;
  const bodyBot = gy - 2;
  const wheels = [x0 + wr + 2, x1 - wr - 2];
  const seed = car.id.length * 7;

  // ground shadow
  for (let x = x0 + 1; x <= x1 - 1; x++) P.set(x, gy + 1, C.shadow, 0.28);
  for (let x = x0 + 3; x <= x1 - 3; x++) P.set(x, gy + 2, C.shadow, 0.12);

  // body
  for (let y = bodyTop; y <= bodyBot; y++) {
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1;
      if ((y === bodyTop || y === bodyBot) && edge) continue;
      if (car.round && y === bodyTop && (x === x0 + 1 || x === x1 - 1)) continue;
      let c = body;
      if (y === bodyTop) c = shade(body, 0.22);
      if (y >= bodyBot - 1) c = shade(body, -0.28);
      if (edge && y > bodyTop + 1) c = shade(body, -0.12);
      if (car.stripe && y === bodyTop + 2) c = hex(car.stripe);
      P.set(x, y, c);
    }
  }
  // bumpers
  for (let y = bodyBot - 2; y <= bodyBot - 1; y++) {
    P.set(x0, y, hex('#3a3c40'));
    P.set(x1, y, hex('#3a3c40'));
  }
  P.set(x1, bodyTop + 1, C.lamp);
  P.set(x1 - 1, bodyTop + 1, shade(C.lamp, -0.2));
  P.set(x0, bodyTop + 1, C.tail);

  // cabin
  const cs = x0 + Math.floor(len * car.cab[0]);
  const ce = x0 + Math.floor(len * car.cab[1]);
  const rh = car.roofH;
  const rs = car.rearSlope ?? 1;
  const fs = car.frontSlope ?? 1;
  const mid = Math.floor((cs + ce) / 2) + (car.pillarShift || 0);
  for (let t = 0; t < rh; t++) {
    const y = bodyTop - rh + t;
    const l = cs + (rh - 1 - t) * rs;
    const r = ce - (rh - 1 - t) * fs;
    for (let x = l; x <= r; x++) {
      let c = body;
      const inner = t >= 1 && x > l && x < r;
      if (t === 0) c = shade(body, 0.18);
      else if (inner && x !== mid) {
        c = C.glass;
        if ((x - l + t) % 7 === 2) c = C.glassHi;
      }
      P.set(x, y, c);
    }
  }

  // side intake and rear wing (Vela cars)
  if (car.intake) {
    const ix = x0 + Math.floor(len * car.cab[1]) + 1;
    for (let x = ix; x < ix + 4; x++) P.set(x, bodyTop + 2 + (x - ix > 1 ? 1 : 0), shade(body, -0.45));
  }
  if (car.wing) {
    const wy = bodyTop - 3;
    for (let x = x0 - 1; x <= x0 + 5; x++) P.set(x, wy, x === x0 - 1 ? hex('#1c1d20') : shade(body, 0.1));
    for (let x = x0; x <= x0 + 5; x++) P.set(x, wy + 1, hex('#1c1d20'));
    for (const px of [x0 + 1, x0 + 4]) for (let y = wy + 2; y < bodyTop; y++) P.set(px, y, hex('#2a2b2e'));
  }

  // rust & moss
  if (car.rust) {
    for (let y = bodyTop; y <= bodyBot; y++)
      for (let x = x0; x <= x1; x++)
        if (P.d[(y * P.w + x) * 4 + 3] && hash(x, y, seed) < car.rust * (y > bodyBot - 3 ? 1.6 : 0.5))
          P.set(x, y, C.rust[Math.floor(hash(y, x) * 3)]);
  }
  if (car.moss) {
    for (let x = cs; x <= ce; x++) {
      const y = bodyTop - rh;
      if (hash(x, seed) < car.moss) P.set(x, y, moss(hash(x, 3)));
      if (hash(x, seed, 2) < car.moss * 0.6) P.set(x, y - 1, moss(hash(x, 4)));
      if (hash(x, seed, 5) < car.moss * 0.4) P.set(x, y + 1, moss(hash(x, 5)));
    }
    for (let x = x0; x <= x1; x++) if (hash(x, seed, 9) < car.moss * 0.5) P.set(x, bodyTop, moss(hash(x, 6)));
    for (let x = x0 - 3; x <= x1 + 3; x++) {
      if (hash(x, seed, 11) < 0.55) P.set(x, gy, moss(hash(x, 7)));
      if (hash(x, seed, 12) < 0.25) P.set(x, gy - 1, moss(hash(x, 8)));
    }
  }
  if (car.plant) {
    const px = cs + 3, py = bodyTop - rh - 1;
    [[0, 0], [0, -1], [0, -2], [-1, -2], [1, -1], [2, -2], [-2, -1], [1, -3], [-1, -3], [0, -4]].forEach(([dx, dy], i) =>
      P.set(px + dx, py + dy, C.moss[i % 4]));
    P.set(px, py - 5, hex('#c0503e'));
  }

  // wheels
  for (const wx of wheels) {
    const wy = gy - wr;
    P.disc(wx, wy, wr + 1, (dx, dy) => (dy < -1 ? hex('#141416') : null));
    P.disc(wx, wy, wr, (dx, dy) => {
      const d = dx * dx + dy * dy;
      if (d <= 1) return C.hub;
      if (d <= (wr - 1) * (wr - 1)) return car.goldRims ? hex('#c9a24a') : C.rim;
      return C.tire;
    });
  }
  return P;
}

function drawBikeSide(P, car, gy) {
  const frame = hex(car.color);
  const wr = 5;
  const a = 17, b = 38;
  const wy = gy - wr;
  for (let x = a - 6; x <= b + 6; x++) P.set(x, gy + 1, C.shadow, 0.22);
  for (const wx of [a, b]) {
    P.disc(wx, wy, wr, (dx, dy) => {
      const d = dx * dx + dy * dy;
      if (d >= (wr - 1) * (wr - 1)) return C.tire;
      if (d <= 1) return C.hub;
      if (dx === 0 || dy === 0) return shade(C.rim, -0.2);
      return null;
    });
  }
  const crank = [27, wy];
  const seat = [24, wy - 8];
  const head = [34, wy - 8];
  P.line(a, wy, crank[0], crank[1], frame);
  P.line(a, wy, seat[0], seat[1], frame);
  P.line(seat[0], seat[1], crank[0], crank[1], frame);
  P.line(seat[0], seat[1], head[0], head[1], frame);
  P.line(crank[0], crank[1], head[0], head[1], frame);
  P.line(head[0], head[1], b, wy, frame);
  P.line(head[0], head[1], head[0] - 1, head[1] - 3, hex('#3a3c40'));
  P.line(head[0] - 2, head[1] - 3, head[0] + 1, head[1] - 3, hex('#3a3c40'));
  P.rect(seat[0] - 2, seat[1] - 2, 4, 1, hex('#2a2b2e'));
  P.line(seat[0], seat[1] - 1, seat[0], seat[1], hex('#3a3c40'));
  // basket
  P.rect(head[0] + 1, head[1] - 2, 4, 3, hex('#a07a4f'));
  P.set(head[0] + 2, head[1] - 1, hex('#7d5c38'));
  P.set(head[0] + 4, head[1] - 1, hex('#7d5c38'));
  P.set(crank[0], crank[1], hex('#2a2b2e'));
  return P;
}

/* ------------------------------------------------------------------ */
/* Isometric cars (scene)                                              */
/* ------------------------------------------------------------------ */

function drawIsoCar(iso, car, x, y, z) {
  const P = iso.pix;
  const body = hex(car.color);
  if (car.kind === 'bike') {
    const [sx, sy] = iso.p(x + 2, y + 1, z);
    const f = body;
    P.set(sx - 3, sy + 1, C.tire); P.set(sx - 4, sy + 1, C.tire); P.set(sx - 3, sy, C.tire);
    P.set(sx + 3, sy - 2, C.tire); P.set(sx + 4, sy - 2, C.tire); P.set(sx + 3, sy - 3, C.tire);
    P.line(sx - 3, sy - 1, sx + 3, sy - 4, f);
    P.line(sx - 1, sy - 3, sx, sy - 1, f);
    P.set(sx + 3, sy - 6, hex('#3a3c40'));
    P.set(sx - 1, sy - 4, hex('#2a2b2e'));
    return;
  }
  const L = car.isoLen || 7;
  const W = 3;
  // shadow
  for (let i = -1; i <= L; i++)
    for (let j = -1; j <= W; j++) {
      const [sx, sy] = iso.p(x + i, y + j, z);
      P.set(sx, sy, C.shadow, 0.25);
      P.set(sx + 1, sy, C.shadow, 0.25);
    }
  // wheels
  for (const [i, j] of [[1, W], [L - 2, W], [1, 0], [L - 2, 0]]) {
    const [sx, sy] = iso.p(x + i, y + j, z);
    P.rect(sx - 1, sy - 2, 3, 2, C.tire);
  }
  const bh = car.kind === 'van' ? 2 : 2;
  iso.box(x, y, z + 1, L, W, bh, {
    top: shade(body, 0.08),
    left: shade(body, -0.12),
    right: shade(body, -0.32),
    leftFn: (u, v) => (u === L - 1 && v === bh - 1 ? C.lamp : null),
    rightFn: (u, v) => (v === bh - 1 && (u === 0 || u === W - 1) ? C.lamp : null),
  });
  const cs = Math.round(L * car.cab[0]);
  const ce = Math.round(L * car.cab[1]);
  const ch = car.kind === 'van' ? 3 : car.kind === 'sport' ? 1 : 2;
  iso.box(x + cs, y, z + 1 + bh, Math.max(2, ce - cs), W, ch, {
    top: shade(body, 0.16),
    left: C.glass,
    right: C.glassDark,
    leftFn: (u, v) => (v === ch - 1 && u % 3 === 1 ? C.glassHi : null),
  });
  if (car.wing) {
    iso.box(x, y, z + 1 + bh + 1, 1, W, 1, { top: hex('#1c1d20'), left: shade(body, -0.2), right: hex('#1c1d20') });
  }
  if (car.moss) {
    const [sx, sy] = iso.p(x + cs + 1, y + 1, z + 1 + bh + ch);
    for (let i = 0; i < 6; i++) if (hash(i, 77) < car.moss + 0.3) P.set(sx + i - 2, sy + (i % 2), moss(hash(i, 2)));
  }
}

/* ------------------------------------------------------------------ */
/* Homes                                                               */
/* ------------------------------------------------------------------ */

// Window pattern for a wall of length `len`.
function windows(len, h, o) {
  const period = o.period || 3;
  const floorH = o.floorH || 5;
  const winH = o.winH || 3;
  const winW = o.winW || 1;
  const sill = o.sill ?? 1;
  const ground = o.groundFloor ?? floorH;
  return (u, v) => {
    if (u < 1 || u > len - 2) return null;
    if (v < ground) return null;
    const vv = v - ground;
    const fv = vv % floorH;
    const fu = (u - 1) % period;
    if (fu >= winW || fv < sill || fv >= sill + winH) return null;
    if (v + 1 >= h) return null;
    const id = hash(Math.floor((u - 1) / period), Math.floor(vv / floorH), o.seed || 1);
    const lit = id < o.litRatio;
    if (lit) return fv === sill + winH - 1 ? C.litHi : fv === sill ? C.litDim : C.lit;
    return fv === sill + winH - 1 ? shade(C.glassDark, 0.25) : C.glassDark;
  };
}

// Combine wall functions: first non-null wins.
const layer = (...fns) => (u, v, sx, sy) => {
  for (const f of fns) {
    if (!f) continue;
    const c = f(u, v, sx, sy);
    if (c) return c;
  }
  return null;
};

const vines = (h, density, seed) => (u, v) => {
  const n = hash(u, seed, 31);
  if (n > density) return null;
  const len = Math.floor(hash(u, seed, 32) * h * 0.7) + 2;
  if (v >= h - len) return moss(hash(u, v, seed));
  return null;
};

const grime = (base, seed, amt = 0.08) => (u, v) =>
  hash(u, v, seed, 4) < amt ? shade(base, -0.08) : null;

const roofMoss = (density, seed) => (wx, wy) => {
  const cell = hash(Math.floor(wx / 2), Math.floor(wy / 2), seed);
  if (cell < density) return moss(hash(Math.floor(wx), Math.floor(wy), seed));
  return null;
};

function drawTree(iso, x, y, z, r = 4, seed = 1) {
  const P = iso.pix;
  const [sx, sy] = iso.p(x, y, z);
  P.rect(sx - 2, sy - 1, 5, 2, C.shadow, 0.25);
  for (let i = 0; i < r + 2; i++) {
    P.set(sx, sy - i, C.trunk);
    P.set(sx + 1, sy - i, shade(C.trunk, -0.2));
  }
  const cy = sy - r - 4;
  P.disc(sx, cy, r, (dx, dy) => {
    const n = hash(dx, dy, seed);
    const lightness = (-dx - dy) / (r * 2);
    if (n < 0.08) return C.moss[3];
    if (lightness > 0.25) return n < 0.5 ? C.moss[2] : C.moss[1];
    if (lightness < -0.25) return n < 0.5 ? C.moss[3] : C.moss[0];
    return n < 0.4 ? C.moss[0] : C.moss[1];
  });
}

function drawLamp(iso, x, y, z, on) {
  const P = iso.pix;
  const [sx, sy] = iso.p(x, y, z);
  for (let i = 0; i < 12; i++) P.set(sx, sy - i, hex('#3b3e44'));
  P.set(sx + 1, sy - 11, hex('#3b3e44'));
  P.set(sx + 2, sy - 11, on ? C.litHi : hex('#6b6e73'));
  P.set(sx + 2, sy - 10, on ? C.lit : hex('#55585d'));
  if (on) {
    for (let dy = -2; dy <= 6; dy++)
      for (let dx = -4; dx <= 8; dx++) {
        const d = Math.hypot(dx - 2, (dy - 1) * 1.4);
        if (d < 6 && !(dx === 2 && (dy === -1 || dy === 0))) P.set(sx + dx, sy - 10 + dy + 2, C.lit, 0.12 * (1 - d / 6));
      }
  }
}

function acUnit(iso, x, y, z) {
  iso.box(x, y, z, 2, 2, 2, { top: hex('#b9bcbe'), leftFn: (u, v) => (v === 1 ? hex('#7d8185') : null) });
}

/**
 * Draws a home with its footprint starting at world (X, Y, Z).
 * light: 0..1 share of windows lit. Returns extra lot features (e.g. pool).
 */
export function drawHome(iso, home, X, Y, Z, light) {
  const s = home.seed || 3;
  const wall = hex(home.color);
  switch (home.art) {
    case 'dorm': {
      const A = 9, B = 7, H = 13;
      iso.box(X, Y, Z, A, B, H, {
        top: hex('#8f8a82'),
        left: wall,
        right: shade(wall, -0.25),
        leftFn: layer(windows(A, H, { seed: s, litRatio: light, period: 3, floorH: 5, groundFloor: 4 }),
          (u, v) => (u >= 3 && u <= 4 && v < 4 ? (v === 3 ? hex('#4b3a2c') : hex('#6b4f38')) : null),
          grime(wall, s)),
        rightFn: layer(windows(B, H, { seed: s + 1, litRatio: light, period: 3, groundFloor: 4 }), grime(shade(wall, -0.25), s)),
        topFn: roofMoss(0.12, s),
      });
      acUnit(iso, X + 5, Y + 2, Z + H);
      return {};
    }
    case 'studio': {
      const A = 10, B = 9, H = 19;
      iso.box(X, Y, Z, A, B, H, {
        top: hex('#9a978f'),
        left: wall,
        right: shade(wall, -0.24),
        leftFn: layer(vines(H, 0.25, s),
          windows(A, H, { seed: s, litRatio: light, period: 3, floorH: 5, winH: 3, groundFloor: 5 }),
          (u, v) => (v < 5 && u >= 1 && u <= A - 2 ? (v === 4 ? hex('#c0503e') : v === 3 ? hex('#e8d8b8') : v >= 1 && u !== 5 ? (light > 0.5 ? C.lit : C.glassDark) : hex('#3c3a38')) : null),
          grime(wall, s, 0.1)),
        rightFn: layer(vines(H, 0.3, s + 9), windows(B, H, { seed: s + 2, litRatio: light, groundFloor: 5 }), grime(shade(wall, -0.24), s)),
        topFn: roofMoss(0.45, s),
      });
      acUnit(iso, X + 1, Y + 5, Z + H);
      // solar panel
      iso.box(X + 5, Y + 1, Z + H, 4, 3, 1, { top: hex('#34465e'), topFn: (wx, wy) => (Math.floor(wx) % 2 === 0 ? hex('#3f5571') : null) });
      return {};
    }
    case 'walkup': {
      const A = 12, B = 8, H = 24;
      const fire = hex('#2b2c30');
      iso.box(X, Y, Z, A, B, H, {
        top: hex('#7d6c63'),
        left: wall,
        right: shade(wall, -0.26),
        leftFn: layer(
          // fire escape
          (u, v) => (u >= 7 && u <= 10 && v >= 6 && v < H - 2 && ((v - 5) % 5 === 0 || u === 7 || u === 10) ? fire : null),
          windows(A, H, { seed: s, litRatio: light, period: 3, floorH: 5, winH: 3, groundFloor: 5 }),
          (u, v) => (v === 5 ? ((u % 2) ? hex('#2f6b5e') : hex('#e6dfcf')) : null),
          (u, v) => (v < 5 && u >= 1 && u <= A - 2 ? (v >= 1 && v <= 3 && u !== 4 && u !== 8 ? (light > 0.5 ? C.lit : C.glassDark) : hex('#3a3331')) : null),
          (u, v) => ((u + Math.floor(v / 2)) % 4 === 0 && v % 2 === 0 ? shade(wall, -0.1) : null)),
        rightFn: layer(windows(B, H, { seed: s + 3, litRatio: light, groundFloor: 5 }),
          (u, v) => ((u + Math.floor(v / 2)) % 4 === 1 && v % 2 === 0 ? shade(wall, -0.36) : null)),
        topFn: roofMoss(0.3, s),
      });
      // water tower
      iso.box(X + 6, Y + 2, Z + H, 3, 3, 2, { top: hex('#4a4038') });
      iso.box(X + 6, Y + 2, Z + H + 2, 3, 3, 4, { top: hex('#8a6a4c'), left: hex('#7a5b3f'), right: hex('#5e4430') });
      acUnit(iso, X + 1, Y + 4, Z + H);
      return {};
    }
    case 'rowhouse': {
      // Three attached rowhouses; yours is the middle one (lit like the rest).
      const B = 9;
      const row = [
        { c: hex('#7d8a94'), H: 13, s: s + 1 },
        { c: wall, H: 15, s },
        { c: hex('#c49a4a'), H: 13, s: s + 2 },
      ];
      row.forEach((r, k) => {
        const A = 5;
        const isMine = k === 1;
        iso.box(X + k * A, Y, Z, A, B, r.H, {
          top: hex('#6f6862'),
          left: r.c,
          right: shade(r.c, -0.26),
          leftFn: layer(
            (u, v) => (u === 3 && v < 4 ? (v === 3 ? hex('#3a2f28') : isMine ? hex('#2f5d50') : hex('#5a4535')) : null),
            (u, v) => (v === r.H - 1 ? shade(r.c, 0.18) : null),
            (u, v) => (u >= 1 && u <= 2 && v >= 1 && v <= 3 ? (hash(k, s) < light + (isMine ? 0.4 : 0) ? C.lit : C.glassDark) : null),
            (u, v) => (u >= 1 && u <= 3 && ((v >= 6 && v <= 8) || (v >= 10 && v <= 12 && v < r.H - 1)) && u !== 2
              ? (hash(k, v > 9 ? 2 : 1, s) < light + (isMine ? 0.3 : 0) ? (v === 8 || v === 12 ? C.litDim : C.lit) : C.glassDark) : null),
            (u, v) => ((u + Math.floor(v / 2)) % 3 === 0 && v % 2 === 0 ? shade(r.c, -0.08) : null)),
          rightFn: k === 2 ? windows(B, r.H, { seed: r.s, litRatio: light, period: 3, floorH: 5, groundFloor: 1 }) : null,
          topFn: roofMoss(0.18, r.s),
        });
      });
      // stoop
      iso.box(X + 7, Y + B, Z, 2, 1, 1, { top: hex('#a19a90') });
      return {};
    }
    case 'townhouse': {
      const A = 12, B = 9, H = 19;
      iso.box(X, Y, Z, A, B, H, {
        top: hex('#6e6058'),
        left: wall,
        right: shade(wall, -0.26),
        leftFn: layer(
          (u, v) => (v === H - 1 || v === H - 2 ? shade(wall, 0.2) : null), // cornice
          (u, v) => (u >= 5 && u <= 6 && v < 5 ? (v === 4 ? hex('#2c2622') : hex('#1f3b33')) : null), // door
          (u, v) => (u === 4 || u === 7) && v < 5 ? hex('#e8e0d2') : null, // door trim
          windows(A, H, { seed: s, litRatio: light, period: 4, floorH: 6, winH: 4, winW: 2, groundFloor: 6, sill: 1 }),
          (u, v) => (v < 6 && v >= 1 && v <= 4 && (u === 1 || u === 2 || u === 9 || u === 10)
            ? (hash(u > 5 ? 1 : 0, s, 3) < light ? (v === 4 ? C.litHi : C.lit) : C.glassDark) : null),
          (u, v) => ((u + Math.floor(v / 2)) % 4 === 0 && v % 2 === 0 ? shade(wall, -0.09) : null)),
        rightFn: layer(windows(B, H, { seed: s + 3, litRatio: light, period: 3, floorH: 6, winH: 4, groundFloor: 0 }),
          (u, v) => ((u + Math.floor(v / 2)) % 4 === 1 && v % 2 === 0 ? shade(wall, -0.34) : null)),
        topFn: roofMoss(0.2, s),
      });
      // stoop + steps
      iso.box(X + 4, Y + B, Z, 4, 2, 1, { top: hex('#a8a197') });
      // roof deck with planters and a chimney
      iso.box(X + 2, Y + 2, Z + H, 6, 5, 1, { top: hex('#8a6a4c'), topFn: (wx) => (Math.floor(wx) % 2 ? hex('#7a5b3f') : null) });
      iso.box(X + 9, Y + 1, Z + H, 2, 2, 4, { top: hex('#4a3c35'), left: hex('#8b4a38') });
      const [px, py] = iso.p(X + 3, Y + 7, Z + H + 1);
      for (let i = 0; i < 7; i++) iso.pix.set(px + i, py - (i % 2), moss(hash(i, s)));
      return {};
    }
    case 'house': {
      const A = 12, B = 10, H = 11;
      const garage = hex('#c9c3b6');
      iso.box(X, Y, Z, A, B, H, {
        top: hex('#7f8e64'),
        left: wall,
        right: shade(wall, -0.22),
        leftFn: layer(vines(H, 0.18, s),
          (u, v) => (u >= 2 && u <= 3 && v < 5 ? (v === 4 ? hex('#3f5a73') : hex('#4f6f8c')) : null),
          windows(A, H, { seed: s, litRatio: Math.max(light, 0.2), period: 3, floorH: 5, winH: 3, winW: 2, groundFloor: 0 })),
        rightFn: windows(B, H, { seed: s + 4, litRatio: light, period: 4, floorH: 5, winW: 2, groundFloor: 0 }),
        topFn: (wx, wy) => (wx > 1 && wx < A - 1 && wy > 1 && wy < B - 1 ? roofMoss(0.75, s)(wx, wy) || hex('#6c7a52') : hex('#a6a094')),
      });
      // garage
      iso.box(X + A, Y + 2, Z, 7, 8, 7, {
        top: hex('#9c978c'),
        left: garage,
        right: shade(garage, -0.24),
        leftFn: (u, v) => (u >= 1 && u <= 5 && v < 5 ? (v % 2 ? hex('#e3ddd0') : hex('#bdb6a8')) : null),
      });
      return {};
    }
    case 'penthouse': {
      const A = 12, B = 12, H = 48;
      iso.box(X, Y, Z, A, B, H, {
        top: hex('#6c7680'),
        left: wall,
        right: shade(wall, -0.28),
        leftFn: layer(
          (u, v) => (v < 5 && u >= 1 && u <= A - 2 ? (v >= 1 && v <= 3 ? (light > 0.4 ? C.litHi : hex('#55636f')) : hex('#3b4148')) : null),
          windows(A, H, { seed: s, litRatio: light, period: 2, floorH: 4, winH: 3, groundFloor: 5, sill: 0 })),
        rightFn: windows(B, H, { seed: s + 5, litRatio: light * 0.9, period: 2, floorH: 4, winH: 3, groundFloor: 5, sill: 0 }),
        topFn: roofMoss(0.35, s),
      });
      const penthouse = hex('#e7e3da');
      iso.box(X + 2, Y + 2, Z + H, 8, 8, 7, {
        top: hex('#7f8e64'),
        left: penthouse,
        right: shade(penthouse, -0.22),
        leftFn: (u, v) => (u >= 1 && u <= 6 && v >= 1 && v <= 5 && u !== 4 ? (light > 0.4 ? C.lit : C.glassDark) : null),
        rightFn: (u, v) => (u >= 1 && u <= 6 && v >= 1 && v <= 5 ? (light > 0.4 ? C.litDim : C.glassDark) : null),
        topFn: roofMoss(0.7, s + 1),
      });
      const [ax, ay] = iso.p(X + 4, Y + 4, Z + H + 7);
      for (let i = 0; i < 9; i++) iso.pix.set(ax, ay - i, hex('#3b3e44'));
      iso.pix.set(ax, ay - 9, C.tail);
      return {};
    }
    case 'mansion': {
      const A = 15, B = 10, H = 15;
      const roof = hex('#8b5a44');
      const colonnade = (u, v) => (v < 9 && u >= 4 && u <= 10 && u % 2 === 0 ? hex('#f4efe4') : null);
      iso.box(X, Y, Z, A, B, H, {
        top: roof,
        topFn: (wx, wy) => (Math.floor(wx + wy) % 3 === 0 ? shade(roof, -0.12) : null),
        left: wall,
        right: shade(wall, -0.2),
        leftFn: layer(colonnade,
          (u, v) => (u >= 6 && u <= 8 && v < 6 ? (v === 5 ? hex('#5d3a2a') : hex('#7a4b33')) : null),
          (u, v) => (v === 9 ? shade(wall, 0.15) : null),
          windows(A, H, { seed: s, litRatio: Math.max(light, 0.3), period: 3, floorH: 5, winH: 4, groundFloor: 0, sill: 1 })),
        rightFn: windows(B, H, { seed: s + 6, litRatio: light, period: 3, floorH: 5, winH: 4, groundFloor: 0 }),
      });
      // east wing
      iso.box(X + A, Y + 2, Z, 6, 8, 10, {
        top: roof,
        left: wall,
        right: shade(wall, -0.2),
        leftFn: windows(6, 10, { seed: s + 7, litRatio: light, period: 2, floorH: 5, winH: 3, groundFloor: 0 }),
        rightFn: windows(8, 10, { seed: s + 8, litRatio: light, period: 3, floorH: 5, winH: 3, groundFloor: 0 }),
      });
      // chimney
      iso.box(X + 3, Y + 2, Z + H, 2, 2, 4, { top: hex('#4a3c35'), left: hex('#8b5a44') });
      return { hedges: true, trees: [[1, 12, 4], [25, 13, 3]] };
    }
  }
  return {};
}

/* ------------------------------------------------------------------ */
/* Shop tiles                                                          */
/* ------------------------------------------------------------------ */

export function renderHomeTile(home) {
  const W = 112, H = 112;
  const P = new Pix(W, H);
  const a = 26, b = 22;
  const iso = new Iso(P, W / 2 - (a - b), H - (a + b) - 6);
  iso.box(0, 0, 0, a, b, 2, {
    top: C.grass,
    topFn: (wx, wy) => (wx > a - 2 || wy > b - 2 ? C.concreteHi : hash(Math.floor(wx), Math.floor(wy), 4) < 0.1 ? C.moss[2] : null),
    left: C.dirt,
    right: shade(C.dirt, -0.25),
    rim: false,
  });
  const fit = { penthouse: [7, 5], mansion: [1, 2], house: [2, 4], walkup: [6, 6], studio: [7, 6], dorm: [8, 7], rowhouse: [4, 6], townhouse: [6, 6] }[home.art] || [4, 4];
  const extras = drawHome(iso, home, fit[0], fit[1], 2, 0.35);
  if (extras.trees) for (const [x, y, r] of extras.trees) drawTree(iso, Math.min(x, a - 2), Math.min(y, b - 2), 2, r - 1, x);
  return P;
}

/* ------------------------------------------------------------------ */
/* The scene on the dashboard                                          */
/* ------------------------------------------------------------------ */

// Pittsburgh at dusk: hills with porch lights, the downtown skyline, a river, and a yellow bridge.
function drawPittsburgh(P, working) {
  const W = P.w, H = P.h;
  const top = hex(working ? '#1b1f31' : '#1c212e');
  const bottom = hex(working ? '#3a3747' : '#323846');
  for (let y = 0; y < H; y++) {
    const c = mix(top, bottom, y / H);
    for (let x = 0; x < W; x++) P.set(x, y, c);
  }
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(hash(i, 1) * W), y = Math.floor(hash(i, 2) * 44);
    P.set(x, y, hex('#c8cbd6'), 0.2 + hash(i, 3) * 0.45);
  }
  const riverTop = 74;
  const glow = working ? 0.3 : 0.14;

  // far hills (Mount Washington style), with houses lit along the slope
  const hill = hex('#252b35');
  const hillY = (x) => riverTop - 6 - Math.round(10 * Math.sin((x + 20) / 26) + 6 * Math.sin((x + 3) / 11) + 8);
  for (let x = 0; x < W; x++) {
    const hy = hillY(x);
    for (let y = hy; y < riverTop; y++) {
      let c = hill;
      if (y > hy + 1 && hash(x, y, 41) < glow * 0.18) c = mix(hill, C.lit, 0.55);
      P.set(x, y, c);
    }
  }

  // downtown skyline, centered left of middle
  const tower = hex('#2b3140');
  const towers = [
    [34, 8, 26], [43, 6, 34], [50, 9, 22], [60, 5, 40], [66, 8, 30], [75, 7, 46], [83, 6, 28], [90, 9, 36], [100, 6, 24], [107, 7, 30],
  ];
  towers.forEach(([x0, w, h], k) => {
    const yTop = riverTop - h;
    for (let y = yTop; y < riverTop; y++)
      for (let x = x0; x < x0 + w; x++) {
        let c = k % 3 === 1 ? shade(tower, -0.15) : tower;
        if ((x - x0) % 2 === 1 && y % 3 === 0 && y > yTop + 2 && hash(x, y, 7) < glow + 0.05) c = mix(tower, C.lit, 0.5);
        P.set(x, y, c);
      }
    // glass-castle spires on one tower, a mast on another
    if (k === 5) for (let s = 0; s < w; s += 2) { P.set(x0 + s, yTop - 1, tower); P.set(x0 + s, yTop - 2, tower); P.set(x0 + s, yTop - 3, shade(tower, 0.1)); }
    if (k === 3) for (let i = 1; i < 6; i++) P.set(x0 + 2, yTop - i, tower);
    if (k === 3) P.set(x0 + 2, yTop - 6, C.tail);
  });

  // river
  const water = hex('#1f2b3a');
  for (let y = riverTop; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = mix(water, hex('#24344a'), (y - riverTop) / (H - riverTop));
      if (hash(x, y, 51) < 0.02) c = shade(c, 0.15);
      P.set(x, y, c);
    }
  // reflections of lights
  for (let x = 0; x < W; x++)
    if (hash(x, 52) < glow * 0.6)
      for (let y = riverTop + 1; y < riverTop + 4 + Math.floor(hash(x, 53) * 8); y += 2) P.set(x, y, C.lit, 0.35);

  // yellow self-anchored suspension bridge across the river
  const gold = hex('#e8b23a');
  const deckY = riverTop + 3;
  const x0 = 8, x1 = W - 8;
  const t1 = x0 + Math.floor((x1 - x0) * 0.3), t2 = x0 + Math.floor((x1 - x0) * 0.7);
  for (let x = x0; x <= x1; x++) { P.set(x, deckY, gold); P.set(x, deckY + 1, shade(gold, -0.35)); }
  for (const t of [t1, t2]) for (let y = deckY - 12; y <= deckY + 4; y++) { P.set(t, y, gold); P.set(t + 1, y, shade(gold, -0.25)); }
  const cable = (xa, xb, ya, yb, sag) => {
    for (let x = xa; x <= xb; x++) {
      const t = (x - xa) / (xb - xa);
      const y = Math.round(ya + (yb - ya) * t + sag * 4 * t * (1 - t));
      P.set(x, y, gold);
      if ((x - xa) % 3 === 0) for (let yy = y + 1; yy < deckY; yy++) P.set(x, yy, gold, 0.45);
    }
  };
  cable(x0, t1, deckY - 1, deckY - 12, 3);
  cable(t1 + 1, t2, deckY - 12, deckY - 12, 8);
  cable(t2 + 1, x1, deckY - 12, deckY - 1, 3);
  // bridge lights
  for (let x = x0 + 4; x < x1; x += 8) P.set(x, deckY - 1, working ? C.litHi : shade(gold, 0.3));
}

export function renderScene(home, car, { working = false } = {}) {
  const W = 172, H = 129;
  const P = new Pix(W, H);
  drawPittsburgh(P, working);

  const a = 28, b = 24;
  const iso = new Iso(P, W / 2 - (a - b), H - (a + b) - 9);
  const isMansion = home.art === 'mansion';
  const pool = isMansion ? [3, 14, 9, 3] : null;
  const river = !!home.river;
  const inPool = (wx, wy, pad = 0) =>
    pool && wx >= pool[0] - pad && wx < pool[0] + pool[2] + pad && wy >= pool[1] - pad && wy < pool[1] + pool[3] + pad;
  const inRiver = (wx, wy) => river && wy > 20.5 && wx < 13;
  const onDock = (wx, wy) => river && wx >= 6 && wx < 8.5 && wy > 19.5;
  iso.box(0, 0, 0, a, b, 5, {
    top: C.grass,
    topFn: (wx, wy) => {
      if (onDock(wx, wy)) return Math.floor(wy * 2) % 2 ? hex('#8a6a4c') : hex('#7a5b3f');
      if (inRiver(wx, wy)) return hash(Math.floor(wx * 2), Math.floor(wy * 2), 9) < 0.08 ? hex('#7fb4c4') : hex('#3f6f86');
      if (inPool(wx, wy)) {
        const edge = wx < pool[0] + 0.5 || wy < pool[1] + 0.5;
        return edge ? hex('#3f7f91') : hash(Math.floor(wx * 2), Math.floor(wy * 2), 8) < 0.1 ? hex('#a6d4dd') : C.water;
      }
      if (wx > a - 2.5 || wy > b - 2.5) return river && wx < 13 ? hex('#3f6f86') : C.concreteHi; // sidewalk
      if (wy > 16 && wx > 13) return wy > 17 && wx > 14 ? C.asphalt : C.concrete; // driveway
      if (inPool(wx, wy, 1)) return C.concreteHi;
      if (river && wy > 19.5 && wx < 13) return hex('#a49a83'); // little beach
      const n = hash(Math.floor(wx), Math.floor(wy), 21);
      return n < 0.08 ? C.moss[2] : n > 0.94 ? C.moss[3] : null;
    },
    left: C.dirt,
    right: shade(C.dirt, -0.25),
    leftFn: (u, v) => {
      if (river && u < 13 && v >= 2) return v === 4 ? hex('#3f6f86') : hex('#35596d');
      return v === 4 ? C.moss[1] : v === 3 && hash(u, 1) < 0.5 ? C.moss[3] : hash(u, v, 2) < 0.12 ? shade(C.dirt, 0.1) : null;
    },
    rightFn: (u, v) => (v === 4 ? C.moss[0] : v === 3 && hash(u, 2) < 0.5 ? C.moss[3] : null),
    rim: false,
  });

  const light = working ? 0.92 : 0.2;
  const extras = drawHome(iso, home, 3, 3, 5, light);
  if (!isMansion) drawTree(iso, 25, 4, 5, 4, 9);
  if (extras.trees) for (const [tx, ty, r] of extras.trees) drawTree(iso, tx, ty, 5, r, tx);
  if (extras.hedges) iso.box(1, 18, 5, 9, 1, 2, { top: C.moss[1], left: C.moss[0], right: C.moss[3] });
  if (river) {
    // a little boat at the dock
    iso.box(3, 21, 5, 3, 2, 1, { top: hex('#e9e2d2'), left: hex('#b9502f'), right: hex('#8e3c24') });
  }
  drawIsoCar(iso, car, 15, 18, 5);
  drawLamp(iso, 26, 22, 5, working);
  if (!river) drawTree(iso, 3, 21, 5, 3, 4);
  return P;
}
